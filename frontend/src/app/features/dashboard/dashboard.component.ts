import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models/client.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="dashboard">
      <!-- Page header -->
      <div class="page-header">
        <div>
          <h1>Bonjour, {{ firstName }} 👋</h1>
          <p class="page-subtitle">Voici l'état de vos dossiers clients</p>
        </div>
        <div class="header-meta">
          <span class="date-badge">{{ today }}</span>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--blue">
            <mat-icon>folder_shared</mat-icon>
          </div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ clients.length }}</div>
            <div class="stat-card__label">Dossiers actifs</div>
          </div>
          <div class="stat-card__trend stat-card__trend--neutral">Tous sites</div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--green">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ dossiersTransmissibles }}</div>
            <div class="stat-card__label">Transmissibles</div>
          </div>
          <div class="stat-card__trend stat-card__trend--green">Score ≥ 80%</div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--orange">
            <mat-icon>schedule</mat-icon>
          </div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ dossiersPartiels }}</div>
            <div class="stat-card__label">En cours</div>
          </div>
          <div class="stat-card__trend stat-card__trend--orange">Score 50–79%</div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--red">
            <mat-icon>warning_amber</mat-icon>
          </div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ dossiersEnAlerte }}</div>
            <div class="stat-card__label">En alerte</div>
          </div>
          <div class="stat-card__trend stat-card__trend--red">Score &lt; 50%</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="section-header">
        <h2>Dossiers clients</h2>
        <div class="filter-tabs">
          <button class="filter-tab" [class.active]="siteFilter === ''" (click)="filterSite('')">Tous</button>
          <button class="filter-tab" [class.active]="siteFilter === 'REUNION'" (click)="filterSite('REUNION')">🇷🇪 La Réunion</button>
          <button class="filter-tab" [class.active]="siteFilter === 'MADAGASCAR'" (click)="filterSite('MADAGASCAR')">🇲🇬 Madagascar</button>
        </div>
      </div>

      <!-- Client grid -->
      <div class="client-grid">
        @for (client of filteredClients; track client.id) {
          <div class="client-card" [routerLink]="['/clients', client.id]">
            <div class="client-card__header">
              <div class="client-avatar">{{ getInitials(client.nom) }}</div>
              <div class="client-card__meta">
                <h3>{{ client.nom }}</h3>
                <span [class]="client.site === 'REUNION' ? 'badge-reunion' : 'badge-madagascar'">
                  {{ client.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                </span>
              </div>
              <div class="client-card__arrow">
                <mat-icon>chevron_right</mat-icon>
              </div>
            </div>

            <div class="client-card__score-section">
              <div class="score-row">
                <span class="score-label">Santé de passation</span>
                <span class="score-pill" [class]="getScorePillClass(client.santePassation)">
                  {{ client.santePassation }}%
                </span>
              </div>
              <div class="score-bar-track">
                <div class="score-bar-fill" [class]="getScoreBarClass(client.santePassation)"
                     [style.width.%]="client.santePassation"></div>
              </div>
              <div class="score-status">{{ getScoreLabel(client.santePassation) }}</div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1280px; margin: 0 auto; }

    /* Page header */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.5px; }
    .page-subtitle { font-size: 14px; color: #64748b; margin: 0; }
    .date-badge {
      background: white; border: 1px solid #e2e8f0;
      padding: 7px 16px; border-radius: 20px;
      font-size: 13px; color: #475569; font-weight: 500;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    /* Stats */
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 36px; }
    .stat-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
      padding: 22px 20px; display: flex; align-items: flex-start; gap: 16px; position: relative;
      overflow: hidden;
    }
    .stat-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    }
    .stat-card:nth-child(1)::before { background: linear-gradient(90deg, #3b82f6, #6366f1); }
    .stat-card:nth-child(2)::before { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .stat-card:nth-child(3)::before { background: linear-gradient(90deg, #f59e0b, #f97316); }
    .stat-card:nth-child(4)::before { background: linear-gradient(90deg, #f87171, #dc2626); }
    .stat-card__icon {
      width: 46px; height: 46px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;
    }
    .stat-card__icon mat-icon { font-size: 22px; width: 22px; height: 22px; color: white; }
    .stat-card__icon--blue { background: linear-gradient(135deg, #3b82f6, #4f46e5); }
    .stat-card__icon--green { background: linear-gradient(135deg, #22c55e, #16a34a); }
    .stat-card__icon--orange { background: linear-gradient(135deg, #f59e0b, #f97316); }
    .stat-card__icon--red { background: linear-gradient(135deg, #f87171, #dc2626); }
    .stat-card__body { flex: 1; }
    .stat-card__value { font-size: 32px; font-weight: 800; color: #0f172a; line-height: 1; letter-spacing: -1px; }
    .stat-card__label { font-size: 13px; color: #64748b; margin-top: 5px; font-weight: 500; }
    .stat-card__trend {
      position: absolute; top: 18px; right: 16px;
      font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; letter-spacing: 0.2px;
    }
    .stat-card__trend--neutral { background: #f1f5f9; color: #64748b; }
    .stat-card__trend--green { background: #dcfce7; color: #15803d; }
    .stat-card__trend--orange { background: #fff7ed; color: #c2410c; }
    .stat-card__trend--red { background: #fee2e2; color: #dc2626; }

    /* Section header */
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .section-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }
    .filter-tabs {
      display: flex; gap: 3px;
      background: #e8ecf0; border-radius: 10px; padding: 3px;
    }
    .filter-tab {
      border: none; background: none; padding: 6px 16px;
      border-radius: 7px; font-size: 13px; font-weight: 500; color: #64748b;
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .filter-tab:hover { background: white; color: #1e293b; }
    .filter-tab.active { background: white; color: #1e40af; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

    /* Client grid */
    .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .client-card {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
      padding: 20px; cursor: pointer;
      transition: all 0.18s ease;
    }
    .client-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(30,64,175,0.1), 0 1px 3px rgba(0,0,0,0.04);
      border-color: #c7d2fe;
    }
    .client-card__header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .client-avatar {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #dbeafe, #c7d2fe);
      color: #1e40af; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .client-card__meta { flex: 1; min-width: 0; }
    .client-card__meta h3 {
      font-size: 15px; font-weight: 600; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;
    }
    .client-card__arrow mat-icon { color: #cbd5e1; font-size: 20px; width: 20px; height: 20px; }

    /* Score section */
    .score-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .score-label { font-size: 12px; color: #94a3b8; font-weight: 500; }
    .score-pill { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    .score-pill.high { background: #dcfce7; color: #15803d; }
    .score-pill.medium { background: #fff7ed; color: #c2410c; }
    .score-pill.low { background: #fee2e2; color: #dc2626; }
    .score-bar-track { height: 5px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
    .score-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
    .score-bar-fill.high { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .score-bar-fill.medium { background: linear-gradient(90deg, #fb923c, #f59e0b); }
    .score-bar-fill.low { background: linear-gradient(90deg, #f87171, #dc2626); }
    .score-status { font-size: 11px; color: #94a3b8; }

    /* Badge classes */
    .badge-reunion { display: inline-flex; align-items: center; gap: 4px; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-madagascar { display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

    @media (max-width: 1024px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class DashboardComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  siteFilter = '';
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  get dossiersTransmissibles() { return this.clients.filter(c => c.santePassation >= 80).length; }
  get dossiersPartiels() { return this.clients.filter(c => c.santePassation >= 50 && c.santePassation < 80).length; }
  get dossiersEnAlerte() { return this.clients.filter(c => c.santePassation < 50).length; }
  get firstName() { return this.auth.currentUser()?.firstName || ''; }

  constructor(private clientsService: ClientsService, private auth: AuthService) {}

  ngOnInit() {
    this.clientsService.getAll().subscribe((data) => {
      this.clients = data;
      this.filteredClients = data;
    });
  }

  filterSite(site: string) {
    this.siteFilter = site;
    this.filteredClients = site ? this.clients.filter(c => c.site === site) : this.clients;
  }

  getInitials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getScorePillClass(score: number) {
    if (score >= 80) return 'score-pill high';
    if (score >= 50) return 'score-pill medium';
    return 'score-pill low';
  }

  getScoreBarClass(score: number) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getScoreLabel(score: number) {
    if (score >= 80) return 'Transmissible';
    if (score >= 50) return 'Partiellement renseigné';
    return 'Risque de perte d\'information';
  }
}
