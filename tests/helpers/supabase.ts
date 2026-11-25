import { vi } from "vitest";


// Minimal controllable mock of the Supabase server/admin client surface used by
// app/actions.ts and lib/auth.ts. Tests configure behaviour via setClient().
export type TableRow = Record<string, unknown>;

interface QueryBuilder {
  select: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
  eq: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
  maybeSingle: ReturnType<typeof vi.fn> & { (): Promise<{ data: TableRow | null; error: Error | null }> };
  insert: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
  update: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
  delete: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
  order: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
  limit: ReturnType<typeof vi.fn> & { (...args: unknown[]): QueryBuilder };
}

interface MockAuth {
  signInWithPassword: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  admin?: {
    createUser: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };
}

interface MockClient {
  from: (table: string) => QueryBuilder;
  rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
  auth: MockAuth;
}

let currentClient: MockClient | null = null;

export function setClient(client: MockClient) {
  currentClient = client;
}

export function getClient(): MockClient {
  if (!currentClient) throw new Error("No supabase mock client configured. Call setClient() first.");
  return currentClient;
}

export function clearClient() {
  currentClient = null;
}

// Build a realistic mock client from declarative table data.
export function createMockClient(opts: {
  tables?: Record<string, TableRow[]>;
  rpc?: Record<string, unknown>;
  auth?: MockAuth & { admin?: MockAuth["admin"] };
}): MockClient {
  const tables = new Map<string, TableRow[]>(Object.entries(opts.tables || {}));
  const rpcResults = opts.rpc || {};

  function buildQuery(initialRows: TableRow[]): QueryBuilder {
    let rows = [...initialRows];
    const filters: Array<{ column: string; value: unknown }> = [];
    const applyFilters = () => {
      rows = rows.filter((row) => filters.every(({ column, value }) => row[column] === value));
    };

    const select = vi.fn(function (this: QueryBuilder) {
      return this;
    }) as QueryBuilder["select"];
    const eq = vi.fn(function (this: QueryBuilder, column: string, value: unknown) {
      filters.push({ column, value });
      return this;
    }) as QueryBuilder["eq"];
    const maybeSingle = vi.fn(async function (this: QueryBuilder) {
      applyFilters();
      const data = rows.length ? rows[0] : null;
      return { data, error: null };
    }) as QueryBuilder["maybeSingle"];
    const insert = vi.fn(function (this: QueryBuilder, value: TableRow) {
      rows.push(value);
      return this;
    }) as QueryBuilder["insert"];
    const update = vi.fn(function (this: QueryBuilder, values: TableRow) {
      applyFilters();
      for (const row of rows) {
        Object.assign(row, values);
      }
      return this;
    }) as QueryBuilder["update"];
    const del = vi.fn(function (this: QueryBuilder) {
      applyFilters();
      rows = rows.filter((row) => !filters.every(({ column, value }) => row[column] === value));
      return this;
    }) as QueryBuilder["delete"];
    const order = vi.fn(function (this: QueryBuilder) { return this; }) as QueryBuilder["order"];
    const limit = vi.fn(function (this: QueryBuilder) { return this; }) as QueryBuilder["limit"];

    return { select, eq, maybeSingle, insert, update, delete: del, order, limit };
  }

  const from = vi.fn((table: string): QueryBuilder => {
    return buildQuery(tables.get(table) || []);
  }) as MockClient["from"];

  const rpc = vi.fn(async (_name: string): Promise<{ data: unknown; error: Error | null }> => {
    if (_name in rpcResults) return { data: rpcResults[_name], error: null };
    return { data: null, error: new Error(`Unknown RPC: ${_name}`) };
  }) as MockClient["rpc"];

  const auth: MockAuth = {
    signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...opts.auth,
  };

  return { from, rpc, auth };
}
