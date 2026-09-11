import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TimerService } from '../../core/services/saisie-temps.service';

/**
 * Indicateur compact du minuteur (module Travail), à monter dans les
 * différents "chrome" de l'application qui restent affichés en dehors de
 * /travail/* (topbar principale, topbar de la fiche client…) — cf. Tempolia
 * qui affiche "⏸ Arrêter minuteur 00h22:56" dans sa barre du haut sur tout
 * écran.
 *
 * TimerService est un singleton (`providedIn: 'root'`), donc ce composant ne
 * fait qu'afficher un second rendu du même état déjà partagé avec le widget
 * du module Travail — aucune logique de minuteur n'est dupliquée ici.
 *
 * "Arrêter" ici stoppe immédiatement le chrono (comme le ferait un simple
 * bouton stop) SANS ouvrir le formulaire de catégorisation (client, mission,
 * commentaire) qui vit dans travail.component.ts — ce composant ne doit pas
 * être modifié depuis ce chantier (un autre agent y travaille en parallèle).
 * Pour catégoriser et enregistrer la saisie de temps correspondante, il faut
 * utiliser "Voir" qui ramène vers le module Travail où ce formulaire est
 * disponible.
 */
@Component({
  selector: 'app-global-timer-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
@if (timerSvc.isRunning()) {
  <div class="gti">
    <span class="gti-dot"></span>
    <mat-icon class="gti-icon">timer</mat-icon>
    <span class="gti-time">{{ timerSvc.displayTime$() }}</span>
    @if (timerSvc.activeTaskCtx()?.taskTitre) {
      <span class="gti-ctx" [matTooltip]="timerSvc.activeTaskCtx()!.taskTitre">{{ timerSvc.activeTaskCtx()!.taskTitre }}</span>
    }
    <button class="gti-btn gti-btn--voir" (click)="goToTravail()" matTooltip="Ouvrir le module Travail">
      <mat-icon>open_in_new</mat-icon>
      <span class="gti-btn__label">Voir</span>
    </button>
    <button class="gti-btn gti-btn--stop" (click)="stop()" matTooltip="Arrêter le minuteur">
      <mat-icon>stop_circle</mat-icon>
      <span class="gti-btn__label">Arrêter</span>
    </button>
  </div>
}
  `,
  styles: [`
    .gti {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 6px 5px 10px;
      border-radius: 20px;
      background: linear-gradient(135deg, #fee2e2, #fef3c7);
      border: 1px solid #fbbf24;
      flex-shrink: 0;
    }
    .gti-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #ef4444;
      animation: gti-pulse 1.4s infinite;
      flex-shrink: 0;
    }
    @keyframes gti-pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,.45); }
      50% { opacity: .55; box-shadow: 0 0 0 4px rgba(239,68,68,0); }
    }
    .gti-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #b45309; }
    .gti-time {
      font-variant-numeric: tabular-nums;
      font-size: 12.5px; font-weight: 700; color: #7c2d12; letter-spacing: .2px;
      white-space: nowrap;
    }
    .gti-ctx {
      font-size: 11px; color: #92400e; max-width: 130px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      border-left: 1px solid rgba(180,83,9,.25); padding-left: 8px; margin-left: 2px;
    }
    .gti-btn {
      display: flex; align-items: center; gap: 4px;
      border: none; border-radius: 14px; cursor: pointer;
      padding: 4px 9px; font-size: 11.5px; font-weight: 600;
      font-family: inherit; transition: opacity .12s;
      mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    }
    .gti-btn:hover { opacity: .82; }
    .gti-btn--voir { background: #1e293b; color: #fff; }
    .gti-btn--stop { background: #fff; color: #b91c1c; border: 1px solid #fca5a5; }
    .gti-btn__label { white-space: nowrap; }

    @media (max-width: 900px) {
      .gti-ctx { display: none; }
      .gti-btn__label { display: none; }
      .gti-btn { padding: 5px; }
    }
  `],
})
export class GlobalTimerIndicatorComponent {
  timerSvc = inject(TimerService);
  private router = inject(Router);

  goToTravail() {
    this.router.navigate(['/travail']);
  }

  stop() {
    this.timerSvc.stop();
  }
}
