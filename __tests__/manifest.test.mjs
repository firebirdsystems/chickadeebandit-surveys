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

  it("each query file is a single statement (no semicolons)", () => {
    for (const name of ai.db_exports) {
      const path = join(__dirname, `../src/queries/${name}.sql`);
      const sql = readFileSync(path, "utf-8");
      expect(sql.includes(";"), `src/queries/${name}.sql must not contain semicolons`).toBe(false);
    }
  });
});

// ── row_policies ─────────────────────────────────────────────────────────────

describe("manifest.json row_policies", () => {
  const rp = manifest.row_policies ?? {};

  it("surveys table has adult_writable policy", () => {
    expect(rp.surveys?.kind).toBe("adult_writable");
  });

  it("questions table has adult_writable policy", () => {
    expect(rp.questions?.kind).toBe("adult_writable");
  });

  it("response_receipts has owner_only policy", () => {
    expect(rp.response_receipts?.kind).toBe("owner_only");
  });

  it("response_receipts disables adults_bypass (anonymity guaranteed)", () => {
    expect(rp.response_receipts?.adults_bypass).toBe(false);
  });

  it("response_receipts disables member_can_update (receipts are immutable)", () => {
    expect(rp.response_receipts?.member_can_update).toBe(false);
  });

  it("responses are readable and writable only through the trusted results/submission endpoints", () => {
    expect(rp.responses).toEqual({ kind: "endpoint_only", read: "none" });
    expect(rp.response_receipts?.endpoint_writes_only).toBe(true);
  });
});

// ── anonymous_responses ───────────────────────────────────────────────────────

describe("manifest.json anonymous_responses", () => {
  const ar = manifest.anonymous_responses ?? {};

  const requiredFields = [
    "receipt_table", "session_column", "member_column", "created_at_column",
    "response_table", "response_session_column",
    "response_answer_column", "response_id_column", "response_created_at_column",
    "session_table", "session_id_column", "session_status_column", "session_open_value",
  ];

  for (const field of requiredFields) {
    it(`has required field: ${field}`, () => {
      expect(typeof ar[field]).toBe("string");
      expect(ar[field].trim().length).toBeGreaterThan(0);
    });
  }

  it("uses response_receipts as receipt_table", () => {
    expect(ar.receipt_table).toBe("response_receipts");
  });

  it("uses responses as response_table", () => {
    expect(ar.response_table).toBe("responses");
  });

  it("uses surveys as session_table", () => {
    expect(ar.session_table).toBe("surveys");
  });

  it("session_open_value is 'open'", () => {
    expect(ar.session_open_value).toBe("open");
  });

  it("declares response_member_column (hub conditionally stores member_id for non-anonymous surveys)", () => {
    expect(ar.response_member_column).toBe("member_id");
  });

  it("declares session_anonymous_column (hub reads this to decide anonymity per session)", () => {
    expect(ar.session_anonymous_column).toBe("anonymous");
  });

  it("releases results only after closure and validates question ownership", () => {
    expect(ar.result_visible_values).toEqual(["closed"]);
    expect(ar.question_table).toBe("questions");
    expect(ar.question_session_column).toBe("survey_id");
    expect(ar.question_id_column).toBe("id");
  });

  it("declares response_question_column for question_id", () => {
    expect(ar.response_question_column).toBe("question_id");
  });
});

// ── publish_acls ─────────────────────────────────────────────────────────────

describe("manifest.json publish_acls", () => {
  it("survey.created requires adult role", () => {
    expect(manifest.publish_acls?.["survey.created"]?.require_role).toBe("adult");
  });

  it("survey.closed requires adult role", () => {
    expect(manifest.publish_acls?.["survey.closed"]?.require_role).toBe("adult");
  });
});

// ── migrations ───────────────────────────────────────────────────────────────

describe("migrations", () => {
  it("001_init.sql exists and defines the core tables", () => {
    const path = join(__dirname, "../migrations/001_init.sql");
    expect(existsSync(path)).toBe(true);
    const sql = readFileSync(path, "utf-8");
    for (const table of ["surveys", "questions", "responses"]) {
      expect(sql, `missing table: app_surveys__${table}`)
        .toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS app_surveys__${table}`, "i"));
    }
  });

  it("001 migration adds response_receipts table", () => {
    const sql = readFileSync(join(__dirname, "../migrations/001_init.sql"), "utf-8");
    expect(sql).toMatch(/CREATE TABLE.*app_surveys__response_receipts/i);
  });

  it("001 migration creates responses with nullable member_id without destructive SQL", () => {
    const sql = readFileSync(join(__dirname, "../migrations/001_init.sql"), "utf-8");
    expect(sql).toMatch(/CREATE TABLE.*app_surveys__responses/i);
    expect(sql).toMatch(/member_id\s+TEXT(?!\s+NOT NULL)/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
