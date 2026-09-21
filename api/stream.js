import { Readable } from 'stream';
import { Innertube, Platform } from 'youtubei.js';

// Initialize platform shim for YouTube cipher eval
Platform.shim.eval = async (data) => new Function(data.output)();

let ytMwebInstance = null;
let ytAndroidInstance = null;

async function getYT(clientType = 'MWEB') {
  if (clientType === 'MWEB') {
    if (!ytMwebInstance) {
      ytMwebInstance = await Innertube.create({
        client_type: 'MWEB',
        generate_session_locally: true
      });
    }
    return ytMwebInstance;
  }
  if (!ytAndroidInstance) {
    ytAndroidInstance = await Innertube.create({
      client_type: 'ANDROID',
      generate_session_locally: true
    });
  }
  return ytAndroidInstance;
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

  try {
    // 1. YouTube streaming via Innertube (MWEB client bypasses datacenter bot detection)
    if (extractedYtId) {
      let yt;
      let info;
      try {
        yt = await getYT('MWEB');
        info = await yt.getBasicInfo(extractedYtId);
      } catch (err) {
        console.warn('MWEB getBasicInfo failed, falling back to ANDROID:', err.message);
        yt = await getYT('ANDROID');
        info = await yt.getBasicInfo(extractedYtId);
      }

      const isAudio = type === 'mp3' || type === 'audio';
      const videoTitle = info?.basic_info?.title || extractedYtId;
      const cleanFilename = (filename && filename !== 'QuickVero_Media' ? filename : videoTitle).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeExt = isAudio ? 'm4a' : 'mp4';
      const contentType = isAudio ? 'audio/mp4' : 'video/mp4';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${safeExt}"`);

      // Stream via innertube download stream (Format 18: MP4 H.264 + AAC audio)
      const stream = await yt.download(extractedYtId, {
        type: 'video+audio',
        quality: 'best'
      });

      const nodeStream = Readable.from(stream);
      return nodeStream.pipe(res);
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL or ytId parameter is required.' });
    }

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
    res.status(500).json({ error: `Streaming error: ${err.message}` });
  }
}
