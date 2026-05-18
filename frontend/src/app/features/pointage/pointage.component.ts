import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRippleModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { PointageService, EntreeJournee, MonStatut, Pointage } from '../../core/services/pointage.service';
import { AuthService } from '../../core/services/auth.service';

const HEURE_DEBUT    = 7;
const HEURE_FIN      = 19;
const TOTAL_MINUTES  = (HEURE_FIN - HEURE_DEBUT) * 60;
const JOURS          = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const JOURS_SEMAINE  = [1, 2, 3, 4, 5]; // lundi → vendredi

@Component({
  selector: 'app-pointage',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatButtonToggleModule, MatSnackBarModule, MatRippleModule,
  ],
  template: `
<div class="pt-page">

  <!-- ══════════════════════════════════════════════════════════
       VUE COLLABORATEUR
  ═══════════════════════════════════════════════════════════ -->
  <div class="collab-view">

    <!-- Greeting -->
    <div class="greeting">
      <span class="greeting-emoji">{{ greetEmoji() }}</span>
      <div>
        <p class="greeting-sub">{{ greetLabel() }}</p>
        <h2 class="greeting-name">{{ prenom() }}</h2>
      </div>
    </div>

    <!-- ── Carte principale ─────────────────────────────────── -->
    <div class="main-card" [class.main-card--arrive]="estArrive()" [class.main-card--parti]="estParti()">

      <!-- Fond décoratif -->
      <div class="main-card__bg"></div>

      <!-- Contenu -->
      <div class="main-card__content">

        <!-- État : pas encore pointé -->
        @if (!estArrive()) {
          <div class="state state--waiting">
            <div class="state__icon-wrap">
              <mat-icon class="state__icon">fingerprint</mat-icon>
            </div>
            <p class="state__title">Vous n'avez pas encore pointé</p>
            <p class="state__sub">{{ dateComplete() }}</p>
          </div>
        }

        <!-- État : présent -->
        @if (estArrive() && !estParti()) {
          <div class="state state--present">
            <div class="arrive-time">
              <mat-icon>login</mat-icon>
              <span>Arrivé à <strong>{{ heureArrivee() }}</strong></span>
            </div>
            <div class="duration-display">
              <span class="duration-val">{{ dureeStr() }}</span>
              <span class="duration-label">de présence</span>
            </div>
            <p class="state__sub">{{ dateComplete() }}</p>
          </div>
        }

        <!-- État : parti -->
        @if (estParti()) {
          <div class="state state--parti">
            <div class="arrive-time">
              <mat-icon>login</mat-icon>
              <span>Arrivée <strong>{{ heureArrivee() }}</strong></span>
            </div>
            <div class="arrive-time">
              <mat-icon>logout</mat-icon>
              <span>Départ <strong>{{ heureDepart() }}</strong></span>
            </div>
            <div class="duration-display">
              <span class="duration-val">{{ dureeStr() }}</span>
              <span class="duration-label">travaillées aujourd'hui</span>
            </div>
          </div>
        }

        <!-- Bouton pointer -->
        @if (!estParti()) {
          <button class="btn-pointer" matRipple
                  [class.btn-pointer--depart]="estArrive()"
                  [disabled]="enCours()"
                  (click)="pointer()">
            <mat-icon>{{ estArrive() ? 'logout' : 'fingerprint' }}</mat-icon>
            <span>{{ estArrive() ? 'Pointer le départ' : 'Pointer mon arrivée' }}</span>
          </button>
        }

        @if (estParti()) {
          <div class="journee-terminee">
            <mat-icon>check_circle</mat-icon>
            Bonne fin de journée !
          </div>
        }

      </div>
    </div>

    <!-- ── Semaine ───────────────────────────────────────────── -->
    <div class="semaine-card">
      <h3 class="semaine-title">Cette semaine</h3>
      <div class="semaine-jours">
        @for (jour of semaine(); track jour.date) {
          <div class="jour-item" [class.jour-item--today]="jour.isToday">
            <span class="jour-label">{{ jour.label }}</span>
            <div class="jour-dot"
                 [class.jour-dot--present]="jour.statut === 'present'"
                 [class.jour-dot--parti]="jour.statut === 'parti'"
                 [class.jour-dot--absent]="jour.statut === 'absent'"
                 [class.jour-dot--futur]="jour.statut === 'futur'"
                 [matTooltip]="jour.tooltip">
              @if (jour.statut === 'present' || jour.statut === 'parti') {
                <mat-icon>check</mat-icon>
              }
              @if (jour.statut === 'futur') {
                <mat-icon>remove</mat-icon>
              }
            </div>
            @if (jour.heure) {
              <span class="jour-heure">{{ jour.heure }}</span>
            }
          </div>
        }
      </div>
    </div>

  </div>

  <!-- ══════════════════════════════════════════════════════════
       VUE ÉQUIPE (admin uniquement)
  ═══════════════════════════════════════════════════════════ -->
  @if (isAdmin()) {
    <div class="equipe-section">
      <div class="equipe-header">
        <h3 class="equipe-title">
          <mat-icon>groups</mat-icon>
          Équipe aujourd'hui
        </h3>
        <mat-button-toggle-group [(ngModel)]="siteFiltre" (ngModelChange)="chargerEquipe()">
          <mat-button-toggle value="">Tous</mat-button-toggle>
          <mat-button-toggle value="REUNION">🇷🇪 Réunion</mat-button-toggle>
          <mat-button-toggle value="MADAGASCAR">🇲🇬 Madagascar</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Timeline -->
      <div class="timeline-wrap">
        <!-- Header heures -->
        <div class="tl-grid tl-grid--header">
          <div class="tl-name-col"></div>
          <div class="tl-track">
            @for (h of heures; track h) {
              <span class="tl-hour" [style.left.%]="pctH(h)">{{ h }}h</span>
            }
            <div class="tl-now" [style.left.%]="pctNow()">
              <div class="tl-now__dot"></div>
            </div>
          </div>
        </div>

        <!-- Lignes -->
        @for (e of entrees(); track e.user.id) {
          <div class="tl-grid tl-grid--row">
            <div class="tl-name-col">
              <div class="tl-avatar" [class.tl-avatar--present]="isPresent(e)" [class.tl-avatar--parti]="isPartiE(e)">
                {{ initiales(e) }}
              </div>
              <div class="tl-user-info">
                <span class="tl-user-name">{{ e.user.firstName }} {{ e.user.lastName }}</span>
                <span class="tl-badge" [class]="badgeClass(e)">{{ badgeLabel(e) }}</span>
              </div>
            </div>
            <div class="tl-track">
              @if (e.pointage) {
                <div class="tl-bar"
                     [class.tl-bar--parti]="!!e.pointage.heureDepart"
                     [style.left.%]="pctArrivee(e.pointage.heureArrivee)"
                     [style.width.%]="pctDuree(e.pointage)"
                     [matTooltip]="tooltipE(e.pointage)">
                  <span class="tl-bar-time">{{ fmt(e.pointage.heureArrivee) }}</span>
                </div>
              }
              <div class="tl-now tl-now--track" [style.left.%]="pctNow()"></div>
            </div>
          </div>
        }

        @if (entrees().length === 0) {
          <p class="tl-empty">Aucun collaborateur</p>
        }
      </div>
    </div>
  }

</div>
  `,
  styleUrl: './pointage.component.scss',
})
export class PointageComponent implements OnInit, OnDestroy {
  monStatut  = signal<MonStatut | null>(null);
  historique = signal<Pointage[]>([]);
  entrees    = signal<EntreeJournee[]>([]);
  enCours    = signal(false);
  siteFiltre = '';
  now        = signal(new Date());

