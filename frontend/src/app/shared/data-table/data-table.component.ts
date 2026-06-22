import {
  Component, ContentChildren, Directive, EventEmitter, Input,
  OnChanges, Output, QueryList, SimpleChanges, TemplateRef,
  computed, signal, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ColumnDef {
  key: string;
  label: string;
}

@Directive({ selector: '[appCol]', standalone: true })
export class ColDirective {
  @Input('appCol') key!: string;
  constructor(public tpl: TemplateRef<{ $implicit: any }>) {}
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, ColDirective],
  template: `
<div class="dt-wrap">
  <table class="dt-table">
    <thead>
      <tr>
        @for (col of columns; track col.key) {
          <th>{{ col.label }}</th>
        }
      </tr>
    </thead>
    <tbody>
      @if (loading) {
        <tr><td [attr.colspan]="columns.length" class="dt-msg">Chargement…</td></tr>
      } @else if (pagedData().length === 0) {
        <tr><td [attr.colspan]="columns.length" class="dt-msg">Aucune donnée.</td></tr>
      } @else {
        @for (row of pagedData(); track row.id ?? $index) {
          <tr (click)="rowClick.emit(row)" [class]="rowClass ? rowClass(row) : ''">
            @for (col of columns; track col.key) {
              <td>
                @if (tplOf(col.key); as tpl) {
                  <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
                } @else {
                  {{ row[col.key] ?? '—' }}
                }
              </td>
            }
          </tr>
        }
      }
    </tbody>
  </table>

  @if (_pgSize() > 0 && _data().length > 0) {
    <div class="dt-pagination">
      <span class="dt-info">
        {{ page() * _pgSize() + 1 }}–{{ min(_data().length, (page() + 1) * _pgSize()) }}
        sur {{ _data().length }}
      </span>
      <div class="dt-btns">
        <button class="dt-btn" [disabled]="page() === 0" (click)="setPage(page() - 1)">‹</button>
        @for (p of pages(); track p) {
          <button class="dt-btn" [class.dt-btn--active]="page() === p" (click)="setPage(p)">{{ p + 1 }}</button>
        }
        <button class="dt-btn" [disabled]="page() === totalPages() - 1" (click)="setPage(page() + 1)">›</button>
      </div>
    </div>
  }
</div>
  `,
  styles: [`
    .dt-wrap { width: 100%; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden; }

    .dt-table { width: 100%; border-collapse: collapse; font-size: 13px; }

    .dt-table thead tr { background: #162351; }
    .dt-table thead th {
      color: #fff; font-weight: 600; font-size: 13px;
      padding: 10px 12px; text-align: left; border: none; white-space: nowrap;
    }

    .dt-table tbody tr { background: #fff; cursor: pointer; }
    .dt-table tbody tr:nth-child(even) { background: #f8f9fa; }
    .dt-table tbody tr:hover td { background: #e8edf8 !important; }

    .dt-table tbody tr.row--anomalie td { background: #FFFBEB !important; }
    .dt-table tbody tr.row--absent  td { color: #9ca3af; background: #FAFAFA; }
    .dt-table tbody tr.row--ancien  td { color: #9ca3af !important; }

    .dt-table tbody td {
      padding: 9px 12px; border-bottom: 1px solid #dee2e6;
      color: #212529; vertical-align: middle;
    }
    .dt-table tbody tr:last-child td { border-bottom: none; }

    .dt-msg { padding: 32px; text-align: center; color: #999; font-size: 13px; cursor: default; }

    /* Pagination */
    .dt-pagination {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-top: 1px solid #dee2e6;
      background: #f8f9fa; font-size: 12px; color: #555;
    }
    .dt-btns { display: flex; gap: 4px; }
    .dt-btn {
      min-width: 30px; height: 28px; padding: 0 6px;
      border: 1px solid #dee2e6; border-radius: 3px;
      background: #fff; font-size: 12px; cursor: pointer;
      &:hover:not(:disabled) { background: #e8edf8; border-color: #162351; }
      &:disabled { opacity: .4; cursor: default; }
    }
    .dt-btn--active {
      background: #162351 !important; color: #fff; border-color: #162351;
    }
  `],
})
export class DataTableComponent implements OnChanges {
  @Input() columns: ColumnDef[] = [];
  @Input() loading = false;
  @Input() rowClass?: (row: any) => string;
  @Output() rowClick = new EventEmitter<any>();

  // Signals internes pour que computed() puisse les suivre
  protected _data   = signal<any[]>([]);
  protected _pgSize = signal(20);

  @Input() set data(v: any[])     { this._data.set(v); }
  @Input() set pageSize(v: number){ this._pgSize.set(v); }

  @ContentChildren(ColDirective) private colDefs!: QueryList<ColDirective>;

  page = signal(0);

  constructor() {
    // Remet à la page 0 quand les données changent
    effect(() => { this._data(); this.page.set(0); });
  }

  ngOnChanges(_: SimpleChanges) {}

  pagedData = computed(() => {
    const d  = this._data();
    const ps = this._pgSize();
    if (ps <= 0) return d;
    const s = this.page() * ps;
    return d.slice(s, s + ps);
  });

  totalPages = computed(() => {
    const ps = this._pgSize();
    return ps > 0 ? Math.max(1, Math.ceil(this._data().length / ps)) : 1;
  });

  pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i));

  setPage(p: number) { this.page.set(p); }

  tplOf(key: string): TemplateRef<any> | null {
    return this.colDefs?.find(d => d.key === key)?.tpl ?? null;
  }

  min(a: number, b: number) { return Math.min(a, b); }
}
