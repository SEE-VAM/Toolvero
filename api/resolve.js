import cakkatrok from 'cakkatrok-instagram-downloader';

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si/api/v1/videos/',
  'https://inv.nadeko.net/api/v1/videos/',
  'https://invidious.tiekoetter.com/api/v1/videos/',
  'https://yt.chocolatemoo53.com/api/v1/videos/'
];

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
    // 1. YouTube Resolution
    if (platform === 'youtube' || /youtube\.com|youtu\.be/.test(targetUrl)) {
      const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
      const ytId = ytMatch ? ytMatch[1] : null;

      if (!ytId) {
        return res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
      }

      for (const base of INVIDIOUS_INSTANCES) {
        try {
          const ytRes = await fetch(`${base}${ytId}`, {
            signal: AbortSignal.timeout(6000),
            headers: { 'Accept': 'application/json' }
          });
          if (ytRes.ok) {
            const data = await ytRes.json();
            const formatStreams = data.formatStreams || [];
            const adaptive = data.adaptiveFormats || [];

            // Find best video streams
            const v1080 = adaptive.find(f => f.type && f.type.includes('video/mp4') && (f.resolution === '1080p' || f.qualityLabel === '1080p'));
            const v720 = adaptive.find(f => f.type && f.type.includes('video/mp4') && (f.resolution === '720p' || f.qualityLabel === '720p')) || formatStreams.find(f => f.resolution === '720p');
            const v360 = formatStreams.find(f => f.resolution === '360p') || adaptive.find(f => f.type && f.type.includes('video/mp4') && f.resolution === '360p');

            const bestVideo = v1080?.url || v720?.url || v360?.url || formatStreams[0]?.url || adaptive.find(f => f.type && f.type.includes('video/mp4'))?.url;
            const bestAudio = adaptive.find(a => a.type && a.type.includes('audio/mp4'))?.url || adaptive.find(a => a.type && a.type.includes('audio'))?.url;

            const streams = [];
            if (v1080?.url) {
              streams.push({ quality: '1080p', label: 'Full HD 1080p (MP4)', format: 'mp4', resolution: '1920x1080', size: '1080p', url: v1080.url });
            }
            if (v720?.url) {
              streams.push({ quality: '720p', label: 'HD 720p (MP4)', format: 'mp4', resolution: '1280x720', size: '720p', url: v720.url });
            }
            if (v360?.url) {
              streams.push({ quality: '360p', label: 'SD 360p (MP4)', format: 'mp4', resolution: '640x360', size: '360p', url: v360.url });
            }
            if (streams.length === 0 && bestVideo) {
              streams.push({ quality: 'HD', label: 'Standard MP4 Video', format: 'mp4', resolution: 'HD', size: 'MP4', url: bestVideo });
            }

            return res.status(200).json({
              success: true,
              data: {
                id: ytId,
                title: data.title || `YouTube Video (${ytId})`,
                author: data.author || 'YouTube Channel',
                duration: `${Math.floor((data.lengthSeconds || 0) / 60)}:${String((data.lengthSeconds || 0) % 60).padStart(2, '0')}`,
                thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
                videoUrl: bestVideo,
                audioUrl: bestAudio,
                streams,
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
      try {
        const igRes = await cakkatrok(targetUrl);
        if (igRes && igRes.media && igRes.media.length > 0) {
          const firstMedia = igRes.media.find(m => m.type === 'video') || igRes.media[0];
          const videoUrl = firstMedia.url;
          const isVideo = firstMedia.type === 'video';

          const reelMatch = targetUrl.match(/(?:reel|p|tv|reels)\/([a-zA-Z0-9_-]+)/);
          const reelCode = reelMatch ? reelMatch[1] : '';

          return res.status(200).json({
            success: true,
            data: {
              id: reelCode || Math.random().toString(36).substring(7),
              title: firstMedia.text || (reelCode ? `Instagram Reel (${reelCode})` : 'Instagram Media'),
              author: '@instagram_creator',
              duration: 'Reel',
              thumbnail: reelCode ? `https://www.instagram.com/p/${reelCode}/media/?size=l` : '',
              videoUrl: videoUrl,
              audioUrl: videoUrl,
              streams: [
                { quality: 'HD', label: 'Instagram HD MP4', format: 'mp4', resolution: '1080x1920', size: 'Full HD', url: videoUrl }
              ],
              platform: 'instagram',
              platformName: 'Instagram',
              isVideo
            }
          });
        }
      } catch (igErr) {
        console.error('Cakkatrok IG error:', igErr.message);
      }
    }

    // 3. TikTok Resolution
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
            return res.status(200).json({
              success: true,
              data: {
                id: tk.id || Math.random().toString(36).substring(7),
                title: tk.title || 'TikTok Video (No Watermark)',
                author: tk.author?.unique_id ? `@${tk.author.unique_id}` : '@tiktok_user',
                duration: `${Math.floor((tk.duration || 15) / 60)}:${String((tk.duration || 15) % 60).padStart(2, '0')}`,
                thumbnail: tk.cover,
                videoUrl,
                audioUrl,
                streams: [
                  { quality: 'HD', label: 'HD MP4 (No Watermark)', format: 'mp4', resolution: '1080x1920', size: `${((tk.size || 15000000) / 1024 / 1024).toFixed(1)} MB`, url: videoUrl },
                  { quality: 'SD', label: 'Standard MP4', format: 'mp4', resolution: '720x1280', size: 'Standard', url: videoUrl }
                ],
                platform: 'tiktok',
                platformName: 'TikTok'
              }
            });
          }
        }
      } catch {}
    }

    return res.status(404).json({ success: false, error: 'Could not extract direct stream for this link. Please try again.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
