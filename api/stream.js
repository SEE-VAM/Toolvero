import { Readable } from 'stream';
import { Innertube, Platform } from 'youtubei.js';

// Initialize platform shim for YouTube cipher eval
Platform.shim.eval = async (data) => new Function(data.output)();

const FALLBACK_COOKIE = '__Secure-3PAPISID=NRAApVeYSt_lt9uD/AGBsMBcEY8WvMK7Vy; APISID=pqNwouGLTy8GIMFx/AfiK4p3DhyBEJym29; SAPISID=NRAApVeYSt_lt9uD/AGBsMBcEY8WvMK7Vy; __Secure-1PAPISID=NRAApVeYSt_lt9uD/AGBsMBcEY8WvMK7Vy; _ga=GA1.1.201074170.1774367578; _ga_5JSYX2Q357=GS2.1.s1774367577$o1$g1$t1774367783$j36$l0$h0; SID=g.a000CAno0BvCwTMOPhSjW8KVEDi_nGo27vgzVw9GmTpnXcnCmm6aQgN_w7gTxIQfxei2urDHCwACgYKAa0SARISFQHGX2MiDJiWLjAPrSmJjDR_g3pNKBoVAUF8yKopLb7aW3ObFY_ogDgJTl940076; PREF=f4=4000000&f6=40000000&tz=Asia.Calcutta&f7=100&repeat=NONE&autoplay=true&volume=100&f5=20000; SIDCC=AKEyXzU_Qnj8z04AqiB-oaCGDrK15pypn8CDcSo1pL5cCR9BR2rpR6RChxVEk8dVX9sNsD5-s7dK';

function getEffectiveCookie() {
  const envCookie = process.env.YOUTUBE_COOKIE || '';
  if (envCookie && envCookie.includes('SID=') && envCookie.length > 200) {
    return envCookie;
  }
  return FALLBACK_COOKIE;
}

async function getYT(clientType = 'ANDROID') {
  return await Innertube.create({
    client_type: clientType,
    cookie: getEffectiveCookie(),
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
    // 1. YouTube streaming via Innertube (Multi-client fallback: MWEB, WEB, ANDROID)
    if (extractedYtId) {
      let yt;
      let info;
      let directStreamUrl;
      let successfulClient = null;

      const clientCandidates = ['MWEB', 'WEB', 'ANDROID', 'ANDROID_VR'];
      for (const clientType of clientCandidates) {
        try {
          debugStep = `${clientType}_init`;
          const currentYt = await getYT(clientType);
          let currentInfo;
          try {
            debugStep = `${clientType}_basic_info`;
            currentInfo = await currentYt.getBasicInfo(extractedYtId);
            debugStep = `${clientType}_choose_format`;
            const format = currentInfo.chooseFormat({ type: 'video+audio', quality: 'best' });
            if (format) {
              debugStep = `${clientType}_decipher`;
              const resolvedUrl = format.url || (format.signature_cipher ? await format.decipher(currentYt.session.player) : null);
              if (resolvedUrl) {
                yt = currentYt;
                info = currentInfo;
                directStreamUrl = resolvedUrl;
                successfulClient = clientType;
                break;
              }
            }
          } catch (formatErr) {
            const playability = currentInfo?.playability_status ? `${currentInfo.playability_status.status}: ${currentInfo.playability_status.reason || ''}` : 'no-info';
            throw new Error(`${formatErr.message} [playability: ${playability}]`);
          }
        } catch (clientErr) {
          innerError = (innerError ? innerError + ' | ' : '') + `${clientType} failed at ${debugStep}: ${clientErr.message}`;
          console.warn(innerError);
        }
      }

      const isAudio = type === 'mp3' || type === 'audio' || type === '128k' || type === '320k';
      const videoTitle = info?.basic_info?.title || extractedYtId;
      const rawName = (filename && filename !== 'QuickVero_Media' ? filename : videoTitle)
        .replace(/\.(mp4|mp3|m4a|webm|mov)$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanFilename = rawName || 'QuickVero_Media';
      const safeExt = isAudio ? 'm4a' : 'mp4';
      const contentType = isAudio ? 'audio/mp4' : 'video/mp4';

      // If direct stream URL is found, stream directly via high-speed fetch
      if (directStreamUrl) {
        debugStep = 'upstream_fetch';
        const userAgent = successfulClient === 'ANDROID' || successfulClient === 'ANDROID_VR'
          ? 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

        const upstreamHeaders = {
          'User-Agent': userAgent
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
          nodeStream.on('error', (err) => {
            console.error('Upstream nodeStream error:', err);
            if (!res.headersSent) res.status(500).end();
          });
          req.on('close', () => {
            nodeStream.destroy();
          });
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
        nodeStream.on('error', (err) => {
          console.error('yt.download nodeStream error:', err);
          if (!res.headersSent) res.status(500).end();
        });
        req.on('close', () => {
          nodeStream.destroy();
        });
        return nodeStream.pipe(res);
      }

      const cookieUsed = getEffectiveCookie();
      return res.status(502).json({
        error: 'Unable to stream this YouTube video right now.',
        step: debugStep,
        innerError,
        cookieInfo: {
          hasEnvCookie: !!process.env.YOUTUBE_COOKIE,
          envLen: (process.env.YOUTUBE_COOKIE || '').length,
          usedFallback: cookieUsed === FALLBACK_COOKIE,
          cookieLen: cookieUsed.length
        }
      });
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

    const rawClean = (filename || 'QuickVero_Media')
      .replace(/\.(mp4|mp3|m4a|webm|mov)$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanFilename = rawClean || 'QuickVero_Media';
    // Ensure accurate file extension matching actual container
    const isAudioOnly = type === 'mp3' || type === 'audio' || type === '128k' || type === '320k';
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
    const cookieUsed = getEffectiveCookie();
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      error: `Streaming error: ${err.message}`,
      step: debugStep,
      innerError,
      cookieInfo: {
        hasEnvCookie: !!process.env.YOUTUBE_COOKIE,
        envLen: (process.env.YOUTUBE_COOKIE || '').length,
        usedFallback: cookieUsed === FALLBACK_COOKIE,
        cookieLen: cookieUsed.length
      }
    });
  }
}
