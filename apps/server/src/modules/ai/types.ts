import type { NlQueryIntent } from "@strim/shared";

export type { NlQueryIntent };

export type AiQueryInput = {
  question: string;
};

export type AiCitation = {
  sourceType: string;
  sourceId: string;
};

export type AiQueryOutput = {
  answer: string;
  citations: AiCitation[];
  intent: NlQueryIntent;
  uncertainty: string;
};
