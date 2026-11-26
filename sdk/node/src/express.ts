import { StrimClient } from './client.js';
import { IngestEventItem, StrimConfig } from './types.js';

export function strim(config: StrimConfig) {
  const client = new StrimClient(config);

  return function strimMiddleware(req: any, res: any, next: (err?: any) => void) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      try {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000.0;

        const path = req.originalUrl || req.url || '/';
        const cleanPath = path.split('?')[0];

        // Extract route template if express route matched (e.g. /users/:id)
        let route = cleanPath;
        if (req.route && req.route.path) {
          const basePath = req.baseUrl || '';
          route = `${basePath}${req.route.path}`;
        }

        const statusCode = res.statusCode || 200;
        const contentLength = res.getHeader ? Number(res.getHeader('content-length')) || 0 : 0;

        const event: IngestEventItem = {
          ts: new Date().toISOString(),
          method: (req.method || 'GET').toUpperCase(),
          path: cleanPath,
          route: route,
          status: statusCode,
          duration_ms: Math.max(0.1, Number(durationMs.toFixed(2))),
          bytes: contentLength,
          error: statusCode >= 400 || statusCode === 0,
        };

        client.record(event);
      } catch {
        // Silent catch: telemetry collection must never affect host request flow
      }
    });

    if (typeof next === 'function') {
      next();
    }
  };
}
