import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BpListeComponent } from './bp-liste.component';
import { FORCES_PORTER, LIBELLES_ZONES, NIVEAUX_PORTER, menaceGlobalePorter } from '../../../../../core/models/outils-bp.model';

type CodeForce = typeof FORCES_PORTER[number];

/** Repère visuel de chaque force (aide reprise des modules StratPilote, flèche vers le centre). */
const FORCES: Record<CodeForce, { icon: string; fleche: string; aide: string; placeholder: string }> = {
  nouveauxEntrants: { icon: 'person_add', fleche: 'south_east',
    aide: "Barrières à l'entrée, investissements nécessaires, réglementation", placeholder: 'Un nouvel acteur, une barrière…' },
  pouvoirClients: { icon: 'groups', fleche: 'south_west',
    aide: 'Concentration des clients, sensibilité au prix, coût de changement', placeholder: 'Un levier de négociation client…' },
  substituts: { icon: 'swap_horiz', fleche: 'west',
    aide: 'Alternatives disponibles, rapport qualité/prix, facilité de substitution', placeholder: 'Une offre de remplacement…' },
  pouvoirFournisseurs: { icon: 'local_shipping', fleche: 'north_east',
    aide: 'Nombre de fournisseurs, coût de changement, dépendance aux intrants', placeholder: 'Une dépendance fournisseur…' },
  concurrence: { icon: 'local_fire_department', fleche: 'north_west',
    aide: 'Nombre de concurrents, croissance du secteur, différenciation', placeholder: 'Un concurrent, une pression prix…' },
};

const COULEURS_MENACE: Record<string, string> = {
  'Aucune évaluation': '#94a3b8', 'Menace faible': '#10b981', 'Menace modérée': '#f59e0b', 'Menace forte': '#ef4444',
};

