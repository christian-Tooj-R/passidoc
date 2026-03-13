import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { HistoriqueTabComponent } from './tabs/historique-tab/historique-tab.component';

type TabId =
  | 'fiche' | 'pilotage' | 'fournisseurs' | 'synthese'
  | 'strategie' | 'missions' | 'controle' | 'objectifs'
  | 'documents' | 'taches' | 'ia' | 'historique';

interface TabGroup {
  label: string;
  icon: string;
  tabs: { id: TabId; icon: string; label: string }[];
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatTooltipModule,
    FicheIdentiteTabComponent, FluxMensuelTabComponent,
    FournisseursTabComponent, SyntheseTabComponent, DocumentsTabComponent,
    AnalyseStrategiqueTabComponent, MissionsTabComponent,
    ObjectifsTabComponent, ControleInterneTabComponent,
    AiAssistantTabComponent, TachesTabComponent, HistoriqueTabComponent,
  ],
  template: `
    @if (client) {
      <div class="detail">

        <!-- ── Hero ──────────────────────────────────── -->
        <div class="detail-hero">
          <div class="detail-hero__left">
            <div class="breadcrumb">
              <a routerLink="/clients">Dossiers</a>
              <mat-icon>chevron_right</mat-icon>
              <span>{{ client.nom }}</span>
            </div>
            <div class="detail-hero__title-row">
              <div class="detail-avatar" (click)="triggerLogoUpload()">
                @if (client.logoUrl) {
                  <img [src]="client.logoUrl" [alt]="client.nom" class="logo-img" />
                } @else {
                  {{ getInitials(client.nom) }}
                }
                <div class="avatar-overlay">
                  <mat-icon>photo_camera</mat-icon>
                </div>
              </div>
              <input #logoInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="onLogoChange($event)" />
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
              <div [class]="getScoreColorClass(client.santePassation)">
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

        <!-- ── Body : panneau flottant + contenu ─────── -->
        <div class="detail-body">

          <!-- Panneau de navigation flottant -->
          <aside class="float-panel">
            <div class="panel-top">
              <mat-icon class="panel-top-icon">view_sidebar</mat-icon>
              <span>Navigation</span>
            </div>

            @for (group of TAB_GROUPS; track group.label) {
              <div class="panel-group">
                <div class="group-header">
                  <mat-icon class="group-icon">{{ group.icon }}</mat-icon>
                  <span>{{ group.label }}</span>
                </div>
                @for (tab of group.tabs; track tab.id) {
                  <button class="panel-item"
                          [class.active]="activeTab() === tab.id"
                          (click)="activeTab.set(tab.id)">
                    <mat-icon class="item-icon">{{ tab.icon }}</mat-icon>
                    <span class="item-label">{{ tab.label }}</span>
                    @if (activeTab() === tab.id) {
                      <mat-icon class="item-chevron">chevron_right</mat-icon>
                    }
                  </button>
                }
              </div>
            }
          </aside>

          <!-- Zone de contenu active -->
          <div class="content-area">
            <div class="content-breadcrumb">
              <mat-icon>{{ activeTabMeta()?.icon }}</mat-icon>
              <span>{{ activeTabMeta()?.label }}</span>
            </div>
            <div class="tab-content">
              @switch (activeTab()) {
                @case ('fiche')        { <app-fiche-identite-tab [clientId]="client.id" [site]="client.site" [typesFluxActifs]="client.typesFluxActifs" (typesChanged)="onTypesChanged($event)" /> }
                @case ('pilotage')     { <app-flux-mensuel-tab  [clientId]="client.id" [typesFluxActifs]="client.typesFluxActifs" /> }
                @case ('fournisseurs') { <app-fournisseurs-tab        [clientId]="client.id" /> }
                @case ('synthese')     { <app-synthese-tab            [clientId]="client.id" [site]="client.site" /> }
                @case ('strategie')    { <app-analyse-strategique-tab [clientId]="client.id" /> }
                @case ('missions')     { <app-missions-tab            [clientId]="client.id" /> }
                @case ('controle')     { <app-controle-interne-tab    [clientId]="client.id" /> }
                @case ('objectifs')    { <app-objectifs-tab           [clientId]="client.id" /> }
                @case ('documents')    { <app-documents-tab           [clientId]="client.id" /> }
                @case ('taches')       { <app-taches-tab              [clientId]="client.id" /> }
                @case ('ia')           { <app-ai-assistant-tab        [clientId]="client.id" /> }
                @case ('historique')   { <app-historique-tab          [clientId]="client.id" /> }
              }
            </div>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    /* ─── Page wrapper ──────────────────────────────── */
    .detail {
      max-width: 1600px;
      margin: 0 auto;
      padding: 28px 32px;
    }

    /* ─── Hero ──────────────────────────────────────── */
    .detail-hero {
      background: linear-gradient(135deg, #0f2040 0%, #1e3a8a 60%, #312e81 100%);
      border-radius: 18px;
      padding: 28px 32px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      position: relative;
      overflow: hidden;
    }
    .detail-hero::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 220px; height: 220px;
      background: rgba(255,255,255,.05);
      border-radius: 50%;
    }
    .detail-hero__left { flex: 1; position: relative; z-index: 1; }
    .breadcrumb {
      display: flex; align-items: center; gap: 4px;
      font-size: 13px; color: rgba(255,255,255,.5); margin-bottom: 20px;
    }
    .breadcrumb a { color: #93c5fd; text-decoration: none; font-weight: 500; }
    .breadcrumb a:hover { color: white; }
    .breadcrumb mat-icon { font-size: 16px; width: 16px; height: 16px; color: rgba(255,255,255,.3); }
    .detail-hero__title-row { display: flex; align-items: center; gap: 16px; }
    .detail-avatar {
      width: 56px; height: 56px; border-radius: 14px;
      background: rgba(255,255,255,.15);
      border: 1px solid rgba(255,255,255,.25);
      color: white; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      position: relative; cursor: pointer; overflow: hidden;
    }
    .detail-avatar:hover .avatar-overlay { opacity: 1; }
    .logo-img { width: 100%; height: 100%; object-fit: cover; border-radius: 14px; }
    .avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.4); border-radius: 14px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s; }
    .avatar-overlay mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    .detail-hero__title-row h1 {
      font-size: 24px; font-weight: 800; color: white;
      margin-bottom: 8px; letter-spacing: -.4px;
    }
    .badge-reunion    { display: inline-flex; align-items: center; background: rgba(219,234,254,.2); color: #93c5fd; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid rgba(147,197,253,.3); }
    .badge-madagascar { display: inline-flex; align-items: center; background: rgba(220,252,231,.2); color: #86efac; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid rgba(134,239,172,.3); }

    .detail-hero__right { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; flex-shrink: 0; position: relative; z-index: 1; }
    .score-widget { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); border-radius: 14px; padding: 16px 20px; min-width: 210px; }
    .score-widget__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .score-widget__label { font-size: 12px; color: rgba(255,255,255,.55); font-weight: 500; }
    .score-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .score-badge.ok      { background: rgba(220,252,231,.25); color: #86efac; border: 1px solid rgba(134,239,172,.3); }
    .score-badge.partial { background: rgba(254,249,195,.2);  color: #fde047; border: 1px solid rgba(253,224,71,.25); }
    .score-badge.alert   { background: rgba(254,226,226,.2);  color: #fca5a5; border: 1px solid rgba(252,165,165,.25); }
    .score-widget__value { font-size: 38px; font-weight: 800; line-height: 1; margin-bottom: 12px; color: white; letter-spacing: -2px; }
    .score-widget__pct   { font-size: 20px; font-weight: 600; }
    .score-green  { color: #86efac; } .score-orange { color: #fde047; } .score-red { color: #fca5a5; }
    .score-bar-track { height: 5px; background: rgba(255,255,255,.15); border-radius: 4px; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 4px; }
    .score-bar-fill.high   { background: linear-gradient(90deg, #4ade80, #22c55e); }
    .score-bar-fill.medium { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-bar-fill.low    { background: linear-gradient(90deg, #f87171, #dc2626); }
    .btn-export { border-radius: 10px !important; font-weight: 500; color: white !important; border-color: rgba(255,255,255,.3) !important; }
    .btn-export:hover { background: rgba(255,255,255,.1) !important; }

    /* ─── Detail body ────────────────────────────────── */
    .detail-body {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }

    /* ─── Floating nav panel ─────────────────────────── */
    .float-panel {
      width: 240px;
      min-width: 240px;
      position: sticky;
      top: 0;
      align-self: flex-start;
      background: white;
      border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow:
        0 4px 24px rgba(15,23,42,.07),
        0 1px 3px rgba(15,23,42,.04);
      overflow: hidden;
      flex-shrink: 0;
    }

    .panel-top {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: .8px;
    }
    .panel-top-icon { font-size: 15px; width: 15px; height: 15px; }

    .panel-group {
      padding: 10px 10px 6px;
    }
    .panel-group + .panel-group {
      border-top: 1px solid #f1f5f9;
      margin-top: 2px;
    }
    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px 8px;
      font-size: 10px;
      font-weight: 700;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: .7px;
    }
    .group-icon { font-size: 13px; width: 13px; height: 13px; }

    .panel-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
      color: #64748b;
      text-align: left;
      transition: all .14s ease;
      margin-bottom: 2px;
    }
    .panel-item:hover {
      background: #f8fafc;
      color: #1e293b;
    }
    .panel-item.active {
      background: linear-gradient(135deg, #eef2ff, #f0f4ff);
      color: #4f46e5;
      font-weight: 600;
      box-shadow: inset 3px 0 0 #6366f1;
    }
    .item-icon {
      font-size: 17px;
      width: 17px; height: 17px;
      flex-shrink: 0;
      color: inherit;
      opacity: .7;
    }
    .panel-item.active .item-icon { opacity: 1; }
    .item-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item-chevron {
      font-size: 14px; width: 14px; height: 14px;
      color: #818cf8; margin-left: auto; flex-shrink: 0;
    }

    /* ─── Content area ───────────────────────────────── */
    .content-area {
      flex: 1;
      min-width: 0;
      background: white;
      border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03);
      overflow: hidden;
    }

    .content-breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 24px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      background: #fafbfc;
    }
    .content-breadcrumb mat-icon { font-size: 16px; width: 16px; height: 16px; color: #6366f1; }

    .tab-content { padding: 28px; }
  `],
})
export class ClientDetailComponent implements OnInit {
  @ViewChild('logoInput') logoInput!: ElementRef<HTMLInputElement>;

