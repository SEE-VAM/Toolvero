import { Readable } from 'stream';
import { Innertube, Platform } from 'youtubei.js';

// Initialize platform shim for YouTube cipher eval
Platform.shim.eval = async (data) => new Function(data.output)();

let ytInstance = null;
async function getYT() {
  if (!ytInstance) {
    ytInstance = await Innertube.create({
      client_type: 'ANDROID',
      generate_session_locally: true
    });
  }
  return ytInstance;
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    // 1. YouTube streaming via Innertube (Format 18: MP4 H.264 + AAC audio)
    if (extractedYtId) {
      const yt = await getYT();
      const info = await yt.getBasicInfo(extractedYtId);
      const directFmt = (info.streaming_data?.formats || []).find((f) => f.url);

      if (directFmt && directFmt.url) {
        targetUrl = directFmt.url;
      } else {
        // Direct download stream fallback through Innertube
        const stream = await yt.download(extractedYtId, {
          type: type === 'mp3' ? 'audio' : 'video+audio',
          quality: 'best'
        });

        const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeType = type.toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
        const contentType = safeType === 'mp3' ? 'audio/mpeg' : 'video/mp4';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${safeType}"`);

        const nodeStream = Readable.from(stream);
        return nodeStream.pipe(res);
      }
    }

    if (!targetUrl) {
      return res.status(400).send('URL or ytId parameter is required.');
    }

    // 2. Unwrap SnapCDN / RapidCDN JWT tokens to direct CDN URL
    targetUrl = unwrapCdnUrl(decodeURIComponent(targetUrl));

    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Failed to stream media: ${upstreamRes.statusText}`);
    }

    const upstreamContentType = upstreamRes.headers.get('content-type') || '';

    // CRITICAL PROTECTION: Prevent HTML error page from masquerading as MP4/MP3
    if (upstreamContentType.includes('text/html')) {
      return res.status(422).send('Error: Upstream server returned a webpage instead of direct media.');
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeType = type.toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
    const contentType = safeType === 'mp3' ? 'audio/mpeg' : (upstreamContentType || 'video/mp4');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${safeType}"`);

    const clen = upstreamRes.headers.get('content-length');
    if (clen) {
      res.setHeader('Content-Length', clen);
    }

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      nodeStream.pipe(res);
    } else {
      res.status(500).send('No stream body received.');
    }
  } catch (err) {
    console.error('Streaming error:', err);
    res.status(500).send(`Streaming error: ${err.message}`);
  }
}
