import type { PrismaClient } from "@prisma/client";
import type { TraceWaterfallResult } from "./types";

export class RequestService {
  /**
   * Search and filter request records within the organization.
   */
  static async searchRequests(
    db: PrismaClient,
    organizationId: string,
    filter: {
      environmentId?: string;
      service?: string;
      method?: string;
      status?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const where = {
      organizationId,
      ...(filter.environmentId ? { environmentId: filter.environmentId } : {}),
      ...(filter.service ? { service: filter.service } : {}),
      ...(filter.method ? { method: filter.method } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };

    const take = Math.min(filter.limit ?? 50, 200);
    const skip = filter.offset ?? 0;

    const [requests, total] = await Promise.all([
      db.requestRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.requestRecord.count({ where }),
    ]);

    return { requests, total };
  }

  /**
   * Retrieves a single request record by ID.
   */
  static async getRequestById(db: PrismaClient, organizationId: string, id: string) {
    return db.requestRecord.findFirst({
      where: { id, organizationId },
    });
  }

  /**
   * Generates a trace waterfall with timeline offsets for all spans matching traceId.
   */
  static async getTraceWaterfall(
    db: PrismaClient,
    organizationId: string,
    id: string,
  ): Promise<TraceWaterfallResult | null> {
    const root = await db.requestRecord.findFirst({
      where: { id, organizationId },
    });
    if (!root) return null;

    const spans = await db.requestRecord.findMany({
      where: { traceId: root.traceId, organizationId },
      orderBy: { createdAt: "asc" },
    });

    const rootTime = new Date(root.createdAt).getTime();

    const formattedSpans = spans.map((s) => {
      const spanTime = new Date(s.createdAt).getTime();
      const offsetMs = Math.max(0, spanTime - rootTime);
      return {
        id: s.id,
        service: s.service,
        path: s.path,
        method: s.method,
        status: s.status,
        durationMs: s.durationMs,
        offsetMs,
        createdAt: s.createdAt,
      };
    });

    const maxSpanEnd = formattedSpans.reduce(
      (max, span) => Math.max(max, span.offsetMs + span.durationMs),
      root.durationMs,
    );

    return {
      root,
      totalDurationMs: Math.max(root.durationMs, maxSpanEnd),
      spans: formattedSpans,
    };
  }
}
