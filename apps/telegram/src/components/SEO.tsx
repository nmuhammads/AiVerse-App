import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
  robots?: string;
  jsonLd?: Record<string, unknown>;
}

const BASE_URL = 'https://www.aiverseapp.net';
const DEFAULT_TITLE = 'AiVerse - AI Creative Platform | Generate Images & Videos with AI';
const DEFAULT_DESCRIPTION = 'AiVerse is an AI-powered creative platform for generating stunning images and videos. Use GPT Image, Kling, NanoBanana PRO and more AI models.';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export function SEO({ title, description, path = '/', image, type = 'website', robots, jsonLd }: SEOProps) {
  const cleanTitle = title?.trim();
  const fullTitle = cleanTitle
    ? (/\baiverse\b/i.test(cleanTitle) ? cleanTitle : `${cleanTitle} | AiVerse`)
    : DEFAULT_TITLE;
  const fullDescription = description || DEFAULT_DESCRIPTION;
  const fullUrl = `${BASE_URL}${path}`;
  const fullImage = image || DEFAULT_IMAGE;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', fullDescription);
    setMeta('name', 'robots', robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', fullDescription);
    setMeta('property', 'og:url', fullUrl);
    setMeta('property', 'og:image', fullImage);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', 'AiVerse');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', fullDescription);
    setMeta('name', 'twitter:image', fullImage);

    // Update/create canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = fullUrl;

    // Dynamic JSON-LD
    const ldId = 'dynamic-jsonld';
    let ldScript = document.getElementById(ldId);
    if (jsonLd) {
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.id = ldId;
        ldScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = JSON.stringify(jsonLd);
    } else if (ldScript) {
      ldScript.remove();
    }

    return () => {
      // Reset to defaults on unmount
      document.title = DEFAULT_TITLE;
    };
  }, [fullTitle, fullDescription, fullUrl, fullImage, type, robots, jsonLd]);

  return null;
}
