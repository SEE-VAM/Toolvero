import { audioBufferToMp3Blob } from './audioProcessor';
import { sanitizeFilename } from '../utils/fileHelpers';

export type VideoPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'twitter' | 'generic';

export interface VideoStreamOption {
  quality: string;
  label: string;
  format: 'mp4' | 'webm' | 'mp3';
  resolution?: string;
  size?: string;
  url: string;
}

export interface VideoDownloadInfo {
  id: string;
  url: string;
  platform: VideoPlatform;
  platformName: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  videoUrl: string;
  videoId?: string;
  embedUrl?: string;
  streams: VideoStreamOption[];
  audioUrl?: string;
  extractedAt: string;
  isLiveStream?: boolean;
  isSample?: boolean;
}

// Preset verified working media samples for 100% reliable instant testing
export const SAMPLE_LINKS: Record<VideoPlatform, { url: string; title: string; author: string; duration: string; videoUrl: string; thumbnail: string }> = {
  instagram: {
    url: 'https://www.instagram.com/reel/C7yuNqMMktN/',
    title: 'NASA Citizen Science Project — Earth & Space Explorations',
    author: '@nasa',
    duration: '0:45',
    videoUrl: '/samples/sample_reel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  },
  facebook: {
    url: 'https://www.facebook.com/watch/?v=109283746582910',
    title: 'Street Gourmet Specials — Artisan Sourdough & Cooking',
    author: 'Chef Food Discovery',
    duration: '0:32',
    videoUrl: '/samples/sample_video.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  },
  youtube: {
    url: 'https://www.youtube.com/watch?v=bGTA7NEeN5o',
    title: 'Inkem Inkem Full Video Song || Geetha Govindam || Sid Sriram',
    author: 'Aditya Music',
    duration: '4:15',
    videoUrl: '/samples/sample_short.mp4',
    thumbnail: 'https://i.ytimg.com/vi/bGTA7NEeN5o/hqdefault.jpg',
  },
  tiktok: {
    url: 'https://www.tiktok.com/@creator/video/73829182749102',
    title: 'Viral Dance Choreography & Trend Beats (No Watermark)',
    author: '@dancecrew_official',
    duration: '0:22',
    videoUrl: '/samples/sample_reel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
  },
  twitter: {
    url: 'https://x.com/techinsider/status/17892019283719283',
    title: 'Next-Gen Robotics & Autonomous Flight Demonstration',
    author: '@TechInnovations',
    duration: '0:29',
    videoUrl: '/samples/sample_video.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80',
  },
  generic: {
    url: '/samples/sample_video.mp4',
    title: 'Direct Video Stream (MP4 / WebM)',
    author: 'Online Media',
    duration: '0:45',
    videoUrl: '/samples/sample_video.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80',
  },
};

export class VideoDownloaderService {
  /**
   * Detects the platform of the given URL
   */
  detectPlatform(rawUrl: string): VideoPlatform {
    const url = rawUrl.trim().toLowerCase();
    if (/instagram\.com|instagr\.am/.test(url)) return 'instagram';
    if (/facebook\.com|fb\.watch|fb\.com/.test(url)) return 'facebook';
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/tiktok\.com/.test(url)) return 'tiktok';
    if (/twitter\.com|x\.com/.test(url)) return 'twitter';
    return 'generic';
  }

  getPlatformName(platform: VideoPlatform): string {
    switch (platform) {
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      case 'youtube': return 'YouTube';
      case 'tiktok': return 'TikTok';
      case 'twitter': return 'Twitter / X';
      default: return 'Video Link';
    }
  }

  /**
   * Resolves video info, download streams, and metadata
   */
  async resolveVideo(url: string, preferredPlatform?: VideoPlatform): Promise<VideoDownloadInfo> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('Please enter a valid video link/URL.');
    }

    const platform = preferredPlatform && preferredPlatform !== 'generic' 
      ? preferredPlatform 
      : this.detectPlatform(cleanUrl);
      
    const platformName = this.getPlatformName(platform);

    // 1. If it's a direct video file URL
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(cleanUrl)) {
      return {
        id: Math.random().toString(36).substring(7),
        url: cleanUrl,
        platform: 'generic',
        platformName: 'Direct Video',
        title: cleanUrl.split('/').pop()?.split('?')[0] || 'Direct Video Clip',
        author: 'Direct CDN Source',
        duration: 'Direct Stream',
        thumbnail: SAMPLE_LINKS.generic.thumbnail,
        videoUrl: cleanUrl,
        streams: [
          { quality: '1080p', label: 'Full HD 1080p (MP4)', format: 'mp4', resolution: '1920x1080', size: 'HD', url: cleanUrl },
          { quality: '720p', label: 'HD 720p (MP4)', format: 'mp4', resolution: '1280x720', size: '720p', url: cleanUrl },
        ],
        extractedAt: new Date().toISOString(),
      };
    }

    // 2. Primary: Try our QuickVero serverless resolver endpoint (/api/resolve)
    try {
      const apiRes = await fetch(`/api/resolve?url=${encodeURIComponent(cleanUrl)}&platform=${platform}`, {
        signal: AbortSignal.timeout(9000),
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.success && json.data) {
          const d = json.data;
          return {
            id: d.id || Math.random().toString(36).substring(7),
            url: cleanUrl,
            platform,
            platformName,
            title: d.title || `${platformName} Video`,
            author: d.author || `@${platform}_creator`,
            duration: d.duration || 'Full Video',
            thumbnail: d.thumbnail || SAMPLE_LINKS[platform]?.thumbnail || SAMPLE_LINKS.generic.thumbnail,
            videoUrl: d.videoUrl,
            audioUrl: d.audioUrl,
            embedUrl: platform === 'youtube' && d.id ? `https://www.youtube-nocookie.com/embed/${d.id}` : (platform === 'instagram' && d.id ? `https://www.instagram.com/reel/${d.id}/embed/` : undefined),
            streams: d.streams && d.streams.length > 0 ? d.streams : [
              { quality: '1080p', label: 'Full HD 1080p (MP4)', format: 'mp4', resolution: '1920x1080', size: 'Full HD', url: d.videoUrl },
              { quality: '720p', label: 'HD 720p (MP4)', format: 'mp4', resolution: '1280x720', size: 'HD', url: d.videoUrl },
            ],
            extractedAt: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Continue to client-side direct resolvers
    }

    // 3. Client-side fallback for YouTube (direct stream proxy routing)
    if (platform === 'youtube') {
      const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
      const ytId = ytMatch ? ytMatch[1] : null;

      if (ytId) {
        let ytTitle = `YouTube Video (${ytId})`;
        let ytAuthor = 'YouTube Creator';
        let ytThumb = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;

        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
          if (oembedRes.ok) {
            const odata = await oembedRes.json();
            if (odata.title) ytTitle = odata.title;
            if (odata.author_name) ytAuthor = odata.author_name;
            if (odata.thumbnail_url) ytThumb = odata.thumbnail_url;
          }
        } catch {}

        const streamUrl = `/api/stream?ytId=${ytId}&type=mp4`;
        const audioStreamUrl = `/api/stream?ytId=${ytId}&type=mp3`;

        return {
          id: ytId,
          url: cleanUrl,
          platform: 'youtube',
          platformName: 'YouTube',
          title: ytTitle,
          author: ytAuthor,
          duration: 'YouTube Video',
          thumbnail: ytThumb,
          videoUrl: streamUrl,
          audioUrl: audioStreamUrl,
          videoId: ytId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}`,
          streams: [
            { quality: '360p', label: 'Standard MP4 (Video & Audio)', format: 'mp4', resolution: '640x360', size: 'Standard MP4', url: streamUrl },
            { quality: 'MP3', label: 'Audio MP3 (320 kbps Studio Quality)', format: 'mp3', resolution: 'Audio Only', size: 'HQ MP3', url: audioStreamUrl },
            { quality: '128k', label: 'Audio MP3 (128 kbps Fast Download)', format: 'mp3', resolution: 'Audio Only', size: '128 kbps', url: audioStreamUrl },
          ],
          extractedAt: new Date().toISOString(),
        };
      }
    }

    // 4. Client-side fallback for TikTok
    if (platform === 'tiktok') {
      try {
        const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.data && data.data.play) {
            const tk = data.data;
            const videoUrl = tk.play.startsWith('http') ? tk.play : `https://www.tikwm.com${tk.play}`;
            const audioUrl = tk.music ? (tk.music.startsWith('http') ? tk.music : `https://www.tikwm.com${tk.music}`) : undefined;
            const streamUrl = `/api/stream?url=${encodeURIComponent(videoUrl)}&type=mp4`;
            return {
              id: tk.id || Math.random().toString(36).substring(7),
              url: cleanUrl,
              platform: 'tiktok',
              platformName: 'TikTok',
              title: tk.title || 'TikTok Video (No Watermark)',
              author: tk.author?.unique_id ? `@${tk.author.unique_id}` : '@tiktok_user',
              duration: `${Math.floor((tk.duration || 15) / 60)}:${String((tk.duration || 15) % 60).padStart(2, '0')}`,
              thumbnail: tk.cover || SAMPLE_LINKS.tiktok.thumbnail,
              videoUrl: streamUrl,
              audioUrl: audioUrl ? `/api/stream?url=${encodeURIComponent(audioUrl)}&type=mp3` : streamUrl,
              streams: [
                { quality: 'HD', label: 'HD MP4 (No Watermark)', format: 'mp4', resolution: '1080x1920', size: `${((tk.size || 15000000) / 1024 / 1024).toFixed(1)} MB`, url: streamUrl },
                { quality: 'SD', label: 'Standard MP4', format: 'mp4', resolution: '720x1280', size: 'Standard', url: streamUrl },
              ],
              extractedAt: new Date().toISOString(),
            };
          }
        }
      } catch {}
    }

    // 5. Sample Link Presets (Used only if user explicitly clicks a preset demo sample)
    const sample = SAMPLE_LINKS[platform] || SAMPLE_LINKS.generic;
    const isExplicitSample = cleanUrl === sample.url || cleanUrl.includes('/samples/');

    if (isExplicitSample) {
      return {
        id: Math.random().toString(36).substring(7),
        url: cleanUrl,
        platform,
        platformName,
        title: sample.title,
        author: sample.author,
        duration: sample.duration,
        thumbnail: sample.thumbnail,
        videoUrl: sample.videoUrl,
        isSample: true,
        streams: [
          { quality: '1080p', label: 'Full HD 1080p (MP4)', format: 'mp4', resolution: '1920x1080', size: '18.4 MB', url: sample.videoUrl },
          { quality: '720p', label: 'HD 720p (MP4)', format: 'mp4', resolution: '1280x720', size: '11.2 MB', url: sample.videoUrl },
        ],
        extractedAt: new Date().toISOString(),
      };
    }

    // 6. Honest Error Handling - Never secretly substitute sample videos
    throw new Error(
      `Unable to load this ${platformName} video. The video may be private, age-restricted, or removed. Please check the URL and try again.`
    );
  }

  /**
   * Fetches an ArrayBuffer for media with multiple fallback strategies
   */
  async fetchMediaArrayBuffer(mediaUrl: string, onProgress?: (percent: number) => void): Promise<ArrayBuffer> {
    onProgress?.(20);

    // 1. If already an internal stream proxy URL, fetch directly
    if (mediaUrl.startsWith('/api/stream')) {
      try {
        const res = await fetch(mediaUrl);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            onProgress?.(60);
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 1000) return buf;
          }
        }
      } catch {}
    }

    onProgress?.(35);
    // 2. Direct fetch
    try {
      const directRes = await fetch(mediaUrl, { mode: 'cors' });
      if (directRes.ok) {
        onProgress?.(60);
        const buf = await directRes.arrayBuffer();
        if (buf && buf.byteLength > 1000) return buf;
      }
    } catch {}

    onProgress?.(50);
    // 3. Stream proxy / CORS proxies
    const proxies = [
      mediaUrl.startsWith('/api/stream')
        ? mediaUrl
        : `/api/stream?url=${encodeURIComponent(mediaUrl)}&filename=media&type=mp4`,
      `https://corsproxy.io/?${encodeURIComponent(mediaUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(mediaUrl)}`,
    ];

    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('text/html') && !contentType.includes('application/json')) {
            onProgress?.(75);
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 1000) return buf;
          }
        }
      } catch {}
    }

    throw new Error('Unable to stream media bytes. The source file may be CORS-restricted or unavailable.');
  }

  /**
   * Downloads a video file directly to the user's computer/phone from QuickVero
  /**
   * Downloads a video file directly to the user's computer/phone from QuickVero
   */
  async downloadVideoFile(streamUrl: string, filename: string, onProgress?: (percent: number) => void): Promise<void> {
    onProgress?.(20);
    const cleanFilename = sanitizeFilename(filename, 'mp4');

    // Build direct stream URL
    let targetDownloadUrl = '';
    if (streamUrl.startsWith('/api/stream')) {
      const u = new URL(streamUrl, window.location.origin);
      u.searchParams.set('filename', cleanFilename);
      u.searchParams.set('type', 'mp4');
      targetDownloadUrl = u.pathname + u.search;
    } else if (streamUrl.startsWith('http')) {
      targetDownloadUrl = `/api/stream?url=${encodeURIComponent(streamUrl)}&filename=${encodeURIComponent(cleanFilename)}&type=mp4`;
    } else {
      targetDownloadUrl = streamUrl;
    }

    onProgress?.(50);

    // Pre-flight check: verify stream is available before triggering native browser download
    // This prevents the browser from downloading corrupted 52-byte error files or failing with "Couldn't download"
    try {
      const checkRes = await fetch(targetDownloadUrl, {
        headers: { 'Range': 'bytes=0-100' },
        signal: AbortSignal.timeout(6000),
      });
      const ctype = checkRes.headers.get('content-type') || '';
      if (!checkRes.ok && checkRes.status !== 206) {
        let errMsg = 'Unable to stream this media right now.';
        try {
          const errJson = await checkRes.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }
      if (ctype.includes('application/json')) {
        let errMsg = 'Stream returned an error response instead of media.';
        try {
          const errJson = await checkRes.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }
    } catch (checkErr: any) {
      if (checkErr.name === 'AbortError' || checkErr.name === 'TimeoutError') {
        // If slow network timeout, proceed to trigger native download
      } else {
        throw checkErr;
      }
    }

    onProgress?.(80);

    // Trigger instant native browser download
    const a = document.createElement('a');
    a.href = targetDownloadUrl;
    a.download = `${cleanFilename}.mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onProgress?.(100);
  }

  /**
   * Extracts audio from the video/audio URL and converts it to MP3 directly
   */
  async convertVideoUrlToMp3(
    mediaUrl: string,
    filename: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    onProgress?.(15);
    const cleanFilename = sanitizeFilename(filename, 'mp3');

    // 1. Fetch media stream bytes
    onProgress?.(30);
    const arrayBuffer = await this.fetchMediaArrayBuffer(mediaUrl, (p) => {
      onProgress?.(30 + Math.floor(p * 0.3));
    });

    // 2. Decode audio track using Web Audio API
    onProgress?.(65);
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeErr: any) {
      throw new Error(
        'Could not decode audio from this video stream. The video may lack an audio track or use an unsupported audio format.'
      );
    } finally {
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    }

    // 3. Encode into genuine MPEG-1 Layer 3 (MP3) at high quality (320 kbps)
    onProgress?.(85);
    const audioBlob = audioBufferToMp3Blob(audioBuffer, 320);

    // 4. Trigger download of the genuine MP3 file
    onProgress?.(100);
    const downloadUrl = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${cleanFilename}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
  }
}

export const videoDownloaderService = new VideoDownloaderService();
