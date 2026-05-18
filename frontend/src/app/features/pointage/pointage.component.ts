import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { PointageService, EntreeJournee, MonStatut } from '../../core/services/pointage.service';

const HEURE_DEBUT = 7;   // 07h00
const HEURE_FIN   = 19;  // 19h00
const TOTAL_MINUTES = (HEURE_FIN - HEURE_DEBUT) * 60;

@Component({
  selector: 'app-pointage',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatButtonToggleModule, MatSnackBarModule,
  ],
  template: `
<div class="pointage-page">

  <!-- ── En-tête ───────────────────────────────────────────── -->
  <div class="pointage-header">
    <div class="header-left">
      <h1 class="page-title">
        <mat-icon>fingerprint</mat-icon>
        Pointage
      </h1>
      <span class="date-badge">{{ dateAffichee }}</span>
    </div>

    <div class="header-right">
      <!-- Filtre site -->
      <mat-button-toggle-group [(ngModel)]="siteFiltre" (ngModelChange)="charger()">
        <mat-button-toggle value="">Tous</mat-button-toggle>
        <mat-button-toggle value="REUNION">🇷🇪 Réunion</mat-button-toggle>
        <mat-button-toggle value="MADAGASCAR">🇲🇬 Madagascar</mat-button-toggle>
      </mat-button-toggle-group>

      <!-- Mon pointage -->
      <button mat-flat-button
              [color]="monStatut()?.estPointe && !monStatut()?.estParti ? 'warn' : 'primary'"
              class="btn-pointer"
              [disabled]="enCours()"
              (click)="pointer()">
        <mat-icon>{{ monStatut()?.estPointe && !monStatut()?.estParti ? 'logout' : 'login' }}</mat-icon>
        {{ monStatut()?.estPointe && !monStatut()?.estParti ? 'Pointer départ' : 'Pointer arrivée' }}
      </button>
    </div>
  </div>

  <!-- ── Timeline ──────────────────────────────────────────── -->
  <div class="timeline-wrapper">

    <!-- Header heures -->
    <div class="tl-grid">
      <div class="tl-user-col tl-header-cell">Collaborateur</div>
      <div class="tl-track tl-header-hours">
        @for (h of heures; track h) {
          <div class="tl-hour-label" [style.left.%]="pctHeure(h)">{{ h }}h</div>
        }
        <!-- Ligne heure actuelle -->
        <div class="tl-now-line" [style.left.%]="pctMaintenant()">
          <div class="tl-now-dot"></div>
        </div>
      </div>
    </div>

    <!-- Lignes collaborateurs -->
    @for (e of entrees(); track e.user.id) {
      <div class="tl-grid tl-row" [class.tl-row--present]="isPresent(e)" [class.tl-row--absent]="!e.pointage">
        <!-- Info user -->
        <div class="tl-user-col">
          <div class="avatar" [class.avatar--present]="isPresent(e)" [class.avatar--parti]="isParti(e)">
            {{ initiales(e) }}
          </div>
          <div class="user-info">
            <span class="user-name">{{ e.user.firstName }} {{ e.user.lastName }}</span>
            <span class="user-badge" [class]="badgeClass(e)">
              {{ badgeLabel(e) }}
            </span>
          </div>
        </div>

        <!-- Piste timeline -->
        <div class="tl-track">
          @if (e.pointage) {
            <div class="tl-bar"
                 [style.left.%]="pctArrivee(e.pointage.heureArrivee)"
                 [style.width.%]="pctDuree(e.pointage)"
                 [class.tl-bar--parti]="!!e.pointage.heureDepart"
                 [matTooltip]="tooltip(e.pointage)">
              <span class="tl-bar-label">{{ heureLabel(e.pointage.heureArrivee) }}</span>
            </div>
          }
        </div>
      </div>
    }

    @if (entrees().length === 0) {
      <div class="tl-empty">Aucun collaborateur trouvé</div>
    }
  </div>

</div>
  `,
  styleUrl: './pointage.component.scss',
})
export class PointageComponent implements OnInit, OnDestroy {
  entrees   = signal<EntreeJournee[]>([]);
  monStatut = signal<MonStatut | null>(null);
  enCours   = signal(false);
  siteFiltre = '';

