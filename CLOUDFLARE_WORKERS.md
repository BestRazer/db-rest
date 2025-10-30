# Cloudflare Workers Deployment Guide

This project has been made compatible with Cloudflare Workers. This guide explains the changes made and how to deploy.

## What Changed

### Removed Dependencies
- **Redis** (`ioredis`): Removed completely as requested. Caching is disabled.
- **serve-static**: Static file serving removed (docs can be hosted separately on Cloudflare Pages)

### Modified for Workers Compatibility
- **File System Operations**: Removed all `fs` operations (file logging, statSync, etc.)
- **Node.js Specific APIs**: Removed `createRequire`, `__dirname`, `process.exit`, etc.
- **Environment Variables**: Changed from `process.env` to Cloudflare Workers environment bindings
- **Server Listener**: Added `worker.js` with Cloudflare Workers fetch handler

### Architecture Changes
```
Before (Node.js):
index.js → api.js → Redis → HAFAS API

After (Cloudflare Workers):
worker.js → api.js → HAFAS API (no caching)
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Local Development
```bash
npm run dev
```
This starts Wrangler dev server on http://localhost:3000

### 3. Deploy to Cloudflare Workers
```bash
npm run deploy
```

## Configuration

### Environment Variables
Edit `wrangler.toml` to configure environment variables:

```toml
[vars]
HOSTNAME = "your-domain.com"
PORT = "443"
```

For sensitive values (like custom user agents), use Wrangler secrets:
```bash
npx wrangler secret put USER_AGENT
npx wrangler secret put HAFAS_USER_AGENT
```

### Custom Domain
Uncomment and configure in `wrangler.toml`:
```toml
routes = [
  { pattern = "db-rest.example.com", custom_domain = true }
]
```

## File Structure

### New Files
- `worker.js` - Cloudflare Workers entry point
- `wrangler.toml` - Cloudflare Workers configuration
- `CLOUDFLARE_WORKERS.md` - This documentation

### Modified Files
- `api.js` - Now exports `createApi(env)` function instead of direct exports
- `index.js` - Updated to use `createApi()` for Node.js compatibility
- `lib/db-stations.js` - Removed file system operations
- `routes/stations.js` - Removed `process.exit()` calls
- `package.json` - Removed incompatible dependencies, added Wrangler

## Limitations in Cloudflare Workers

### Features Not Available
1. **Redis Caching**: Removed as requested. To add caching, use Cloudflare KV or Durable Objects.
2. **HAFAS Request/Response Logging**: File-based logging is not supported. Use Cloudflare Logs or Logpush instead.
3. **Static File Serving**: Documentation is not served. Host docs separately on Cloudflare Pages.
4. **Random Local Addresses**: The `localaddress-agent` feature is not available in Workers.

### Performance Considerations
- **Cold Start**: First request may be slower as the worker initializes
- **No Caching**: Without Redis, all requests go directly to HAFAS API
- **Station Data**: Loaded on worker initialization (may increase memory usage)

## Adding Caching with Cloudflare KV

If you need caching, you can implement Cloudflare KV:

1. **Create a KV Namespace**:
```bash
npx wrangler kv:namespace create "CACHE"
```

2. **Add to wrangler.toml**:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-namespace-id"
```

3. **Implement KV Store**: Create a custom store adapter for `cached-hafas-client` that uses KV instead of Redis.

## Node.js Compatibility

The project still works with Node.js! Just run:
```bash
npm start
```

The `index.js` file uses the same `createApi()` function but with `process.env` for environment variables.

## Testing

### Local Testing with Wrangler
```bash
npm run dev
```

Then test endpoints:
```bash
curl http://localhost:3000/stations?query=Berlin
curl http://localhost:3000/journeys?from=8011160&to=8000105
```

### Production Testing
After deployment:
```bash
curl https://your-worker.workers.dev/stations?query=Berlin
```

## Troubleshooting

### Import Errors
If you see errors about missing modules, ensure all dependencies are installed:
```bash
npm install
```

### Worker Size Limits
Cloudflare Workers have a 1MB compressed size limit. If exceeded, consider:
- Using external storage for large datasets
- Lazy-loading station data
- Code splitting

### Compatibility Issues
The project uses the `nodejs_compat` compatibility flag for Node.js APIs like Buffer. If you encounter issues, check:
- Cloudflare Workers Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Wrangler documentation: https://developers.cloudflare.com/workers/wrangler/

## Migration from Node.js Deployment

If migrating from an existing Node.js deployment:

1. **Redis Data**: No migration needed (caching disabled)
2. **Environment Variables**: Set them in `wrangler.toml` or as secrets
3. **Logs**: Configure Cloudflare Logpush for request logs
4. **Monitoring**: Use Cloudflare Analytics for monitoring

## Next Steps

- Set up custom domain in Cloudflare dashboard
- Configure Cloudflare Analytics for monitoring
- Implement Cloudflare KV caching if needed
- Deploy documentation to Cloudflare Pages
- Set up CI/CD with GitHub Actions and Wrangler

## Support

For Cloudflare Workers-specific issues:
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Community: https://community.cloudflare.com/

For db-rest issues:
- GitHub Issues: https://github.com/derhuerst/db-rest/issues
