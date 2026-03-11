import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { ClientsService } from '../../core/services/clients.service';
import { Client } from '../../core/models/client.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatChipsModule, MatBadgeModule,
  ],
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <h1>Tableau de bord</h1>
        <div class="dashboard__stats">
          <div class="stat-card">
            <mat-icon>folder_shared</mat-icon>
            <div>
              <span class="stat-value">{{ clients.length }}</span>
              <span class="stat-label">Dossiers actifs</span>
            </div>
          </div>
          <div class="stat-card stat-card--warning">
            <mat-icon>warning</mat-icon>
            <div>
              <span class="stat-value">{{ dossiersEnAlerte }}</span>
              <span class="stat-label">Dossiers en alerte</span>
            </div>
          </div>
          <div class="stat-card stat-card--success">
            <mat-icon>check_circle</mat-icon>
            <div>
              <span class="stat-value">{{ dossiersTransmissibles }}</span>
              <span class="stat-label">Transmissibles</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard__filters">
        <button mat-stroked-button [class.active]="siteFilter === ''" (click)="filterSite('')">Tous</button>
        <button mat-stroked-button [class.active]="siteFilter === 'REUNION'" (click)="filterSite('REUNION')">La Réunion</button>
        <button mat-stroked-button [class.active]="siteFilter === 'MADAGASCAR'" (click)="filterSite('MADAGASCAR')">Madagascar</button>
      </div>

      <div class="dashboard__grid">
        @for (client of filteredClients; track client.id) {
          <mat-card class="client-card" [routerLink]="['/clients', client.id]">
            <mat-card-header>
              <mat-card-title>{{ client.nom }}</mat-card-title>
              <mat-card-subtitle>
                <mat-chip [class]="'site-chip site-chip--' + client.site.toLowerCase()">
                  {{ client.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                </mat-chip>
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div class="client-card__score">
                <span class="client-card__score-label">Santé de passation</span>
                <span class="client-card__score-value" [class]="getScoreClass(client.santePassation)">
                  {{ client.santePassation }}%
                </span>
              </div>
              <mat-progress-bar
                [value]="client.santePassation"
                [color]="getProgressColor(client.santePassation)"
              />
              <p class="client-card__status">{{ getScoreLabel(client.santePassation) }}</p>
            </mat-card-content>

            <mat-card-actions>
              <button mat-button color="primary">Ouvrir le dossier</button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .dashboard__header h1 { margin: 0 0 24px; font-size: 28px; font-weight: 700; color: #1e293b; }
    .dashboard__stats { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat-card {
      display: flex; align-items: center; gap: 16px;
      background: white; padding: 20px; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;
    }
    .stat-card mat-icon { font-size: 36px; width: 36px; height: 36px; color: #2563eb; }
    .stat-card--warning mat-icon { color: #d97706; }
    .stat-card--success mat-icon { color: #16a34a; }
    .stat-value { display: block; font-size: 28px; font-weight: 700; color: #1e293b; }
    .stat-label { display: block; font-size: 13px; color: #64748b; }
    .dashboard__filters { display: flex; gap: 8px; margin-bottom: 24px; }
    .dashboard__filters button.active { background: #2563eb; color: white; }
    .dashboard__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .client-card { cursor: pointer; transition: box-shadow 0.2s; }
    .client-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .client-card__score { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .client-card__score-label { font-size: 13px; color: #64748b; }
    .client-card__score-value { font-weight: 700; font-size: 16px; }
    .score-low { color: #dc2626; }
    .score-medium { color: #d97706; }
    .score-high { color: #16a34a; }
    .client-card__status { font-size: 12px; color: #94a3b8; margin: 6px 0 0; }
    .site-chip { font-size: 12px; }
  `],
})
export class DashboardComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  siteFilter = '';

  get dossiersEnAlerte() { return this.clients.filter(c => c.santePassation < 50).length; }
  get dossiersTransmissibles() { return this.clients.filter(c => c.santePassation >= 80).length; }

  constructor(private clientsService: ClientsService) {}

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

  getScoreClass(score: number) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }

  getProgressColor(score: number): 'primary' | 'accent' | 'warn' {
    if (score >= 80) return 'primary';
    if (score >= 50) return 'accent';
    return 'warn';
  }

  getScoreLabel(score: number) {
    if (score >= 80) return '✓ Transmissible';
    if (score >= 50) return '⚠ Partiellement renseigné';
    return '✗ Risque de perte d\'information';
  }
}