  heures = Array.from({ length: HEURE_FIN - HEURE_DEBUT + 1 }, (_, i) => HEURE_DEBUT + i);

  presents = computed(() => this.entrees().filter(e => e.pointage && !e.pointage.heureDepart).length);
  absents  = computed(() => this.entrees().filter(e => !e.pointage).length);
  partis   = computed(() => this.entrees().filter(e => e.pointage?.heureDepart).length);

  get dateAffichee() {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  private timer?: ReturnType<typeof setInterval>;

  constructor(private svc: PointageService, private snack: MatSnackBar) {}

  ngOnInit() {
    this.charger();
    // Refresh toutes les 60s pour la ligne "maintenant" et les nouveaux pointages
    this.timer = setInterval(() => this.charger(), 60_000);
  }

  ngOnDestroy() { clearInterval(this.timer); }

  charger() {
    this.svc.getJournee(undefined, this.siteFiltre || undefined).subscribe(d => this.entrees.set(d));
    this.svc.getMonStatut().subscribe(s => this.monStatut.set(s));
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

  // ── Calculs timeline ──────────────────────────────────────

  pctHeure(h: number): number {
    return ((h - HEURE_DEBUT) / (HEURE_FIN - HEURE_DEBUT)) * 100;
  }

  pctMaintenant(): number {
    const now = new Date();
    const min = (now.getHours() - HEURE_DEBUT) * 60 + now.getMinutes();
    return Math.min(Math.max((min / TOTAL_MINUTES) * 100, 0), 100);
  }

  pctArrivee(h: string): number {
    const d = new Date(h);
    const min = (d.getHours() - HEURE_DEBUT) * 60 + d.getMinutes();
    return Math.max((min / TOTAL_MINUTES) * 100, 0);
  }

  pctDuree(p: { heureArrivee: string; heureDepart: string | null }): number {
    const fin = p.heureDepart ? new Date(p.heureDepart) : new Date();
    const debut = new Date(p.heureArrivee);
    const dureeMin = (fin.getTime() - debut.getTime()) / 60000;
    return Math.min((dureeMin / TOTAL_MINUTES) * 100, 100 - this.pctArrivee(p.heureArrivee));
  }

  heureLabel(h: string): string {
    const d = new Date(h);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  tooltip(p: { heureArrivee: string; heureDepart: string | null }): string {
    const arr = this.heureLabel(p.heureArrivee);
    if (p.heureDepart) return `Arrivée ${arr} — Départ ${this.heureLabel(p.heureDepart)}`;
    const now = new Date();
    const debut = new Date(p.heureArrivee);
    const diffMin = Math.floor((now.getTime() - debut.getTime()) / 60000);
    const h = Math.floor(diffMin / 60), m = diffMin % 60;
    return `Arrivée ${arr} — Présent depuis ${h}h${m.toString().padStart(2, '0')}`;
  }

  // ── Helpers ───────────────────────────────────────────────

  initiales(e: EntreeJournee): string {
    return `${e.user.firstName[0]}${e.user.lastName[0]}`.toUpperCase();
  }

  isPresent(e: EntreeJournee): boolean { return !!e.pointage && !e.pointage.heureDepart; }
  isParti(e: EntreeJournee):   boolean { return !!e.pointage?.heureDepart; }

  badgeClass(e: EntreeJournee): string {
    if (!e.pointage) return 'badge badge--absent';
    if (e.pointage.heureDepart) return 'badge badge--parti';
    return 'badge badge--present';
  }

  badgeLabel(e: EntreeJournee): string {
    if (!e.pointage) return 'Absent';
    if (e.pointage.heureDepart) return 'Parti';
    return 'Présent';
  }
}
