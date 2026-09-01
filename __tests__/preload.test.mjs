import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const html = readFileSync(join(__dirname, "../src/index.html"), "utf-8");
const norm = (s) => s.replace(/\s+/g, " ").trim();

// The hub runs `manifest.preload` while rendering the document and answers the
// app's matching api/db request from the embedded rows — matching on the
// statement text with whitespace collapsed. A drifted copy is not an error
// anywhere: it is a preload that silently never answers. So the manifest is
// checked against the source here.
describe("manifest.preload mirrors the app's first-render reads", () => {
  const body = norm(html);
  const prefix = `app_${manifest.id.replace(/-/g, "_")}__`;

  it("declares statements the app posts, byte-for-byte after whitespace collapse", () => {
    for (const [name, { sql }] of Object.entries(manifest.preload)) {
      expect(body.includes(norm(sql)), `preload.${name} is not the text src/index.html posts`).toBe(true);
    }
  });

  it("stays within the hub's caps and reads only this app's tables", () => {
    expect(Object.keys(manifest.preload).length).toBeLessThanOrEqual(6);
    for (const [name, { sql, params = [] }] of Object.entries(manifest.preload)) {
      expect(sql, name).toMatch(/^(SELECT|WITH) /);
      expect(sql, name).not.toMatch(/;|--/);
      for (const table of sql.match(/(?:FROM|JOIN)\s+(\w+)/g) ?? []) expect(table, name).toMatch(new RegExp(`\\s${prefix}`));
      expect((sql.match(/\?/g) ?? []).length, `${name}: placeholders vs params`).toBe(params.length);
    }
  });

  // Two preloads scope themselves with `survey_id IN (SELECT id FROM
  // app_surveys__surveys ...)`. The row-policy rewriter fails closed on a
  // governed table it has to inject a predicate into when that table is named
  // only inside a subquery — those statements are legal solely because
  // adult_writable WITHOUT a member_read_column appends nothing on a SELECT, so
  // there is no predicate to inject. Adding one would not fail here or in
  // contract-CI; it would make both preloads throw at runtime, which reads as
  // "the survey list has no questions". Pinned so the precondition cannot be
  // removed silently.
  it("keeps the surveys policy read-unscoped, which the subquery preloads depend on", () => {
    const subqueryPreloads = Object.entries(manifest.preload)
      .filter(([, { sql }]) => /IN\s*\(\s*SELECT/i.test(sql))
      .map(([name]) => name);
    expect(subqueryPreloads.length, "expected the scoped child preloads").toBeGreaterThan(0);
    expect(
      manifest.row_policies.surveys.member_read_column,
      `row_policies.surveys.member_read_column would break preload(s): ${subqueryPreloads.join(", ")} — rewrite them as JOINs first`,
    ).toBeUndefined();
  });
});
