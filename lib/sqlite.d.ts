declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): { run(...values: (string | number | null)[]): { changes: number }; get(...values: (string | number | null)[]): unknown; all(...values: (string | number | null)[]): unknown[] };
  }
}
