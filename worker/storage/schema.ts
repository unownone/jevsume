/**
 * Idempotent D1 bootstrap used when the binding exists but wrangler
 * migrations have not been applied (local first-run, preview deploys).
 * Keep in sync with files in /migrations.
 *
 * Run one statement at a time with prepare()/run(). D1.exec() splits on
 * newlines, so a multi-line CREATE TABLE becomes "incomplete input".
 */
export const D1_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  filename TEXT,
  source TEXT,
  content_hash TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_content_hash ON resumes(content_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_resumes_source ON resumes(source)`,
  `CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  job_description TEXT NOT NULL,
  requirements_json TEXT NOT NULL,
  sections_json TEXT NOT NULL DEFAULT '{"expected":[],"goodToHave":[],"skills":[]}',
  created_at TEXT NOT NULL
) STRICT`,
  `ALTER TABLE personas ADD COLUMN sections_json TEXT NOT NULL DEFAULT '{"expected":[],"goodToHave":[],"skills":[]}'`,
  `CREATE INDEX IF NOT EXISTS idx_personas_created_at ON personas(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_personas_title ON personas(title)`,
  `CREATE TABLE IF NOT EXISTS persona_tags (
  persona_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (persona_id, tag),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_persona_tags_tag ON persona_tags(tag)`,
  `CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  resume_id TEXT,
  persona_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  jev_score INTEGER,
  prompt_hash TEXT NOT NULL,
  input_json TEXT NOT NULL,
  prompt_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  review_json TEXT,
  usage_input_tokens INTEGER,
  usage_output_tokens INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resume_id) REFERENCES resumes(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_kind ON eval_runs(kind)`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_resume ON eval_runs(resume_id)`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_persona ON eval_runs(persona_id)`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_score ON eval_runs(jev_score)`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_provider ON eval_runs(provider)`,
  `CREATE INDEX IF NOT EXISTS idx_eval_runs_prompt_hash ON eval_runs(prompt_hash)`,
  `CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
) STRICT`,
];

const prepared = new WeakSet<D1Database>();

export async function ensureD1Schema(db: D1Database): Promise<void> {
  if (prepared.has(db)) {
    return;
  }
  for (const sql of D1_SCHEMA_STATEMENTS) {
    try {
      await db.prepare(sql).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column/i.test(message)) {
        throw error;
      }
    }
  }
  prepared.add(db);
}
