import YAML from "yaml";

export type DiscoveredMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type DiscoveredEndpoint = {
  path: string;
  method: DiscoveredMethod;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: "path" | "query" | "header" | "cookie";
    required?: boolean;
    description?: string;
    schemaType?: string;
  }>;
  requestBody?: {
    contentType?: string;
    example?: unknown;
  };
  isSafe: boolean;
  source: "openapi" | "swagger" | "crawler" | "probe" | "graphql" | "sitemap";
  statusCode?: number;
};

export type DiscoveryResult = {
  baseUrl: string;
  source: "openapi" | "swagger" | "crawler" | "probe" | "graphql" | "mixed";
  specUrl?: string;
  title?: string;
  version?: string;
  endpoints: DiscoveredEndpoint[];
  probedCount: number;
  scanDurationMs: number;
};

const OPENAPI_PROBE_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/v3/api-docs",
  "/api-docs",
  "/v3/api-docs/swagger-config",
  "/openapi.yaml",
  "/swagger.yaml",
  "/.well-known/openapi.json",
  "/api/openapi.json",
  "/api/swagger.json",
  "/docs/openapi.json",
];

const COMMON_REST_PROBE_PATHS = [
  "/health",
  "/healthz",
  "/api/health",
  "/status",
  "/ping",
  "/metrics",
  "/api",
  "/api/v1",
  "/v1",
  "/api/v1/health",
  "/api/users",
  "/v1/projects",
  "/v1/load-tests",
  "/v1/org",
  "/v1/compare",
];

