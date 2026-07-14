import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { FormsModule } from '@angular/forms';
import { PointageService, Pointage, PausePointage, MonStatut, EntreeJournee, SiteLocation } from '../../core/services/pointage.service';
import { AuthService } from '../../core/services/auth.service';
import { GeoLocationService } from '../../core/services/geo-location.service';
import { DataTableComponent, ColDirective, ColumnDef } from '../../shared/data-table/data-table.component';

type GeoEtat = 'idle' | 'checking' | 'ok' | 'trop_loin' | 'refuse' | 'indisponible';

const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const JOURS_LONGS  = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface JourSemaine {
  label:    string;
  labelLong: string;
  date:     string;
  isToday:  boolean;
  isFutur:  boolean;
  pointage: Pointage | null;
  statut:   'present' | 'parti' | 'absent' | 'futur' | 'en_pause' | 'revenu';
  netMin:   number;
  pauseMin: number;
}

type EtatLigne = 'absent' | 'present' | 'en_pause' | 'revenu' | 'parti';

@Component({
  selector: 'app-pointage',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatButtonToggleModule, MatSnackBarModule, MatRippleModule,
    MatDatepickerModule,
    DataTableComponent, ColDirective,
  ],
  template: `
<div class="pt-page" [class.pt-page--admin]="isAdmin()">

  <!-- ══════════════════════════════════════════════════════════
       VUE COLLABORATEUR
  ═══════════════════════════════════════════════════════════ -->
  <div class="collab-view">

    <!-- En-tête identique au listing admin -->
    <div class="collab-header">
      <h3 class="collab-title">
        <mat-icon>fingerprint</mat-icon>
        Mon pointage
      </h3>
      <span class="collab-date">{{ dateComplete() }}</span>
    </div>

    <!-- Carte principale -->
    <div class="main-card"
         [class.main-card--present]="etat() === 'present'"
         [class.main-card--pause]="etat() === 'en_pause'"
         [class.main-card--revenu]="etat() === 'revenu'"
         [class.main-card--parti]="etat() === 'parti'">
      <div class="main-card__bg"></div>
      <div class="main-card__content">

        @if (etat() === 'absent') {
          <div class="state">
            <div class="state__icon-wrap"><mat-icon class="state__icon">fingerprint</mat-icon></div>
            <p class="state__title">Vous n'avez pas encore pointé</p>
            <p class="state__sub">{{ dateComplete() }}</p>
          </div>
        }
        @if (etat() === 'present') {
          <div class="state">
            <div class="timeline-chips">
              <div class="chip chip--in"><mat-icon>login</mat-icon><span>{{ fmt(statut()?.pointage?.heureArrivee) }}</span></div>
            </div>
            <div class="duration-display">
              <span class="duration-val">{{ minToStr(netMin()) }}</span>
              <span class="duration-label">de travail effectif</span>
            </div>
            <p class="state__sub">{{ dateComplete() }}</p>
          </div>
        }
        @if (etat() === 'en_pause') {
          <div class="state">
            <div class="timeline-chips">
              <div class="chip chip--in"><mat-icon>login</mat-icon><span>{{ fmt(statut()?.pointage?.heureArrivee) }}</span></div>
              @for (p of closedPauses(); track p.id) {
                <div class="chip chip--pause chip--done"><mat-icon>coffee</mat-icon><span>{{ fmt(p.heureDebut) }} → {{ fmt(p.heureFin) }}</span></div>
              }
              <div class="chip chip--pause"><mat-icon>pause_circle</mat-icon><span>Pause depuis {{ fmt(openPause()?.heureDebut) }}</span></div>
            </div>
            <div class="duration-display">
              <span class="duration-val">{{ minToStr(netMin()) }}</span>
              <span class="duration-label">travaillées avant pause</span>
            </div>
            <p class="state__sub pause-label">En pause — {{ minToStr(pauseMin()) }} écoulées</p>
          </div>
        }
        @if (etat() === 'revenu') {
          <div class="state">
            <div class="timeline-chips">
              <div class="chip chip--in"><mat-icon>login</mat-icon><span>{{ fmt(statut()?.pointage?.heureArrivee) }}</span></div>
              @for (p of closedPauses(); track p.id) {
                <div class="chip chip--pause chip--done"><mat-icon>coffee</mat-icon><span>{{ fmt(p.heureDebut) }} → {{ fmt(p.heureFin) }}</span></div>
              }
            </div>
            <div class="duration-display">
              <span class="duration-val">{{ minToStr(netMin()) }}</span>
              <span class="duration-label">de travail effectif</span>
            </div>
          </div>
        }
        @if (etat() === 'parti') {
          <div class="state">
            <div class="timeline-chips">
              <div class="chip chip--in"><mat-icon>login</mat-icon><span>{{ fmt(statut()?.pointage?.heureArrivee) }}</span></div>
              @for (p of closedPauses(); track p.id) {
                <div class="chip chip--pause chip--done"><mat-icon>coffee</mat-icon><span>{{ fmt(p.heureDebut) }} → {{ fmt(p.heureFin) }}</span></div>
              }
              <div class="chip chip--out"><mat-icon>logout</mat-icon><span>{{ fmt(statut()?.pointage?.heureDepart) }}</span></div>
            </div>
            <div class="duration-display">
              <span class="duration-val">{{ minToStr(netMin()) }}</span>
              <span class="duration-label">travaillées aujourd'hui</span>
            </div>
          </div>
        }

        @if (etat() === 'revenu') {
          <div class="btn-groupe-revenu">
            <button class="btn-pointer btn-pointer--pause" matRipple
                    [disabled]="enCours()" (click)="pointer('debut_pause')">
              <mat-icon>pause_circle</mat-icon>
              <span>Nouvelle pause</span>
            </button>
            <button class="btn-pointer btn-pointer--out" matRipple
                    [disabled]="enCours()" (click)="pointer('depart')">
              <mat-icon>logout</mat-icon>
              <span>Pointer le départ</span>
            </button>
          </div>
        }
        @if (etat() !== 'parti' && etat() !== 'revenu') {
          <button class="btn-pointer" matRipple
                  [class.btn-pointer--pause]="etat() === 'present'"
                  [class.btn-pointer--resume]="etat() === 'en_pause'"
                  [disabled]="enCours() || (etat() === 'absent' && !peutPointerArrivee())"
                  (click)="pointer(etat() === 'present' ? 'debut_pause' : etat() === 'en_pause' ? 'fin_pause' : undefined)">
            <mat-icon>{{ etat() === 'absent' && geoEtat() === 'checking' ? 'hourglass_empty' : btnIcon() }}</mat-icon>
            <span>{{ etat() === 'absent' && geoEtat() === 'checking' ? 'Vérification position…' : btnLabel() }}</span>
          </button>
          @if (etat() === 'absent' && siteLocation()) {
            <div class="geo-status" [class]="'geo-status--' + geoEtat()">
              @switch (geoEtat()) {
                @case ('ok') {
                  <mat-icon>check_circle</mat-icon>
                  <span>Vous êtes au bureau · {{ geo.formatDistance(distanceM()!) }}</span>
                }
                @case ('trop_loin') {
                  <mat-icon>location_off</mat-icon>
                  <span>Trop loin du bureau ({{ geo.formatDistance(distanceM()!) }}) · rayon {{ siteLocation()!.radiusMeters }} m</span>
                }
                @case ('refuse') {
                  <mat-icon>gps_off</mat-icon>
                  <span>Géolocalisation refusée — autorisez-la dans votre navigateur</span>
                }
                @case ('indisponible') {
                  <mat-icon>gps_off</mat-icon>
                  <span>Géolocalisation non disponible sur cet appareil</span>
                }
                @case ('checking') {
                  <mat-icon>my_location</mat-icon>
                  <span>Vérification de votre position…</span>
                }
                @default {
                  <mat-icon>location_on</mat-icon>
                  <span>Pointage géolocalisé activé pour ce site</span>
                }
              }
            </div>
          }
        }
        @if (etat() === 'parti') {
          <div class="journee-terminee"><mat-icon>check_circle</mat-icon>Bonne fin de journée !</div>
        }
      </div>
    </div>

    <!-- KPIs personnels -->
    <div class="collab-kpis">
      <div class="kpi kpi--present">
        <mat-icon>event_available</mat-icon>
        <strong>{{ joursPresentsSemaine() }}<span class="kpi-denom">/5</span></strong>
        <span>jours cette semaine</span>
      </div>
      <div class="kpi kpi--total">
        <mat-icon>schedule</mat-icon>
        <strong>{{ minToStr(totalSemaine()) }}</strong>
        <span>total semaine</span>
      </div>
      <div class="kpi kpi--mois">
        <mat-icon>date_range</mat-icon>
        <strong>{{ joursPresentsMois() }}</strong>
        <span>jours ce mois</span>
      </div>
    </div>

    <!-- Vue semaine -->
    <div class="semaine-card">
      <div class="semaine-header">
        <button class="nav-btn" matRipple (click)="semaineOffset.set(semaineOffset() - 1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <h3 class="semaine-title">{{ titreSemaine() }}</h3>
        <button class="nav-btn" matRipple [disabled]="semaineOffset() >= 0"
                (click)="semaineOffset.set(semaineOffset() + 1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
        <span class="cal-container">
          <mat-datepicker-toggle [for]="pickerCollab" class="nav-cal-toggle" matTooltip="Choisir une semaine">
            <mat-icon matDatepickerToggleIcon>calendar_month</mat-icon>
          </mat-datepicker-toggle>
          <input class="cal-anchor" [matDatepicker]="pickerCollab"
                 [max]="maxDate" (dateChange)="onDateCollabChange($event)">
          <mat-datepicker #pickerCollab></mat-datepicker>
        </span>
      </div>
      <div class="semaine-jours">
        @for (jour of semaine(); track jour.date) {
          <div class="jour-col" [class.jour-col--today]="jour.isToday">
            <span class="jour-label">{{ jour.label }}</span>
            <span class="jour-num">{{ jourNum(jour.date) }}</span>
            <div class="jour-badge"
                 [class.jour-badge--present]="jour.statut === 'present' || jour.statut === 'en_pause' || jour.statut === 'revenu'"
                 [class.jour-badge--parti]="jour.statut === 'parti'"
                 [class.jour-badge--absent]="jour.statut === 'absent'"
                 [class.jour-badge--futur]="jour.statut === 'futur'">
              @if (jour.statut === 'absent') { <mat-icon>close</mat-icon> }
              @if (jour.statut === 'futur')  { <mat-icon>remove</mat-icon> }
              @if (jour.statut === 'parti' || jour.statut === 'present' || jour.statut === 'revenu') { <mat-icon>check</mat-icon> }
              @if (jour.statut === 'en_pause') { <mat-icon>pause</mat-icon> }
            </div>
            @if (jour.pointage) {
              <div class="jour-heures">
                <span class="jour-heure-in">{{ fmt(jour.pointage.heureArrivee) }}</span>
                @if (jour.pointage.heureDepart) {
                  <span class="jour-heure-out">{{ fmt(jour.pointage.heureDepart) }}</span>
                }
              </div>
            }
            @if (jour.netMin > 0) {
              <span class="jour-net">{{ minToStr(jour.netMin) }}</span>
            }
          </div>
        }
      </div>
      <div class="semaine-total">
        <span class="semaine-total-label">Total semaine</span>
        <span class="semaine-total-val">{{ minToStr(totalSemaine()) }}</span>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
       LISTING ADMIN
  ═══════════════════════════════════════════════════════════ -->
  @if (isAdmin()) {
    <div class="listing-section">

      <!-- En-tête -->
      <div class="listing-header">
        <h3 class="listing-title">
          <mat-icon>badge</mat-icon>
          Relevé des présences
        </h3>
        <button class="btn-export" matRipple (click)="exportCsv()">
          <mat-icon>download</mat-icon>
          Export CSV
        </button>
      </div>

      <!-- Navigation par jour + filtre site -->
      <div class="listing-filters">
        <div class="date-nav">
          <button class="nav-btn" matRipple (click)="prevJourAdmin()">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <span class="date-nav-label">{{ titreJourAdmin() }}</span>
          <button class="nav-btn" matRipple [disabled]="isAdminAujourdhui()" (click)="nextJourAdmin()">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <span class="cal-container">
            <mat-datepicker-toggle [for]="pickerAdmin" class="nav-cal-toggle" matTooltip="Aller à une date">
              <mat-icon matDatepickerToggleIcon>calendar_month</mat-icon>
            </mat-datepicker-toggle>
            <input class="cal-anchor" [matDatepicker]="pickerAdmin"
                   [max]="maxDate" (dateChange)="onDateAdminChange($event)">
            <mat-datepicker #pickerAdmin></mat-datepicker>
          </span>
          @if (!isAdminAujourdhui()) {
            <button class="btn-today" matRipple (click)="goToToday()">Aujourd'hui</button>
          }
        </div>
        <mat-button-toggle-group [(ngModel)]="siteFiltre" (ngModelChange)="chargerJourAdmin()">
          <mat-button-toggle value="">Tous</mat-button-toggle>
          <mat-button-toggle value="REUNION">🇷🇪 Réunion</mat-button-toggle>
          <mat-button-toggle value="MADAGASCAR">🇲🇬 Madagascar</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Recherche -->
      <div class="search-wrap">
        <mat-icon class="search-icon">search</mat-icon>
        <input class="search-input" type="text"
               placeholder="Rechercher un employé..."
               [ngModel]="searchAdmin()"
               (ngModelChange)="onSearchChange($event)">
        @if (searchAdmin()) {
          <button class="search-clear" (click)="onSearchChange('')">
            <mat-icon>close</mat-icon>
          </button>
        }
      </div>

      <!-- KPIs jour -->
      <div class="listing-kpis">
        <div class="kpi kpi--present">
          <mat-icon>people</mat-icon>
          <strong>{{ nbPresentsAdmin() }}</strong>
          <span>présents</span>
        </div>
        <div class="kpi kpi--absent">
          <mat-icon>person_off</mat-icon>
          <strong>{{ nbAbsentsAdmin() }}</strong>
          <span>absents</span>
        </div>
        <div class="kpi kpi--total">
          <mat-icon>schedule</mat-icon>
          <strong>{{ minToStr(totalTravailAdmin()) }}</strong>
          <span>total du jour</span>
        </div>
      </div>

      <!-- Tableau du jour -->
      <app-data-table
        [columns]="colonnesAdmin"
        [data]="lignesAdmin()"
        [pageSize]="20"
        [rowClass]="rowClassAdmin">

        <ng-template appCol="employe" let-e>
          <div class="employe-cell">
            <div class="employe-avatar"
                 [class.employe-avatar--present]="etatPour(e.user.id) === 'present' || etatPour(e.user.id) === 'revenu'"
                 [class.employe-avatar--pause]="etatPour(e.user.id) === 'en_pause'"
                 [class.employe-avatar--parti]="etatPour(e.user.id) === 'parti'">
              {{ (e.user.firstName[0] + e.user.lastName[0]).toUpperCase() }}
            </div>
            <span class="employe-nom">{{ e.user.firstName }} {{ e.user.lastName }}</span>
          </div>
        </ng-template>

        <ng-template appCol="site" let-e>
          <span class="site-badge"
                [class.site-badge--re]="e.user.site === 'REUNION'"
                [class.site-badge--mg]="e.user.site === 'MADAGASCAR'">
            {{ e.user.site === 'REUNION' ? '🇷🇪' : '🇲🇬' }}
            {{ e.user.site === 'REUNION' ? 'Réunion' : 'Madagascar' }}
          </span>
        </ng-template>

        <ng-template appCol="journee" let-e>
          <span class="col-journee-val">{{ typeJourneeL(e) }}</span>
        </ng-template>

        <ng-template appCol="arrivee" let-e>
          <span class="col-time-val">
            @if (e.pointage) { {{ fmt(e.pointage.heureArrivee) }} } @else { — }
          </span>
        </ng-template>

        <ng-template appCol="depart" let-e>
          <span class="col-time-val">
            @if (e.pointage?.heureDepart) { {{ fmt(e.pointage!.heureDepart) }} }
            @else if (e.pointage) { <span class="en-cours-dot">●</span> }
            @else { — }
          </span>
        </ng-template>

        <ng-template appCol="pause" let-e>
          <span class="col-dur-val">
            @if ((e.pointage?.pauses?.length ?? 0) > 0) {
              <span class="pause-tag">{{ minToStr(calcPauseE(e.pointage!)) }}</span>
            } @else { — }
          </span>
        </ng-template>

        <ng-template appCol="travail" let-e>
          <span class="col-dur-val col-travail">
            {{ e.pointage ? minToStr(calcNetteE(e.pointage!)) : '—' }}
          </span>
        </ng-template>

        <ng-template appCol="statut" let-e>
          <span class="statut-badge" [class]="'statut-badge--' + etatPour(e.user.id)">
            {{ labelEtatL(e.user.id) }}
          </span>
        </ng-template>

      </app-data-table>
    </div>
  }

</div>
  `,
  styleUrl: './pointage.component.scss',
})
export class PointageComponent implements OnInit, OnDestroy {

