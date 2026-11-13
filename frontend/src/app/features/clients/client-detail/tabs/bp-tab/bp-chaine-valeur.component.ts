import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ACTIVITES_PRIMAIRES, ACTIVITES_SOUTIEN, LIBELLES_ZONES } from '../../../../../core/models/outils-bp.model';
import { BpListeComponent } from './bp-liste.component';

type Ton = 'gris' | 'rouge' | 'orange' | 'vert';
type Score = 'importance' | 'performance';

const NOTES = [1, 2, 3, 4, 5];
const TONS: { cle: Ton; label: string }[] = [
  { cle: 'rouge', label: 'Faible (1-2)' },
  { cle: 'orange', label: 'Moyenne (3)' },
  { cle: 'vert', label: 'Bonne (4-5)' },
  { cle: 'gris', label: 'Non évaluée' },
];

/**
 * Chaîne de valeur de Porter (« Porter classique » de StratPilote) : activités de soutien en
 * bandes, activités principales en colonnes, flèche « MARGE » à droite. Chaque carte porte ses
 * scores d'importance et de performance (couleur = performance). En édition, un clic sur une
 * carte ouvre le panneau « Éditer activité » sous le schéma. Les goulots d'étranglement
 * (activités critiques mais peu performantes) sont calculés.
 */
