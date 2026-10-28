import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { toSlug } from '../components/arts-council-explorer/lib/url-state';
import { recipientKey } from '../components/arts-council-explorer/lib/recipients';

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ? site.toString().replace(/\/+$/, '') : 'https://grants.mikehiggins.me.uk';

  const urls: { loc: string; priority: string; changefreq: string }[] = [
    { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
  ];

  // 1. Core Tool Tabs
  const tabs = ['grants', 'analytics', 'map', 'compare', 'about'];
  for (const tab of tabs) {
    urls.push({ loc: `${siteUrl}/${tab}`, priority: '0.9', changefreq: 'weekly' });
  }

  // 2. 15,000+ Recipient, Place, and Discipline Profiles
  try {
    const grantsJsonPath = path.join(process.cwd(), 'public', 'data', 'arts-council-grants.json');
    const grantsRaw = await fs.readFile(grantsJsonPath, 'utf-8');
    const grants = JSON.parse(grantsRaw);

    const recipientSlugs = new Set<string>();
    const placeSlugs = new Set<string>();
    const disciplineSlugs = new Set<string>();

    for (const g of grants) {
      if (g.recipient) {
        recipientSlugs.add(toSlug(recipientKey(g.recipient)));
      }
      if (g.local_authority) {
        placeSlugs.add(toSlug(g.local_authority));
      }
      if (g.main_discipline) {
        disciplineSlugs.add(toSlug(g.main_discipline));
      }
    }

    for (const slug of recipientSlugs) {
      urls.push({ loc: `${siteUrl}/recipients/${slug}`, priority: '0.7', changefreq: 'monthly' });
    }
    for (const slug of placeSlugs) {
      urls.push({ loc: `${siteUrl}/places/${slug}`, priority: '0.8', changefreq: 'monthly' });
    }
    for (const slug of disciplineSlugs) {
      urls.push({ loc: `${siteUrl}/disciplines/${slug}`, priority: '0.8', changefreq: 'monthly' });
    }
  } catch (err) {
    console.error('Failed to load grants data for sitemap generation:', err);
  }

  const xmlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;

  return new Response(sitemapXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
};