  // ── Collab ────────────────────────────────────────────────────
  statut        = signal<MonStatut | null>(null);
  historique    = signal<Pointage[]>([]);
  enCours       = signal(false);
  now           = signal(new Date());
  semaineOffset = signal(0);

  // ── Géolocalisation ───────────────────────────────────────────
  siteLocation  = signal<SiteLocation | null>(null);
  geoEtat       = signal<GeoEtat>('idle');
  distanceM     = signal<number | null>(null);
  private myLat: number | null = null;
  private myLng: number | null = null;

  etat = computed(() => this.statut()?.etat ?? 'absent');

  peutPointerArrivee = computed(() => {
    if (!this.siteLocation()) return true;        // pas de config → libre
    return this.geoEtat() === 'ok';
  });

  netMin = computed(() => {
    const s = this.statut();
    if (!s?.pointage) return 0;
    const fin   = s.pointage.heureDepart ? new Date(s.pointage.heureDepart) : this.now();
    const total = Math.max(0, Math.floor((fin.getTime() - new Date(s.pointage.heureArrivee).getTime()) / 60000));
    return Math.max(0, total - this.pauseMin());
  });

  openPause = computed<PausePointage | undefined>(() =>
    this.statut()?.pointage?.pauses?.find(p => !p.heureFin)
  );

