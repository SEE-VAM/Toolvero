import { Readable } from 'stream';
import { Innertube, Platform } from 'youtubei.js';

// Initialize platform shim for YouTube cipher eval
Platform.shim.eval = async (data) => new Function(data.output)();

async function getYT(clientType = 'ANDROID') {
  return await Innertube.create({
    client_type: clientType,
    cookie: process.env.YOUTUBE_COOKIE || undefined,
    generate_session_locally: true
  });
}

function unwrapCdnUrl(inputUrl) {
  if (!inputUrl) return inputUrl;
  try {
    const u = new URL(inputUrl);
    const token = u.searchParams.get('token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
        const data = JSON.parse(payload);
        if (data.url) return data.url;
      }
    }
  } catch {}
  return inputUrl;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, ytId, filename = 'QuickVero_Media', type = 'mp4' } = req.query;
  let targetUrl = (url || '').trim();
  let extractedYtId = ytId ? String(ytId).trim() : null;

  // If no ytId provided, check if url is a YouTube link
  if (!extractedYtId && targetUrl) {
    const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
    if (ytMatch) {
      extractedYtId = ytMatch[1];
    }
  }

  let debugStep = 'init';
  let innerError = null;

  try {
    // 1. YouTube streaming via Innertube (Android client bypasses datacenter bot detection)
    if (extractedYtId) {
      let yt;
      let info;
      let directStreamUrl;

      // Strategy A: ANDROID client format decipher
      try {
        debugStep = 'android_init';
        yt = await getYT('ANDROID');
        debugStep = 'android_basic_info';
        info = await yt.getBasicInfo(extractedYtId);
        debugStep = 'android_choose_format';
        const format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        if (format) {
          debugStep = 'android_decipher';
          directStreamUrl = await format.decipher(yt.session.player);
        }
      } catch (err) {
        innerError = `ANDROID failed at ${debugStep}: ${err.message}`;
        console.warn(innerError);
        try {
          debugStep = 'vr_init';
          yt = await getYT('ANDROID_VR');
          debugStep = 'vr_basic_info';
          info = await yt.getBasicInfo(extractedYtId);
          debugStep = 'vr_choose_format';
          const format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
          if (format) {
            debugStep = 'vr_decipher';
            directStreamUrl = await format.decipher(yt.session.player);
          }
        } catch (vrErr) {
          innerError += ` | VR failed at ${debugStep}: ${vrErr.message}`;
          console.warn(innerError);
        }
      }

      const isAudio = type === 'mp3' || type === 'audio' || type === '128k';
      const videoTitle = info?.basic_info?.title || extractedYtId;
      const cleanFilename = (filename && filename !== 'QuickVero_Media' ? filename : videoTitle).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeExt = isAudio ? 'm4a' : 'mp4';
      const contentType = isAudio ? 'audio/mp4' : 'video/mp4';

      // If direct stream URL is found, stream directly via high-speed fetch
      if (directStreamUrl) {
        debugStep = 'upstream_fetch';
        const upstreamHeaders = {
          'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip'
        };
        if (req.headers.range) {
          upstreamHeaders['Range'] = req.headers.range;
        }

        const upstreamRes = await fetch(directStreamUrl, { headers: upstreamHeaders });
        debugStep = `upstream_status_${upstreamRes.status}`;

        if (upstreamRes.ok || upstreamRes.status === 206) {
          res.status(upstreamRes.status);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${safeExt}"`);

          const clen = upstreamRes.headers.get('content-length');
          if (clen) res.setHeader('Content-Length', clen);
          const crange = upstreamRes.headers.get('content-range');
          if (crange) res.setHeader('Content-Range', crange);
          const acceptRanges = upstreamRes.headers.get('accept-ranges');
          if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

          debugStep = 'piping_body';
          const nodeStream = Readable.fromWeb(upstreamRes.body);
          return nodeStream.pipe(res);
        } else {
          innerError = (innerError ? innerError + ' | ' : '') + `Direct fetch returned ${upstreamRes.status}: ${upstreamRes.statusText}`;
        }
      }

      // Strategy B: Fallback to yt.download
      if (yt) {
        debugStep = 'yt.download';
        const stream = await yt.download(extractedYtId, {
          type: 'video+audio',
          quality: 'best'
        });

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${safeExt}"`);

        const nodeStream = Readable.from(stream);
        return nodeStream.pipe(res);
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL or ytId parameter is required.' });
    }

    debugStep = 'upstream';
    // 2. Unwrap SnapCDN / RapidCDN JWT tokens to direct CDN URL
    targetUrl = unwrapCdnUrl(decodeURIComponent(targetUrl));

    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    };

    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range;
    }

    const upstreamRes = await fetch(targetUrl, { headers: upstreamHeaders });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({
        error: `Failed to stream media: ${upstreamRes.statusText}`
      });
    }

    const upstreamContentType = upstreamRes.headers.get('content-type') || '';

    // CRITICAL PROTECTION: Prevent HTML error page from masquerading as MP4/MP3
    if (upstreamContentType.includes('text/html')) {
      return res.status(422).json({
        error: 'Upstream server returned a webpage instead of direct media.'
      });
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    // Ensure accurate file extension matching actual container
    const isAudioOnly = type === 'mp3' || type === 'audio';
    const safeExt = isAudioOnly && (upstreamContentType.includes('audio') || upstreamContentType.includes('mpeg')) ? 'mp3' : 'mp4';
    const contentType = upstreamContentType || (safeExt === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${safeExt}"`);

    const clen = upstreamRes.headers.get('content-length');
    if (clen) res.setHeader('Content-Length', clen);

    const crange = upstreamRes.headers.get('content-range');
    if (crange) res.setHeader('Content-Range', crange);

    const acceptRanges = upstreamRes.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      nodeStream.pipe(res);
    } else {
      res.status(500).json({ error: 'No stream body received.' });
    }
  } catch (err) {
    console.error('Streaming error:', err);
    // Never send attachment disposition on error
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: `Streaming error: ${err.message}`, step: debugStep, innerError });
  }
}
