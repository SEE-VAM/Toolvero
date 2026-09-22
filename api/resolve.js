import cakkatrok from 'cakkatrok-instagram-downloader';
import { snapsave } from 'snapsave-media-downloader';
import { Innertube, Platform } from 'youtubei.js';

// Initialize platform shim for YouTube cipher eval
Platform.shim.eval = async (data) => new Function(data.output)();

const FALLBACK_COOKIE = '__Secure-3PAPISID=NRAApVeYSt_lt9uD/AGBsMBcEY8WvMK7Vy; APISID=pqNwouGLTy8GIMFx/AfiK4p3DhyBEJym29; SAPISID=NRAApVeYSt_lt9uD/AGBsMBcEY8WvMK7Vy; __Secure-1PAPISID=NRAApVeYSt_lt9uD/AGBsMBcEY8WvMK7Vy; _ga=GA1.1.201074170.1774367578; _ga_5JSYX2Q357=GS2.1.s1774367577$o1$g1$t1774367783$j36$l0$h0; SID=g.a000CAno0BvCwTMOPhSjW8KVEDi_nGo27vgzVw9GmTpnXcnCmm6aQgN_w7gTxIQfxei2urDHCwACgYKAa0SARISFQHGX2MiDJiWLjAPrSmJjDR_g3pNKBoVAUF8yKopLb7aW3ObFY_ogDgJTl940076; PREF=f4=4000000&f6=40000000&tz=Asia.Calcutta&f7=100&repeat=NONE&autoplay=true&volume=100&f5=20000; SIDCC=AKEyXzU_Qnj8z04AqiB-oaCGDrK15pypn8CDcSo1pL5cCR9BR2rpR6RChxVEk8dVX9sNsD5-s7dK';

