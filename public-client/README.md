# Public Client - Static Frontend

This is a separate Next.js app for all public-facing pages (home, pricing, services, contact, products).

## Key Features

- **SSG/ISR**: Pages are statically generated at build time
- **No server calls on every request**: Pages are cached and served as static HTML
- **Periodic revalidation**: Pages revalidate based on the `revalidate` value in each page
- **Separate from main app**: This app handles only public routes, reducing server load

## How it works

1. Pages are pre-rendered at build time (`npm run build`)
2. When a user visits a page, they get the static HTML (no server call)
3. After the revalidate period, the next request will trigger a regeneration in the background
4. Once regenerated, the new static page is served to subsequent users

## Development

```bash
cd public-client
npm run dev
```

## Build for production

```bash
cd public-client
npm run build
```

The static files will be in the `.next/` folder.

## Integration with main app

The main Next.js app (client/) should proxy requests to these static pages, or you can:
1. Deploy this as a separate service on port 3002
2. Use nginx to serve static files and proxy API requests to the server

## Page revalidation times

- Home: 1 hour (3600 seconds)
- Pricing: 1 hour (3600 seconds) 
- Services: 24 hours (86400 seconds)
- Products: 24 hours (86400 seconds)
- Contact: 24 hours (86400 seconds)
