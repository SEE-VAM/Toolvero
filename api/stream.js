import { Readable } from 'stream';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, filename = 'QuickVero_Media', type = 'mp4' } = req.query;
  const targetUrl = (url || '').trim();

  if (!targetUrl) {
    return res.status(400).send('URL parameter is required.');
  }

  try {
    const upstreamRes = await fetch(decodeURIComponent(targetUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Failed to stream media: ${upstreamRes.statusText}`);
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeType = type.toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
    const contentType = safeType === 'mp3' ? 'audio/mpeg' : (upstreamRes.headers.get('content-type') || 'video/mp4');

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
    res.status(500).send(`Streaming error: ${err.message}`);
  }
}
