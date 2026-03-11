import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { debounceTime } from 'rxjs';
import { ClientsService } from '../../../core/services/clients.service';
import { AuthService } from '../../../core/services/auth.service';
import { Client } from '../../../core/models/client.model';
import { CreateClientDialogComponent } from './create-client-dialog.component';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatDialogModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Dossiers clients</h1>
          <p class="page-subtitle">{{ filteredClients.length }} dossier(s) affiché(s)</p>
        </div>
        @if (auth.isAdmin()) {
          <button mat-flat-button color="primary" class="btn-create" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> Nouveau dossier
          </button>
        }
      </div>

      <!-- Filters bar -->
      <div class="filters-bar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="searchCtrl" placeholder="Rechercher un client..." />
        </mat-form-field>

        <mat-form-field appearance="outline" class="site-field">
          <mat-label>Site</mat-label>
          <mat-select [formControl]="siteCtrl">
            <mat-option value="">Tous les sites</mat-option>
            <mat-option value="REUNION">🇷🇪 La Réunion</mat-option>
            <mat-option value="MADAGASCAR">🇲🇬 Madagascar</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Table -->
      <div class="table-card">
        <table class="clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Site</th>
              <th>Santé de passation</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of filteredClients; track c.id) {
              <tr class="table-row" [routerLink]="['/clients', c.id]">
                <td>
                  <div class="client-cell">
                    <div class="client-avatar">{{ getInitials(c.nom) }}</div>
                    <span class="client-name">{{ c.nom }}</span>
                  </div>
                </td>
                <td>
                  <span [class]="c.site === 'REUNION' ? 'badge-reunion' : 'badge-madagascar'">
                    {{ c.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                  </span>
                </td>
                <td>
                  <div class="score-cell">
                    <div class="score-bar-track">
                      <div class="score-bar-fill" [class]="getScoreBarClass(c.santePassation)"
                           [style.width.%]="c.santePassation"></div>
                    </div>
                    <span class="score-value" [class]="getScoreTextClass(c.santePassation)">{{ c.santePassation }}%</span>
                  </div>
                </td>
                <td>
                  <span class="status-pill" [class]="getStatusClass(c.santePassation)">
                    {{ getStatusLabel(c.santePassation) }}
                  </span>
                </td>
                <td class="action-cell">
                  <button mat-icon-button class="btn-open" [routerLink]="['/clients', c.id]" (click)="$event.stopPropagation()">
                    <mat-icon>arrow_forward</mat-icon>
                  </button>
                </td>
              </tr>
            }
            @if (filteredClients.length === 0) {
              <tr>
                <td colspan="5" class="empty-state">
                  <mat-icon>folder_off</mat-icon>
                  <span>Aucun dossier trouvé</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1280px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.5px; }
    .page-subtitle { font-size: 14px; color: #64748b; margin: 0; }
    .btn-create { border-radius: 10px !important; height: 42px; font-weight: 600; background: linear-gradient(135deg, #1e40af, #3730a3) !important; }

    /* Filters */
    .filters-bar { display: flex; gap: 12px; margin-bottom: 20px; }
    .search-field { flex: 1; }
    .site-field { width: 220px; }

    /* Table */
    .table-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
      overflow: hidden;
    }
    .clients-table { width: 100%; border-collapse: collapse; }
    .clients-table thead th {
      padding: 14px 24px; text-align: left;
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.8px;
      background: #f8fafc; border-bottom: 1px solid #e8ecf0;
    }
    .table-row {
      border-bottom: 1px solid #f1f5f9; cursor: pointer;
      transition: background 0.12s;
    }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: #f8fafc; }
    .clients-table td { padding: 16px 24px; vertical-align: middle; }

    .client-cell { display: flex; align-items: center; gap: 12px; }
    .client-avatar {
      width: 38px; height: 38px; border-radius: 10px;
      background: linear-gradient(135deg, #dbeafe, #c7d2fe);
      color: #1e40af; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .client-name { font-size: 14px; font-weight: 600; color: #1e293b; }

    .badge-reunion { display: inline-flex; align-items: center; background: #dbeafe; color: #1d4ed8; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-madagascar { display: inline-flex; align-items: center; background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

    .score-cell { display: flex; align-items: center; gap: 10px; }
    .score-bar-track { width: 120px; height: 6px; background: #f1f5f9; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
    .score-bar-fill { height: 100%; border-radius: 4px; }
    .score-bar-fill.high { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .score-bar-fill.medium { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-bar-fill.low { background: linear-gradient(90deg, #f87171, #dc2626); }
    .score-value { font-size: 13px; font-weight: 700; min-width: 36px; }
    .score-high { color: #15803d; }
    .score-medium { color: #a16207; }
    .score-low { color: #dc2626; }

    .status-pill { font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 20px; }
    .status-ok { background: #dcfce7; color: #15803d; }
    .status-partial { background: #fef9c3; color: #a16207; }
    .status-alert { background: #fee2e2; color: #dc2626; }

    .action-cell { text-align: right; }
    .btn-open { color: #6366f1 !important; }

    .empty-state {
      text-align: center; padding: 48px !important;
      color: #94a3b8; display: flex; flex-direction: column;
      align-items: center; gap: 8px;
    }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; }
  `],
})
export class ClientListComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  searchCtrl = new FormControl('');
  siteCtrl = new FormControl('');
  private dialog = inject(MatDialog);

  constructor(private clientsService: ClientsService, public auth: AuthService) {}

  ngOnInit() {
    this.load();
    this.searchCtrl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.applyFilters());
    this.siteCtrl.valueChanges.subscribe(() => this.applyFilters());
  }

  load() {
    this.clientsService.getAll().subscribe((data) => {
      this.clients = data;
      this.applyFilters();
    });
  }

  applyFilters() {
    const search = this.searchCtrl.value?.toLowerCase() || '';
    const site = this.siteCtrl.value || '';
    this.filteredClients = this.clients.filter(
      (c) => c.nom.toLowerCase().includes(search) && (!site || c.site === site),
    );
  }

  openCreateDialog() {
    const ref = this.dialog.open(CreateClientDialogComponent, {
      panelClass: 'rounded-dialog',
      disableClose: false,
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.nom && result?.site) {
        this.clientsService.create({ nom: result.nom, site: result.site }).subscribe(() => this.load());
      }
    });
  }

  getInitials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getScoreBarClass(score: number) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getScoreTextClass(score: number) {
    if (score >= 80) return 'score-value score-high';
    if (score >= 50) return 'score-value score-medium';
    return 'score-value score-low';
  }

  getStatusClass(score: number) {
    if (score >= 80) return 'status-pill status-ok';
    if (score >= 50) return 'status-pill status-partial';
    return 'status-pill status-alert';
  }

  getStatusLabel(score: number) {
    if (score >= 80) return 'Transmissible';
    if (score >= 50) return 'En cours';
    return 'Alerte';
  }
}