/** 5 Forces de Porter — schéma radial autour de l'entreprise, puis synthèse, comme StratPilote. */
@Component({
  selector: 'app-bp-porter',
  standalone: true,
  imports: [MatIconModule, BpListeComponent],
  template: `
<div class="porter">
  <div class="porter__centre" [style.--m]="couleurMenace">
    <mat-icon class="porter__centre-icone">business</mat-icon>
    <div class="porter__entreprise">L'ENTREPRISE</div>
    <div class="porter__menace-titre">Menace globale</div>
    <div class="porter__score">{{ menace.score }}<span> / {{ menace.max }}</span></div>
    <div class="porter__menace-label">{{ menace.label }}</div>
    <div class="porter__evaluees">{{ menace.evaluees }} force{{ menace.evaluees > 1 ? 's' : '' }} évaluée{{ menace.evaluees > 1 ? 's' : '' }} sur 5</div>
  </div>

  @for (f of forces; track f.code) {
    @let force = contenu.forces[f.code];
    @let n = niveau(f.code);
    <section [class]="'porter__force porter__force--' + f.code" [style.--n]="n.couleur" [attr.data-force]="f.code">
      <mat-icon class="porter__fleche" aria-hidden="true">{{ f.fleche }}</mat-icon>
      <header class="porter__entete">
        <span class="porter__icone"><mat-icon>{{ f.icon }}</mat-icon></span>
        <h3 class="porter__titre">{{ f.label }}</h3>
        <span class="porter__note" [attr.title]="'Score ' + force.niveau + ' sur 3'">{{ force.niveau }}</span>
      </header>
      <span class="porter__statut">{{ n.label }}</span>
      <p class="porter__aide">{{ f.aide }}</p>
      @if (editable) {
        <div class="porter__niveaux" role="group" [attr.aria-label]="'Niveau de menace — ' + f.label">
          @for (v of niveauxChoix; track v.valeur) {
            <button type="button" class="porter__niveau" [class.porter__niveau--actif]="force.niveau === v.valeur"
                    [style.--c]="v.couleur" [attr.aria-pressed]="force.niveau === v.valeur" (click)="choisirNiveau(f.code, v.valeur)">
              {{ v.label }}
            </button>
          }
        </div>
      }
      <h4 class="porter__sous-titre">Éléments identifiés</h4>
      <app-bp-liste [items]="force.elements" [editable]="editable" [placeholder]="f.placeholder"
                    vide="Aucun élément identifié" (changement)="contenuChange.emit(contenu)" />
    </section>
  }
</div>

<section class="synthese">
  <h3 class="synthese__titre"><mat-icon>summarize</mat-icon>Synthèse de l'analyse</h3>
  <div class="synthese__defil">
    <table class="synthese__table">
      <thead>
        <tr><th>Force</th><th>Niveau</th><th class="num">Éléments identifiés</th><th class="num">Score</th></tr>
      </thead>
      <tbody>
        @for (f of forces; track f.code) {
          @let n = niveau(f.code);
          <tr>
            <td><mat-icon class="synthese__icone">{{ f.icon }}</mat-icon>{{ f.label }}</td>
            <td><span class="synthese__pastille" [style.--n]="n.couleur">{{ n.label }}</span></td>
            <td class="num">{{ contenu.forces[f.code].elements.length }}</td>
            <td class="num">{{ contenu.forces[f.code].niveau }}</td>
          </tr>
        }
      </tbody>
      <tfoot>
        <tr>
          <td>Menace globale</td>
          <td><span class="synthese__pastille" [style.--n]="couleurMenace">{{ menace.label }}</span></td>
          <td class="num">{{ totalElements }}</td>
          <td class="num synthese__total">{{ menace.score }} / {{ menace.max }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</section>
  `,
  styles: [`
    :host { display: block; }
    .porter { display: grid; gap: 14px; align-items: stretch;
      grid-template-columns: minmax(0, 1fr) minmax(170px, 210px) minmax(0, 1fr);
      grid-template-areas:
        "ne   centre pc"
        "ne   centre pc"
        "ne   centre sub"
        "pf   centre sub"
        "pf   centre conc"
        "pf   centre conc"; }
    .porter__force--nouveauxEntrants { grid-area: ne; }
    .porter__force--pouvoirClients { grid-area: pc; }
    .porter__force--substituts { grid-area: sub; }
    .porter__force--pouvoirFournisseurs { grid-area: pf; }
    .porter__force--concurrence { grid-area: conc; }

    .porter__centre { grid-area: centre; align-self: center; justify-self: center; width: 100%; max-width: 210px; aspect-ratio: 1;
      box-sizing: border-box; border-radius: 50%; border: 3px solid var(--m); background: #fff; padding: 14px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 2px;
      box-shadow: 0 0 0 10px #fff7ed, 0 6px 18px rgba(15, 23, 42, .08); }
    .porter__centre-icone { color: #f97316; }
    .porter__entreprise { font-size: 13px; font-weight: 800; letter-spacing: .08em; color: #1e293b; }
    .porter__menace-titre { margin-top: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
    .porter__score { font-size: 30px; font-weight: 800; line-height: 1.1; color: var(--m); }
    .porter__score span { font-size: 15px; font-weight: 600; color: #64748b; }
    .porter__menace-label { font-size: 12.5px; font-weight: 700; color: var(--m); }
    .porter__evaluees { font-size: 10.5px; color: #94a3b8; }

    .porter__force { position: relative; background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid var(--n);
      border-radius: 12px; padding: 14px 16px 16px; box-shadow: 0 1px 3px rgba(15, 23, 42, .05); --bl-accent: #f97316; min-width: 0; }
    .porter__fleche { position: absolute; right: 10px; bottom: 8px; color: #e2e8f0; font-size: 22px; width: 22px; height: 22px; }
    .porter__force--pouvoirClients .porter__fleche, .porter__force--substituts .porter__fleche,
    .porter__force--concurrence .porter__fleche { right: auto; left: 10px; }
    .porter__entete { display: flex; align-items: center; gap: 8px; }
    .porter__icone { display: inline-flex; padding: 6px; border-radius: 8px; background: #fff7ed; color: #f97316; }
    .porter__icone mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .porter__titre { flex: 1; margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; }
    .porter__note { min-width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 800; color: #fff; background: var(--n); }
    .porter__statut { display: inline-block; margin-top: 8px; padding: 2px 10px; border-radius: 10px; font-size: 11.5px; font-weight: 700;
      color: var(--n); background: color-mix(in srgb, var(--n) 14%, #fff); }
    .porter__aide { margin: 8px 0 10px; font-size: 12px; color: #64748b; }
    .porter__niveaux { display: flex; gap: 6px; margin-bottom: 10px; }
    .porter__niveau { flex: 1; padding: 6px 4px; border: 1.5px solid var(--c); border-radius: 8px; background: #fff; color: var(--c);
      font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
    .porter__niveau:hover { background: color-mix(in srgb, var(--c) 10%, #fff); }
    .porter__niveau--actif, .porter__niveau--actif:hover { background: var(--c); color: #fff; }
    .porter__sous-titre { margin: 4px 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; }

    .synthese { margin-top: 22px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; }
    .synthese__titre { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #1e293b; }
    .synthese__titre mat-icon { color: #f97316; }
    .synthese__defil { overflow-x: auto; }
    .synthese__table { width: 100%; border-collapse: collapse; font-size: 13px; color: #334155; }
    .synthese__table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    .synthese__table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .synthese__table td:first-child { white-space: nowrap; }
    .synthese__table .num { text-align: right; }
    .synthese__table tfoot td { font-weight: 800; color: #1e293b; border-bottom: none; border-top: 2px solid #e2e8f0; }
    .synthese__icone { font-size: 16px; width: 16px; height: 16px; vertical-align: -3px; margin-right: 6px; color: #f97316; }
    .synthese__pastille { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap;
      color: var(--n); background: color-mix(in srgb, var(--n) 14%, #fff); }
    .synthese__total { font-size: 15px; }

    @media (max-width: 760px) {
      .porter { grid-template-columns: 1fr; grid-template-areas: "centre" "ne" "pc" "sub" "pf" "conc"; }
      .porter__centre { max-width: 190px; }
      .porter__fleche { display: none; }
    }
  `],
})
export class BpPorterComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();

  readonly forces = FORCES_PORTER.map(code => ({ code, label: LIBELLES_ZONES[code], ...FORCES[code] }));
  /** Sélecteur : Faible / Moyen / Élevé (le « Non évalué » revient en recliquant le niveau actif). */
  readonly niveauxChoix = NIVEAUX_PORTER.filter(n => n.valeur > 0);

  get menace() { return menaceGlobalePorter(this.contenu); }
  get couleurMenace() { return COULEURS_MENACE[this.menace.label] ?? NIVEAUX_PORTER[0].couleur; }
  get totalElements() { return FORCES_PORTER.reduce((t, f) => t + (this.contenu.forces[f].elements?.length ?? 0), 0); }

  niveau(f: CodeForce) { return NIVEAUX_PORTER[Number(this.contenu.forces[f].niveau) || 0] ?? NIVEAUX_PORTER[0]; }

  choisirNiveau(f: CodeForce, valeur: number) {
    const force = this.contenu.forces[f];
    force.niveau = force.niveau === valeur ? 0 : valeur;
    this.contenuChange.emit(this.contenu);
  }
}
