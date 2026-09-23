import { ToolDefinition } from '../types/tool';

export interface SeoProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  keywords?: string[];
  ogImage?: string;
  structuredData?: Record<string, any>;
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://quickvero.vercel.app';
}

export function updatePageMeta({
  title,
  description,
  canonicalUrl,
  keywords = [],
  ogImage,
  structuredData,
}: SeoProps) {
  const base = getBaseUrl();
  const rawCanonical = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : base);
  const resolvedCanonical = rawCanonical
    .replace('https://quickvero.com', base)
    .replace('http://quickvero.com', base);
  const resolvedOgImage = ogImage
    ? ogImage.replace('https://quickvero.com', base)
    : `${base}/og-image.png`;

  // Update document title
  document.title = title;

  // Helper to set or create meta tag
  const setMeta = (name: string, content: string, isProperty: boolean = false) => {
    const attr = isProperty ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  setMeta('description', description);
  if (keywords.length > 0) {
    setMeta('keywords', keywords.join(', '));
  }

  // Open Graph
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:url', resolvedCanonical, true);
  setMeta('og:image', resolvedOgImage, true);

  // Twitter
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', resolvedOgImage);

  // Canonical
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = resolvedCanonical;

  // JSON-LD Structured Data
  const oldScript = document.getElementById('json-ld-data');
  if (oldScript) {
    oldScript.remove();
  }

  if (structuredData) {
    const script = document.createElement('script');
    script.id = 'json-ld-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }
}

export function generateToolStructuredData(tool: ToolDefinition) {
  const base = getBaseUrl();
  const schema: Record<string, any>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': tool.name,
      'applicationCategory': 'UtilitiesApplication',
      'operatingSystem': 'All',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'description': tool.description,
      'url': `${base}${tool.route}`,
    }
  ];

  if (tool.howToSteps && tool.howToSteps.length > 0) {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      'name': `How to use ${tool.name}`,
      'step': tool.howToSteps.map(s => ({
        '@type': 'HowToStep',
        'position': s.step,
        'name': s.title,
        'text': s.description,
      }))
    });
  }

  if (tool.faqs && tool.faqs.length > 0) {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': tool.faqs.map(faq => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.answer,
        }
      }))
    });
  }

  return schema;
}
