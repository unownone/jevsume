import type { JobPersona, ProviderId } from "../../packages/jev/types.ts";
import { assertNever } from "../../packages/jev/types.ts";
import { clampLimit } from "./limits.ts";
import type {
  EvalListFilter,
  EvalRunSummary,
  EvalStore,
  PersonaListFilter,
  PersonaStore,
  ResumeListFilter,
  ResumeStore,
  StoredEvalRun,
  StoredResume,
} from "./types.ts";
import { parseEvalKind } from "./types.ts";

type ResumeRow = {
  id: string;
  text: string;
  filename: string | null;
  source: string | null;
  content_hash: string;
  char_count: number;
  created_at: string;
};

type PersonaRow = {
  id: string;
  title: string;
  tags_json: string;
  job_description: string;
  requirements_json: string;
  created_at: string;
};

type EvalSummaryRow = {
  id: string;
  kind: string;
  resume_id: string | null;
  persona_id: string | null;
  provider: string;
  model: string | null;
  jev_score: number | null;
  prompt_hash: string;
  created_at: string;
};

type EvalRow = EvalSummaryRow & {
  input_json: string;
  prompt_json: string;
  output_json: string;
  review_json: string | null;
  usage_input_tokens: number | null;
  usage_output_tokens: number | null;
};