  client: Client | null = null;
  activeTab = signal<TabId>('fiche');

  readonly TAB_GROUPS: TabGroup[] = [
    {
      label: 'Dossier',
      icon: 'folder',
      tabs: [
        { id: 'fiche', icon: 'badge', label: 'Fiche Identité' },
      ],
    },
    {
      label: 'Comptabilité',
      icon: 'calculate',
      tabs: [
        { id: 'pilotage',     icon: 'bar_chart',       label: 'Pilotage' },
        { id: 'fournisseurs', icon: 'local_shipping',  label: 'Fournisseurs' },
        { id: 'synthese',     icon: 'analytics',       label: 'Synthèse' },
      ],
    },
    {
      label: 'Analyse',
      icon: 'query_stats',
      tabs: [
        { id: 'strategie', icon: 'grid_view',   label: 'Stratégie' },
        { id: 'missions',  icon: 'assignment',  label: 'Missions' },
        { id: 'controle',  icon: 'shield',      label: 'Contrôle Interne' },
        { id: 'objectifs', icon: 'flag',        label: 'Objectifs' },
      ],
    },
    {
      label: 'Ressources',
      icon: 'inventory_2',
      tabs: [
        { id: 'documents',  icon: 'attach_file', label: 'Documents' },
        { id: 'taches',     icon: 'task_alt',    label: 'Tâches' },
        { id: 'historique', icon: 'history',     label: 'Historique' },
      ],
    },
    {
      label: 'Intelligence',
      icon: 'auto_awesome',
      tabs: [
        { id: 'ia', icon: 'smart_toy', label: 'Assistant IA' },
      ],
    },
  ];

