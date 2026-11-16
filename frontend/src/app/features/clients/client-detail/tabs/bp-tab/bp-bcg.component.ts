import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { QUADRANTS_BCG, nouvelId } from '../../../../../core/models/outils-bp.model';

type QuadrantBcg = 'VEDETTE' | 'DILEMME' | 'VACHE' | 'POIDS_MORT';

interface ActiviteBcg { id: string; nom: string; ca: number | null; quadrant: QuadrantBcg; couleur: string }

const ICONES: Record<QuadrantBcg, string> = { VEDETTE: 'star', DILEMME: 'help_outline', VACHE: 'savings', POIDS_MORT: 'trending_down' };
/** Couleurs proposées aux nouvelles activités, à tour de rôle. */
const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#64748b'];
/** Diamètre des bulles (px) : le plus gros CA a D_MAX, surface proportionnelle au CA, D_MIN sans CA. */
const D_MAX = 96;
const D_MIN = 30;

/**
 * Matrice BCG (StratPilote) : 4 quadrants (vedettes, dilemmes, vaches à lait, poids morts)
 * selon la croissance du marché et la part de marché relative ; chaque activité y est une bulle
 * de sa couleur, dont la surface est proportionnelle à son chiffre d'affaires. Le CA n'a pas
 * d'unité imposée (dossiers en EUR à La Réunion, en MGA à Madagascar).
 */
