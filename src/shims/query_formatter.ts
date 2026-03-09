// Minimal shim for QueryFormatter used in your component
export class QueryFormatter {
  constructor(definition?: any) {
    // store definition if needed
  }

  formatQuery(query: string): string {
    // simple no-op formatter; replace with real formatting logic if available
    return query;
  }
}
