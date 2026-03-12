import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.model';
import { FicheIdentiteTabComponent } from './tabs/fiche-identite-tab/fiche-identite-tab.component';
import { FluxMensuelTabComponent } from './tabs/flux-mensuel-tab/flux-mensuel-tab.component';
import { FournisseursTabComponent } from './tabs/fournisseurs-tab/fournisseurs-tab.component';
import { SyntheseTabComponent } from './tabs/synthese-tab/synthese-tab.component';
import { DocumentsTabComponent } from './tabs/documents-tab/documents-tab.component';
import { AnalyseStrategiqueTabComponent } from './tabs/analyse-strategique-tab/analyse-strategique-tab.component';
import { MissionsTabComponent } from './tabs/missions-tab/missions-tab.component';
import { ObjectifsTabComponent } from './tabs/objectifs-tab/objectifs-tab.component';
import { ControleInterneTabComponent } from './tabs/controle-interne-tab/controle-interne-tab.component';
import { AiAssistantTabComponent } from './tabs/ai-assistant-tab/ai-assistant-tab.component';
import { TachesTabComponent } from './tabs/taches-tab/taches-tab.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatTabsModule, MatButtonModule, MatIconModule, MatTooltipModule,
    FicheIdentiteTabComponent, FluxMensuelTabComponent,
    FournisseursTabComponent, SyntheseTabComponent, DocumentsTabComponent,
    AnalyseStrategiqueTabComponent, MissionsTabComponent,
    ObjectifsTabComponent, ControleInterneTabComponent,
    AiAssistantTabComponent, TachesTabComponent,
  ],
  template: `
    @if (client) {
      <div class="detail">
        <!-- Hero header -->
        <div class="detail-hero">
          <div class="detail-hero__left">
            <div class="breadcrumb">
              <a routerLink="/clients">Dossiers</a>
              <mat-icon>chevron_right</mat-icon>
              <span>{{ client.nom }}</span>
            </div>
            <div class="detail-hero__title-row">
              <div class="detail-avatar">{{ getInitials(client.nom) }}</div>
              <div>
                <h1>{{ client.nom }}</h1>
                <span [class]="client.site === 'REUNION' ? 'badge-reunion' : 'badge-madagascar'">
                  {{ client.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                </span>
              </div>
            </div>
          </div>

          <div class="detail-hero__right">
            <div class="score-widget">
              <div class="score-widget__top">
                <span class="score-widget__label">Santé de passation</span>
                <span class="score-badge" [class]="getScoreBadgeClass(client.santePassation)">
                  {{ getScoreStatus(client.santePassation) }}
                </span>
              </div>
              <div class="score-widget__value" [class]="getScoreColorClass(client.santePassation)">
                {{ client.santePassation }}<span class="score-widget__pct">%</span>
              </div>
              <div class="score-bar-track">
                <div class="score-bar-fill" [class]="getScoreBarClass(client.santePassation)"
                     [style.width.%]="client.santePassation"></div>
              </div>
            </div>
            <button mat-stroked-button class="btn-export" (click)="exportPdf()" matTooltip="Générer la note de passation PDF">
              <mat-icon>picture_as_pdf</mat-icon> Note de passation
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container">
          <mat-tab-group animationDuration="150ms">
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">badge</mat-icon> Fiche Identité</ng-template>
              <div class="tab-content"><app-fiche-identite-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">bar_chart</mat-icon> Pilotage</ng-template>
              <div class="tab-content"><app-flux-mensuel-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">local_shipping</mat-icon> Fournisseurs</ng-template>
              <div class="tab-content"><app-fournisseurs-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">analytics</mat-icon> Synthèse</ng-template>
              <div class="tab-content"><app-synthese-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">grid_view</mat-icon> Stratégie</ng-template>
              <div class="tab-content"><app-analyse-strategique-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">assignment</mat-icon> Missions</ng-template>
              <div class="tab-content"><app-missions-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">shield</mat-icon> Contrôle Interne</ng-template>
              <div class="tab-content"><app-controle-interne-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">flag</mat-icon> Objectifs</ng-template>
              <div class="tab-content"><app-objectifs-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">attach_file</mat-icon> Documents</ng-template>
              <div class="tab-content"><app-documents-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label><mat-icon class="ti">task_alt</mat-icon> Tâches</ng-template>
              <div class="tab-content"><app-taches-tab [clientId]="client.id" /></div>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="ti">smart_toy</mat-icon> Assistant IA
              </ng-template>
              <div class="tab-content"><app-ai-assistant-tab [clientId]="client.id" /></div>
            </mat-tab>
          </mat-tab-group>
        </div>
      </div>
    }
  `,
  styles: [`
    .detail { max-width: 1280px; margin: 0 auto; }

    /* Hero */
    .detail-hero {
      background: linear-gradient(135deg, #0f2040 0%, #1e3a8a 60%, #312e81 100%);
      border-radius: 18px;
      padding: 28px 32px; margin-bottom: 20px;
      display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
      position: relative; overflow: hidden;
    }
    .detail-hero::before {
      content: ''; position: absolute; top: -60px; right: -60px;
      width: 220px; height: 220px; background: rgba(255,255,255,0.05); border-radius: 50%;
    }
    .detail-hero__left { flex: 1; position: relative; z-index: 1; }
    .breadcrumb { display: flex; align-items: center; gap: 4px; font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 20px; }
    .breadcrumb a { color: #93c5fd; text-decoration: none; font-weight: 500; }
    .breadcrumb a:hover { color: white; }
    .breadcrumb mat-icon { font-size: 16px; width: 16px; height: 16px; color: rgba(255,255,255,0.3); }
    .detail-hero__title-row { display: flex; align-items: center; gap: 16px; }
    .detail-avatar {
      width: 56px; height: 56px; border-radius: 14px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      color: white; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .detail-hero__title-row h1 { font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px; letter-spacing: -0.4px; }
    .badge-reunion { display: inline-flex; align-items: center; background: rgba(219,234,254,0.2); color: #93c5fd; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid rgba(147,197,253,0.3); }
    .badge-madagascar { display: inline-flex; align-items: center; background: rgba(220,252,231,0.2); color: #86efac; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid rgba(134,239,172,0.3); }

    /* Score widget inside hero */
    .detail-hero__right { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; flex-shrink: 0; position: relative; z-index: 1; }
    .score-widget {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 14px; padding: 16px 20px; min-width: 210px;
    }
    .score-widget__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .score-widget__label { font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 500; }
    .score-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .score-badge.ok { background: rgba(220,252,231,0.25); color: #86efac; border: 1px solid rgba(134,239,172,0.3); }
    .score-badge.partial { background: rgba(254,249,195,0.2); color: #fde047; border: 1px solid rgba(253,224,71,0.25); }
    .score-badge.alert { background: rgba(254,226,226,0.2); color: #fca5a5; border: 1px solid rgba(252,165,165,0.25); }
    .score-widget__value { font-size: 38px; font-weight: 800; line-height: 1; margin-bottom: 12px; color: white; letter-spacing: -2px; }
    .score-widget__pct { font-size: 20px; font-weight: 600; }
    .score-green { color: #86efac; }
    .score-orange { color: #fde047; }
    .score-red { color: #fca5a5; }
    .score-bar-track { height: 5px; background: rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 4px; }
    .score-bar-fill.high { background: linear-gradient(90deg, #4ade80, #22c55e); }
    .score-bar-fill.medium { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-bar-fill.low { background: linear-gradient(90deg, #f87171, #dc2626); }
    .btn-export { border-radius: 10px !important; font-weight: 500; color: white !important; border-color: rgba(255,255,255,0.3) !important; }
    .btn-export:hover { background: rgba(255,255,255,0.1) !important; }

    /* Tabs */
    .tabs-container {
      background: white;
      border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
      overflow: hidden;
    }
    .ti { font-size: 16px !important; width: 16px !important; height: 16px !important; margin-right: 4px; }
    .tab-content { padding: 28px; }
  `],
})
export class ClientDetailComponent implements OnInit {
  client: Client | null = null;

  constructor(private route: ActivatedRoute, private clientsService: ClientsService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.clientsService.getOne(id).subscribe((c) => (this.client = c));
  }

  exportPdf() {
    if (!this.client) return;
    this.clientsService.exportPdf(this.client.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `note-passation-${this.client!.nom}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    });
  }

  getInitials(nom: string) { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  getScoreBadgeClass(s: number) { return s >= 80 ? 'score-badge ok' : s >= 50 ? 'score-badge partial' : 'score-badge alert'; }
  getScoreStatus(s: number) { return s >= 80 ? 'Transmissible' : s >= 50 ? 'Partiel' : 'Alerte'; }
  getScoreColorClass(s: number) { return s >= 80 ? 'score-widget__value score-green' : s >= 50 ? 'score-widget__value score-orange' : 'score-widget__value score-red'; }
  getScoreBarClass(s: number) { return s >= 80 ? 'high' : s >= 50 ? 'medium' : 'low'; }
}
