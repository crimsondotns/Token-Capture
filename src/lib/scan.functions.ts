import { createServerFn } from "@tanstack/react-start";
import { performScan } from "./scan-impl";
import type { SourcePref } from "./types";

export const runScan = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!data || typeof data !== "object") {
      throw new Error("Paste a URL, slug, or symbol first — then press Scan.");
    }
    const rec = data as Record<string, unknown>;
    const query = typeof rec.query === "string" ? rec.query : "";
    const source = rec.source;
    const pref: SourcePref =
      source === "dex" || source === "cmc" || source === "auto" ? source : "auto";
    return { query, source: pref };
  })
  .handler(async ({ data }) => {
    return performScan(data);
  });
