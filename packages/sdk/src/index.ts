import { StrimClient } from "./client";

export * from "./types";
export * from "./ring-buffer";
export * from "./client";

export const strim = new StrimClient();

export default strim;
