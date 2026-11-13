import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BpListeComponent } from './bp-liste.component';
import { LIBELLES_ZONES, LISTES_ICP, LISTES_PERSONA, ProfilAutoBp } from '../../../../../core/models/outils-bp.model';
import { nomCycle } from '../../../../../core/models/mission.model';

interface CaseProfil { label: string; icon: string; valeur: string; detail?: string; ton?: 'positif' | 'negatif' }

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
const pluriel = (n: number, mot: string) => `${fmt(n)} ${mot}${Math.abs(n) >= 2 ? 's' : ''}`;
/** « 2015-03-01 » → « 01/03/2015 » ; une saisie libre (« 2015 ») est affichée telle quelle. */
const dateFr = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

/**
 * Fiche Persona / ICP — persona du dirigeant et profil client idéal côte à côte (StratPilote),
 * précédés du « profil client auto-généré depuis les données existantes » (document client).
 */
@Component({
  selector: 'app-bp-persona',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, BpListeComponent],
  template: `
@if (profil) {
  <section class="auto" aria-label="Profil PASSIDOC (automatique)">
    <header class="auto__entete">
      <span class="auto__logo"><mat-icon>auto_awesome</mat-icon></span>
      <div>
        <h3 class="auto__titre">Profil PASSIDOC (automatique)</h3>
        <p class="auto__aide">Calculé à partir des données du dossier — lecture seule</p>
      </div>
    </header>
    <dl class="auto__grille">
      @for (c of casesProfil; track c.label) {
        <div class="auto__case">
          <dt><mat-icon>{{ c.icon }}</mat-icon>{{ c.label }}</dt>
          <dd [class.auto__valeur--positif]="c.ton === 'positif'" [class.auto__valeur--negatif]="c.ton === 'negatif'">{{ c.valeur }}</dd>
          @if (c.detail) { <dd class="auto__detail">{{ c.detail }}</dd> }
        </div>
      }
    </dl>
  </section>
}

<div class="cartes">
  <section class="carte carte--persona">
    <header class="carte__entete">
      <span class="carte__avatar"><mat-icon>person</mat-icon></span>
      <div class="carte__noms">
        <h3 class="carte__titre">Persona — le dirigeant</h3>
        <p class="carte__sous-titre">{{ contenu.persona.poste || 'Profil, attentes et façon de décider du dirigeant' }}</p>
      </div>
    </header>

    <div class="champs">
      @for (c of champsPersona; track c.cle) {
        <div class="champ">
          <span class="champ__label">{{ c.label }}</span>
          @if (editable) {
            <input class="champ__input" [(ngModel)]="contenu.persona[c.cle]" (ngModelChange)="contenuChange.emit(contenu)"
                   [placeholder]="c.placeholder" maxlength="200" [attr.aria-label]="c.label" [attr.data-champ]="'persona.' + c.cle" />
          } @else {
            <span class="champ__valeur">{{ contenu.persona[c.cle] || '—' }}</span>
          }
        </div>
      }
    </div>
    <div class="champ champ--bio">
      <span class="champ__label">{{ libelleBio }}</span>
      @if (editable) {
        <textarea class="champ__input" rows="3" [(ngModel)]="contenu.persona.bio" (ngModelChange)="contenuChange.emit(contenu)"
                  placeholder="Parcours, situation familiale et patrimoniale, rapport aux chiffres…" maxlength="3000"
                  aria-label="Bio / Contexte" data-champ="persona.bio"></textarea>
      } @else {
        <p class="champ__valeur champ__valeur--bio">{{ contenu.persona.bio || '—' }}</p>
      }
    </div>

    @for (l of listesPersona; track l.cle) {
      <section class="liste" [style.--l]="l.couleur" [attr.data-liste]="'persona.' + l.cle">
        <h4 class="liste__titre"><span class="liste__icone"><mat-icon>{{ l.icon }}</mat-icon></span>{{ l.label }}</h4>
        <app-bp-liste [items]="contenu.persona[l.cle]" [editable]="editable" [placeholder]="l.placeholder"
                      vide="Non renseigné" (changement)="contenuChange.emit(contenu)" />
      </section>
    }
  </section>

  <section class="carte carte--icp">
    <header class="carte__entete">
      <span class="carte__avatar carte__avatar--icp"><mat-icon>apartment</mat-icon></span>
      <div class="carte__noms">
        <h3 class="carte__titre">Profil Client Idéal (ICP)</h3>
        <p class="carte__sous-titre">Le client type que l'entreprise cherche à servir</p>
      </div>
    </header>

    <div class="champs">
      @for (c of champsIcp; track c.cle) {
        <div class="champ">
          <span class="champ__label">{{ c.label }}</span>
          @if (editable) {
            <input class="champ__input" [(ngModel)]="contenu.icp[c.cle]" (ngModelChange)="contenuChange.emit(contenu)"
                   [placeholder]="c.placeholder" maxlength="200" [attr.aria-label]="c.label" [attr.data-champ]="'icp.' + c.cle" />
          } @else {
            <span class="champ__valeur">{{ contenu.icp[c.cle] || '—' }}</span>
          }
        </div>
      }
    </div>

    @for (l of listesIcp; track l.cle) {
      <section class="liste" [style.--l]="l.couleur" [attr.data-liste]="'icp.' + l.cle">
        <h4 class="liste__titre"><span class="liste__icone"><mat-icon>{{ l.icon }}</mat-icon></span>{{ l.label }}</h4>
        @if (editable) {
          <app-bp-liste [items]="contenu.icp[l.cle]" [editable]="true" [placeholder]="l.placeholder"
                        (changement)="contenuChange.emit(contenu)" />
        } @else {
          <ul class="tags">
            @for (item of contenu.icp[l.cle]; track item.id) {
              <li class="tag">{{ item.texte }}
                @if (item.cle) { <span class="tag__badge" matTooltip="Suggestion tirée des données du dossier">PASSIDOC</span> }
              </li>
            } @empty {
              <li class="tags__vide">Non renseigné</li>
            }
          </ul>
        }
      </section>
    }
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }

    .auto { margin-bottom: 16px; padding: 14px 16px; border-radius: 14px; border: 1px solid #c7d2fe;
      background: linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%); }
    .auto__entete { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .auto__logo { display: inline-flex; padding: 7px; border-radius: 10px; background: #fff; color: #6366f1; }
    .auto__titre { margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; }
    .auto__aide { margin: 2px 0 0; font-size: 11.5px; color: #64748b; }
    .auto__grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin: 0; }
    .auto__case { background: rgba(255, 255, 255, .85); border-radius: 10px; padding: 8px 10px; min-width: 0; }
    .auto__case dt { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .04em; color: #64748b; }
    .auto__case dt mat-icon { font-size: 14px; width: 14px; height: 14px; color: #6366f1; }
    .auto__case dd { margin: 4px 0 0; font-size: 14px; font-weight: 700; color: #1e293b; overflow-wrap: anywhere; }
    .auto__case dd.auto__detail { margin-top: 1px; font-size: 11.5px; font-weight: 500; color: #64748b; }
    .auto__case dd.auto__valeur--positif { color: #059669; }
    .auto__case dd.auto__valeur--negatif { color: #dc2626; }

    .cartes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .carte { background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid var(--a); border-radius: 14px; padding: 16px 18px 18px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .05); min-width: 0; --bl-accent: var(--a); }
    .carte--persona { --a: #ec4899; }
    .carte--icp { --a: #6366f1; }
    .carte__entete { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .carte__avatar { flex: none; width: 52px; height: 52px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      color: #fff; background: linear-gradient(135deg, #f472b6, #db2777); box-shadow: 0 0 0 4px #fce7f3; }
    .carte__avatar--icp { border-radius: 14px; background: linear-gradient(135deg, #818cf8, #4f46e5); box-shadow: 0 0 0 4px #e0e7ff; }
    .carte__avatar mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .carte__noms { min-width: 0; }
    .carte__titre { margin: 0; font-size: 15.5px; font-weight: 700; color: #1e293b; }
    .carte__sous-titre { margin: 2px 0 0; font-size: 12px; color: #64748b; overflow-wrap: anywhere; }

    .champs { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-bottom: 10px; }
    .champ { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 8px 10px; border-radius: 10px; background: #f8fafc; }
    .champ--bio { margin-bottom: 4px; }
    .champ__label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
    .champ__valeur { font-size: 13.5px; font-weight: 600; color: #1e293b; overflow-wrap: anywhere; }
    .champ__valeur--bio { margin: 0; font-weight: 400; line-height: 1.5; color: #475569; white-space: pre-wrap; }
    .champ__input { width: 100%; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 5px 7px;
      font: inherit; font-size: 13.5px; color: #1e293b; }
    textarea.champ__input { resize: vertical; line-height: 1.45; }
    .champ__input:focus { outline: none; border-color: var(--a); box-shadow: 0 0 0 2px color-mix(in srgb, var(--a) 20%, transparent); }

    .liste { margin-top: 14px; --bl-accent: var(--l); }
    .liste__titre { display: flex; align-items: center; gap: 7px; margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #334155; }
    .liste__icone { display: inline-flex; padding: 4px; border-radius: 7px; color: var(--l); background: color-mix(in srgb, var(--l) 12%, #fff); }
    .liste__icone mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px 11px; border-radius: 14px; font-size: 12.5px;
      line-height: 1.35; color: color-mix(in srgb, var(--l) 70%, #0f172a); background: color-mix(in srgb, var(--l) 11%, #fff);
      border: 1px solid color-mix(in srgb, var(--l) 30%, #fff); overflow-wrap: anywhere; }
    .tag__badge { font-size: 9px; font-weight: 700; letter-spacing: .04em; padding: 1px 5px; border-radius: 8px;
      background: rgba(37, 99, 235, .12); color: #1d4ed8; }
    .tags__vide { font-size: 12.5px; font-style: italic; color: #94a3b8; }

    @media (max-width: 760px) {
      .cartes { grid-template-columns: 1fr; }
      .carte { padding: 14px; }
    }
  `],
})
export class BpPersonaComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  /** Profil client auto-généré depuis les données existantes (null : bande masquée). */
  @Input() set profil(p: ProfilAutoBp | null) {
    this._profil = p;
    this.casesProfil = p ? construireCasesProfil(p) : [];
  }
  get profil(): ProfilAutoBp | null { return this._profil; }
  private _profil: ProfilAutoBp | null = null;
  /** Cases de la bande « Profil PASSIDOC ». */
  casesProfil: CaseProfil[] = [];
  @Output() contenuChange = new EventEmitter<any>();

  readonly libelleBio = LIBELLES_ZONES['bio'];

  readonly champsPersona = [
    { cle: 'age', label: LIBELLES_ZONES['age'], placeholder: 'ex. 45 ans' },
    { cle: 'poste', label: LIBELLES_ZONES['poste'], placeholder: 'ex. Gérant fondateur' },
    { cle: 'lieu', label: LIBELLES_ZONES['lieu'], placeholder: 'ex. Saint-Denis' },
  ];
  readonly champsIcp = [
    { cle: 'employes', label: LIBELLES_ZONES['employes'], placeholder: 'ex. 10 à 50' },
    { cle: 'caAnnuel', label: LIBELLES_ZONES['caAnnuel'], placeholder: 'ex. 500 k à 2 M' },
    { cle: 'croissance', label: LIBELLES_ZONES['croissance'], placeholder: 'ex. +10 % par an' },
  ];

  private readonly reperesPersona: Record<typeof LISTES_PERSONA[number], { icon: string; couleur: string; placeholder: string }> = {
    objectifs: { icon: 'flag', couleur: '#10b981', placeholder: 'Un objectif du dirigeant…' },
    frustrations: { icon: 'sentiment_dissatisfied', couleur: '#ef4444', placeholder: 'Un irritant, un point de douleur…' },
    motivations: { icon: 'emoji_objects', couleur: '#f59e0b', placeholder: 'Ce qui le pousse à agir…' },
    comportements: { icon: 'psychology', couleur: '#3b82f6', placeholder: 'Une habitude, une façon de décider…' },
  };
  private readonly reperesIcp: Record<typeof LISTES_ICP[number], { icon: string; couleur: string; placeholder: string }> = {
    secteurs: { icon: 'category', couleur: '#8b5cf6', placeholder: "Un secteur d'activité…" },
    technologies: { icon: 'devices', couleur: '#0ea5e9', placeholder: 'Un outil, un logiciel…' },
    localisations: { icon: 'place', couleur: '#14b8a6', placeholder: 'Une zone géographique…' },
    problemes: { icon: 'report_problem', couleur: '#ef4444', placeholder: 'Un problème du client cible…' },
    budget: { icon: 'account_balance_wallet', couleur: '#f59e0b', placeholder: 'Une fourchette de budget…' },
    criteres: { icon: 'fact_check', couleur: '#10b981', placeholder: 'Un critère de choix…' },
  };
  readonly listesPersona = LISTES_PERSONA.map(cle => ({ cle, label: LIBELLES_ZONES[cle], ...this.reperesPersona[cle] }));
  readonly listesIcp = LISTES_ICP.map(cle => ({ cle, label: LIBELLES_ZONES[cle], ...this.reperesIcp[cle] }));
}

