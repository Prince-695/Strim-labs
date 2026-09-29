import type { CacheRecommendation } from "@strim/shared";

export type { CacheRecommendation };

export type CreateCacheRuleInput = {
  environmentId: string;
  endpoint: string;
  method: string;
  ttlSeconds: number;
  tags?: string[];
};

export type UpdateCacheRuleInput = {
  endpoint?: string;
  method?: string;
  ttlSeconds?: number;
  enabled?: boolean;
  tags?: string[];
};

export type InvalidateCacheInput = {
  kind: "manual" | "tag" | "endpoint";
  cacheRuleId?: string;
  tags?: string[];
};