  closedPauses = computed<PausePointage[]>(() =>
    (this.statut()?.pointage?.pauses ?? []).filter(p => !!p.heureFin)
  );

  pauseMin = computed(() => {
    const pauses = this.statut()?.pointage?.pauses ?? [];
    if (!pauses.length) return 0;
    return pauses.reduce((sum, pause) => {
      const start = new Date(pause.heureDebut);
      const end   = pause.heureFin ? new Date(pause.heureFin) : this.now();
      return sum + Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
    }, 0);
  });

  joursPresentsSemaine = computed(() =>
    this.semaine().filter(j => j.statut !== 'absent' && j.statut !== 'futur').length
  );

  joursPresentsMois = computed(() => {
    const moisStr = new Date().toISOString().slice(0, 7);
    return this.historique().filter(p => p.date.startsWith(moisStr)).length;
  });

  // ── Admin listing ─────────────────────────────────────────────
  jourOffsetAdmin = signal(0);
  jourDonnees     = signal<EntreeJournee[]>([]);
  siteFiltre      = '';
  searchAdmin     = signal('');

  readonly colonnesAdmin: ColumnDef[] = [
    { key: 'employe', label: 'Employé' },
    { key: 'site',    label: 'Site' },
    { key: 'journee', label: 'Journée' },
    { key: 'arrivee', label: 'Arrivée' },
    { key: 'depart',  label: 'Départ' },
    { key: 'pause',   label: 'Pause' },
    { key: 'travail', label: 'Travail net' },
    { key: 'statut',  label: 'Statut' },
  ];

