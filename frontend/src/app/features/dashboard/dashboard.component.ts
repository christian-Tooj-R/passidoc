import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { ClientsService } from '../../core/services/clients.service';
import { FluxMensuelService } from '../../core/services/flux-mensuel.service';
import { Client } from '../../core/models/client.model';
import { AuthService } from '../../core/services/auth.service';

const MOIS_COURT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const TYPE_LABELS: Record<string, string> = {
  RELEVE_BANCAIRE: 'Relevé bancaire',
  TVA:             'TVA',
  PAIE:            'Paie',
  RAPPORT_VENTE:   'Rapport de vente',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatRippleModule],
  template: `
    <div class="dash">

      <!-- ══ HERO ══════════════════════════════════════════ -->
      <div class="hero">
        <div class="hero__text">
          <span class="hero__eyebrow">Tableau de bord</span>
          <h1 class="hero__title">Bonjour, {{ firstName }} 👋</h1>
          <p class="hero__date">{{ today }}</p>
        </div>
        <div class="hero__stats">
          <div class="h-stat">
            <span class="h-stat__val">{{ clients.length }}</span>
            <span class="h-stat__lbl">Dossiers</span>
          </div>
          <div class="h-stat__div"></div>
          <div class="h-stat">
            <span class="h-stat__val h-stat__val--green">{{ dossiersTransmissibles }}</span>
            <span class="h-stat__lbl">Transmissibles</span>
          </div>
          <div class="h-stat__div"></div>
          <div class="h-stat">
            <span class="h-stat__val h-stat__val--orange">{{ dossiersPartiels }}</span>
            <span class="h-stat__lbl">En cours</span>
          </div>
          <div class="h-stat__div"></div>
          <div class="h-stat">
            <span class="h-stat__val h-stat__val--red">{{ dossiersEnAlerte }}</span>
            <span class="h-stat__lbl">En alerte</span>
          </div>
        </div>
      </div>

      <!-- ══ METRIC CARDS ═══════════════════════════════════ -->
      <div class="metrics-row">
        @for (m of metrics; track m.label) {
          <div class="metric" [style.background]="m.bg">
            <div class="metric__top">
              <span class="metric__label">{{ m.label }}</span>
              <div class="metric__icon" [style.background]="m.iconBg" [style.color]="m.color">
                <mat-icon>{{ m.icon }}</mat-icon>
              </div>
            </div>
            <span class="metric__value" [style.color]="m.color">{{ m.value }}</span>
            <span class="metric__tag" [style.color]="m.color">{{ m.tag }}</span>
          </div>
        }
      </div>

      <!-- ══ ALERTES ════════════════════════════════════════ -->
      @if (alertes.length > 0) {
        <div class="alertes">
          <div class="alertes__head">
            <div class="alertes__icon-wrap">
              <mat-icon>notifications_active</mat-icon>
            </div>
            <div class="alertes__headtext">
              <p class="alertes__title">Documents manquants ou en retard</p>
              <p class="alertes__sub">{{ alertes.length }} alerte{{ alertes.length > 1 ? 's' : '' }} à traiter</p>
            </div>
            <button class="text-btn" (click)="alertesExpanded = !alertesExpanded">
              {{ alertesExpanded ? 'Réduire' : 'Tout voir' }}
              <mat-icon>{{ alertesExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
          </div>

          <div class="alertes__list">
            @for (a of alertesVisible; track $index) {
              <div class="alerte-row" matRipple [routerLink]="['/clients', a.client?.id]">
                <span class="alerte-dot" [class.dot--orange]="a.statut==='EN_RETARD'" [class.dot--red]="a.statut==='MANQUANT'"></span>
                <span class="alerte-client">{{ a.client?.nom }}</span>
                <span class="alerte-type">{{ typeLabel(a.type) }}</span>
                <span class="alerte-period">{{ moisLabel(a.mois) }} {{ a.annee }}</span>
                <span class="alerte-chip" [class.chip--orange]="a.statut==='EN_RETARD'" [class.chip--red]="a.statut==='MANQUANT'">
                  {{ a.statut === 'EN_RETARD' ? 'En retard' : 'Manquant' }}
                </span>
                <mat-icon class="alerte-arrow">chevron_right</mat-icon>
              </div>
            }
            @if (!alertesExpanded && alertes.length > 5) {
              <div class="alertes__more">+ {{ alertes.length - 5 }} autres alertes</div>
            }
          </div>
        </div>
      }

      <!-- ══ CLIENTS ════════════════════════════════════════ -->
      <div class="section-bar">
        <h2 class="section-bar__title">Dossiers clients</h2>
        <div class="chip-group">
          <button class="md-chip" [class.md-chip--active]="siteFilter===''" (click)="filterSite('')">
            <mat-icon>public</mat-icon> Tous
          </button>
          <button class="md-chip" [class.md-chip--active]="siteFilter==='REUNION'" (click)="filterSite('REUNION')">
            🇷🇪 La Réunion
          </button>
          <button class="md-chip" [class.md-chip--active]="siteFilter==='MADAGASCAR'" (click)="filterSite('MADAGASCAR')">
            🇲🇬 Madagascar
          </button>
        </div>
      </div>

      <div class="client-grid">
        @for (client of filteredClients; track client.id) {
          <div class="c-card" matRipple [routerLink]="['/clients', client.id]">

            <!-- Card top -->
            <div class="c-card__head">
              <div class="c-card__avatar" [class.av--re]="client.site==='REUNION'" [class.av--mg]="client.site==='MADAGASCAR'">
                {{ getInitials(client.nom) }}
              </div>
              <div class="c-card__info">
                <h3 class="c-card__name">{{ client.nom }}</h3>
                <span class="c-card__site" [class.site--re]="client.site==='REUNION'" [class.site--mg]="client.site==='MADAGASCAR'">
                  <mat-icon>location_on</mat-icon>
                  {{ client.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
                </span>
              </div>
              <div class="c-card__score-badge" [class.sb--high]="client.santePassation>=80" [class.sb--mid]="client.santePassation>=50&&client.santePassation<80" [class.sb--low]="client.santePassation<50">
                {{ client.santePassation }}%
              </div>
            </div>

            <!-- Progress -->
            <div class="c-card__prog">
              <div class="c-prog-track">
                <div class="c-prog-bar"
                  [class.bar--high]="client.santePassation>=80"
                  [class.bar--mid]="client.santePassation>=50&&client.santePassation<80"
                  [class.bar--low]="client.santePassation<50"
                  [style.width.%]="client.santePassation"></div>
              </div>
              <span class="c-prog-label">{{ getScoreLabel(client.santePassation) }}</span>
            </div>

          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .dash { max-width: 1300px; }

    /* ── Hero ──────────────────────────────────────── */
    .hero {
      background: #E6F4F1;
      border-radius: 24px;
      padding: 28px 32px;
      margin-bottom: 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 24px;
    }
    .hero__eyebrow { display: block; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #006B57; margin-bottom: 6px; }
    .hero__title { font-size: 28px; font-weight: 700; color: #1A1C1E; letter-spacing: -.4px; margin: 0 0 6px; }
    .hero__date { font-size: 13px; color: #44474F; margin: 0; text-transform: capitalize; }

    .hero__stats { display: flex; align-items: center; gap: 0; background: rgba(255,255,255,.6); border-radius: 16px; padding: 0 4px; }
    .h-stat { display: flex; flex-direction: column; align-items: center; padding: 16px 24px; }
    .h-stat__val { font-size: 28px; font-weight: 700; color: #1A1C1E; line-height: 1; }
    .h-stat__val--green  { color: #386A20; }
    .h-stat__val--orange { color: #7B4F00; }
    .h-stat__val--red    { color: #BA1A1A; }
    .h-stat__lbl { font-size: 11px; color: #44474F; margin-top: 4px; white-space: nowrap; }
    .h-stat__div { width: 1px; height: 32px; background: #C8C6CA; }

    /* ── Metric cards ──────────────────────────────── */
    .metrics-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .metric {
      border-radius: 20px;
      padding: 20px;
      display: flex; flex-direction: column; gap: 6px;
      cursor: default;
      transition: transform .15s;
    }
    .metric:hover { transform: translateY(-2px); }
    .metric__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .metric__label { font-size: 12px; font-weight: 500; color: #44474F; }
    .metric__icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .metric__icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .metric__value { font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -.5px; }
    .metric__tag { font-size: 11px; font-weight: 500; }

    /* ── Alertes ───────────────────────────────────── */
    .alertes {
      background: #FFDAD6;
      border-radius: 20px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .alertes__head {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 20px;
    }
    .alertes__icon-wrap {
      width: 40px; height: 40px; border-radius: 50%;
      background: #BA1A1A; color: #FFDAD6;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .alertes__icon-wrap mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .alertes__headtext { flex: 1; }
    .alertes__title { font-size: 14px; font-weight: 700; color: #410002; margin: 0; }
    .alertes__sub { font-size: 12px; color: #BA1A1A; margin: 2px 0 0; }

    .text-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; color: #BA1A1A;
      font-family: 'Inter', sans-serif; padding: 6px 12px; border-radius: 20px;
      transition: background .12s;
    }
    .text-btn:hover { background: rgba(186,26,26,.08); }
    .text-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .alertes__list { background: #FFFBFE; }
    .alerte-row {
      display: flex; align-items: center; gap: 12px;
      padding: 13px 20px;
      border-top: 1px solid #F5DDD9;
      cursor: pointer; transition: background .12s; position: relative;
    }
    .alerte-row:hover { background: #FFF8F7; }
    .alerte-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot--orange { background: #F97316; }
    .dot--red    { background: #BA1A1A; }
    .alerte-client { font-size: 13px; font-weight: 600; color: #1A1C1E; flex: 2; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alerte-type   { font-size: 12.5px; color: #44474F; flex: 2; }
    .alerte-period { font-size: 12px; color: #6F7978; flex: 1; }
    .alerte-chip {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0;
    }
    .chip--orange { background: #FFDDB0; color: #7B4F00; }
    .chip--red    { background: #FFDAD6; color: #BA1A1A; }
    .alerte-arrow { font-size: 16px; width: 16px; height: 16px; color: #C8C6CA; margin-left: auto; }
    .alertes__more { padding: 12px 20px; font-size: 12px; color: #BA1A1A; text-align: center; border-top: 1px solid #F5DDD9; font-weight: 500; }

    /* ── Section bar ───────────────────────────────── */
    .section-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-bar__title { font-size: 16px; font-weight: 700; color: #1A1C1E; margin: 0; }

    /* MD3 Chips */
    .chip-group { display: flex; gap: 8px; }
    .md-chip {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid #C8C6CA; background: #FFFBFE;
      border-radius: 8px; padding: 6px 14px;
      font-size: 13px; font-weight: 500; color: #44474F;
      cursor: pointer; transition: all .12s; font-family: 'Inter', sans-serif;
    }
    .md-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .md-chip:hover { background: #ECE6F0; border-color: #79747E; }
    .md-chip--active {
      background: #E8DEF8; border-color: transparent; color: #21005D; font-weight: 600;
    }
    .md-chip--active mat-icon { color: #21005D; }

    /* ── Client grid ───────────────────────────────── */
    .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .c-card {
      background: #FFFBFE;
      border-radius: 16px;
      border: 1px solid #E0E2EC;
      padding: 18px;
      cursor: pointer;
      position: relative; overflow: hidden;
      transition: box-shadow .15s, border-color .15s;
    }
    .c-card:hover {
      box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 4px 8px 2px rgba(0,0,0,.1);
      border-color: transparent;
    }

    .c-card__head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .c-card__avatar {
      width: 44px; height: 44px; border-radius: 50%;
      font-size: 14px; font-weight: 700; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .av--re { background: #C8F8EE; color: #006B57; }
    .av--mg { background: #DDE3EA; color: #162351; }

    .c-card__info { flex: 1; min-width: 0; }
    .c-card__name {
      font-size: 14px; font-weight: 600; color: #1A1C1E; margin: 0 0 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .c-card__site {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11.5px; font-weight: 500;
    }
    .c-card__site mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .site--re { color: #006B57; }
    .site--mg { color: #162351; }

    .c-card__score-badge {
      flex-shrink: 0; font-size: 13px; font-weight: 700;
      padding: 4px 10px; border-radius: 8px;
    }
    .sb--high { background: #C3EFAD; color: #386A20; }
    .sb--mid  { background: #FFDDB0; color: #7B4F00; }
    .sb--low  { background: #FFDAD6; color: #BA1A1A; }

    .c-card__prog { }
    .c-prog-track { height: 5px; background: #E0E2EC; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .c-prog-bar { height: 100%; border-radius: 4px; transition: width .5s ease; }
    .bar--high { background: #386A20; }
    .bar--mid  { background: #7B4F00; }
    .bar--low  { background: #BA1A1A; }
    .c-prog-label { font-size: 11px; color: #6F7978; }

    @media (max-width: 1100px) { .metrics-row { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 760px) { .hero { flex-direction: column; align-items: flex-start; } }
  `],
})
export class DashboardComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  alertes: any[] = [];
  alertesExpanded = false;
  siteFilter = '';
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  get dossiersTransmissibles() { return this.clients.filter(c => c.santePassation >= 80).length; }
  get dossiersPartiels()       { return this.clients.filter(c => c.santePassation >= 50 && c.santePassation < 80).length; }
  get dossiersEnAlerte()       { return this.clients.filter(c => c.santePassation < 50).length; }
  get firstName()              { return this.auth.currentUser()?.firstName || ''; }
  get alertesVisible()         { return this.alertesExpanded ? this.alertes : this.alertes.slice(0, 5); }

  get metrics() {
    return [
      { label: 'Dossiers actifs',   value: this.clients.length,          icon: 'folder_shared',        tag: 'Tous sites',                           color: '#006B57', iconBg: 'rgba(0,107,87,.15)',  bg: '#C8F8EE' },
      { label: 'Transmissibles',    value: this.dossiersTransmissibles,   icon: 'task_alt',             tag: 'Score ≥ 80%',                          color: '#386A20', iconBg: 'rgba(56,106,32,.15)', bg: '#C3EFAD' },
      { label: 'En cours',          value: this.dossiersPartiels,         icon: 'schedule',             tag: 'Score 50–79%',                         color: '#7B4F00', iconBg: 'rgba(123,79,0,.15)',  bg: '#FFDDB0' },
      { label: 'En alerte',         value: this.dossiersEnAlerte,         icon: 'warning_amber',        tag: 'Score < 50%',                          color: '#BA1A1A', iconBg: 'rgba(186,26,26,.15)', bg: '#FFDAD6' },
      { label: 'Docs manquants',    value: this.alertes.length,           icon: 'notifications_active', tag: this.alertes.length > 0 ? 'À traiter' : 'Tout reçu',
        color: this.alertes.length > 0 ? '#6E2A9A' : '#006B57',
        iconBg: this.alertes.length > 0 ? 'rgba(110,42,154,.15)' : 'rgba(0,107,87,.15)',
        bg:    this.alertes.length > 0 ? '#EEDCFF' : '#C8F8EE' },
    ];
  }

  constructor(
    private clientsService: ClientsService,
    private fluxService: FluxMensuelService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.clientsService.getAll().subscribe(data => {
      this.clients = data;
      this.filteredClients = data;
    });
    this.fluxService.getAlertesGlobales().subscribe(data => this.alertes = data);
  }

  filterSite(site: string) {
    this.siteFilter = site;
    this.filteredClients = site ? this.clients.filter(c => c.site === site) : this.clients;
  }

  getInitials(nom: string) { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  getScoreLabel(score: number) {
    if (score >= 80) return 'Transmissible';
    if (score >= 50) return 'Partiellement renseigné';
    return 'Risque de perte d\'information';
  }
  typeLabel(type: string) { return TYPE_LABELS[type] ?? type; }
  moisLabel(m: number)    { return MOIS_COURT[m - 1] ?? ''; }
}
