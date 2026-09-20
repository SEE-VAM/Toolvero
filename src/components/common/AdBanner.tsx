import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  format?: 'leaderboard' | 'rectangle' | 'responsive';
  slot?: string;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export const AdBanner: React.FC<AdBannerProps> = ({ 
  format = 'responsive', 
  slot = '1234567890',
  className = '' 
}) => {
  const adRef = useRef<HTMLModElement>(null);
  const isLoaded = useRef(false);

  // Checks for environment variable or configured ID
  const clientId = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADSENSE_CLIENT_ID) 
    ? (import.meta as any).env.VITE_ADSENSE_CLIENT_ID 
    : 'ca-pub-8043431725904194';

  const isConfigured = Boolean(clientId && !clientId.includes('XXXX'));

  useEffect(() => {
    if (isConfigured && !isLoaded.current && typeof window !== 'undefined') {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      } catch (e) {
        console.warn('AdSense slot initialization:', e);
      }
    }
  }, [isConfigured]);

  return (
    <aside
      aria-label="Advertisement"
      className={`relative overflow-hidden rounded-2xl border border-dashed border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 p-3 text-center my-4 ${className}`}
    >
      <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center justify-center gap-1.5">
        <span>Advertisement</span>
        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="text-[9px] text-slate-400 font-normal">Google AdSense Partner</span>
      </div>

      <div className="flex items-center justify-center min-h-[90px] w-full overflow-hidden">
        {isConfigured ? (
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '90px' }}
            data-ad-client={clientId}
            data-ad-slot={slot}
            data-ad-format={format === 'leaderboard' ? 'horizontal' : format === 'rectangle' ? 'rectangle' : 'auto'}
            data-full-width-responsive="true"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-4 px-4 text-xs text-slate-400 dark:text-slate-500">
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
              Google AdSense Ad Space Ready
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-md">
              Connect your Google AdSense Publisher ID (<code className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-brand-600 dark:text-brand-400">ca-pub-XXXXXXXX</code>) to start serving high-paying responsive banner ads on QuickVero.
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

