import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime } from 'rxjs';
import { ClientsService } from '../../../core/services/clients.service';
import { AuthService } from '../../../core/services/auth.service';
import { Client } from '../../../core/models/client.model';
import { CreateClientDialogComponent } from './create-client-dialog.component';
import { SectionLayoutComponent } from '../../../layout/section-layout/section-layout.component';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatDialogModule, MatTooltipModule,
    SectionLayoutComponent,
  ],
  template: `
    <app-section-layout>

      <!-- ── Panneau flottant contextuel ─────────────── -->
      <div slot="panel">

        <!-- Recherche rapide -->
        <div class="panel-search">
          <mat-icon class="search-icon">search</mat-icon>
          <input class="search-input" [formControl]="searchCtrl" placeholder="Rechercher…" />
        </div>

        <!-- Filtre site -->
        <div class="panel-section">
          <div class="section-title">
            <mat-icon>public</mat-icon> Site
          </div>
          <button class="filter-btn" [class.active]="siteCtrl.value === ''" (click)="siteCtrl.setValue('')">
            <mat-icon>layers</mat-icon>
            <span>Tous les sites</span>
            <span class="count-badge">{{ clients.length }}</span>
          </button>
          <button class="filter-btn" [class.active]="siteCtrl.value === 'REUNION'" (click)="siteCtrl.setValue('REUNION')">
            <span class="flag">🇷🇪</span>
            <span>La Réunion</span>
            <span class="count-badge">{{ countBySite('REUNION') }}</span>
          </button>
          <button class="filter-btn" [class.active]="siteCtrl.value === 'MADAGASCAR'" (click)="siteCtrl.setValue('MADAGASCAR')">
            <span class="flag">🇲🇬</span>
            <span>Madagascar</span>
            <span class="count-badge">{{ countBySite('MADAGASCAR') }}</span>
          </button>
        </div>

        <!-- Filtre santé -->
        <div class="panel-section">
          <div class="section-title">
            <mat-icon>health_and_safety</mat-icon> Santé
          </div>
          <button class="filter-btn" [class.active]="healthFilter() === ''" (click)="healthFilter.set('')">
            <mat-icon>all_inclusive</mat-icon>
            <span>Tous</span>
          </button>
          <button class="filter-btn" [class.active]="healthFilter() === 'ok'" (click)="healthFilter.set('ok')">
            <span class="dot dot-green"></span>
            <span>Transmissible</span>
            <span class="count-badge">{{ countByHealth('ok') }}</span>
          </button>
          <button class="filter-btn" [class.active]="healthFilter() === 'partial'" (click)="healthFilter.set('partial')">
            <span class="dot dot-amber"></span>
            <span>Partiel</span>
            <span class="count-badge">{{ countByHealth('partial') }}</span>
          </button>
          <button class="filter-btn" [class.active]="healthFilter() === 'alert'" (click)="healthFilter.set('alert')">
            <span class="dot dot-red"></span>
            <span>Alerte</span>
            <span class="count-badge">{{ countByHealth('alert') }}</span>
          </button>
        </div>

        <!-- Stats rapides -->
        <div class="panel-section panel-stats">
          <div class="section-title">
            <mat-icon>insights</mat-icon> Statistiques
          </div>
          <div class="stat-row">
            <span class="stat-label">Total dossiers</span>
            <span class="stat-value">{{ clients.length }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Affichés</span>
            <span class="stat-value indigo">{{ filteredClients.length }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Score moyen</span>
            <span class="stat-value" [class]="avgScoreClass()">{{ avgScore() }}%</span>
          </div>
        </div>

        <!-- CTA Nouveau dossier -->
        @if (auth.isAdmin()) {
          <div class="panel-cta">
            <button class="btn-new" (click)="openCreateDialog()">
              <mat-icon>add</mat-icon>
              <span>Nouveau dossier</span>
            </button>
          </div>
        }

      </div>

      <!-- ── Contenu principal ──────────────────────── -->
      <div>
        <div class="page-header">
          <div>
            <h1>Dossiers clients</h1>
            <p class="page-subtitle">{{ filteredClients.length }} dossier(s) affiché(s)</p>
          </div>
        </div>

        <div class="table-card">
          <table class="clients-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Site</th>
                <th>Responsable</th>
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
                    @if (c.responsable) {
                      <div class="resp-cell">
                        <div class="resp-avatar">{{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}</div>
                        <span class="resp-name">{{ c.responsable.firstName }} {{ c.responsable.lastName }}</span>
                      </div>
                    } @else {
                      <span class="resp-none">Non assigné</span>
                    }
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
                  <td colspan="6" class="empty-state">
                    <mat-icon>folder_off</mat-icon>
                    <span>Aucun dossier trouvé</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    </app-section-layout>
  `,
  styles: [`
    /* ─── Page header ────────────────────────────────── */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .page-header h1 { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -.5px; }
    .page-subtitle { font-size: 13px; color: #64748b; margin: 0; }

    /* ─── Floating panel ─────────────────────────────── */
    .panel-search {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .search-icon { font-size: 17px; width: 17px; height: 17px; color: #94a3b8; flex-shrink: 0; }
    .search-input {
      border: none; outline: none; background: none;
      font-size: 13.5px; color: #1e293b; width: 100%;
    }
    .search-input::placeholder { color: #cbd5e1; }

    .panel-section {
      padding: 12px 12px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .panel-section:last-of-type { border-bottom: none; }
    .section-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 700; color: #cbd5e1;
      text-transform: uppercase; letter-spacing: .7px;
      padding: 0 4px 8px;
    }
    .section-title mat-icon { font-size: 13px; width: 13px; height: 13px; }

    .filter-btn {
      width: 100%;
      display: flex; align-items: center; gap: 9px;
      padding: 9px 10px;
      border: none; background: none; cursor: pointer;
      border-radius: 9px;
      font-size: 13.5px; font-weight: 500; color: #64748b;
      text-align: left; transition: all .13s;
      margin-bottom: 2px;
    }
    .filter-btn:hover { background: #f8fafc; color: #1e293b; }
    .filter-btn.active {
      background: #eef2ff; color: #4f46e5; font-weight: 600;
      box-shadow: inset 2px 0 0 #6366f1;
    }
    .filter-btn mat-icon { font-size: 14px; width: 14px; height: 14px; opacity: .6; }
    .filter-btn.active mat-icon { opacity: 1; }
    .flag { font-size: 14px; line-height: 1; }
    .count-badge {
      margin-left: auto;
      font-size: 10px; font-weight: 700;
      background: #f1f5f9; color: #64748b;
      padding: 1px 6px; border-radius: 20px;
    }
    .filter-btn.active .count-badge { background: #c7d2fe; color: #4338ca; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-green { background: #22c55e; }
    .dot-amber { background: #f59e0b; }
    .dot-red   { background: #ef4444; }

    /* Stats */
    .panel-stats { padding-bottom: 10px; }
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 4px; }
    .stat-label { font-size: 12px; color: #94a3b8; }
    .stat-value { font-size: 13px; font-weight: 700; color: #1e293b; }
    .stat-value.indigo { color: #4f46e5; }
    .stat-value.ok     { color: #15803d; }
    .stat-value.warn   { color: #a16207; }
    .stat-value.danger { color: #dc2626; }

    /* CTA */
    .panel-cta { padding: 10px; border-top: 1px solid #f1f5f9; }
    .btn-new {
      width: 100%;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 12px;
      border: 1.5px dashed #c7d2fe; background: #f8f9ff;
      border-radius: 9px; cursor: pointer;
      font-size: 12.5px; font-weight: 600; color: #4f46e5;
      transition: all .15s;
    }
    .btn-new:hover { background: #eef2ff; border-color: #a5b4fc; }
    .btn-new mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ─── Table ──────────────────────────────────────── */
    .table-card {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03);
      overflow: hidden;
    }
    .clients-table { width: 100%; border-collapse: collapse; }
    .clients-table thead th {
      padding: 13px 20px; text-align: left;
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .8px;
      background: #f8fafc; border-bottom: 1px solid #e8ecf0;
    }
    .table-row { border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background .12s; }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: #fafbff; }
    .clients-table td { padding: 14px 20px; vertical-align: middle; }

    .client-cell { display: flex; align-items: center; gap: 12px; }
    .client-avatar {
      width: 36px; height: 36px; border-radius: 9px;
      background: linear-gradient(135deg, #dbeafe, #c7d2fe);
      color: #1e40af; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .client-name { font-size: 14px; font-weight: 600; color: #1e293b; }

    .badge-reunion    { display: inline-flex; align-items: center; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }
    .badge-madagascar { display: inline-flex; align-items: center; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }

    .score-cell { display: flex; align-items: center; gap: 10px; }
    .score-bar-track { width: 100px; height: 5px; background: #f1f5f9; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
    .score-bar-fill { height: 100%; border-radius: 4px; }
    .score-bar-fill.high   { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .score-bar-fill.medium { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-bar-fill.low    { background: linear-gradient(90deg, #f87171, #dc2626); }
    .score-value { font-size: 13px; font-weight: 700; min-width: 36px; }
    .score-high   { color: #15803d; }
    .score-medium { color: #a16207; }
    .score-low    { color: #dc2626; }

    .status-pill { font-size: 11.5px; font-weight: 500; padding: 3px 10px; border-radius: 20px; }
    .status-ok      { background: #dcfce7; color: #15803d; }
    .status-partial { background: #fef9c3; color: #a16207; }
    .status-alert   { background: #fee2e2; color: #dc2626; }

    .action-cell { text-align: right; }
    .btn-open { color: #6366f1 !important; }

    .empty-state {
      text-align: center; padding: 48px !important;
      color: #94a3b8;
    }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }

    .resp-cell { display: flex; align-items: center; gap: 8px; }
    .resp-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      color: #4338ca; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .resp-name { font-size: 13px; color: #475569; }
    .resp-none { font-size: 13px; color: #cbd5e1; font-style: italic; }
  `],
})
export class ClientListComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  searchCtrl = new FormControl('');
  siteCtrl    = new FormControl('');
  healthFilter = signal('');
  private dialog = inject(MatDialog);

  constructor(private clientsService: ClientsService, public auth: AuthService) {
    effect(() => { this.healthFilter(); this.applyFilters(); });
  }

  ngOnInit() {
    this.load();
    this.searchCtrl.valueChanges.pipe(debounceTime(250)).subscribe(() => this.applyFilters());
    this.siteCtrl.valueChanges.subscribe(() => this.applyFilters());
  }

  load() {
    this.clientsService.getAll().subscribe(data => {
      this.clients = data;
      this.applyFilters();
    });
  }

  applyFilters() {
    const search = this.searchCtrl.value?.toLowerCase() || '';
    const site   = this.siteCtrl.value || '';
    const health = this.healthFilter();
    this.filteredClients = this.clients.filter(c => {
      if (!c.nom.toLowerCase().includes(search)) return false;
      if (site && c.site !== site) return false;
      if (health === 'ok'      && c.santePassation < 80)  return false;
      if (health === 'partial' && (c.santePassation < 50 || c.santePassation >= 80)) return false;
      if (health === 'alert'   && c.santePassation >= 50) return false;
      return true;
    });
  }

  openCreateDialog() {
    const ref = this.dialog.open(CreateClientDialogComponent, { panelClass: 'rounded-dialog' });
    ref.afterClosed().subscribe(result => {
      if (result?.nom && result?.site) {
        this.clientsService.create({ nom: result.nom, site: result.site, ficheData: result.ficheData }).subscribe(() => this.load());
      }
    });
  }

  countBySite(site: string)   { return this.clients.filter(c => c.site === site).length; }
  countByHealth(h: string) {
    if (h === 'ok')      return this.clients.filter(c => c.santePassation >= 80).length;
    if (h === 'partial') return this.clients.filter(c => c.santePassation >= 50 && c.santePassation < 80).length;
    return this.clients.filter(c => c.santePassation < 50).length;
  }

  avgScore() {
    if (!this.filteredClients.length) return 0;
    return Math.round(this.filteredClients.reduce((a, c) => a + c.santePassation, 0) / this.filteredClients.length);
  }
  avgScoreClass() {
    const s = this.avgScore();
    return s >= 80 ? 'stat-value ok' : s >= 50 ? 'stat-value warn' : 'stat-value danger';
  }

  getInitials(nom: string) { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  getScoreBarClass(s: number)  { return s >= 80 ? 'high' : s >= 50 ? 'medium' : 'low'; }
  getScoreTextClass(s: number) { return s >= 80 ? 'score-value score-high' : s >= 50 ? 'score-value score-medium' : 'score-value score-low'; }
  getStatusClass(s: number)    { return s >= 80 ? 'status-pill status-ok' : s >= 50 ? 'status-pill status-partial' : 'status-pill status-alert'; }
  getStatusLabel(s: number)    { return s >= 80 ? 'Transmissible' : s >= 50 ? 'En cours' : 'Alerte'; }
}