  heures = Array.from({ length: HEURE_FIN - HEURE_DEBUT + 1 }, (_, i) => HEURE_DEBUT + i);

  estArrive = computed(() => !!this.monStatut()?.estPointe);
  estParti  = computed(() => !!this.monStatut()?.estParti);

  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(
    private svc: PointageService,
    private auth: AuthService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.charger();
    this.timers.push(setInterval(() => this.now.set(new Date()), 1000));
    this.timers.push(setInterval(() => this.charger(), 60_000));
  }

  ngOnDestroy() { this.timers.forEach(t => clearInterval(t)); }

  isAdmin() { return this.auth.isAdmin(); }

  charger() {
    this.svc.getMonStatut().subscribe(s => this.monStatut.set(s));
    this.svc.getHistorique().subscribe(h => this.historique.set(h));
    if (this.isAdmin()) this.chargerEquipe();
  }

  chargerEquipe() {
    this.svc.getJournee(undefined, this.siteFiltre || undefined).subscribe(d => this.entrees.set(d));
  }

  pointer() {
    this.enCours.set(true);
    this.svc.pointer().subscribe({
      next: () => { this.charger(); this.enCours.set(false); },
      error: (e) => {
        this.snack.open(e.error?.message ?? 'Erreur', undefined, { duration: 3000 });
        this.enCours.set(false);
      },
    });
  }