  constructor(private route: ActivatedRoute, private clientsService: ClientsService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.clientsService.getOne(id).subscribe(c => this.client = c);
  }

  onTypesChanged(types: any[]) {
    if (this.client) this.client = { ...this.client, typesFluxActifs: types };
  }

  activeTabMeta() {
    for (const g of this.TAB_GROUPS) {
      const t = g.tabs.find(t => t.id === this.activeTab());
      if (t) return t;
    }
    return null;
  }

  exportPdf() {
    if (!this.client) return;
    this.clientsService.exportPdf(this.client.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note-passation-${this.client!.nom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  triggerLogoUpload() {
    this.logoInput?.nativeElement.click();
  }

  onLogoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.client) return;
    this.clientsService.uploadLogo(this.client.id, file).subscribe(updated => {
      this.client = { ...this.client!, logoUrl: updated.logoUrl };
    });
  }

  getInitials(nom: string) { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  getScoreBadgeClass(s: number) { return s >= 80 ? 'score-badge ok' : s >= 50 ? 'score-badge partial' : 'score-badge alert'; }
  getScoreStatus(s: number) { return s >= 80 ? 'Transmissible' : s >= 50 ? 'Partiel' : 'Alerte'; }
  getScoreColorClass(s: number) { return s >= 80 ? 'score-widget__value score-green' : s >= 50 ? 'score-widget__value score-orange' : 'score-widget__value score-red'; }
  getScoreBarClass(s: number) { return s >= 80 ? 'high' : s >= 50 ? 'medium' : 'low'; }
}
