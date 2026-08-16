/** Extracted redaction package (Phase 10). Implementation lives in @strim/shared to avoid dual sources. */
export {
  redactString,
  redactHeaders,
  redactJson,
  isDangerousReplayTarget,
  REDACTED_PLACEHOLDER,
  type RedactionRule,
} from "@strim/shared";
