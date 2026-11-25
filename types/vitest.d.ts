declare module "vitest" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: unknown): {
    toBeUndefined(): void;
    toBeNull(): void;
    toEqual(expected: unknown): void;
    toMatchObject(expected: Record<string, unknown>): void;
    toContain(item: unknown): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    toThrow(message?: string | RegExp): void;
    not: { toThrow(message?: string | RegExp): void };
  };
  export function vi(): {
    mock<T extends (...args: never[]) => unknown>(fn: T): T & { mock: { calls: unknown[] } };
    fn<T extends (...args: never[]) => unknown>(impl?: T): T & { mock: { calls: unknown[] } };
    mocked<T extends (...args: never[]) => unknown>(fn: T): T & { mockReset(): void; mockReturnValue(v: unknown): void; mockResolvedValue(v: unknown): void };
  };
  export const beforeEach: (fn: () => void) => void;
  export const afterEach: (fn: () => void) => void;
  export const beforeAll: (fn: () => void) => void;
  export const afterAll: (fn: () => void) => void;
}
