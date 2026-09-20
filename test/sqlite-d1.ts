import { DatabaseSync } from "node:sqlite";

type SqlValue = string | number | null;

function isSqlValue(value: unknown): value is SqlValue {
  return value === null || typeof value === "string" || typeof value === "number";
}

function bindValues(values: unknown[]): SqlValue[] {
  return values.map((value) => {
    if (!isSqlValue(value)) {
      throw new TypeError(`Unsupported D1 bind value: ${typeof value}`);
    }
    return value;
  });
}

function meta(changes: number, lastRowId: number) {
  return {
    changes,
    last_row_id: lastRowId,
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: changes,
    changed_db: changes > 0,
  };
}

class MemoryD1Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SqlValue[] = [],
  ) {}

  bind(...values: unknown[]): MemoryD1Statement {
    return new MemoryD1Statement(this.db, this.sql, bindValues(values));
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<{
    success: true;
    results: T[];
    meta: ReturnType<typeof meta>;
  }> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { success: true, results, meta: meta(0, 0) };
  }

  async run(): Promise<{
    success: true;
    results: never[];
    meta: ReturnType<typeof meta>;
  }> {
    const result = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      results: [],
      meta: meta(Number(result.changes), Number(result.lastInsertRowid)),
    };
  }
}

export class MemoryD1Database {
  private readonly db = new DatabaseSync(":memory:");

  prepare(query: string): MemoryD1Statement {
    return new MemoryD1Statement(this.db, query);
  }

  async batch(statements: MemoryD1Statement[]): Promise<unknown[]> {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    this.db.exec(query);
    return { count: 0, duration: 0 };
  }
}

export function createSqliteD1(): D1Database {
  return new MemoryD1Database() as unknown as D1Database;
}

export function emptyD1Env(db: D1Database): CloudflareBindings {
  return {
    DB: db,
    VISITORS: undefined as unknown as KVNamespace,
    TYPESAFE_MODEL: "jev-latest",
    TYPESAFE_BASE_URL: "https://api.typesafe.ai",
  };
}