async function getYT(clientType = 'ANDROID') {
  return await Innertube.create({
    client_type: clientType,
    cookie: process.env.YOUTUBE_COOKIE || FALLBACK_COOKIE,
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, platform } = req.query;
  const targetUrl = (url || '').trim();

  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    // 1. YouTube Resolution via Innertube (High-speed & reliable Android client)
    if (platform === 'youtube' || /youtube\.com|youtu\.be/.test(targetUrl)) {
      const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
      const ytId = ytMatch ? ytMatch[1] : null;

      if (!ytId) {
        return res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
      }

      try {
        let yt;
        let info;
        try {
          yt = await getYT('ANDROID');
          info = await yt.getBasicInfo(ytId);
        } catch (androidErr) {
          console.warn('ANDROID resolve failed, trying ANDROID_VR:', androidErr.message);
          yt = await getYT('ANDROID_VR');
          info = await yt.getBasicInfo(ytId);
        }

        const formats = info.streaming_data?.formats || [];
        const has720p = formats.some((f) => f.quality_label?.includes('720'));
        const directFmt = formats.find((f) => f.url || f.itag === 18);
        const title = info.basic_info.title || `YouTube Video (${ytId})`;
        const author = info.basic_info.author || 'YouTube Channel';
        const durationSec = info.basic_info.duration || 0;
        const duration = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;
        const thumbnail = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        const streamUrl = `/api/stream?ytId=${ytId}&type=mp4`;
        const audioStreamUrl = `/api/stream?ytId=${ytId}&type=mp3`;
        const estSize = directFmt?.content_length ? `${(directFmt.content_length / 1024 / 1024).toFixed(1)} MB` : 'Standard MP4';

        const streams = [];
        if (has720p) {
          streams.push({
            quality: '720p',
            label: 'HD 720p MP4 (Video + Audio)',
            format: 'mp4',
            resolution: '1280x720',
            size: 'HD',
            url: `${streamUrl}&quality=720p`
          });
        }
        streams.push(
          {
            quality: '360p',
            label: 'Standard MP4 (Video & Audio)',
            format: 'mp4',
            resolution: '640x360',
            size: estSize,
            url: streamUrl
          },
          {
            quality: 'MP3',
            label: 'Audio MP3 (320 kbps Studio Quality)',
            format: 'mp3',
            resolution: 'Audio Only',
            size: 'HQ MP3',
            url: audioStreamUrl
          },
          {
            quality: '128k',
            label: 'Audio MP3 (128 kbps Fast Download)',
            format: 'mp3',
            resolution: 'Audio Only',
            size: '128 kbps',
            url: audioStreamUrl
          }
        );

        return res.status(200).json({
          success: true,
          data: {
            id: ytId,
            title,
            author,
            duration,
            thumbnail,
            videoUrl: streamUrl,
            audioUrl: audioStreamUrl,
            directUrl: directFmt?.url || undefined,
            streams,
            platform: 'youtube',
            platformName: 'YouTube'
          }
        });
      } catch (ytErr) {
        console.warn('Innertube direct resolution failed, attempting oEmbed fallback:', ytErr.message);
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
          if (oembedRes.ok) {
            const odata = await oembedRes.json();
            return res.status(200).json({
              success: true,
              data: {
                id: ytId,
                title: odata.title || `YouTube Video (${ytId})`,
                author: odata.author_name || 'YouTube Creator',
                duration: 'YouTube Video',
                thumbnail: odata.thumbnail_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
                videoUrl: `/api/stream?ytId=${ytId}&type=mp4`,
                audioUrl: `/api/stream?ytId=${ytId}&type=mp3`,
                streams: [
                  { quality: '360p', label: 'Standard MP4 (Video & Audio)', format: 'mp4', resolution: '640x360', size: 'Standard MP4', url: `/api/stream?ytId=${ytId}&type=mp4` },
                  { quality: 'MP3', label: 'Audio MP3 (320 kbps Studio Quality)', format: 'mp3', resolution: 'Audio Only', size: 'HQ MP3', url: `/api/stream?ytId=${ytId}&type=mp3` },
                  { quality: '128k', label: 'Audio MP3 (128 kbps Fast Download)', format: 'mp3', resolution: 'Audio Only', size: '128 kbps', url: `/api/stream?ytId=${ytId}&type=mp3` }
                ],
                platform: 'youtube',
                platformName: 'YouTube'
              }
            });
          }
        } catch {}
      }
    }

    // 2. Instagram Resolution
    if (platform === 'instagram' || /instagram\.com|instagr\.am/.test(targetUrl)) {
      const reelMatch = targetUrl.match(/(?:reel|p|tv|reels)\/([a-zA-Z0-9_-]+)/);
      const reelCode = reelMatch ? reelMatch[1] : '';

      // Try snapsave first
      try {
        const snapRes = await snapsave(targetUrl);
        if (snapRes && snapRes.data && snapRes.data.media && snapRes.data.media.length > 0) {
          const firstMedia = snapRes.data.media.find((m) => m.type === 'video') || snapRes.data.media[0];
          const unwrappedUrl = unwrapCdnUrl(firstMedia.url);
          const isVideo = firstMedia.type === 'video';
          const streamUrl = `/api/stream?url=${encodeURIComponent(unwrappedUrl)}&type=mp4`;

          return res.status(200).json({
            success: true,
            data: {
              id: reelCode || Math.random().toString(36).substring(7),
              title: `Instagram ${isVideo ? 'Reel' : 'Photo'} (${reelCode || 'Media'})`,
              author: '@instagram_creator',
              duration: 'Reel',
              thumbnail: unwrapCdnUrl(firstMedia.thumbnail) || (reelCode ? `https://www.instagram.com/p/${reelCode}/media/?size=l` : ''),
              videoUrl: streamUrl,
              audioUrl: streamUrl,
              streams: [
                { quality: 'HD', label: 'Instagram HD MP4', format: 'mp4', resolution: '1080x1920', size: 'Full HD', url: streamUrl }
              ],
              platform: 'instagram',
              platformName: 'Instagram',
              isVideo
            }
          });
        }
      } catch (snapErr) {
        console.warn('Snapsave IG error:', snapErr.message);
      }

      // Fallback to cakkatrok
      try {
        const igRes = await cakkatrok(targetUrl);
        if (igRes && igRes.media && igRes.media.length > 0) {
          const firstMedia = igRes.media.find((m) => m.type === 'video') || igRes.media[0];
          const unwrappedUrl = unwrapCdnUrl(firstMedia.url);
          const isVideo = firstMedia.type === 'video';
          const streamUrl = `/api/stream?url=${encodeURIComponent(unwrappedUrl)}&type=mp4`;

          return res.status(200).json({
            success: true,
            data: {
              id: reelCode || Math.random().toString(36).substring(7),
              title: firstMedia.text || (reelCode ? `Instagram Reel (${reelCode})` : 'Instagram Media'),
              author: '@instagram_creator',
              duration: 'Reel',
              thumbnail: reelCode ? `https://www.instagram.com/p/${reelCode}/media/?size=l` : '',
              videoUrl: streamUrl,
              audioUrl: streamUrl,
              streams: [
                { quality: 'HD', label: 'Instagram HD MP4', format: 'mp4', resolution: '1080x1920', size: 'Full HD', url: streamUrl }
              ],
              platform: 'instagram',
              platformName: 'Instagram',
              isVideo
            }
          });
        }
      } catch (igErr) {
        console.warn('Cakkatrok IG error:', igErr.message);
      }
    }

    // 3. Facebook Resolution
    if (platform === 'facebook' || /facebook\.com|fb\.watch|fb\.com/.test(targetUrl)) {
      try {
        const fbRes = await snapsave(targetUrl);
        if (fbRes && fbRes.data && fbRes.data.media && fbRes.data.media.length > 0) {
          const firstMedia = fbRes.data.media.find((m) => m.type === 'video') || fbRes.data.media[0];
          const unwrappedUrl = unwrapCdnUrl(firstMedia.url);
          const streamUrl = `/api/stream?url=${encodeURIComponent(unwrappedUrl)}&type=mp4`;

          return res.status(200).json({
            success: true,
            data: {
              id: Math.random().toString(36).substring(7),
              title: 'Facebook Video',
              author: 'Facebook Creator',
              duration: 'Video',
              thumbnail: unwrapCdnUrl(firstMedia.thumbnail) || '',
              videoUrl: streamUrl,
              audioUrl: streamUrl,
              streams: [
                { quality: 'HD', label: 'Facebook HD MP4', format: 'mp4', resolution: '1080p', size: 'HD', url: streamUrl }
              ],
              platform: 'facebook',
              platformName: 'Facebook'
            }
          });
        }
      } catch (fbErr) {
        console.warn('Facebook error:', fbErr.message);
      }
    }

    // 4. TikTok Resolution
    if (platform === 'tiktok' || /tiktok\.com/.test(targetUrl)) {
      try {
        const tkRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`, {
          signal: AbortSignal.timeout(6000)
        });
        if (tkRes.ok) {
          const tkData = await tkRes.json();
          if (tkData?.data?.play) {
            const tk = tkData.data;
            const videoUrl = tk.play.startsWith('http') ? tk.play : `https://www.tikwm.com${tk.play}`;
            const audioUrl = tk.music ? (tk.music.startsWith('http') ? tk.music : `https://www.tikwm.com${tk.music}`) : undefined;
            const streamUrl = `/api/stream?url=${encodeURIComponent(videoUrl)}&type=mp4`;
            return res.status(200).json({
              success: true,
              data: {
                id: tk.id || Math.random().toString(36).substring(7),
                title: tk.title || 'TikTok Video (No Watermark)',
                author: tk.author?.unique_id ? `@${tk.author.unique_id}` : '@tiktok_user',
                duration: `${Math.floor((tk.duration || 15) / 60)}:${String((tk.duration || 15) % 60).padStart(2, '0')}`,
                thumbnail: tk.cover,
                videoUrl: streamUrl,
                audioUrl: audioUrl ? `/api/stream?url=${encodeURIComponent(audioUrl)}&type=mp3` : streamUrl,
                streams: [
                  { quality: 'HD', label: 'HD MP4 (No Watermark)', format: 'mp4', resolution: '1080x1920', size: `${((tk.size || 15000000) / 1024 / 1024).toFixed(1)} MB`, url: streamUrl },
                  { quality: 'SD', label: 'Standard MP4', format: 'mp4', resolution: '720x1280', size: 'Standard', url: streamUrl }
                ],
                platform: 'tiktok',
                platformName: 'TikTok'
              }
            });
          }
        }
      } catch {}
    }

    // 5. Twitter / X Resolution
    if (platform === 'twitter' || /twitter\.com|x\.com/.test(targetUrl)) {
      try {
        const twRes = await snapsave(targetUrl);
        if (twRes && twRes.data && twRes.data.media && twRes.data.media.length > 0) {
          const firstMedia = twRes.data.media.find((m) => m.type === 'video') || twRes.data.media[0];
          const unwrappedUrl = unwrapCdnUrl(firstMedia.url);
          const streamUrl = `/api/stream?url=${encodeURIComponent(unwrappedUrl)}&type=mp4`;
          return res.status(200).json({
            success: true,
            data: {
              id: Math.random().toString(36).substring(7),
              title: 'Twitter / X Video',
              author: '@twitter_user',
              duration: 'Clip',
              thumbnail: unwrapCdnUrl(firstMedia.thumbnail) || '',
              videoUrl: streamUrl,
              audioUrl: streamUrl,
              streams: [
                { quality: 'HD', label: 'HD MP4 Video', format: 'mp4', resolution: 'HD', size: 'HD', url: streamUrl }
              ],
              platform: 'twitter',
              platformName: 'Twitter / X'
            }
          });
        }
      } catch {}
    }

    return res.status(404).json({
      success: false,
      error: 'Could not extract direct stream for this link. The video may be private, restricted, or unavailable. Please verify the URL.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
