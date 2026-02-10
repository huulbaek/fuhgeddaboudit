export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const origin = url.origin

  const pages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/terms', priority: '0.3', changefreq: 'monthly' },
    { loc: '/auth/login', priority: '0.5', changefreq: 'monthly' },
    { loc: '/auth/register', priority: '0.5', changefreq: 'monthly' },
  ]

  const urls = pages
    .map(
      (p) => `  <url>
    <loc>${origin}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  setResponseHeader(event, 'content-type', 'application/xml')
  return xml
})
