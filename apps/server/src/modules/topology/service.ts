import { blastRadius, dependsOn, whatBreaksIfUnavailable } from "@strim/shared";
import type { PrismaClient } from "@prisma/client";
import type { AnnotateTopologyInput, TopologyQueryType } from "./types";

export class TopologyService {
  /**
   * Fetches the complete topology graph (nodes and edges) for an environment.
   */
  static async getGraph(db: PrismaClient, organizationId: string, environmentId: string) {
    const [nodes, edges] = await Promise.all([
      db.topologyNode.findMany({ where: { environmentId, organizationId } }),
      db.topologyEdge.findMany({ where: { environmentId, organizationId } }),
    ]);
    return { nodes, edges };
  }

  /**
   * Manually annotates or overrides a dependency relationship between services.
   */
  static async annotateEdge(db: PrismaClient, organizationId: string, input: AnnotateTopologyInput) {
    const { environmentId, fromName, toName } = input;

    await db.topologyNode.upsert({
      where: { environmentId_name: { environmentId, name: fromName } },
      create: { organizationId, environmentId, name: fromName, manual: true },
      update: { manual: true },
    });

    await db.topologyNode.upsert({
      where: { environmentId_name: { environmentId, name: toName } },
      create: { organizationId, environmentId, name: toName, manual: true },
      update: { manual: true },
    });

    return db.topologyEdge.upsert({
      where: {
        environmentId_fromName_toName: {
          environmentId,
          fromName,
          toName,
        },
      },
      create: { organizationId, environmentId, fromName, toName, manual: true },
      update: { manual: true },
    });
  }

  /**
   * Evaluates graph queries: 'depends', 'breaks', or 'blast'.
   */
  static async queryGraph(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
    node: string,
    queryType: TopologyQueryType = "depends",
  ): Promise<string[]> {
    const edges = await db.topologyEdge.findMany({
      where: { environmentId, organizationId },
    });

    const mapped = edges.map((e) => ({ from: e.fromName, to: e.toName }));

    if (queryType === "breaks") {
      return whatBreaksIfUnavailable(node, mapped);
    }
    if (queryType === "blast") {
      return blastRadius(node, mapped);
    }
    return dependsOn(node, mapped);
  }
}
