import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AXES_DIAGNOSTIC, ECHELLE_DIAGNOSTIC, LIBELLES_ZONES, scoreDiagnostic } from '../../../../../core/models/outils-bp.model';
import { BpListeComponent } from './bp-liste.component';

type Ton = 'gris' | 'rouge' | 'orange' | 'vert';

const NOTES = [1, 2, 3, 4, 5];
/** Géométrie du radar (unités du viewBox). */
const L = 560, H = 330, CX = 280, CY = 165, R = 110, LIGNE = 13;

const arrondi = (v: number) => Math.round(v * 10) / 10;

/** Coupe un libellé long en deux lignes équilibrées pour le radar. */
function couper(texte: string, max = 16): string[] {
  if (texte.length <= max) return [texte];
  const mots = texte.split(' ');
  let meilleur = [texte];
  let pire = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(' ');
    const b = mots.slice(i).join(' ');
    if (Math.max(a.length, b.length) < pire) { pire = Math.max(a.length, b.length); meilleur = [a, b]; }
  }
  return meilleur;
}

interface FondRadar {
  grilles: string[];
  rayons: { x: number; y: number }[];
  niveaux: { v: number; x: number; y: number }[];
  libelles: { code: string; x: number; y: number; ancre: string; lignes: string[] }[];
}

/**
 * Diagnostic interne (StratPilote) : score global et radar des 8 axes, notation 1 à 5 axe par
 * axe avec notes d'analyse, puis synthèse (points forts / faibles calculés, forces et
 * faiblesses saisies).
 */
