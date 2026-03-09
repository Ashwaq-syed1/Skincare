// src/typings.d.ts
// src/typings.d.ts
declare module 'google3/third_party/javascript/google_sql/language/google_sql' {
  export interface GoogleSqlDefinition { text?: string; parsed?: any; [k: string]: any; }
  // add a runtime value if your code expects one:
  export const GoogleSqlDefinition: any;
  export default GoogleSqlDefinition;
}


// src/typings.d.ts
declare module 'google3/third_party/javascript/google_sql/query_formatter' {
  export interface QueryFormatterInstance {
    formatQuery(sql: string, options?: any): string;
    // other instance methods...
  }

  // Constructable runtime export with a proper method
  export class QueryFormatterConstructor {
    constructor(options?: any);
    formatQuery(sql: string, options?: any): string;
    // other methods...
  }

  export { QueryFormatterConstructor as QueryFormatter };
  export default QueryFormatterConstructor;
}



