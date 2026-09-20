import React, { useEffect } from 'react';
import { ShieldCheck, Lock, EyeOff, Server } from 'lucide-react';
import { updatePageMeta } from '../utils/seoHelpers';

export const PrivacyPolicyPage: React.FC = () => {
  useEffect(() => {
    updatePageMeta({
      title: 'Privacy Policy — QuickVero File Security & Data Protection',
      description: 'Review the QuickVero privacy policy. We process files directly in your browser with zero permanent storage.',
      canonicalUrl: 'https://quickvero.com/privacy-policy',
    });
  }, []);

  return (
    <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Last Updated: September 2026 &bull; Effective Immediately
          </p>
        </div>

        {/* Highlight Box */}
        <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-4">
          <ShieldCheck className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-bold">Browser-First Zero-Retention Commitment</h2>
            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
              Whenever supported, QuickVero processes your files directly within your web browser using client-side technologies. Your files do not get uploaded, saved, or indexed on any remote server.
            </p>
          </div>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Information We Do Not Collect</h2>
            <p>
              QuickVero does not require account creation, email sign-ups, or personal identity verification. For all in-browser tools (including Image Compressor, Image Resizer, JPG/PNG Converters, WebP Converter, Hash Generator, Base64 Encoder, and PDF Tools), the computational workload occurs strictly in your device&apos;s local volatile memory.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. Backend Cloud Processing</h2>
            <p>
              For tools that require server-side computing resources (such as advanced video transcode clusters), uploaded files are transmitted via secure HTTPS encryption, held in temporary memory solely for the duration of the processing job, and deleted automatically. We never store or inspect user media.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Local Storage (Cookies &amp; Preferences)</h2>
            <p>
              QuickVero uses modern browser <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">localStorage</code> strictly to remember your preferred UI theme (Dark or Light), your pinned Favorite Tools, and your Recently Visited tools. This data never leaves your browser.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Telemetry and Analytics</h2>
            <p>
              To maintain service uptime and understand tool popularity, we may collect aggregated, non-personally identifiable diagnostic events (e.g., page views, error counts, and browser user-agent types).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">5. Advertising &amp; Third-Party Partners (Google AdSense)</h2>
            <p>
              QuickVero displays advertisements served by Google AdSense and accredited third-party advertising partners to fund ongoing server and development costs. Google, as a third-party vendor, uses cookies (including the DoubleClick cookie) to serve relevant advertisements to users based on visits to this site and other websites across the Internet.
            </p>
            <p>
              Users may opt out of personalized advertising at any time by visiting Google&apos;s <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline">Ads Settings</a> or through the Network Advertising Initiative / <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline">aboutads.info</a> consumer choice opt-out page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