/** Cases de la bande « Profil PASSIDOC » ; une valeur absente s'affiche « — ». */
function construireCasesProfil(p: ProfilAutoBp): CaseProfil[] {
  const croissance = p.croissanceCa;
  return [
    { label: 'Secteur', icon: 'category', valeur: p.secteur || '—' },
    { label: 'Effectif', icon: 'badge', valeur: p.effectif != null ? pluriel(p.effectif, 'salarié') : '—' },
    { label: 'Capital', icon: 'account_balance', valeur: p.capital != null ? fmt(p.capital) : '—' },
    { label: "Chiffre d'affaires", icon: 'payments', valeur: p.ca != null ? fmt(p.ca) : '—' },
    { label: 'Croissance du CA', icon: croissance != null && croissance < 0 ? 'trending_down' : 'trending_up',
      valeur: croissance != null ? `${croissance > 0 ? '+' : ''}${croissance} %` : '—',
      ton: croissance == null || croissance === 0 ? undefined : croissance > 0 ? 'positif' : 'negatif' },
    { label: 'Ancienneté de la relation', icon: 'handshake',
      valeur: p.ancienneteRelationAns != null ? pluriel(p.ancienneteRelationAns, 'an') : '—',
      detail: pluriel(p.nbExercices, 'exercice') },
    { label: "Création de l'entreprise", icon: 'event', valeur: p.dateCreationEntreprise ? dateFr(p.dateCreationEntreprise) : '—' },
    { label: 'Maturité numérique', icon: 'devices', valeur: p.maturiteNumerique != null ? `${p.maturiteNumerique} / 5` : '—' },
    { label: 'Dépôt des pièces', icon: 'inventory', valeur: p.disciplinePieces?.appreciation || '—',
      detail: p.disciplinePieces?.enRetard ? `${pluriel(p.disciplinePieces.enRetard, 'pièce')} en retard` : 'Aucune pièce en retard' },
    { label: 'Missions acceptées', icon: 'assignment_turned_in', valeur: fmt(p.missionsAcceptees ?? 0),
      detail: p.cyclesMissions?.length ? p.cyclesMissions.map(nomCycle).join(', ') : undefined },
  ];
}
