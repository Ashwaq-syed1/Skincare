import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

/** Interfaces for the table data */
export interface TableColumn {
  key: string;
  header: string;
}

export interface TableData {
  columns: TableColumn[];
  rows: any[];
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, MatTableModule],
  template: `
    <div class="table-container" *ngIf="rows?.length || columns?.length">
      <table mat-table [dataSource]="rows" class="mat-elevation-z0">
        <!-- Dynamic columns -->
        <ng-container *ngFor="let column of columns" [matColumnDef]="column.key">
          <th mat-header-cell *matHeaderCellDef>{{ column.header }}</th>
          <td mat-cell *matCellDef="let element">{{ element[column.key] }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="getColumnKeys()"></tr>
        <tr mat-row *matRowDef="let row; columns: getColumnKeys();"></tr>
      </table>
    </div>

    <div class="no-data" *ngIf="!rows?.length">
      No data available.
    </div>
  `,
  styles: [
    `
      .table-container {
        overflow-x: auto;
        max-width: 100%;
      }

      table {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        --mat-table-header-headline-color: var(--skin-care-primary);
        --mat-table-header-headline-font: "DM Sans";
        --mat-table-header-headline-line-height: normal;
        --mat-table-header-headline-size: 16px;
        --mat-table-header-headline-weight: 500;
        --mat-table-header-headline-tracking: normal;

        --mat-table-row-item-label-text-color: var(--skin-care-primary);
        --mat-table-row-item-label-text-font: "DM Sans";
        --mat-table-row-item-label-text-line-height: normal;
        --mat-table-row-item-label-text-size: 16px;
        --mat-table-row-item-label-text-weight: 400;
        --mat-table-row-item-label-text-tracking: normal;

        --mat-table-footer-supporting-text-color: var(--skin-care-primary);
        --mat-table-footer-supporting-text-font: "DM Sans";
        --mat-table-footer-supporting-text-line-height: normal;
        --mat-table-footer-supporting-text-size: 16px;
        --mat-table-footer-supporting-text-weight: 400;
        --mat-table-footer-supporting-text-tracking: normal;

        --mat-table-row-item-outline-color: var(--skin-care-search-outline);
        --mat-table-background-color: #fafafa;
      }

      th.mat-header-cell {
        font-weight: bold;
        background-color: #f5f5f5;
      }

      .no-data {
        padding: 12px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class DataTableComponent implements OnChanges {
  @Input() data: any[] | TableData = [];

  columns: TableColumn[] = [];
  rows: any[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ('data' in changes) {
      this.processData();
    }
  }

  private processData(): void {
    // Reset
    this.columns = [];
    this.rows = [];

    // If data is a TableData object
    if (this.data && !Array.isArray(this.data) && 'rows' in this.data) {
      this.rows = (this.data as TableData).rows || [];
      this.columns = (this.data as TableData).columns || [];

      if (this.columns.length === 0 && this.rows.length > 0) {
        this.columns = Object.keys(this.rows[0]).map((key) => ({
          key,
          header: this.formatColumnHeader(key),
        }));
      }
      return;
    }

    // If data is an array, treat it as rows and generate columns
    if (Array.isArray(this.data)) {
      this.rows = this.data;
      if (this.rows.length > 0) {
        this.columns = Object.keys(this.rows[0]).map((key) => ({
          key,
          header: this.formatColumnHeader(key),
        }));
      } else {
        this.columns = [];
      }
      return;
    }

    // Fallback: empty
    this.rows = [];
    this.columns = [];
  }

  /** Template helpers */
  getRows(): any[] {
    return this.rows;
  }

  getColumns(): TableColumn[] {
    return this.columns;
  }

  getColumnKeys(): string[] {
    return this.columns.map((col) => col.key);
  }

  formatColumnHeader(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, (c) => c.toUpperCase());
  }
}
