import { z } from "@hono/zod-openapi";

export const AiQueryRequestSchema = z.object({
  question: z.string().min(1).openapi({
    description: "Natural language query grounded in the tenant's Runtime Model",
    example: "Why did latency spike after the last configuration change?",
  }),
}).openapi({
  title: "AiQueryRequest",
});

export const AiCitationSchema = z.object({
  sourceType: z.string().openapi({ example: "audit" }),
  sourceId: z.string().openapi({ example: "aud_123abc" }),
}).openapi({
  title: "AiCitation",
});

export const AiQueryResponseSchema = z.object({
  answer: z.string().openapi({
    example: "After the latest configuration updates (2 events), review latency on the Runtime Overview. The system cannot prove causality; these are potential contributing factors.",
  }),
  citations: z.array(AiCitationSchema),
  intent: z.any().openapi({ description: "Parsed query intent and parameters" }),
  uncertainty: z.string().openapi({
    example: "Answers are grounded in tenant-scoped Runtime Model data and do not prove causality.",
  }),
}).openapi({
  title: "AiQueryResponse",
});

export const AiQueryLogItemSchema = z.object({
  id: z.string().openapi({ example: "aiq_123abc" }),
  question: z.string().openapi({ example: "What changed before the incident?" }),
  answer: z.string().openapi({ example: "Potential contributing factors for the latest incident..." }),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
  citations: z.array(AiCitationSchema),
}).openapi({
  title: "AiQueryLogItem",
});

export const ListAiQueriesResponseSchema = z.object({
  queries: z.array(AiQueryLogItemSchema),
}).openapi({
  title: "ListAiQueriesResponse",
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "UNAUTHORIZED" }),
  message: z.string().optional().openapi({ example: "Organization context required" }),
});