function optionalText(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

function resumeFromRow(row: ResumeRow): StoredResume {
  return {
    id: row.id,
    text: row.text,
    filename: optionalText(row.filename),
    source: optionalText(row.source),
    contentHash: row.content_hash,
    charCount: row.char_count,
    createdAt: row.created_at,
  };
}

function personaFromRow(row: PersonaRow): JobPersona {
  return {
    id: row.id,
    title: row.title,
    tags: JSON.parse(row.tags_json) as string[],
    jobDescription: row.job_description,
    requirements: JSON.parse(row.requirements_json) as JobPersona["requirements"],
    createdAt: row.created_at,
  };
}

function parseProvider(value: string): ProviderId {
  const provider = value as ProviderId;
  switch (provider) {
    case "jev":
    case "mock":
      return provider;
    default:
      return assertNever(provider, `Unknown provider: ${value}`);
  }
}

function summaryFromRow(row: EvalSummaryRow): EvalRunSummary {
  return {
    id: row.id,
    kind: parseEvalKind(row.kind),
    resumeId: row.resume_id,
    personaId: row.persona_id,
    provider: parseProvider(row.provider),
    model: row.model,
    jevScore: row.jev_score,
    promptHash: row.prompt_hash,
    createdAt: row.created_at,
  };
}

function evalFromRow(row: EvalRow): StoredEvalRun {
  return {
    ...summaryFromRow(row),
    input: JSON.parse(row.input_json),
    prompt: JSON.parse(row.prompt_json),
    output: JSON.parse(row.output_json),
    review: row.review_json ? JSON.parse(row.review_json) : null,
    usageInputTokens: row.usage_input_tokens,
    usageOutputTokens: row.usage_output_tokens,
  };
}

export class D1ResumeStore implements ResumeStore {
  constructor(private readonly db: D1Database) {}

  async put(resume: StoredResume): Promise<StoredResume> {
    await this.db
      .prepare(
        `INSERT INTO resumes (id, text, filename, source, content_hash, char_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        resume.id,
        resume.text,
        resume.filename ?? null,
        resume.source ?? null,
        resume.contentHash,
        resume.charCount,
        resume.createdAt,
      )
      .run();
    return resume;
  }

  async get(id: string): Promise<StoredResume | null> {
    const row = await this.db
      .prepare(
        `SELECT id, text, filename, source, content_hash, char_count, created_at
         FROM resumes WHERE id = ?`,
      )
      .bind(id)
      .first<ResumeRow>();
    return row ? resumeFromRow(row) : null;
  }

  async getByHash(contentHash: string): Promise<StoredResume | null> {
    const row = await this.db
      .prepare(
        `SELECT id, text, filename, source, content_hash, char_count, created_at
         FROM resumes WHERE content_hash = ?`,
      )
      .bind(contentHash)
      .first<ResumeRow>();
    return row ? resumeFromRow(row) : null;
  }

  async list(filter: ResumeListFilter = {}): Promise<StoredResume[]> {
    const clauses: string[] = [];
    const binds: unknown[] = [];
    const source = filter.source?.trim();
    const query = filter.q?.trim();
    if (source) {
      clauses.push("source = ?");
      binds.push(source);
    }
    if (query) {
      clauses.push("(text LIKE ? ESCAPE '\\' OR IFNULL(filename, '') LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(query)}%`;
      binds.push(like, like);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.db
      .prepare(
        `SELECT id, text, filename, source, content_hash, char_count, created_at
         FROM resumes ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, clampLimit(filter.limit))
      .all<ResumeRow>();
    return result.results.map(resumeFromRow);
  }
}

export class D1PersonaStore implements PersonaStore {
  constructor(private readonly db: D1Database) {}

  async put(persona: JobPersona): Promise<JobPersona> {
    const statements = [
      this.db
        .prepare(
          `INSERT INTO personas (id, title, tags_json, job_description, requirements_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          persona.id,
          persona.title,
          JSON.stringify(persona.tags),
          persona.jobDescription,
          JSON.stringify(persona.requirements),
          persona.createdAt,
        ),
    ];
    for (const tag of persona.tags) {
      statements.push(
        this.db
          .prepare(`INSERT INTO persona_tags (persona_id, tag) VALUES (?, ?)`)
          .bind(persona.id, tag),
      );
    }
    await this.db.batch(statements);
    return persona;
  }

  async get(id: string): Promise<JobPersona | null> {
    const row = await this.db
      .prepare(
        `SELECT id, title, tags_json, job_description, requirements_json, created_at
         FROM personas WHERE id = ?`,
      )
      .bind(id)
      .first<PersonaRow>();
    return row ? personaFromRow(row) : null;
  }

  async list(filter: PersonaListFilter = {}): Promise<JobPersona[]> {
    const clauses: string[] = [];
    const binds: unknown[] = [];
    const query = filter.q?.trim();
    const tag = filter.tag?.trim();
    if (query) {
      clauses.push("(title LIKE ? ESCAPE '\\' OR job_description LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(query)}%`;
      binds.push(like, like);
    }
    if (tag) {
      clauses.push(
        "id IN (SELECT persona_id FROM persona_tags WHERE tag = ? COLLATE NOCASE)",
      );
      binds.push(tag);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.db
      .prepare(
        `SELECT id, title, tags_json, job_description, requirements_json, created_at
         FROM personas ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, clampLimit(filter.limit))
      .all<PersonaRow>();
    return result.results.map(personaFromRow);
  }
}

export class D1EvalStore implements EvalStore {
  constructor(private readonly db: D1Database) {}

  async put(run: StoredEvalRun): Promise<StoredEvalRun> {
    await this.db
      .prepare(
        `INSERT INTO eval_runs (
           id, kind, resume_id, persona_id, provider, model, jev_score, prompt_hash,
           input_json, prompt_json, output_json, review_json,
           usage_input_tokens, usage_output_tokens, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        run.id,
        run.kind,
        run.resumeId,
        run.personaId,
        run.provider,
        run.model,
        run.jevScore,
        run.promptHash,
        JSON.stringify(run.input),
        JSON.stringify(run.prompt),
        JSON.stringify(run.output),
        run.review ? JSON.stringify(run.review) : null,
        run.usageInputTokens,
        run.usageOutputTokens,
        run.createdAt,
      )
      .run();
    return run;
  }

  async get(id: string): Promise<StoredEvalRun | null> {
    const row = await this.db
      .prepare(
        `SELECT id, kind, resume_id, persona_id, provider, model, jev_score, prompt_hash,
                input_json, prompt_json, output_json, review_json,
                usage_input_tokens, usage_output_tokens, created_at
         FROM eval_runs WHERE id = ?`,
      )
      .bind(id)
      .first<EvalRow>();
    return row ? evalFromRow(row) : null;
  }

  async list(filter: EvalListFilter = {}): Promise<EvalRunSummary[]> {
    const clauses: string[] = [];
    const binds: unknown[] = [];
    if (filter.kind) {
      clauses.push("kind = ?");
      binds.push(filter.kind);
    }
    if (filter.resumeId) {
      clauses.push("resume_id = ?");
      binds.push(filter.resumeId);
    }
    if (filter.personaId) {
      clauses.push("persona_id = ?");
      binds.push(filter.personaId);
    }
    if (filter.provider) {
      clauses.push("provider = ?");
      binds.push(filter.provider);
    }
    if (filter.promptHash) {
      clauses.push("prompt_hash = ?");
      binds.push(filter.promptHash);
    }
    if (filter.minScore !== undefined) {
      clauses.push("jev_score IS NOT NULL AND jev_score >= ?");
      binds.push(filter.minScore);
    }
    if (filter.maxScore !== undefined) {
      clauses.push("jev_score IS NOT NULL AND jev_score <= ?");
      binds.push(filter.maxScore);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.db
      .prepare(
        `SELECT id, kind, resume_id, persona_id, provider, model, jev_score, prompt_hash, created_at
         FROM eval_runs ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, clampLimit(filter.limit))
      .all<EvalSummaryRow>();
    return result.results.map(summaryFromRow);
  }
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function createD1Stores(db: D1Database) {
  return {
    kind: "d1" as const,
    personas: new D1PersonaStore(db),
    resumes: new D1ResumeStore(db),
    evals: new D1EvalStore(db),
  };
}