@Component({
  selector: 'app-bp-chaine-valeur',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, MatButtonModule, MatIconModule, BpListeComponent],
  template: `
<ng-template #carte let-code let-bande="bande">
  @let a = contenu.activites[code];
  <article class="cv__act cv__act--{{ ton(a.performance) }}" [class.cv__act--bande]="bande"
           [class.cv__act--sel]="editable && selection === code" [attr.data-code]="code"
           [attr.role]="editable ? 'button' : null" [attr.tabindex]="editable ? 0 : null"
           [attr.aria-expanded]="editable ? selection === code : null"
           (click)="ouvrir(code)" (keydown.enter)="ouvrir(code)" (keydown.space)="$event.preventDefault(); ouvrir(code)">
    <h4 class="cv__act-titre">{{ libelle(code) }}</h4>
    <p class="cv__act-desc" [class.cv__act-desc--vide]="!a.description" [attr.title]="a.description || null">{{
      a.description || (editable ? 'Cliquer pour décrire…' : 'Non décrite') }}</p>
    <div class="cv__scores">
      <span class="cv__score" role="img" [attr.aria-label]="'Importance : ' + (a.importance ? a.importance + ' sur 5' : 'non évaluée')">
        <span class="cv__score-lib">Importance</span>
        <span class="cv__pts cv__pts--imp">@for (n of notes; track n) { <i [class.on]="n <= a.importance"></i> }</span>
        <b class="cv__score-val">{{ a.importance || '–' }}</b>
      </span>
      <span class="cv__score" role="img" [attr.aria-label]="'Performance : ' + (a.performance ? a.performance + ' sur 5' : 'non évaluée')">
        <span class="cv__score-lib">Performance</span>
        <span class="cv__pts cv__pts--perf">@for (n of notes; track n) { <i [class.on]="n <= a.performance"></i> }</span>
        <b class="cv__score-val">{{ a.performance || '–' }}</b>
      </span>
    </div>
  </article>
</ng-template>

<div class="cv">
  <div class="cv__schema">
    <div class="cv__corps">
      <p class="cv__groupe">Activités de soutien</p>
      <div class="cv__soutien">
        @for (code of soutien; track code) {
          <ng-container *ngTemplateOutlet="carte; context: { $implicit: code, bande: true }" />
        }
      </div>
      <p class="cv__groupe">Activités principales</p>
      <div class="cv__primaires">
        @for (code of primaires; track code) {
          <ng-container *ngTemplateOutlet="carte; context: { $implicit: code, bande: false }" />
        }
      </div>
    </div>
    <div class="cv__marge">
      <span class="cv__marge-titre">Marge</span>
      @if (editable) {
        <textarea class="cv__marge-champ" rows="5" maxlength="500" [(ngModel)]="contenu.marge" (ngModelChange)="emettre()"
                  placeholder="Ex. : marge brute 32 %" aria-label="Marge"></textarea>
      } @else {
        <p class="cv__marge-texte">{{ contenu.marge || '—' }}</p>
      }
    </div>
  </div>

  <div class="cv__legende">
    <span class="cv__legende-titre">Couleur = performance :</span>
    @for (t of tons; track t.cle) { <span class="cv__leg cv__leg--{{ t.cle }}"><i></i>{{ t.label }}</span> }
    @if (editable) { <span class="cv__astuce"><mat-icon>touch_app</mat-icon>Cliquez sur une activité pour la renseigner</span> }
  </div>

  @if (editable && selection) {
    @let a = contenu.activites[selection];
    <section class="cv__panneau" #panneau aria-label="Éditer activité">
      <header class="cv__panneau-tete">
        <div>
          <span class="cv__panneau-sur">Éditer activité · {{ estSoutien(selection) ? 'activité de soutien' : 'activité principale' }}</span>
          <h4 class="cv__panneau-titre">{{ libelle(selection) }}</h4>
        </div>
        <button mat-stroked-button type="button" class="cv__fermer" (click)="fermer()">Fermer</button>
      </header>
      <label class="cv__champ">Description
        <textarea rows="4" maxlength="3000" [(ngModel)]="a.description" (ngModelChange)="emettre()"
                  placeholder="Comment l'entreprise réalise cette activité : moyens, atouts, difficultés…"></textarea>
      </label>
      <div class="cv__notes">
        @for (s of scores; track s.champ) {
          <div class="cv__note">
            <span class="cv__note-titre">{{ s.titre }}</span>
            <div class="cv__echelle" role="group" [attr.aria-label]="s.titre" [attr.data-score]="s.champ">
              @for (n of notes; track n) {
                <button type="button" [class.on]="a[s.champ] === n" [attr.aria-pressed]="a[s.champ] === n"
                        (click)="noter(s.champ, n)">{{ n }}</button>
              }
            </div>
            <span class="cv__aide">{{ s.aide }}</span>
          </div>
        }
      </div>
    </section>
  }

  <section class="cv__bloc">
    <h3 class="cv__titre"><mat-icon>balance</mat-icon>Forces et faiblesses</h3>
    <div class="cv__ff">
      <div class="cv__ff-col cv__ff-col--forces">
        <h4>Forces</h4>
        <app-bp-liste [items]="contenu.forces" [editable]="editable" placeholder="Une activité source d'avantage…"
                      vide="Aucune force notée" (changement)="emettre()" />
      </div>
      <div class="cv__ff-col cv__ff-col--faiblesses">
        <h4>Faiblesses</h4>
        <app-bp-liste [items]="contenu.faiblesses" [editable]="editable" placeholder="Une activité à améliorer…"
                      vide="Aucune faiblesse notée" (changement)="emettre()" />
      </div>
    </div>
  </section>

  <section class="cv__bloc cv__goulots">
    @let gs = goulots;
    <h3 class="cv__titre"><mat-icon>report_problem</mat-icon>Goulots d'étranglement</h3>
    <p class="cv__intro">Activités critiques (importance 4 ou 5) mais peu performantes (performance 1 ou 2).</p>
    @if (gs.length) {
      <div class="cv__table-wrap">
        <table class="cv__table">
          <thead><tr><th>Activité</th><th>Type</th><th class="cv__c">Importance</th><th class="cv__c">Performance</th><th>Description</th></tr></thead>
          <tbody>
            @for (g of gs; track g.code) {
              <tr [attr.data-code]="g.code">
                <td class="cv__table-nom">{{ libelle(g.code) }}</td>
                <td>{{ estSoutien(g.code) ? 'Soutien' : 'Principale' }}</td>
                <td class="cv__c">{{ g.importance }}/5</td>
                <td class="cv__c"><span class="cv__perf-faible">{{ g.performance }}/5</span></td>
                <td class="cv__table-desc">{{ g.description || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="cv__vide">Aucun goulot d'étranglement identifié.</p>
    }
  </section>
</div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .cv { display: flex; flex-direction: column; gap: 20px; }

    /* Schéma */
    .cv__schema { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 10px; }
    .cv__corps { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .cv__groupe { margin: 4px 0 0; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
    .cv__soutien { display: flex; flex-direction: column; gap: 6px; }
    .cv__primaires { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }

    .cv__act { --fond: #f8fafc; --bord: #e2e8f0; --accent: #94a3b8; box-sizing: border-box; min-width: 0;
      display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 10px;
      background: var(--fond); border: 1px solid var(--bord); border-left: 4px solid var(--accent); transition: box-shadow .15s; }
    .cv__act--gris, .cv__leg--gris { --fond: #f8fafc; --bord: #e2e8f0; --accent: #94a3b8; }
    .cv__act--rouge, .cv__leg--rouge { --fond: #fef2f2; --bord: #fecaca; --accent: #dc2626; }
    .cv__act--orange, .cv__leg--orange { --fond: #fff7ed; --bord: #fed7aa; --accent: #ea580c; }
    .cv__act--vert, .cv__leg--vert { --fond: #f0fdf4; --bord: #bbf7d0; --accent: #16a34a; }
    .cv__act[role=button] { cursor: pointer; }
    .cv__act[role=button]:hover { box-shadow: 0 2px 10px rgba(15, 23, 42, .1); }
    .cv__act[role=button]:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 2px; }
    .cv__act--sel { box-shadow: 0 0 0 2px #0ea5e9 !important; }
    .cv__act--bande { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto; align-items: center; column-gap: 14px; }
    .cv__primaires .cv__act { min-height: 150px; }
    .cv__act-titre { margin: 0; font-size: 13px; font-weight: 700; line-height: 1.3; color: #1e293b; }
    .cv__act-desc { margin: 0; font-size: 12.5px; line-height: 1.4; color: #475569; white-space: pre-line; word-break: break-word;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .cv__act--bande .cv__act-desc { -webkit-line-clamp: 2; }
    .cv__primaires .cv__act-desc { flex: 1; }
    .cv__act-desc--vide { font-style: italic; color: #94a3b8; }
    .cv__scores { display: flex; flex-direction: column; gap: 3px; }
    .cv__score { display: flex; flex-wrap: wrap; align-items: center; column-gap: 6px; row-gap: 2px; font-size: 11px; color: #64748b; }
    .cv__score-lib { min-width: 70px; }
    .cv__pts { display: inline-flex; gap: 3px; }
    .cv__pts i { width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0; }
    .cv__pts--imp i.on { background: #334155; }
    .cv__pts--perf i.on { background: var(--accent); }
    .cv__score-val { min-width: 8px; color: #1e293b; }

    .cv__marge { box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 10px; min-height: 120px;
      padding: 16px 38px 16px 14px; color: #fff; background: linear-gradient(160deg, #0ea5e9 0%, #0369a1 100%);
      clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 50%, calc(100% - 28px) 100%, 0 100%); }
    .cv__marge-titre { font-size: 15px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .cv__marge-texte { margin: 0; font-size: 12.5px; line-height: 1.4; white-space: pre-line; word-break: break-word; }
    .cv__marge-champ { width: 100%; box-sizing: border-box; resize: vertical; padding: 6px; border-radius: 6px; font: inherit; font-size: 12.5px;
      border: 1px solid rgba(255, 255, 255, .55); background: rgba(255, 255, 255, .15); color: #fff; }
    .cv__marge-champ::placeholder { color: rgba(255, 255, 255, .8); }
    .cv__marge-champ:focus { outline: none; background: #fff; color: #1e293b; }

    .cv__legende { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: -8px; font-size: 12px; color: #64748b; }
    .cv__legende-titre { font-weight: 600; }
    .cv__leg { display: inline-flex; align-items: center; gap: 5px; }
    .cv__leg i { width: 12px; height: 12px; border-radius: 3px; background: var(--fond); border: 1px solid var(--bord); border-left: 3px solid var(--accent); }
    .cv__astuce { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: #0369a1; }
    .cv__astuce mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Panneau d'édition */
    .cv__panneau { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; border-radius: 12px;
      background: #f0f9ff; border: 1px solid #bae6fd; scroll-margin: 16px; }
    .cv__panneau-tete { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .cv__panneau-sur { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #0369a1; }
    .cv__panneau-titre { margin: 2px 0 0; font-size: 16px; font-weight: 700; color: #0f172a; }
    .cv__champ { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: #334155; }
    .cv__champ textarea { resize: vertical; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff;
      font: inherit; font-size: 13.5px; font-weight: 400; color: #1e293b; }
    .cv__champ textarea:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 2px rgba(14, 165, 233, .2); }
    .cv__notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .cv__note { display: flex; flex-direction: column; gap: 6px; }
    .cv__note-titre { font-size: 12.5px; font-weight: 600; color: #334155; }
    .cv__echelle { display: flex; gap: 6px; }
    .cv__echelle button { width: 40px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer;
      font: inherit; font-weight: 700; color: #334155; }
    .cv__echelle button:hover { border-color: #0ea5e9; }
    .cv__echelle button.on { background: #0ea5e9; border-color: #0ea5e9; color: #fff; }
    .cv__aide { font-size: 11.5px; color: #64748b; }

    /* Sections du bas */
    .cv__titre { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #1e293b; }
    .cv__titre mat-icon { font-size: 20px; width: 20px; height: 20px; color: #0ea5e9; }
    .cv__ff { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .cv__ff-col { border-radius: 12px; padding: 14px 16px 16px; }
    .cv__ff-col h4 { margin: 0 0 8px; padding-bottom: 8px; font-size: 14px; font-weight: 700; border-bottom: 2px solid currentColor; }
    .cv__ff-col--forces { background: #ecfdf5; --bl-accent: #10b981; }
    .cv__ff-col--forces h4 { color: #059669; }
    .cv__ff-col--faiblesses { background: #fef2f2; --bl-accent: #ef4444; }
    .cv__ff-col--faiblesses h4 { color: #dc2626; }
    .cv__goulots .cv__titre mat-icon { color: #dc2626; }
    .cv__intro { margin: -4px 0 10px; font-size: 12.5px; color: #64748b; }
    .cv__vide { margin: 0; font-size: 13px; font-style: italic; color: #94a3b8; }
    .cv__table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .cv__table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cv__table th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
      color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .cv__table td { padding: 9px 12px; vertical-align: top; color: #334155; border-bottom: 1px solid #f1f5f9; }
    .cv__table tr:last-child td { border-bottom: none; }
    .cv__table .cv__c { text-align: center; white-space: nowrap; }
    .cv__table-nom { font-weight: 600; color: #1e293b; white-space: nowrap; }
    .cv__table-desc { white-space: pre-line; min-width: 200px; }
    .cv__perf-faible { padding: 1px 8px; border-radius: 10px; background: #fee2e2; color: #b91c1c; font-weight: 700; }

    @container (max-width: 760px) {
      .cv__schema { grid-template-columns: 1fr; }
      .cv__marge { min-height: 0; padding-right: 44px; }
      .cv__act--bande { grid-template-columns: 1fr; row-gap: 6px; }
      .cv__primaires { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cv__primaires .cv__act { min-height: 0; }
      .cv__ff, .cv__notes { grid-template-columns: 1fr; }
      .cv__astuce { margin-left: 0; }
    }
    @container (max-width: 460px) {
      .cv__primaires { grid-template-columns: 1fr; }
    }
  `],
})
export class BpChaineValeurComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();
  @ViewChild('panneau') panneau?: ElementRef<HTMLElement>;

  /** Activité ouverte dans le panneau « Éditer activité ». */
  selection: string | null = null;

  readonly notes = NOTES;
  readonly tons = TONS;
  readonly scores: { champ: Score; titre: string; aide: string }[] = [
    { champ: 'importance', titre: "Score d'Importance (1-5)", aide: '1 = Faible importance, 5 = Critique' },
    { champ: 'performance', titre: 'Score de Performance (1-5)', aide: '1 = Performance faible, 5 = Excellence' },
  ];

  // Constantes importées lues via des getters (ordre d'initialisation du bundle de test).
  get soutien(): readonly string[] { return ACTIVITES_SOUTIEN; }
  get primaires(): readonly string[] { return ACTIVITES_PRIMAIRES; }

  libelle(code: string): string { return LIBELLES_ZONES[code] ?? code; }
  estSoutien(code: string): boolean { return (ACTIVITES_SOUTIEN as readonly string[]).includes(code); }

  /** Couleur d'une carte selon la performance : rouge ≤ 2, orange 3, vert ≥ 4, gris si non évaluée. */
  ton(performance: number): Ton {
    const p = Number(performance) || 0;
    return !p ? 'gris' : p <= 2 ? 'rouge' : p === 3 ? 'orange' : 'vert';
  }

  /** Activités d'importance ≥ 4 et de performance ≤ 2 (non évaluée exclue), les plus criantes d'abord. */
  get goulots(): { code: string; importance: number; performance: number; description: string }[] {
    return [...this.soutien, ...this.primaires]
      .map(code => ({ code, ...this.contenu.activites[code] }))
      .filter(a => a.importance >= 4 && a.performance >= 1 && a.performance <= 2)
      .sort((x, y) => (y.importance - y.performance) - (x.importance - x.performance));
  }

  ouvrir(code: string) {
    if (!this.editable) return;
    this.selection = code;
    setTimeout(() => this.panneau?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  }

  fermer() { this.selection = null; }

  /** Un clic sur la note déjà choisie la remet à « non évaluée ». */
  noter(champ: Score, n: number) {
    if (!this.editable || !this.selection) return;
    const a = this.contenu.activites[this.selection];
    a[champ] = a[champ] === n ? 0 : n;
    this.emettre();
  }

  emettre() { this.contenuChange.emit(this.contenu); }
}