@Component({
  selector: 'app-bp-bcg',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
@let max = caMax;
<div class="bcg">
  <header class="bcg__tete">
    <p class="bcg__aide"><mat-icon>bubble_chart</mat-icon>Taille des bulles proportionnelle au chiffre d'affaires de chaque activité.</p>
    @if (editable && !brouillon) {
      <button mat-flat-button type="button" class="bcg__ajouter" (click)="nouvelle()">+ Ajouter une activité</button>
    }
  </header>

  @if (editable && brouillon; as b) {
    <div class="bcg__form" #formulaire>
      <h4 class="bcg__form-titre">{{ estNouvelle ? 'Nouvelle activité' : 'Modifier l’activité' }}</h4>
      <div class="bcg__champs">
        <label class="bcg__champ bcg__champ--nom">Nom de l'activité *
          <input type="text" class="bcg__nom-champ" maxlength="120" [(ngModel)]="b.nom" [class.bcg__invalide]="erreurNom"
                 [attr.aria-invalid]="erreurNom" (ngModelChange)="erreurNom = false" (keydown.enter)="enregistrer()"
                 placeholder="Ex. : Vente de matériaux">
          @if (erreurNom) { <span class="bcg__erreur" role="alert">Le nom de l'activité est obligatoire.</span> }
        </label>
        <label class="bcg__champ">Chiffre d'affaires
          <input type="number" class="bcg__ca-champ" min="0" step="any" [(ngModel)]="b.ca" placeholder="Montant annuel">
        </label>
        <label class="bcg__champ">Quadrant
          <select class="bcg__quadrant-champ" [(ngModel)]="b.quadrant">
            @for (q of quadrants; track q.code) { <option [ngValue]="q.code">{{ q.label }}</option> }
          </select>
        </label>
        <label class="bcg__champ bcg__champ--couleur">Couleur
          <input type="color" [(ngModel)]="b.couleur">
        </label>
      </div>
      <div class="bcg__actions">
        <button mat-stroked-button type="button" class="bcg__annuler" (click)="annuler()">Annuler</button>
        <button mat-flat-button type="button" class="bcg__enregistrer" (click)="enregistrer()">Enregistrer</button>
      </div>
    </div>
  }

  @if (!activites.length) {
    <p class="bcg__vide">Aucune activité pour le moment</p>
  }

  <div class="bcg__matrice">
    <div class="bcg__axe-y" aria-hidden="true">
      <span class="bcg__borne"><mat-icon>arrow_upward</mat-icon>Fort</span>
      <span class="bcg__axe-titre">Taux de croissance du marché</span>
      <span class="bcg__borne">Faible</span>
    </div>
    <div class="bcg__grille">
      @for (q of quadrants; track q.code) {
        <section class="bcg__q" [attr.data-quadrant]="q.code" [style.--q]="q.couleur">
          <header class="bcg__q-tete">
            <span class="bcg__q-ic"><mat-icon>{{ icone(q.code) }}</mat-icon></span>
            <div>
              <h4 class="bcg__q-nom">{{ q.label }}</h4>
              <p class="bcg__q-desc">{{ q.description }}</p>
            </div>
          </header>
          <div class="bcg__bulles">
            @for (a of activitesDe(q.code); track a.id) {
              <div class="bcg__act" [attr.data-id]="a.id" [class.bcg__act--edit]="editable"
                   [attr.role]="editable ? 'button' : null" [attr.tabindex]="editable ? 0 : null"
                   [matTooltip]="a.nom + (a.ca !== null ? ' — ' + formatCa(a.ca) : '')"
                   (click)="modifier(a)" (keydown.enter)="modifier(a)">
                <span class="bcg__bulle" [style.--d]="diametre(a.ca, max) + 'px'" [style.background]="a.couleur"></span>
                <span class="bcg__nom">{{ a.nom }}</span>
                @if (a.ca !== null) { <span class="bcg__ca">{{ formatCa(a.ca) }}</span> }
              </div>
            }
          </div>
        </section>
      }
    </div>
    <span></span>
    <div class="bcg__axe-x" aria-hidden="true">
      <span class="bcg__borne"><mat-icon>arrow_back</mat-icon>Forte</span>
      <span class="bcg__axe-titre">Part de marché relative</span>
      <span class="bcg__borne">Faible</span>
    </div>
  </div>

  @if (editable && activites.length) {
    <section class="bcg__liste">
      <h3 class="bcg__titre"><mat-icon>list</mat-icon>Activités</h3>
      <div class="bcg__table-wrap">
        <table class="bcg__table">
          <thead><tr><th>Activité</th><th>Quadrant</th><th class="bcg__num">Chiffre d'affaires</th><th></th></tr></thead>
          <tbody>
            @for (a of activites; track a.id) {
              <tr [attr.data-id]="a.id">
                <td><i class="bcg__pt" [style.background]="a.couleur"></i>{{ a.nom }}</td>
                <td>{{ libelleQuadrant(a.quadrant) }}</td>
                <td class="bcg__num">{{ a.ca === null ? '—' : formatCa(a.ca) }}</td>
                <td class="bcg__boutons">
                  <button mat-icon-button type="button" class="bcg__modifier" (click)="modifier(a)" matTooltip="Modifier" aria-label="Modifier">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button type="button" class="bcg__supprimer" (click)="supprimer(a)" matTooltip="Supprimer" aria-label="Supprimer">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  }
</div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .bcg { display: flex; flex-direction: column; gap: 16px; }
    .bcg__tete { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .bcg__aide { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: #64748b; }
    .bcg__aide mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3b82f6; }
    .bcg__vide { margin: 0; padding: 10px 14px; border-radius: 10px; border: 1.5px dashed #cbd5e1; text-align: center;
      font-size: 13px; font-style: italic; color: #64748b; }

    /* Matrice */
    .bcg__matrice { display: grid; grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: auto auto; gap: 6px; }
    .bcg__axe-y { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 4px 0;
      border-right: 2px solid #cbd5e1; }
    .bcg__axe-y .bcg__axe-titre, .bcg__axe-y .bcg__borne { writing-mode: vertical-rl; transform: rotate(180deg); }
    .bcg__axe-x { display: flex; align-items: center; justify-content: space-between; padding: 4px 2px 0; border-top: 2px solid #cbd5e1; }
    .bcg__axe-titre { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
    .bcg__borne { display: inline-flex; align-items: center; gap: 2px; font-size: 11.5px; color: #64748b; }
    .bcg__borne mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .bcg__grille { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .bcg__q { --q: #64748b; display: flex; flex-direction: column; gap: 10px; min-height: 240px; padding: 14px 16px; border-radius: 14px;
      background: color-mix(in srgb, var(--q) 8%, #fff); border: 1px solid color-mix(in srgb, var(--q) 30%, #fff); }
    .bcg__q-tete { display: flex; align-items: flex-start; gap: 10px; }
    .bcg__q-ic { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
      background: var(--q); color: #fff; }
    .bcg__q-ic mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .bcg__q-nom { margin: 0; font-size: 14px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--q); }
    .bcg__q-desc { margin: 2px 0 0; font-size: 11.5px; line-height: 1.35; color: #64748b; }
    .bcg__bulles { flex: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px 18px; padding: 4px; }
    .bcg__act { display: flex; flex-direction: column; align-items: center; gap: 4px; max-width: 130px; text-align: center; }
    .bcg__act--edit { cursor: pointer; }
    .bcg__act--edit:hover .bcg__bulle { transform: scale(1.05); }
    .bcg__act:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; border-radius: 8px; }
    .bcg__bulle { --d: 30px; display: block; width: var(--d); height: var(--d); border-radius: 50%; opacity: .9; transition: transform .15s;
      box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .4), 0 2px 6px rgba(15, 23, 42, .18); }
    .bcg__nom { font-size: 12.5px; font-weight: 600; line-height: 1.25; color: #1e293b; word-break: break-word; }
    .bcg__ca { font-size: 11.5px; color: #64748b; white-space: nowrap; }

    /* Formulaire et liste */
    .bcg__form { padding: 16px 18px; border-radius: 12px; background: #f8fafc; border: 1px solid #cbd5e1; scroll-margin: 16px; }
    .bcg__form-titre { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #1e293b; }
    .bcg__champs { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 80px; gap: 12px; align-items: start; }
    .bcg__champ { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: #334155; }
    .bcg__champ input, .bcg__champ select { box-sizing: border-box; width: 100%; height: 36px; padding: 6px 9px; border: 1px solid #cbd5e1;
      border-radius: 8px; background: #fff; font: inherit; font-size: 13.5px; font-weight: 400; color: #1e293b; }
    .bcg__champ input[type=color] { padding: 3px; cursor: pointer; }
    .bcg__champ input:focus, .bcg__champ select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, .2); }
    .bcg__champ .bcg__invalide { border-color: #dc2626; }
    .bcg__erreur { font-size: 12px; font-weight: 500; color: #dc2626; }
    .bcg__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .bcg__titre { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #1e293b; }
    .bcg__titre mat-icon { font-size: 20px; width: 20px; height: 20px; color: #3b82f6; }
    .bcg__table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .bcg__table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .bcg__table th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
      color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .bcg__table td { padding: 4px 12px; vertical-align: middle; color: #334155; border-bottom: 1px solid #f1f5f9; }
    .bcg__table tr:last-child td { border-bottom: none; }
    .bcg__table .bcg__num { text-align: right; white-space: nowrap; }
    .bcg__pt { display: inline-block; width: 12px; height: 12px; margin-right: 8px; border-radius: 50%; vertical-align: -1px; }
    .bcg__boutons { text-align: right; white-space: nowrap; }
    .bcg__supprimer { color: #dc2626; }

    @container (max-width: 760px) {
      .bcg__champs { grid-template-columns: 1fr 1fr; }
      .bcg__champ--nom { grid-column: 1 / -1; }
      .bcg__q { min-height: 200px; padding: 12px; }
      .bcg__bulle { width: calc(var(--d) * .75); height: calc(var(--d) * .75); }
    }
    @container (max-width: 520px) {
      .bcg__q-desc { display: none; }
      .bcg__q-nom { font-size: 12px; }
      .bcg__bulle { width: calc(var(--d) * .6); height: calc(var(--d) * .6); }
    }
  `],
})
export class BpBcgComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();
  @ViewChild('formulaire') formulaire?: ElementRef<HTMLElement>;

  /** Activité en cours de saisie (copie : rien n'est modifié avant « Enregistrer »). */
  brouillon: ActiviteBcg | null = null;
  erreurNom = false;

  // Constante importée lue via un getter (ordre d'initialisation du bundle de test).
  get quadrants() { return QUADRANTS_BCG; }
  get activites(): ActiviteBcg[] { return this.contenu?.activites ?? []; }

  activitesDe(code: string): ActiviteBcg[] { return this.activites.filter(a => a.quadrant === code); }
  icone(code: string): string { return ICONES[code as QuadrantBcg] ?? 'circle'; }
  libelleQuadrant(code: string): string { return this.quadrants.find(q => q.code === code)?.label ?? code; }
  formatCa(ca: number): string { return ca.toLocaleString('fr-FR', { maximumFractionDigits: 2 }); }

  get caMax(): number { return Math.max(0, ...this.activites.map(a => a.ca ?? 0)); }

  /** Diamètre d'une bulle : surface proportionnelle au CA rapporté au plus gros CA, au moins D_MIN. */
  diametre(ca: number | null, max: number): number {
    if (!ca || ca <= 0 || !max) return D_MIN;
    return Math.max(D_MIN, Math.round(D_MAX * Math.sqrt(ca / max)));
  }

  get estNouvelle(): boolean { return !!this.brouillon && !this.activites.some(a => a.id === this.brouillon!.id); }

  // ── Édition ─────────────────────────────────────────────────────────────

  nouvelle() {
    if (!this.editable) return;
    this.ouvrir({ id: nouvelId(), nom: '', ca: null, quadrant: 'VEDETTE', couleur: PALETTE[this.activites.length % PALETTE.length] });
  }

  modifier(a: ActiviteBcg) {
    if (!this.editable) return;
    this.ouvrir({ ...a });
  }

  private ouvrir(a: ActiviteBcg) {
    this.brouillon = a;
    this.erreurNom = false;
    setTimeout(() => this.formulaire?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  }

  annuler() {
    this.brouillon = null;
    this.erreurNom = false;
  }

  /** Le nom est obligatoire ; CA vide → null, négatif → 0 (comme la normalisation serveur). */
  enregistrer() {
    const b = this.brouillon;
    if (!b) return;
    const nom = (b.nom ?? '').trim();
    if (!nom) { this.erreurNom = true; return; }
    const brut = b.ca as unknown;
    const n = Number(brut);
    const ca = brut === null || brut === undefined || brut === '' || !Number.isFinite(n) ? null : Math.max(0, n);
    const quadrant = this.quadrants.some(q => q.code === b.quadrant) ? b.quadrant : 'DILEMME';
    const couleur = /^#[0-9a-fA-F]{6}$/.test(b.couleur ?? '') ? b.couleur : '#3b82f6';
    const activite: ActiviteBcg = { id: b.id, nom, ca, quadrant, couleur };
    const existante = this.activites.find(a => a.id === b.id);
    if (existante) Object.assign(existante, activite);
    else this.contenu.activites.push(activite);
    this.brouillon = null;
    this.contenuChange.emit(this.contenu);
  }

  private confirmation = inject(ConfirmService);

  /** Toute suppression passe par la fenêtre de confirmation de l'appli. */
  supprimer(a: ActiviteBcg) {
    if (!this.editable) return;
    this.confirmation.confirm('Supprimer cette activité ?', `« ${a.nom} » sera retirée de la matrice. La suppression devient définitive à l'enregistrement de l'outil.`)
      .subscribe(ok => {
        if (!ok) return;
        const i = this.activites.findIndex(x => x.id === a.id);
        if (i < 0) return;
        this.contenu.activites.splice(i, 1);
        if (this.brouillon?.id === a.id) this.brouillon = null;
        this.contenuChange.emit(this.contenu);
      });
  }
}