  rowClassAdmin = (e: EntreeJournee) =>
    [this.isAnomalieL(e) ? 'row--anomalie' : '', !e.pointage ? 'row--absent' : '']
      .filter(Boolean).join(' ');

  dateAdmin = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() + this.jourOffsetAdmin());
    return d.toISOString().split('T')[0];
  });

  isAdminAujourdhui = computed(() => this.jourOffsetAdmin() === 0);

  // Tous les employés sans filtre de recherche (pour KPIs)
  employesAdmin = computed(() => {
    const map = new Map<number, EntreeJournee['user']>();
    this.jourDonnees().forEach(e => {
      if (!map.has(e.user.id)) map.set(e.user.id, e.user);
    });
    return [...map.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));
  });

  // Lignes du tableau filtrées par recherche
  lignesAdmin = computed(() => {
    const search = this.searchAdmin().toLowerCase().trim();
    return this.jourDonnees().filter(e => {
      if (!search) return true;
      const full = `${e.user.firstName} ${e.user.lastName}`.toLowerCase();
      const rev  = `${e.user.lastName} ${e.user.firstName}`.toLowerCase();
      return full.includes(search) || rev.includes(search);
    });
  });

  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(
    private svc: PointageService,
    private auth: AuthService,
    private snack: MatSnackBar,
    public  geo: GeoLocationService,
  ) {}

  ngOnInit() {
    this.charger();
    this.initGeo();
    this.timers.push(setInterval(() => this.now.set(new Date()), 1000));
    this.timers.push(setInterval(() => this.charger(), 60_000));
    this.timers.push(setInterval(() => this.rafraichirGeo(), 30_000));
  }

  ngOnDestroy() { this.timers.forEach(t => clearInterval(t)); }

  isAdmin() { return this.auth.isAdmin(); }

  charger() {
    this.svc.getMonStatut().subscribe(s => this.statut.set(s));
    this.svc.getHistorique().subscribe(h => this.historique.set(h));
    if (this.isAdmin()) this.chargerJourAdmin();
  }

  chargerJourAdmin() {
    this.svc.getJournee(this.dateAdmin(), this.siteFiltre || undefined)
      .subscribe(entries => this.jourDonnees.set(entries));
  }

  pointer(action?: 'debut_pause' | 'fin_pause' | 'depart') {
    this.enCours.set(true);
    const lat = this.myLat ?? undefined;
    const lng = this.myLng ?? undefined;
    this.svc.pointer(lat, lng, action).subscribe({
      next:  () => { this.charger(); this.enCours.set(false); },
      error: (e) => {
        this.snack.open(e.error?.message ?? 'Erreur', undefined, { duration: 4000 });
        this.enCours.set(false);
        // Si erreur de position, on relance la vérif géo
        if (e.status === 400) this.rafraichirGeo();
      },
    });
  }

  private initGeo() {
    const site = this.auth.currentUser()?.site;
    if (!site) return;
    this.svc.getSiteLocation(site).subscribe({
      next: loc => {
        this.siteLocation.set(loc);
        if (loc) this.rafraichirGeo();
      },
    });
  }

  rafraichirGeo() {
    if (!this.siteLocation()) return;
    this.geoEtat.set('checking');
    this.geo.getCurrentPosition().subscribe({
      next: coords => {
        this.myLat = coords.latitude;
        this.myLng = coords.longitude;
        const loc = this.siteLocation()!;
        const dist = this.geo.distanceTo(coords.latitude, coords.longitude, loc.latitude, loc.longitude);
        this.distanceM.set(dist);
        this.geoEtat.set(dist <= loc.radiusMeters ? 'ok' : 'trop_loin');
      },
      error: (err: Error) => {
        this.myLat = null;
        this.myLng = null;
        this.distanceM.set(null);
        this.geoEtat.set(err.message.includes('refus') || err.message.includes('ermission') ? 'refuse' : 'indisponible');
      },
    });
  }

  // ── Navigation jour admin ─────────────────────────────────────
  prevJourAdmin() {
    this.jourOffsetAdmin.set(this.jourOffsetAdmin() - 1);
    this.chargerJourAdmin();
  }

  nextJourAdmin() {
    this.jourOffsetAdmin.set(this.jourOffsetAdmin() + 1);
    this.chargerJourAdmin();
  }

  goToToday() {
    this.jourOffsetAdmin.set(0);
    this.chargerJourAdmin();
  }

  maxDate = new Date();

  onDateAdminChange(e: { value: Date | null }) {
    const val = e.value;
    if (!val) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(val); target.setHours(0, 0, 0, 0);
    this.jourOffsetAdmin.set(Math.round((target.getTime() - today.getTime()) / 86400000));
    this.chargerJourAdmin();
  }

  onDateCollabChange(e: { value: Date | null }) {
    const val = e.value;
    if (!val) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const currentMonday = this.getMondayOf(today);
    const selectedMonday = this.getMondayOf(new Date(val));
    this.semaineOffset.set(Math.round((selectedMonday.getTime() - currentMonday.getTime()) / (7 * 86400000)));
  }

  private getMondayOf(d: Date): Date {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  titreJourAdmin(): string {
    const d = new Date();
    d.setDate(d.getDate() + this.jourOffsetAdmin());
    const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return this.isAdminAujourdhui() ? `Aujourd'hui — ${label}` : label;
  }

  isToday(iso: string): boolean {
    return iso === new Date().toISOString().split('T')[0];
  }

  // ── Données par employé ───────────────────────────────────────
  pointagePour(userId: number): Pointage | null {
    return this.jourDonnees().find(e => e.user.id === userId)?.pointage ?? null;
  }

  etatPour(userId: number): EtatLigne {
    const p = this.pointagePour(userId);
    if (!p)            return 'absent';
    if (p.heureDepart) return 'parti';
    const pauses = p.pauses ?? [];
    if (pauses.some(pause => !pause.heureFin)) return 'en_pause';
    if (pauses.length > 0)                     return 'revenu';
    return 'present';
  }

  netPour(userId: number): number {
    const p = this.pointagePour(userId);
    return p ? this.calcNetteE(p) : 0;
  }

  // ── Calculs par pointage ──────────────────────────────────────
  calcPauseE(p: Pointage): number {
    const pauses = p.pauses ?? [];
    if (!pauses.length) return 0;
    return pauses.reduce((sum, pause) => {
      const start = new Date(pause.heureDebut);
      const end   = pause.heureFin ? new Date(pause.heureFin) : new Date();
      return sum + Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
    }, 0);
  }

  calcNetteE(p: Pointage): number {
    const fin   = p.heureDepart ? new Date(p.heureDepart) : new Date();
    const total = Math.max(0, Math.floor((fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000));
    return Math.max(0, total - this.calcPauseE(p));
  }

  // ── Helpers lignes tableau ────────────────────────────────────
  typeJourneeL(e: EntreeJournee): string {
    if (!e.pointage) return 'Absent';
    const nb = e.pointage.pauses?.length ?? 0;
    if (nb === 0) return 'Travail';
    return nb === 1 ? 'Travail · 1 pause' : `Travail · ${nb} pauses`;
  }

  labelEtatL(userId: number): string {
    switch (this.etatPour(userId)) {
      case 'absent':   return 'Absent';
      case 'present':  return 'Au travail';
      case 'en_pause': return 'En pause';
      case 'revenu':   return 'Au travail';
      case 'parti':    return 'Terminé';
    }
  }

  isAnomalieL(e: EntreeJournee): boolean {
    if (!e.pointage) return false;
    return new Date(this.dateAdmin() + 'T23:59:59') < new Date() && !e.pointage.heureDepart;
  }

  // ── Recherche ─────────────────────────────────────────────────
  onSearchChange(val: string) { this.searchAdmin.set(val); }

  // ── KPIs jour ─────────────────────────────────────────────────
  nbPresentsAdmin(): number {
    return this.employesAdmin().filter(u => !!this.pointagePour(u.id)).length;
  }

  nbAbsentsAdmin(): number {
    return this.employesAdmin().filter(u => !this.pointagePour(u.id)).length;
  }

  totalTravailAdmin(): number {
    return this.employesAdmin().reduce((sum, u) => sum + this.netPour(u.id), 0);
  }

  // ── Export CSV ────────────────────────────────────────────────
  exportCsv() {
    const date = this.dateAdmin();
    let csv = '﻿'; // BOM UTF-8 pour Excel
    csv += ['Employé', 'Site', 'Arrivée', 'Départ', 'Pause', 'Travail net', 'Statut'].join(';') + '\n';
    this.employesAdmin().forEach(u => {
      const p = this.pointagePour(u.id);
      csv += [
        `${u.firstName} ${u.lastName}`,
        u.site,
        p ? this.fmt(p.heureArrivee) : '',
        p?.heureDepart ? this.fmt(p.heureDepart) : '',
        p?.heureDebutPause ? this.minToStr(this.calcPauseE(p)) : '',
        p ? this.minToStr(this.calcNetteE(p)) : '',
        this.labelEtatL(u.id),
      ].join(';') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `pointages_${date}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Greeting ──────────────────────────────────────────────────
  prenom()      { return this.auth.currentUser()?.firstName ?? ''; }
  greetEmoji()  { const h = new Date().getHours(); return h < 12 ? '☀️' : h < 18 ? '👋' : '🌙'; }
  dateComplete(){ return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

  btnIcon() {
    switch (this.etat()) {
      case 'absent':   return 'fingerprint';
      case 'present':  return 'pause_circle';
      case 'en_pause': return 'play_circle';
      default:         return 'fingerprint';
    }
  }

  btnLabel() {
    switch (this.etat()) {
      case 'absent':   return 'Pointer mon arrivée';
      case 'present':  return 'Commencer la pause';
      case 'en_pause': return 'Fin de pause';
      default:         return '';
    }
  }

  // ── Durée ─────────────────────────────────────────────────────
  minToStr(min: number) {
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  }

  fmt(d: string | Date | null | undefined): string {
    if (!d) return '';
    return new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // ── Vue semaine collab ────────────────────────────────────────
  jourNum(iso: string) { return new Date(iso).getDate(); }

  titreSemaine() {
    const { lundi, vendredi } = this.bornesSemaine();
    const f = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return this.semaineOffset() === 0 ? `Semaine du ${f(lundi)}` : `${f(lundi)} – ${f(vendredi)}`;
  }

  private bornesSemaine() {
    const today  = new Date();
    const lundi  = new Date(today);
    const day    = today.getDay() || 7;
    lundi.setDate(today.getDate() - day + 1 + this.semaineOffset() * 7);
    lundi.setHours(0, 0, 0, 0);
    const vendredi = new Date(lundi);
    vendredi.setDate(lundi.getDate() + 4);
    return { lundi, vendredi };
  }

  semaine(): JourSemaine[] {
    const today    = new Date();
    const todayIso = today.toISOString().split('T')[0];
    const { lundi } = this.bornesSemaine();

    return [0, 1, 2, 3, 4].map(i => {
      const d   = new Date(lundi);
      d.setDate(lundi.getDate() + i);
      const iso     = d.toISOString().split('T')[0];
      const isToday = iso === todayIso;
      const isFutur = d > today && !isToday;
      const p       = this.historique().find(h => h.date === iso) ?? null;

      let statut: JourSemaine['statut'] = 'absent';
      if (isFutur) {
        statut = 'futur';
      } else if (p?.heureDepart) {
        statut = 'parti';
      } else if (p) {
        const pauses = p.pauses ?? [];
        if (pauses.some(pause => !pause.heureFin)) statut = 'en_pause';
        else if (pauses.length > 0)                statut = 'revenu';
        else                                       statut = 'present';
      }

      const pauseMin = p
        ? (p.pauses ?? []).reduce((sum, pause) => {
            const start = new Date(pause.heureDebut);
            const end   = pause.heureFin ? new Date(pause.heureFin) : new Date();
            return sum + Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
          }, 0) : 0;
      const totalMin = p
        ? Math.max(0, Math.floor(((p.heureDepart ? new Date(p.heureDepart) : new Date()).getTime()
            - new Date(p.heureArrivee).getTime()) / 60000)) : 0;

      return {
        label: JOURS_COURTS[d.getDay()], labelLong: JOURS_LONGS[d.getDay()],
        date: iso, isToday, isFutur, pointage: p, statut,
        netMin:   p?.heureDepart ? Math.max(0, totalMin - pauseMin) : (isToday ? Math.max(0, totalMin - pauseMin) : 0),
        pauseMin,
      };
    });
  }

  totalSemaine() { return this.semaine().reduce((acc, j) => acc + j.netMin, 0); }
}
