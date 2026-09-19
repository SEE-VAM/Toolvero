import React, { useState } from 'react';
import {
  Download,
  Music,
  Play,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Film,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Globe,
  FileAudio,
  CheckCircle2,
} from 'lucide-react';
import { ToolDefinition } from '../../../types/tool';
import {
  videoDownloaderService,
  VideoDownloadInfo,
  VideoPlatform,
  SAMPLE_LINKS,
} from '../../../services/videoDownloaderService';

interface VideoDownloaderWorkspaceProps {
  tool: ToolDefinition;
  onShowToast: (toast: { type: 'success' | 'error' | 'info'; message: string }) => void;
}

export const VideoDownloaderWorkspace: React.FC<VideoDownloaderWorkspaceProps> = ({
  tool,
  onShowToast,
}) => {
  // Determine default platform based on tool.id
  const getDefaultPlatform = (): VideoPlatform => {
    if (tool.id.includes('instagram')) return 'instagram';
    if (tool.id.includes('facebook')) return 'facebook';
    if (tool.id.includes('youtube')) return 'youtube';
    if (tool.id.includes('tiktok')) return 'tiktok';
    if (tool.id.includes('twitter')) return 'twitter';
    return 'generic';
  };

  const [inputUrl, setInputUrl] = useState('');
  const [activePlatform, setActivePlatform] = useState<VideoPlatform>(getDefaultPlatform());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoDownloadInfo | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Platform badges data
  const platforms: { id: VideoPlatform; label: string; icon: React.ComponentType<any>; color: string; activeColor: string }[] = [
    { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600', activeColor: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white' },
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600', activeColor: 'bg-blue-600 text-white' },
    { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-600', activeColor: 'bg-red-600 text-white' },
    { id: 'tiktok', label: 'TikTok', icon: Film, color: 'text-cyan-600 dark:text-cyan-400', activeColor: 'bg-slate-900 dark:bg-slate-800 text-cyan-400 border border-cyan-500/30' },
    { id: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-sky-500', activeColor: 'bg-sky-500 text-white' },
    { id: 'generic', label: 'All Links', icon: Globe, color: 'text-indigo-600 dark:text-indigo-400', activeColor: 'bg-indigo-600 text-white' },
  ];

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text);
        const detected = videoDownloaderService.detectPlatform(text);
        if (detected) setActivePlatform(detected);
        onShowToast({ type: 'info', message: 'Link pasted from clipboard!' });
      }
    } catch {
      onShowToast({ type: 'info', message: 'Please paste the link directly into the input box.' });
    }
  };

  // Load sample link
  const handleLoadSample = (platformKey: VideoPlatform) => {
    const sample = SAMPLE_LINKS[platformKey];
    if (sample) {
      setInputUrl(sample.url);
      setActivePlatform(platformKey);
      analyzeLink(sample.url, platformKey);
    }
  };

  // Analyze video link
  const analyzeLink = async (urlToAnalyze?: string, targetPlatform?: VideoPlatform) => {
    const targetUrl = urlToAnalyze || inputUrl;
    if (!targetUrl.trim()) {
      onShowToast({ type: 'error', message: 'Please enter a video link first!' });
      return;
    }

    setIsAnalyzing(true);
    setVideoInfo(null);

    try {
      const info = await videoDownloaderService.resolveVideo(
        targetUrl,
        targetPlatform || activePlatform
      );
      setVideoInfo(info);
      onShowToast({
        type: 'success',
        message: `${info.platformName} video analyzed! Ready to download or convert.`,
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        message: err.message || 'Could not resolve this video link. Please check the URL.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Download Video Stream
  const handleDownloadVideo = async (streamUrl: string, qualityLabel: string) => {
    if (!videoInfo) return;
    setDownloadingFormat(qualityLabel);
    setDownloadProgress(10);

    try {
      const filename = `${videoInfo.platformName}_${videoInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${qualityLabel}`;
      await videoDownloaderService.downloadVideoFile(
        streamUrl,
        filename,
        (p) => setDownloadProgress(p)
      );
      onShowToast({
        type: 'success',
        message: `Your ${qualityLabel} video has started downloading!`,
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        message: 'Could not download video file directly. Opening video stream in new tab...',
      });
      window.open(streamUrl, '_blank');
    } finally {
      setDownloadingFormat(null);
      setDownloadProgress(0);
    }
  };

  // Convert to MP3
  const handleConvertToMp3 = async () => {
    if (!videoInfo) return;
    setDownloadingFormat('MP3');
    setDownloadProgress(10);

    try {
      const filename = `${videoInfo.platformName}_${videoInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Audio`;
      await videoDownloaderService.convertVideoUrlToMp3(
        videoInfo.videoUrl,
        filename,
        (p) => setDownloadProgress(p)
      );
      onShowToast({
        type: 'success',
        message: 'Audio extracted and converted to MP3 successfully!',
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        message: err.message || 'Failed to extract MP3 audio from this video.',
      });
    } finally {
      setDownloadingFormat(null);
      setDownloadProgress(0);
    }
  };

  // Copy Direct Link
  const handleCopyLink = () => {
    if (!videoInfo) return;
    navigator.clipboard.writeText(videoInfo.videoUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    onShowToast({ type: 'success', message: 'Direct video link copied to clipboard!' });
  };

  return (
    <div className="space-y-6">
      {/* Workspace Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-surface-cardDark shadow-card">
        {/* Platform Selector */}
        <div className="flex flex-wrap items-center gap-2 pb-5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">
            Select Platform:
          </span>
          {platforms.map((p) => {
            const Icon = p.icon;
            const isSelected = activePlatform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePlatform(p.id);
                  if (inputUrl) {
                    analyzeLink(inputUrl, p.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? p.activeColor + ' shadow-sm scale-105'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : p.color}`} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="mt-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Paste Video / Reel Link
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <LinkIcon className="w-5 h-5" />
              </div>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  const detected = videoDownloaderService.detectPlatform(e.target.value);
                  if (detected && detected !== 'generic') setActivePlatform(detected);
                }}
                onKeyDown={(e) => e.key === 'Enter' && analyzeLink()}
                placeholder={`Paste ${videoDownloaderService.getPlatformName(activePlatform)} link here (e.g. https://...)...`}
                className="w-full pl-11 pr-24 py-3.5 rounded-2xl text-sm sm:text-base bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 transition-all shadow-inner"
              />
              {/* Paste button inside input */}
              <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputUrl('');
                      setVideoInfo(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium"
                    title="Clear input"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePaste}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Paste</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => analyzeLink()}
              disabled={isAnalyzing || !inputUrl.trim()}
              className="px-6 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Link...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Fetch &amp; Download</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Sample Links Row */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Try sample:
            </span>
            <button
              type="button"
              onClick={() => handleLoadSample('instagram')}
              className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/60 text-pink-700 dark:text-pink-300 hover:bg-pink-100 font-medium transition-colors"
            >
              📸 Instagram Reel
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('facebook')}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-medium transition-colors"
            >
              📘 Facebook Video
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('youtube')}
              className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-100 font-medium transition-colors"
            >
              ▶️ YouTube Short
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('tiktok')}
              className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/60 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 font-medium transition-colors"
            >
              🎵 TikTok Video
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('twitter')}
              className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 font-medium transition-colors"
            >
              🐦 Twitter / X Video
            </button>
          </div>
        </div>

        {/* Progress Bar when downloading or converting */}
        {downloadingFormat && (
          <div className="mt-6 p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/80 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-200 mb-2">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600 dark:text-brand-400" />
                Processing {downloadingFormat}...
              </span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-brand-200 dark:bg-brand-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 dark:bg-brand-400 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Video Result Preview Card */}
      {videoInfo && (
        <div className="p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-surface-cardDark shadow-card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Embedded Video Player */}
            {videoInfo.embedUrl ? (
              <div className="w-full md:w-80 shrink-0 rounded-2xl overflow-hidden bg-black aspect-video shadow-md border border-slate-800 relative">
                <iframe
                  src={videoInfo.embedUrl}
                  title={videoInfo.title}
                  className="w-full h-full border-0 rounded-2xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="w-full md:w-80 shrink-0 rounded-2xl overflow-hidden bg-black aspect-[9/16] sm:aspect-video shadow-md border border-slate-800 relative group">
                <video
                  src={videoInfo.videoUrl}
                  poster={videoInfo.thumbnail}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Video Details & Download Options */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                  {videoInfo.platformName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Duration: {videoInfo.duration}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {videoInfo.author}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
                {videoInfo.title}
              </h3>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Media stream verified! Choose your preferred format to download or convert below.</span>
              </div>

              {/* Action Buttons Grid */}
              <div className="pt-2 space-y-3">
                {videoInfo.downloadLinks && videoInfo.downloadLinks.length > 0 ? (
                  <>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Download Options (Direct Streams):
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {videoInfo.downloadLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between p-3.5 rounded-2xl font-semibold text-sm shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                            link.type === 'mp3'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {link.type === 'mp3' ? (
                              <Music className="w-5 h-5 text-purple-200 shrink-0" />
                            ) : (
                              <Download className="w-5 h-5 text-emerald-200 shrink-0" />
                            )}
                            <div className="text-left">
                              <div className="leading-tight">{link.label}</div>
                              <div className="text-[11px] opacity-80 font-normal">
                                {link.quality} • Instant Download
                              </div>
                            </div>
                          </div>
                          {link.badge && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-lg bg-white/20 text-white shrink-0 ml-2">
                              {link.badge}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Download Formats:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1080p Video Download */}
                      <button
                        type="button"
                        onClick={() => handleDownloadVideo(videoInfo.videoUrl, '1080p_FullHD')}
                        disabled={!!downloadingFormat}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Download className="w-4 h-4" />
                          <div className="text-left">
                            <div className="leading-tight">Download Full HD (1080p)</div>
                            <div className="text-[11px] text-emerald-100 font-normal">MP4 Format • High Quality</div>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-700/80 text-emerald-100">
                          MP4
                        </span>
                      </button>

                      {/* 720p Video Download */}
                      <button
                        type="button"
                        onClick={() => handleDownloadVideo(videoInfo.videoUrl, '720p_HD')}
                        disabled={!!downloadingFormat}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Download className="w-4 h-4" />
                          <div className="text-left">
                            <div className="leading-tight">Download HD (720p)</div>
                            <div className="text-[11px] text-blue-100 font-normal">MP4 Format • Optimized Size</div>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-700/80 text-blue-100">
                          MP4
                        </span>
                      </button>

                      {/* Convert to MP3 Audio */}
                      <button
                        type="button"
                        onClick={handleConvertToMp3}
                        disabled={!!downloadingFormat}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-purple-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer sm:col-span-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <Music className="w-5 h-5 text-purple-200" />
                          <div className="text-left">
                            <div className="leading-tight flex items-center gap-1.5">
                              <span>Convert to MP3 Audio</span>
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-400/30 text-purple-100">
                                Real MP3 320kbps
                              </span>
                            </div>
                            <div className="text-[11px] text-purple-200 font-normal">
                              Extract and decode the audio track natively in your browser
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-purple-700/80 text-white">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Convert MP3</span>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {/* Secondary utility options */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Stream URL'}</span>
                  </button>

                  <a
                    href={videoInfo.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Highlights Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
            <Instagram className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Instagram Reels &amp; Posts</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Download full HD reels and video posts with sound.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Facebook className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Facebook Videos &amp; Reels</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Instant 1080p/720p extraction without logging in.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Convert Any Link to MP3</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Extract studio-quality audio in browser with Web Audio API.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
