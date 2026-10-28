/**
 * Netlify Edge Function: Dynamic SEO Metadata Injector
 * Injects accurate <title>, <meta name="description">, OpenGraph, and <link rel="canonical">
 * tags for 15,000+ recipient profile pages, places, disciplines, and tabs.
 */

const formatSlug = (slug) => {
  try {
    slug = decodeURIComponent(slug);
  } catch {}
  return slug
    .split('-')
    .map((word) => {
      if (word.toLowerCase() === 'and') return '&';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const getPageMetadata = (pathname, origin) => {
  const isRoot = pathname === '/' || pathname === '';
  const canonicalPath = isRoot ? '/' : pathname.replace(/\/+$/, '');
  const canonicalUrl = `${origin}${canonicalPath}`;

  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);

  if (segments.length === 0) {
    return {
      title: 'Arts Council Funding Grants 2018–2026 — Comprehensive Data Explorer',
      description: 'Interactive data explorer and analytics dashboard for Arts Council England National Lottery Project Grants (2018–19 onwards). Explore 15,000+ grants, recipients, disciplines, and regional allocations.',
      canonicalUrl,
    };
  }

  const first = segments[0].toLowerCase();

  if (first === 'recipients' && segments[1]) {
    const name = formatSlug(segments[1]);
    if (segments[2] === 'grants' && segments[3]) {
      return {
        title: `${name} — Grant Award Details — Arts Council Funding Grants`,
        description: `Detailed grant award records, project descriptions, and funding data for ${name} from Arts Council England (2018–2026).`,
        canonicalUrl,
      };
    }
    return {
      title: `${name} — Arts Council Funding Grants`,
      description: `Explore Arts Council England funding grant awards, cumulative totals, and activity history for ${name} (2018–2026).`,
      canonicalUrl,
    };
  }

  if (first === 'places' && segments[1]) {
    const place = formatSlug(segments[1]);
    return {
      title: `${place} — Regional Funding Awards — Arts Council Grants`,
      description: `Explore Arts Council England funding grants, recipient directories, and project investments in ${place} (2018–2026).`,
      canonicalUrl,
    };
  }

  if (first === 'disciplines' && segments[1]) {
    const discipline = formatSlug(segments[1]);
    return {
      title: `${discipline} — Arts Council Funding Grants`,
      description: `Explore Arts Council England funding grants, project awards, and recipient portfolios in ${discipline} (2018–2026).`,
      canonicalUrl,
    };
  }

  if (first === 'grants') {
    if (segments[1]) {
      return {
        title: `Grant Details — Arts Council Funding Grants`,
        description: `Detailed project grant award records and metadata from Arts Council England (2018–2026).`,
        canonicalUrl,
      };
    }
    return {
      title: `Grants Directory — Arts Council Funding Grants 2018–2026`,
      description: `Search, filter, and export Arts Council England National Lottery Project Grants across all years, disciplines, and regions.`,
      canonicalUrl,
    };
  }

  if (first === 'analytics') {
    return {
      title: `Funding Analytics & Charts — Arts Council Funding Grants`,
      description: `Visual analytics, funding trends, grant size distributions, and area heatmaps for Arts Council England Project Grants.`,
      canonicalUrl,
    };
  }

  if (first === 'map') {
    return {
      title: `Interactive Funding Map — Arts Council Funding Grants`,
      description: `Geographic choropleth map of Arts Council England National Lottery Project Grants across English local authorities.`,
      canonicalUrl,
    };
  }

  if (first === 'compare') {
    return {
      title: `Compare Funding Dimensions — Arts Council Funding Grants`,
      description: `Compare Arts Council England funding allocations across geographic areas, disciplines, local authorities, and deprivation indices.`,
      canonicalUrl,
    };
  }

  if (first === 'about') {
    return {
      title: `About & Methodology — Arts Council Funding Grants`,
      description: `Data sources, data cleaning pipeline, fiscal year mapping methodology, and taxonomy notes for Arts Council England grants.`,
      canonicalUrl,
    };
  }

  return {
    title: 'Arts Council Funding Grants 2018–2026',
    description: 'Interactive data explorer and analytics dashboard for Arts Council England National Lottery Project Grants (2018–19 onwards).',
    canonicalUrl,
  };
};

export default async (request, context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip static assets
  const isAsset = /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|json|xml|txt|pdf|woff|woff2|ttf|eot)$/i.test(pathname);
  if (isAsset) {
    return context.next();
  }

  // Fetch the original HTML
  const response = await context.next();
  const html = await response.text();

  const metadata = getPageMetadata(pathname, url.origin);
  const { title, description, canonicalUrl } = metadata;

  let modifiedHtml = html;

  // 1. Replace or Inject <title>
  if (title) {
    if (/<title>[^<]*<\/title>/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
    } else {
      modifiedHtml = modifiedHtml.replace('</head>', `    <title>${title}</title>\n  </head>`);
    }
  }

  // 2. Replace or Inject <meta name="description">
  if (description) {
    if (/<meta\s+name=["']description["'][^>]*\/?>/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name=["']description["'][^>]*\/?>/i,
        `<meta name="description" content="${description}" />`
      );
    } else {
      modifiedHtml = modifiedHtml.replace(
        '</head>',
        `    <meta name="description" content="${description}" />\n  </head>`
      );
    }
  }

  // 3. Replace or Inject <link rel="canonical">
  if (canonicalUrl) {
    let canonicalReplaced = false;
    modifiedHtml = modifiedHtml.replace(/<link\s+rel=["']canonical["'][^>]*\/?>/gi, () => {
      if (!canonicalReplaced) {
        canonicalReplaced = true;
        return `<link rel="canonical" href="${canonicalUrl}" />`;
      }
      return '';
    });
    if (!canonicalReplaced) {
      modifiedHtml = modifiedHtml.replace(
        '</head>',
        `    <link rel="canonical" href="${canonicalUrl}" />\n  </head>`
      );
    }

    // 4. OpenGraph and Twitter tags
    if (/<meta\s+property=["']og:url["'][^>]*\/?>/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /<meta\s+property=["']og:url["'][^>]*\/?>/i,
        `<meta property="og:url" content="${canonicalUrl}" />`
      );
    }
    if (/<meta\s+property=["']og:title["'][^>]*\/?>/i.test(modifiedHtml) && title) {
      modifiedHtml = modifiedHtml.replace(
        /<meta\s+property=["']og:title["'][^>]*\/?>/i,
        `<meta property="og:title" content="${title}" />`
      );
    }
    if (/<meta\s+property=["']og:description["'][^>]*\/?>/i.test(modifiedHtml) && description) {
      modifiedHtml = modifiedHtml.replace(
        /<meta\s+property=["']og:description["'][^>]*\/?>/i,
        `<meta property="og:description" content="${description}" />`
      );
    }
  }

  return new Response(modifiedHtml, {
    status: response.status,
    headers: response.headers,
  });
};