function sanitizeUrl(base: string): string {
  let url = base.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

function isSafeMethod(method: DiscoveredMethod): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

/**
 * Phase 1: Probes OpenAPI / Swagger specifications at standard endpoints.
 */
async function probeOpenApi(
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ endpoints: DiscoveredEndpoint[]; specUrl: string; title?: string; version?: string } | null> {
  for (const path of OPENAPI_PROBE_PATHS) {
    const candidateUrl = `${baseUrl}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(candidateUrl, {
        headers: {
          Accept: "application/json, application/yaml, text/yaml, text/plain, */*",
          ...headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();

      let spec: any = null;
      if (contentType.includes("json") || text.trim().startsWith("{")) {
        try {
          spec = JSON.parse(text);
        } catch {
          // not valid json
        }
      } else {
        try {
          spec = YAML.parse(text);
        } catch {
          // not valid yaml
        }
      }

      if (!spec || (!spec.openapi && !spec.swagger && !spec.paths)) {
        continue;
      }

      // Valid OpenAPI or Swagger spec detected! Parse paths
      const endpoints: DiscoveredEndpoint[] = [];
      const paths = spec.paths ?? {};
      const title = spec.info?.title;
      const version = spec.info?.version;

      for (const [routePath, methods] of Object.entries(paths)) {
        if (!methods || typeof methods !== "object") continue;

        for (const [methodKey, op] of Object.entries(methods as Record<string, any>)) {
          const upperMethod = methodKey.toUpperCase();
          if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(upperMethod)) {
            const method = upperMethod as DiscoveredMethod;
            const opObj = op as any;

            const parameters: DiscoveredEndpoint["parameters"] = Array.isArray(opObj?.parameters)
              ? opObj.parameters.map((p: any) => ({
                  name: p.name,
                  in: p.in,
                  required: p.required,
                  description: p.description,
                  schemaType: p.schema?.type ?? p.type,
                }))
              : [];

            let requestBody: DiscoveredEndpoint["requestBody"] | undefined;
            if (opObj?.requestBody?.content) {
              const contentKeys = Object.keys(opObj.requestBody.content);
              const ct = contentKeys[0];
              if (ct) {
                requestBody = {
                  contentType: ct,
                  example: opObj.requestBody.content[ct]?.example ?? opObj.requestBody.content[ct]?.schema?.example,
                };
              }
            }

            endpoints.push({
              path: routePath,
              method,
              summary: opObj?.summary ?? opObj?.operationId,
              description: opObj?.description,
              parameters,
              requestBody,
              isSafe: isSafeMethod(method),
              source: spec.openapi ? "openapi" : "swagger",
            });
          }
        }
      }

      if (endpoints.length > 0) {
        return { endpoints, specUrl: candidateUrl, title, version };
      }
    } catch {
      // probe failed or timed out, try next
    }
  }

  return null;
}

/**
 * Phase 1: Probes common REST conventions when no OpenAPI spec is available.
 */
async function probeCommonRest(
  baseUrl: string,
  headers: Record<string, string>
): Promise<DiscoveredEndpoint[]> {
  const discovered: DiscoveredEndpoint[] = [];

  const probePromises = COMMON_REST_PROBE_PATHS.map(async (path) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          ...headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Statuses 200-299, 401 (auth required), 403 (forbidden), 405 (method not allowed)
      // all confirm the endpoint exists and is handled by the server!
      if (res.status < 500 && res.status !== 404) {
        discovered.push({
          path,
          method: "GET",
          summary: `Standard REST endpoint (${res.status} ${res.statusText})`,
          isSafe: true,
          source: "probe",
          statusCode: res.status,
        });
      }
    } catch {
      // ignore unreachable probe
    }
  });

  await Promise.allSettled(probePromises);
  return discovered;
}

/**
 * Phase 2: Probes GraphQL introspection.
 */
async function probeGraphQL(
  baseUrl: string,
  headers: Record<string, string>
): Promise<DiscoveredEndpoint[]> {
  const candidates = ["/graphql", "/api/graphql"];
  const introspectionQuery = JSON.stringify({
    query: `
      query Introspect {
        __schema {
          queryType { fields { name description } }
          mutationType { fields { name description } }
        }
      }
    `,
  });

  for (const path of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: introspectionQuery,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      const schema = data?.data?.__schema;
      if (schema) {
        const endpoints: DiscoveredEndpoint[] = [];
        const queries = schema.queryType?.fields ?? [];
        const mutations = schema.mutationType?.fields ?? [];

        for (const q of queries.slice(0, 15)) {
          endpoints.push({
            path: `${path}?query={${q.name}}`,
            method: "POST",
            summary: `GraphQL Query: ${q.name}`,
            description: q.description,
            isSafe: true,
            source: "graphql",
          });
        }

        for (const m of mutations.slice(0, 10)) {
          endpoints.push({
            path: `${path} (mutation ${m.name})`,
            method: "POST",
            summary: `GraphQL Mutation: ${m.name}`,
            description: m.description,
            isSafe: false,
            source: "graphql",
          });
        }

        return endpoints;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Phase 2: Probes sitemap.xml and robots.txt.
 */
async function probeSitemap(
  baseUrl: string,
  headers: Record<string, string>
): Promise<DiscoveredEndpoint[]> {
  const endpoints: DiscoveredEndpoint[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${baseUrl}/sitemap.xml`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const xml = await res.text();
      const locMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g));
      for (const m of locMatches) {
        const rawLoc = m[1];
        if (!rawLoc) continue;
        try {
          const u = new URL(rawLoc);
          if (u.pathname && u.pathname !== "/" && !endpoints.some((e) => e.path === u.pathname)) {
            endpoints.push({
              path: u.pathname,
              method: "GET",
              summary: "Discovered via sitemap.xml",
              isSafe: true,
              source: "sitemap",
            });
          }
        } catch {
          // ignore invalid url
        }
      }
    }
  } catch {
    // ignore
  }

  return endpoints.slice(0, 20);
}

/**
 * Phase 2: Web HTML & JavaScript bundle scraper.
 * Fetches HTML, looks for scripts, and scans for API route calls like fetch('/api/...') or axios.get('/v1/...').
 */