  // ── Greeting ─────────────────────────────────────────────
  prenom() { return this.auth.currentUser()?.firstName ?? ''; }

  greetEmoji() {
    const h = new Date().getHours();
    return h < 12 ? '☀️' : h < 18 ? '👋' : '🌙';
  }

  greetLabel() {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour,' : h < 18 ? 'Bon après-midi,' : 'Bonsoir,';
  }

  dateComplete() {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Durée ─────────────────────────────────────────────────
  heureArrivee() {
    const p = this.monStatut()?.pointage;
    return p ? this.fmt(p.heureArrivee) : '';
  }

  heureDepart() {
    const p = this.monStatut()?.pointage;
    return p?.heureDepart ? this.fmt(p.heureDepart) : '';
  }

  dureeStr() {
    const p = this.monStatut()?.pointage;
    if (!p) return '0h00';
    const fin = p.heureDepart ? new Date(p.heureDepart) : this.now();
    const diff = Math.max(0, Math.floor((fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000));
    return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`;
  }

  fmt(d: string) {
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Semaine ───────────────────────────────────────────────
  semaine() {
    const today  = new Date();
    const monday = new Date(today);
    const day    = today.getDay() || 7;
    monday.setDate(today.getDate() - day + 1);

    return JOURS_SEMAINE.map(offset => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + offset - 1);
      const iso     = d.toISOString().split('T')[0];
      const isToday = iso === today.toISOString().split('T')[0];
      const isFutur = d > today;
      const hist    = this.historique().find(p => p.date === iso);

      let statut: 'present' | 'parti' | 'absent' | 'futur' = 'absent';
      if (isFutur)              statut = 'futur';
      else if (hist?.heureDepart) statut = 'parti';
      else if (hist)            statut = 'present';

      return {
        label:   JOURS[d.getDay()],
        date:    iso,
        isToday,
        statut,
        heure:   hist ? this.fmt(hist.heureArrivee) : null,
        tooltip: hist ? `Arrivée ${this.fmt(hist.heureArrivee)}${hist.heureDepart ? ' · Départ ' + this.fmt(hist.heureDepart) : ''}` : (isFutur ? '' : 'Absent'),
      };
    });
  }

  // ── Timeline équipe ───────────────────────────────────────
  pctH(h: number)        { return ((h - HEURE_DEBUT) / (HEURE_FIN - HEURE_DEBUT)) * 100; }
  pctNow()               { const n = this.now(); return Math.min(Math.max(((n.getHours() - HEURE_DEBUT) * 60 + n.getMinutes()) / TOTAL_MINUTES * 100, 0), 100); }
  pctArrivee(h: string)  { const d = new Date(h); return Math.max(((d.getHours() - HEURE_DEBUT) * 60 + d.getMinutes()) / TOTAL_MINUTES * 100, 0); }
  pctDuree(p: Pointage)  { const fin = p.heureDepart ? new Date(p.heureDepart) : this.now(); const min = (fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000; return Math.min(min / TOTAL_MINUTES * 100, 100 - this.pctArrivee(p.heureArrivee)); }

  tooltipE(p: Pointage)  { return p.heureDepart ? `${this.fmt(p.heureArrivee)} → ${this.fmt(p.heureDepart)}` : `Arrivée ${this.fmt(p.heureArrivee)}`; }
  initiales(e: EntreeJournee) { return (e.user.firstName[0] + e.user.lastName[0]).toUpperCase(); }
  isPresent(e: EntreeJournee) { return !!e.pointage && !e.pointage.heureDepart; }
  isPartiE(e: EntreeJournee)  { return !!e.pointage?.heureDepart; }

  badgeClass(e: EntreeJournee) {
    if (!e.pointage)            return 'tl-badge--absent';
    if (e.pointage.heureDepart) return 'tl-badge--parti';
    return 'tl-badge--present';
  }
  badgeLabel(e: EntreeJournee) {
    if (!e.pointage)            return 'Absent';
    if (e.pointage.heureDepart) return 'Parti';
    return 'Présent';
  }
}
