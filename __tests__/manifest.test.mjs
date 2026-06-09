import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

const VALID_STORAGE   = ["kv", "db", "none"];
const VALID_AUDIENCES = ["everyone", "adults", "children"];

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it("entrypoint is index.html", () => expect(manifest.entrypoint).toBe("index.html"));
  it("runtime is static",        () => expect(manifest.runtime).toBe("static"));

  it("storage is declared and valid", () => {
    expect(manifest.storage, "storage field is required").toBeTruthy();
    expect(VALID_STORAGE).toContain(manifest.storage);
  });

  it("storage is db", () => expect(manifest.storage).toBe("db"));

  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));

  it("permissions.default_audience is valid", () => {
    expect(VALID_AUDIENCES).toContain(manifest.permissions.default_audience);
  });

  it("permissions.requires_approval is boolean", () => {
    expect(typeof manifest.permissions.requires_approval).toBe("boolean");
  });

  it("data_access has reads and writes arrays", () => {
    expect(Array.isArray(manifest.data_access.reads)).toBe(true);
    expect(Array.isArray(manifest.data_access.writes)).toBe(true);
  });

  it("reads family.members", () => {
    expect(manifest.data_access.reads).toContain("family.members");
  });

  it("has a nav label", () => {
    expect(manifest.nav?.label).toBeTruthy();
  });
});

// ── ai_access ─────────────────────────────────────────────────────────────────

describe("manifest.json ai_access", () => {
  const ai = manifest.ai_access;

  it("ai_access field is present", () => {
    expect(ai, "ai_access is required for this app").toBeDefined();
  });

  it("allowed is true", () => {
    expect(ai.allowed).toBe(true);
  });

  it("mode is read or read_write", () => {
    expect(["read", "read_write"]).toContain(ai.mode);
  });

  it("db_exports is an array of non-empty strings", () => {
    expect(Array.isArray(ai.db_exports)).toBe(true);
    expect(ai.db_exports.length).toBeGreaterThan(0);
    for (const name of ai.db_exports) {
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("each db_export name has a corresponding src/queries/{name}.sql file", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      expect(existsSync(path), `missing query file: src/queries/${name}.sql`).toBe(true);
    }
  });

  it("each query file starts with SELECT or WITH (no write statements)", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      const sql = readFileSync(path, "utf-8").trim();
      expect(
        /^(SELECT|WITH)\b/i.test(sql),
        `src/queries/${name}.sql must start with SELECT or WITH, got: ${sql.slice(0, 40)}`
      ).toBe(true);
    }
  });

  it("each query file filters by household_id", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      const sql = readFileSync(path, "utf-8");
      expect(
        sql.includes("household_id"),
        `src/queries/${name}.sql must filter by household_id to prevent cross-household data leaks`
      ).toBe(true);
    }
  });

  it("each query file is a single statement (no semicolons)", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      const sql = readFileSync(path, "utf-8");
      expect(sql.includes(";"), `src/queries/${name}.sql must not contain semicolons`).toBe(false);
    }
  });
});

// ── migrations ───────────────────────────────────────────────────────────────

describe("migrations", () => {
  it("001_init.sql exists and defines the core tables", () => {
    const path = join(__dirname, "../migrations/001_init.sql");
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, "utf-8");
    for (const table of ["surveys", "questions", "responses"]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, "i"));
    }
    expect(sql).toMatch(/household_id/);
  });
});