@Component({
  selector: 'app-bp-diagnostic',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, BpListeComponent],
  template: `
<div class="dg">
  @let score = scoreGlobal;
  @let nb = nbNotes;
  <div class="dg__haut">
    <section class="dg__global dg__global--{{ tonMoyenne(score) }}">
      <span class="dg__global-lib">Score global</span>
      <span class="dg__global-val">{{ texteScore(score) }}@if (score !== null) {<small> / 5</small>}</span>
      <div class="dg__jauge" aria-hidden="true"><i [style.width.%]="(score ?? 0) * 20"></i></div>
      <span class="dg__global-sous">{{ nb }} axe{{ nb > 1 ? 's' : '' }} noté{{ nb > 1 ? 's' : '' }} sur {{ axes.length }}</span>
    </section>

    <figure class="dg__radar-fig">
      @let f = fond;
      <svg class="dg__radar" [attr.viewBox]="'0 0 ' + largeur + ' ' + hauteur" role="img"
           [attr.aria-label]="'Radar du diagnostic interne' + (score === null ? ', aucun axe noté' : ', score global ' + texteScore(score) + ' sur 5')">
        @for (g of f.grilles; track $index) { <polygon class="dg__grille" [class.dg__grille--ext]="$last" [attr.points]="g" /> }
        @for (r of f.rayons; track $index) { <line class="dg__rayon" [attr.x1]="cx" [attr.y1]="cy" [attr.x2]="r.x" [attr.y2]="r.y" /> }
        @for (n of f.niveaux; track n.v) { <text class="dg__niv" [attr.x]="n.x" [attr.y]="n.y">{{ n.v }}</text> }
        @if (nb) {
          <polygon class="dg__forme" [attr.points]="forme" />
          @for (p of points; track p.code) {
            <circle class="dg__pt" [attr.cx]="p.x" [attr.cy]="p.y" r="4.5"><title>{{ p.libelle }} : {{ p.score }}/5</title></circle>
          }
        } @else {
          <text class="dg__radar-vide" [attr.x]="cx" [attr.y]="cy + 4" text-anchor="middle">Aucun axe noté</text>
        }
        @for (lb of f.libelles; track lb.code) {
          <text class="dg__lib" [attr.y]="lb.y" [attr.text-anchor]="lb.ancre">
            @for (ligne of lb.lignes; track $index) { <tspan [attr.x]="lb.x" [attr.dy]="$first ? 0 : ligneRadar">{{ ligne }}</tspan> }
          </text>
        }
      </svg>
    </figure>
  </div>

  <section class="dg__bloc">
    <h3 class="dg__titre"><mat-icon>tune</mat-icon>Évaluation par axe</h3>
    <div class="dg__axes">
      @for (code of axes; track code) {
        @let ax = contenu.axes[code];
        <article class="dg__axe dg__axe--{{ ton(ax.score) }}" [attr.data-axe]="code">
          <header class="dg__axe-tete">
            <h4>{{ libelle(code) }}</h4>
            <span class="dg__badge">{{ ax.score ? echelle[ax.score - 1] : 'Non noté' }}</span>
          </header>
          <div class="dg__echelle" role="group" [attr.aria-label]="'Note : ' + libelle(code)">
            @for (n of notes; track n) {
              @if (editable) {
                <button type="button" class="dg__n" [class.on]="ax.score === n" [class.sous]="n < ax.score"
                        [attr.aria-pressed]="ax.score === n" [matTooltip]="echelle[n - 1]" (click)="noter(code, n)">{{ n }}</button>
              } @else {
                <span class="dg__n" [class.on]="ax.score === n" [class.sous]="n < ax.score">{{ n }}</span>
              }
            }
          </div>
          <div class="dg__graduation"><span>1 - Très faible</span><span>3 - Moyen</span><span>5 - Excellent</span></div>
          <span class="dg__note-lib">Notes / Analyse</span>
          @if (editable) {
            <textarea class="dg__note-champ" rows="3" maxlength="3000" [(ngModel)]="ax.note" (ngModelChange)="emettre()"
                      [attr.aria-label]="'Notes / Analyse : ' + libelle(code)"
                      placeholder="Constats, éléments factuels, pistes d'amélioration…"></textarea>
          } @else {
            <p class="dg__note" [class.dg__note--vide]="!ax.note">{{ ax.note || 'Aucune note' }}</p>
          }
        </article>
      }
    </div>
  </section>

  <section class="dg__bloc">
    <h3 class="dg__titre"><mat-icon>summarize</mat-icon>Synthèse du diagnostic</h3>
    @let forts = pointsForts;
    @let faibles = pointsFaibles;
    <div class="dg__synthese">
      <div class="dg__pts dg__pts--forts">
        <h4><mat-icon>trending_up</mat-icon>Points forts</h4>
        <ul>
          @for (p of forts; track p.code) { <li [attr.data-axe]="p.code"><span>{{ p.libelle }}</span><b>{{ p.score }}/5</b></li> }
          @empty { <li class="dg__pts-vide">Aucun axe noté 4 ou 5</li> }
        </ul>
      </div>
      <div class="dg__pts dg__pts--faibles">
        <h4><mat-icon>trending_down</mat-icon>Points faibles</h4>
        <ul>
          @for (p of faibles; track p.code) { <li [attr.data-axe]="p.code"><span>{{ p.libelle }}</span><b>{{ p.score }}/5</b></li> }
          @empty { <li class="dg__pts-vide">Aucun axe noté 1 ou 2</li> }
        </ul>
      </div>
      <div class="dg__liste dg__liste--forces">
        <h4>Forces</h4>
        <app-bp-liste [items]="contenu.forces" [editable]="editable" placeholder="Ajouter une force…"
                      vide="Aucune force notée" (changement)="emettre()" />
      </div>
      <div class="dg__liste dg__liste--faiblesses">
        <h4>Faiblesses</h4>
        <app-bp-liste [items]="contenu.faiblesses" [editable]="editable" placeholder="Ajouter une faiblesse…"
                      vide="Aucune faiblesse notée" (changement)="emettre()" />
      </div>
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .dg { display: flex; flex-direction: column; gap: 22px; }
    .dg__titre { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #1e293b; }
    .dg__titre mat-icon { font-size: 20px; width: 20px; height: 20px; color: #14b8a6; }

    /* En-tête : score global + radar */
    .dg__haut { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 20px; align-items: center; }
    .dg__global { --accent: #94a3b8; --fond: #f8fafc; display: flex; flex-direction: column; gap: 8px; padding: 20px;
      border-radius: 14px; background: var(--fond); border: 1px solid #e2e8f0; border-top: 4px solid var(--accent); }
    .dg__global--rouge { --accent: #dc2626; --fond: #fef2f2; }
    .dg__global--orange { --accent: #ea580c; --fond: #fff7ed; }
    .dg__global--vert { --accent: #16a34a; --fond: #f0fdf4; }
    .dg__global-lib { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
    .dg__global-val { font-size: 40px; font-weight: 800; line-height: 1; color: var(--accent); }
    .dg__global-val small { font-size: 18px; font-weight: 600; color: #64748b; }
    .dg__jauge { height: 8px; border-radius: 4px; background: #e2e8f0; overflow: hidden; }
    .dg__jauge i { display: block; height: 100%; border-radius: 4px; background: var(--accent); transition: width .2s; }
    .dg__global-sous { font-size: 12.5px; color: #64748b; }
    .dg__radar-fig { margin: 0; display: flex; justify-content: center; min-width: 0; }
    .dg__radar { width: 100%; max-width: 560px; height: auto; overflow: visible; }
    .dg__grille { fill: none; stroke: #e2e8f0; stroke-width: 1; }
    .dg__grille--ext { stroke: #cbd5e1; fill: #f8fafc; }
    .dg__rayon { stroke: #e2e8f0; stroke-width: 1; }
    .dg__niv { font-size: 9px; fill: #94a3b8; }
    .dg__forme { fill: rgba(20, 184, 166, .22); stroke: #0d9488; stroke-width: 2; stroke-linejoin: round; }
    .dg__pt { fill: #0d9488; stroke: #fff; stroke-width: 1.5; }
    .dg__lib { font-size: 11.5px; font-weight: 600; fill: #334155; }
    .dg__radar-vide { font-size: 12px; font-style: italic; fill: #94a3b8; }

    /* Axes */
    .dg__axes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .dg__axe { --accent: #94a3b8; --clair: #f1f5f9; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px;
      border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid var(--accent); }
    .dg__axe--rouge { --accent: #dc2626; --clair: #fee2e2; }
    .dg__axe--orange { --accent: #ea580c; --clair: #ffedd5; }
    .dg__axe--vert { --accent: #16a34a; --clair: #dcfce7; }
    .dg__axe-tete { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .dg__axe-tete h4 { margin: 0; font-size: 14px; font-weight: 700; color: #1e293b; }
    .dg__badge { flex-shrink: 0; padding: 2px 9px; border-radius: 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap;
      background: var(--clair); color: var(--accent); }
    .dg__echelle { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .dg__n { display: flex; align-items: center; justify-content: center; height: 32px; border-radius: 8px; box-sizing: border-box;
      border: 1px solid #e2e8f0; background: #f8fafc; font: inherit; font-size: 13px; font-weight: 700; color: #64748b; }
    button.dg__n { cursor: pointer; }
    button.dg__n:hover { border-color: var(--accent); color: #1e293b; }
    .dg__n.sous { background: var(--clair); border-color: var(--clair); color: var(--accent); }
    .dg__n.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .dg__graduation { display: flex; justify-content: space-between; gap: 6px; font-size: 10.5px; color: #94a3b8; }
    .dg__note-lib { margin-top: 2px; font-size: 12px; font-weight: 600; color: #475569; }
    .dg__note-champ { resize: vertical; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff;
      font: inherit; font-size: 13px; color: #1e293b; }
    .dg__note-champ:focus { outline: none; border-color: #14b8a6; box-shadow: 0 0 0 2px rgba(20, 184, 166, .2); }
    .dg__note { margin: 0; font-size: 13px; line-height: 1.45; color: #475569; white-space: pre-line; word-break: break-word; }
    .dg__note--vide { font-style: italic; color: #94a3b8; }

    /* Synthèse */
    .dg__synthese { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .dg__pts, .dg__liste { border-radius: 12px; padding: 14px 16px 16px; }
    .dg__synthese h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; padding-bottom: 8px; font-size: 14px; font-weight: 700;
      border-bottom: 2px solid currentColor; }
    .dg__synthese h4 mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .dg__pts ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
    .dg__pts li { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; color: #334155; }
    .dg__pts li b { white-space: nowrap; }
    .dg__pts li.dg__pts-vide { font-size: 12.5px; font-style: italic; color: #94a3b8; }
    .dg__pts--forts { background: #ecfdf5; }
    .dg__pts--faibles { background: #fef2f2; }
    .dg__liste { background: #fff; border: 1px solid #e2e8f0; }
    .dg__liste--forces { --bl-accent: #10b981; }
    .dg__liste--faiblesses { --bl-accent: #ef4444; }
    .dg__pts--forts h4, .dg__liste--forces h4, .dg__pts--forts li b { color: #059669; }
    .dg__pts--faibles h4, .dg__liste--faiblesses h4, .dg__pts--faibles li b { color: #dc2626; }

    @container (max-width: 760px) {
      .dg__haut, .dg__axes, .dg__synthese { grid-template-columns: 1fr; }
      .dg__global { flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: 14px; }
      .dg__jauge { flex-basis: 100%; }
    }
  `],
})
export class BpDiagnosticComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();

  readonly notes = NOTES;
  readonly largeur = L;
  readonly hauteur = H;
  readonly cx = CX;
  readonly cy = CY;
  readonly ligneRadar = LIGNE;
  private fondCache?: FondRadar;

  // Constantes importées lues via des getters (ordre d'initialisation du bundle de test).
  get axes(): readonly string[] { return AXES_DIAGNOSTIC; }
  get echelle(): string[] { return ECHELLE_DIAGNOSTIC; }

  libelle(code: string): string { return LIBELLES_ZONES[code] ?? code; }
  private note(code: string): number { return Number(this.contenu?.axes?.[code]?.score) || 0; }

  get scoreGlobal(): number | null { return scoreDiagnostic(this.contenu); }
  get nbNotes(): number { return this.axes.filter(a => this.note(a) > 0).length; }

  texteScore(s: number | null): string {
    return s === null ? '—' : s.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  ton(score: number): Ton {
    const s = Number(score) || 0;
    return !s ? 'gris' : s <= 2 ? 'rouge' : s === 3 ? 'orange' : 'vert';
  }

  tonMoyenne(s: number | null): Ton {
    return s === null ? 'gris' : s < 2.5 ? 'rouge' : s < 3.5 ? 'orange' : 'vert';
  }

  get pointsForts() { return this.synthese(n => n >= 4); }
  get pointsFaibles() { return this.synthese(n => n >= 1 && n <= 2); }

  private synthese(garder: (n: number) => boolean) {
    return this.axes.filter(a => garder(this.note(a))).map(a => ({ code: a, libelle: this.libelle(a), score: this.note(a) }));
  }

  // ── Radar ───────────────────────────────────────────────────────────────

  private point(i: number, valeur: number): { x: number; y: number } {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / this.axes.length;
    return { x: arrondi(CX + R * (valeur / 5) * Math.cos(angle)), y: arrondi(CY + R * (valeur / 5) * Math.sin(angle)) };
  }

  /** Grilles, rayons et libellés : ne dépendent pas des notes, calculés une fois. */
  get fond(): FondRadar {
    if (this.fondCache) return this.fondCache;
    const n = this.axes.length;
    const grilles = [1, 2, 3, 4, 5].map(v => this.axes.map((_, i) => { const p = this.point(i, v); return `${p.x},${p.y}`; }).join(' '));
    const rayons = this.axes.map((_, i) => this.point(i, 5));
    const niveaux = [1, 2, 3, 4, 5].map(v => ({ v, x: CX + 4, y: arrondi(CY - (R * v) / 5 - 2) }));
    const libelles = this.axes.map((code, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const x = arrondi(CX + (R + 14) * cos);
      const y = CY + (R + 14) * sin;
      const lignes = couper(this.libelle(code));
      const decalage = sin < -0.2 ? -(lignes.length - 1) * LIGNE - 2 : sin > 0.2 ? 10 : -((lignes.length - 1) * LIGNE) / 2 + 4;
      return { code, x, y: arrondi(y + decalage), ancre: cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle', lignes };
    });
    return (this.fondCache = { grilles, rayons, niveaux, libelles });
  }

  get forme(): string {
    return this.axes.map((a, i) => { const p = this.point(i, this.note(a)); return `${p.x},${p.y}`; }).join(' ');
  }

  get points() {
    return this.axes.map((code, i) => ({ code, i, score: this.note(code) }))
      .filter(p => p.score > 0)
      .map(p => ({ ...p, ...this.point(p.i, p.score), libelle: this.libelle(p.code) }));
  }

  // ── Édition ─────────────────────────────────────────────────────────────

  /** Un clic sur la note déjà choisie la retire (axe non noté). */
  noter(code: string, n: number) {
    if (!this.editable) return;
    const axe = this.contenu.axes[code];
    axe.score = axe.score === n ? 0 : n;
    this.emettre();
  }

  emettre() { this.contenuChange.emit(this.contenu); }
}
