// src/app/chat-message.component.ts
import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OverlayModule } from '@angular/cdk/overlay';

// import { GoogleSqlDefinition } from 'google3/third_party/javascript/google_sql/language/google_sql';
// import { QueryFormatter } from 'google3/third_party/javascript/google_sql/query_formatter';

import { GoogleSqlDefinition } from '../shims/google_sql';
import { QueryFormatter } from '../shims/query_formatter';

import { ChatMessage, ViewCodeEvent } from './types';
import { DataTableComponent, TableData } from './data-table.component';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    DataTableComponent,
    OverlayModule,
  ],
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
})
export class ChatMessageComponent {
  /** Inputs / Outputs */
  @Input() message!: ChatMessage;
  @Output() viewCode = new EventEmitter<ViewCodeEvent>();
  @Output() orderConfirmed = new EventEmitter<ChatMessage['orderDetails']>();

  /** ViewChild for the SQL view button (template should have #viewSql) */
  @ViewChild('viewSql', { read: ElementRef, static: false })
  viewSqlQueryButton?: ElementRef;

  /** Formatter instance (kept inside the class) */
  private readonly sqlFormatter = new QueryFormatter(new GoogleSqlDefinition());

  showSqlTooltip = false;
  showSqlDialog = false;

  /** Derived values as getters (computed-like behavior) */
  get generatedSql(): string {
    const sqlQuery = this.message?.sqlQuery;
    if (sqlQuery) {
      return removeNewlinesFromKnownOperators(this.sqlFormatter.formatQuery(sqlQuery));
    }
    return '';
  }

  get alloyDbNlaSql(): string {
    const nlaQuery = this.message?.nlaQuery;
    if (nlaQuery) {
      const sqlStringLiteral = toPgStringLiteral(nlaQuery);
      return removeNewlinesFromKnownOperators(
        this.sqlFormatter.formatQuery(
          `SELECT alloydb_ai.nl_get_sql('google_io', ${sqlStringLiteral})->>'sql';`
        )
      );
    }
    return '';
  }

  get messageLines(): string[] {
    const text = this.message?.text ?? '';
    return text.split('\n');
  }

  /**
   * Safe accessor for the data-table input.
   * Always returns either a TableData object or an array (never undefined).
   */
  get tableDataForView(): TableData | any[] {
    return (this.message?.tableData ?? []) as TableData | any[];
  }

  /**
   * True when there is meaningful table data to show.
   * Use this to guard template rendering so nested property access is safe.
   */
  get hasTableData(): boolean {
    const t = this.message?.tableData;
    return !!(t && ((t as any).columns?.length || (t as any).rows?.length));
  }

  openSqlDialog(): void {
    const componentEl = this.viewSqlQueryButton?.nativeElement;
    if (!componentEl) return;

    const generated = this.generatedSql;
    if (!generated) return;

    const nla = this.alloyDbNlaSql;
    if (!nla) return;

    this.viewCode.emit({
      generatedQuery: generated,
      alloyDbNlaQuery: nla,
      target: componentEl,
    });
  }

  /** Example method to emit order confirmation (call when user confirms) */
  confirmOrder(details: ChatMessage['orderDetails'] | null): void {
    if (!details) return;
    this.orderConfirmed.emit(details);
  }
}

/** Utility helpers (kept outside the class) */
function toPgStringLiteral(str: string): string {
  const quoteEscaped = str.replaceAll("'", "''");
  if (str.includes('\\')) {
    return `E'${quoteEscaped.replaceAll('\\', '\\\\')}'`;
  }
  return `'${quoteEscaped}'`;
}

function removeNewlinesFromKnownOperators(str: string): string {
  str = str.replaceAll(/distinct\s+from\s+/gi, 'distinct from ');
  return str;
}
