import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ? site.toString().replace(/\/+$/, '') : 'https://grants.mikehiggins.me.uk';
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