async function probeWebBundles(
  baseUrl: string,
  headers: Record<string, string>
): Promise<DiscoveredEndpoint[]> {
  const endpoints: DiscoveredEndpoint[] = [];
  const foundPaths = new Set<string>();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(baseUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        ...headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const html = await res.text();

    // Find script src URLs
    const scriptMatches = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi))
      .map((m) => m[1])
      .filter((src): src is string => Boolean(src));

    // Scan up to 5 scripts
    const scriptsToScan = scriptMatches.slice(0, 5).map((src) => {
      if (src.startsWith("//")) return `https:${src}`;
      if (src.startsWith("/")) return `${baseUrl}${src}`;
      if (!src.startsWith("http")) return `${baseUrl}/${src}`;
      return src;
    });

    const apiPattern = /["'](\/(?:api|v[0-9]|rest|graphql)[^"'`\s?#]{2,})["']/g;

    for (const scriptUrl of scriptsToScan) {
      try {
        const scController = new AbortController();
        const scTimeout = setTimeout(() => scController.abort(), 3000);

        const scRes = await fetch(scriptUrl, { signal: scController.signal });
        clearTimeout(scTimeout);

        if (!scRes.ok) continue;

        const code = await scRes.text();
        const matches = code.matchAll(apiPattern);

        for (const match of matches) {
          const apiPath = match[1];
          if (
            apiPath &&
            !foundPaths.has(apiPath) &&
            !apiPath.includes(".js") &&
            !apiPath.includes(".css") &&
            !apiPath.includes(".png") &&
            !apiPath.includes(".svg")
          ) {
            foundPaths.add(apiPath);
            endpoints.push({
              path: apiPath,
              method: "GET",
              summary: "Detected in frontend client bundle",
              isSafe: true,
              source: "crawler",
            });
          }
        }
      } catch {
        // continue
      }
    }
  } catch {
    // continue
  }

  return endpoints.slice(0, 25);
}

/**
 * Master Discovery Function
 * Runs Phase 1 (OpenAPI & REST probe) followed by Phase 2 (GraphQL, Sitemap & Web crawler).
 */
export async function discoverEndpoints(
  rawBaseUrl: string,
  customHeaders: Record<string, string> = {}
): Promise<DiscoveryResult> {
  const startTime = performance.now();
  const baseUrl = sanitizeUrl(rawBaseUrl);

  // 1. Try OpenAPI / Swagger (Highest fidelity)
  const openApiResult = await probeOpenApi(baseUrl, customHeaders);
  if (openApiResult && openApiResult.endpoints.length > 0) {
    return {
      baseUrl,
      source: openApiResult.specUrl.includes("swagger") ? "swagger" : "openapi",
      specUrl: openApiResult.specUrl,
      title: openApiResult.title,
      version: openApiResult.version,
      endpoints: openApiResult.endpoints,
      probedCount: OPENAPI_PROBE_PATHS.length,
      scanDurationMs: Math.round(performance.now() - startTime),
    };
  }

  // 2. If no OpenAPI spec found, run concurrent multi-layer discovery
  const [restProbes, graphQlEndpoints, sitemapEndpoints, bundleEndpoints] = await Promise.all([
    probeCommonRest(baseUrl, customHeaders),
    probeGraphQL(baseUrl, customHeaders),
    probeSitemap(baseUrl, customHeaders),
    probeWebBundles(baseUrl, customHeaders),
  ]);

  const endpointMap = new Map<string, DiscoveredEndpoint>();

  // Merge results, prioritizing restProbes and graphql
  for (const ep of [...graphQlEndpoints, ...restProbes, ...bundleEndpoints, ...sitemapEndpoints]) {
    const key = `${ep.method}:${ep.path}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, ep);
    }
  }

  const endpoints = Array.from(endpointMap.values());
  const source =
    graphQlEndpoints.length > 0
      ? "graphql"
      : restProbes.length > 0
      ? "probe"
      : bundleEndpoints.length > 0
      ? "crawler"
      : "mixed";

  return {
    baseUrl,
    source,
    endpoints,
    probedCount: OPENAPI_PROBE_PATHS.length + COMMON_REST_PROBE_PATHS.length,
    scanDurationMs: Math.round(performance.now() - startTime),
  };
}
