import React, { useEffect } from 'react';
import { Hero } from '../components/home/Hero';
import { CategorySection } from '../components/home/CategorySection';
import { PopularTools } from '../components/home/PopularTools';
import { TrustSection } from '../components/home/TrustSection';
import { AdBanner } from '../components/common/AdBanner';
import { CategoryDefinition, ToolDefinition } from '../types/tool';
import { updatePageMeta, getBaseUrl } from '../utils/seoHelpers';
import { analytics } from '../services/analytics';

interface HomePageProps {
  onNavigate: (path: string) => void;
  onOpenSearch: () => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenSearch,
  favorites,
  onToggleFavorite,
}) => {
  useEffect(() => {
    const base = getBaseUrl();
    updatePageMeta({
      title: 'QuickVero — Powerful Online Tools. Simple & Fast.',
      description: 'Free online video downloader, image compressor, PDF tools, and audio converters directly in your browser with QuickVero.',
      canonicalUrl: `${base}/`,
      keywords: [
        'online tools',
        'video downloader',
        'instagram reel downloader',
        'tiktok downloader',
        'facebook video downloader',
        'image compressor',
        'pdf converter',
        'mp4 to mp3',
        'free file tools',
        'quickvero',
      ],
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'QuickVero',
        'url': `${base}/`,
        'description': 'Powerful Online Tools. Simple & Fast.',
        'potentialAction': {
          '@type': 'SearchAction',
          'target': `${base}/tools?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }
    });

    analytics.trackPageView('/', 'QuickVero - Homepage');
  }, []);

  const handleSelectTool = (tool: ToolDefinition) => {
    onNavigate(tool.route);
  };

  const handleSelectCategory = (cat: CategoryDefinition) => {
    onNavigate(cat.route);
  };

  const handleQuickQuery = (query: string) => {
    onNavigate(`/tools?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <Hero
        onSearchClick={onOpenSearch}
        onExploreTools={() => onNavigate('/tools')}
        onPopularTools={() => {
          const el = document.getElementById('popular-tools');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onQuickQuery={handleQuickQuery}
      />

      {/* Popular Tools Section */}
      <PopularTools
        onSelectTool={handleSelectTool}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
      />

      {/* Reserved Monetization Placement */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8">
        <AdBanner format="leaderboard" />
      </div>

      {/* Category Section */}
      <CategorySection onSelectCategory={handleSelectCategory} />

      {/* Why QuickVero Trust Section */}
      <TrustSection />
    </div>
  );
};
