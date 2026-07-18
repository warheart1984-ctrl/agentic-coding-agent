declare module "sql.js" {
  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    run(sql: string, params?: unknown[]): void;
    getAsObject(params: unknown[]): ParamsObject | null;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    run(params: unknown[]): this;
    getAsObject(params: unknown[]): ParamsObject | null;
    all(params: unknown[]): ParamsObject[];
    free(): void;
    bind(params: unknown[]): this;
  }

  interface ParamsObject {
    [key: string]: SqlValue;
  }

  type SqlValue = string | number | boolean | null | Uint8Array;

  interface SqlJsStatic {
    (config: { locateFile: (file: string) => string }): Promise<{
      Database: new (data?: Uint8Array) => Database;
    }>;
  }

  const initSqlJs: SqlJsStatic;
  export default initSqlJs;
}