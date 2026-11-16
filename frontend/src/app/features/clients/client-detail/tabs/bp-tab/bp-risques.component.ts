import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CATEGORIES_RISQUE, ECHELLE_GRAVITE, ECHELLE_PROBABILITE, ZONES_CRITICITE, ZoneCriticite, criticite, nouvelId,
} from '../../../../../core/models/outils-bp.model';

interface RisqueBp {
  id: string; nom: string; description: string; categorie: string; probabilite: number; gravite: number;
  planAction: string; responsable: string; dateCible: string; cle?: string;
}

interface LigneRisque { r: RisqueBp; n: number; valeur: number; zone: ZoneCriticite }

const PROBAS = [5, 4, 3, 2, 1];
const GRAVITES = [1, 2, 3, 4, 5];
/** Plages de criticité (probabilité × gravité) de chaque zone. */
const PLAGES: Record<ZoneCriticite, string> = { ACCEPTABLE: '1 à 4', TOLERABLE: '5 à 9', A_TRAITER: '10 à 14', INACCEPTABLE: '15 à 25' };
const ORDRE_ZONES: ZoneCriticite[] = ['ACCEPTABLE', 'TOLERABLE', 'A_TRAITER', 'INACCEPTABLE'];
const borne = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v)) || 1));

/**
 * Matrice de risques (StratPilote) : matrice 5 × 5 probabilité × gravité colorée par zone de
 * criticité, chaque risque y figure par son numéro ; légende et décompte par zone ; registre
 * des risques trié par criticité décroissante (même numérotation que la matrice). En édition,
 * formulaire intégré pour ajouter, modifier ou supprimer un risque.
 */
@Component({
  selector: 'app-bp-risques',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
@let v = vue;
<div class="rq">
  <div class="rq__haut">
    <div class="rq__matrice-wrap">
      <div class="rq__matrice" role="group" aria-label="Matrice probabilité × gravité">
        <div class="rq__axe-p"><span>Probabilité</span></div>
        @for (p of probas; track p) {
          <div class="rq__lib rq__lib-p">{{ echelleP[p - 1] }}</div>
          @for (g of gravites; track g) {
            @let z = zoneDe(p, g);
            <div class="rq__cel" [attr.data-p]="p" [attr.data-g]="g" [attr.data-zone]="z"
                 [style.background]="zones[z].fond" [style.border-color]="zones[z].couleur + '66'">
              <span class="rq__cel-val" [style.color]="zones[z].couleur">{{ p * g }}</span>
              @for (l of v.cellules[p + '-' + g] ?? []; track l.r.id) {
                <span class="rq__pastille" [class.rq__pastille--edit]="editable" tabindex="0"
                      [attr.role]="editable ? 'button' : null" [matTooltip]="l.r.nom"
                      [attr.aria-label]="'Risque ' + l.n + ' : ' + l.r.nom"
                      (click)="editer(l.r)" (keydown.enter)="editer(l.r)">{{ l.n }}</span>
              }
            </div>
          }
        }
        <span class="rq__coin"></span>
        @for (g of gravites; track g) { <div class="rq__lib rq__lib-g">{{ echelleG[g - 1] }}</div> }
        <span class="rq__coin"></span>
        <div class="rq__axe-g">Gravité</div>
      </div>
    </div>

    <aside class="rq__cote">
      <section class="rq__carte">
        <h4>Légende</h4>
        @for (z of ordreZones; track z) {
          <div class="rq__leg"><i [style.background]="zones[z].fond" [style.border-color]="zones[z].couleur"></i>
            <span>{{ zones[z].label }}</span><small>{{ plages[z] }}</small></div>
        }
        <p class="rq__formule">Criticité = Probabilité × Gravité</p>
      </section>
      <section class="rq__carte">
        <h4>Risques par criticité</h4>
        @for (z of ordreZonesDesc; track z) {
          <div class="rq__compte" [attr.data-zone]="z">
            <i [style.background]="zones[z].couleur"></i>
            <span class="rq__compte-lib">{{ zones[z].label }}</span>
            <b class="rq__compte-nb">{{ v.compte[z] }}</b>
          </div>
        }
        <div class="rq__total">Total <b>{{ v.lignes.length }}</b></div>
      </section>
    </aside>
  </div>

  <section class="rq__registre">
    <header class="rq__registre-tete">
      <h3 class="rq__titre"><mat-icon>list_alt</mat-icon>Registre des risques</h3>
      @if (editable && !brouillon) {
        <button mat-flat-button type="button" class="rq__ajouter" (click)="nouveau()">+ Ajouter un risque</button>
      }
    </header>

    @if (editable && brouillon; as b) {
      @let k = criticiteDe(b);
      <div class="rq__form" #formulaire>
        <h4 class="rq__form-titre">{{ estNouveau ? 'Nouveau risque' : 'Modifier le risque n° ' + numeroDe(b.id) }}</h4>
        <div class="rq__champs">
          <label class="rq__champ rq__champ--large">Nom du risque *
            <input type="text" class="rq__nom-champ" maxlength="200" [(ngModel)]="b.nom" [class.rq__invalide]="erreurNom"
                   [attr.aria-invalid]="erreurNom" (ngModelChange)="erreurNom = false" (keydown.enter)="enregistrer()"
                   placeholder="Ex. : Redressement de TVA">
            @if (erreurNom) { <span class="rq__erreur" role="alert">Le nom du risque est obligatoire.</span> }
          </label>
          <label class="rq__champ rq__champ--large">Description
            <textarea rows="2" maxlength="3000" [(ngModel)]="b.description"></textarea>
          </label>
          <label class="rq__champ">Catégorie
            <select class="rq__categorie" [(ngModel)]="b.categorie">
              @for (c of categories; track c.code) { <option [ngValue]="c.code">{{ c.label }}</option> }
            </select>
          </label>
          <label class="rq__champ">Probabilité *
            <select class="rq__proba" [(ngModel)]="b.probabilite">
              @for (e of echelleP; track $index) { <option [ngValue]="$index + 1">{{ e }}</option> }
            </select>
          </label>
          <label class="rq__champ">Gravité *
            <select class="rq__gravite" [(ngModel)]="b.gravite">
              @for (e of echelleG; track $index) { <option [ngValue]="$index + 1">{{ e }}</option> }
            </select>
          </label>
          <div class="rq__apercu">Criticité :
            <span class="rq__crit"><i [style.background]="zones[k.zone].couleur"></i>{{ k.valeur }}</span>
            <span>{{ zones[k.zone].label }}</span>
          </div>
          <label class="rq__champ rq__champ--large">Plan d'action
            <textarea rows="2" maxlength="3000" [(ngModel)]="b.planAction"></textarea>
          </label>
          <label class="rq__champ">Responsable
            <input type="text" maxlength="120" [(ngModel)]="b.responsable">
          </label>
          <label class="rq__champ">Date cible
            <input type="date" [(ngModel)]="b.dateCible">
          </label>
        </div>
        <div class="rq__actions">
          @if (!estNouveau) {
            <button mat-button type="button" class="rq__supprimer" (click)="supprimer()"><mat-icon>delete_outline</mat-icon>Supprimer</button>
          }
          <span class="rq__espace"></span>
          <button mat-stroked-button type="button" class="rq__annuler" (click)="annuler()">Annuler</button>
          <button mat-flat-button type="button" class="rq__enregistrer" (click)="enregistrer()">Enregistrer</button>
        </div>
      </div>
    }

    @if (v.lignes.length) {
      <div class="rq__table-wrap">
        <table class="rq__table">
          <thead>
            <tr><th class="rq__c">N°</th><th>Nom</th><th>Catégorie</th><th class="rq__c" title="Probabilité">P</th>
              <th class="rq__c" title="Gravité">G</th><th>Criticité</th><th>Plan d'action</th><th>Responsable</th><th>Date cible</th></tr>
          </thead>
          <tbody>
            @for (l of v.lignes; track l.r.id) {
              <tr [attr.data-id]="l.r.id" [class.rq__ligne--edit]="editable" [class.rq__ligne--sel]="editable && brouillon?.id === l.r.id"
                  [attr.tabindex]="editable ? 0 : null" (click)="editer(l.r)" (keydown.enter)="editer(l.r)">
                <td class="rq__c"><span class="rq__pastille rq__pastille--table">{{ l.n }}</span></td>
                <td class="rq__nom">
                  <span class="rq__nom-txt">{{ l.r.nom }}</span>
                  @if (l.r.cle) { <span class="rq__badge" matTooltip="Risque détecté à partir des données du dossier">PASSIDOC</span> }
                  @if (l.r.description) { <small class="rq__desc">{{ l.r.description }}</small> }
                </td>
                <td class="rq__nowrap">{{ libelleCategorie(l.r.categorie) }}</td>
                <td class="rq__c">{{ l.r.probabilite }}</td>
                <td class="rq__c">{{ l.r.gravite }}</td>
                <td class="rq__nowrap" [attr.data-zone]="l.zone">
                  <span class="rq__crit" [style.background]="zones[l.zone].fond"><i [style.background]="zones[l.zone].couleur"></i>{{ l.valeur }}</span>
                  <small class="rq__crit-lib">{{ zones[l.zone].label }}</small>
                </td>
                <td class="rq__long">{{ l.r.planAction || '—' }}</td>
                <td>{{ l.r.responsable || '—' }}</td>
                <td class="rq__nowrap">{{ dateFr(l.r.dateCible) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="rq__vide">Aucun risque identifié pour le moment.</p>
    }
  </section>
</div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .rq { display: flex; flex-direction: column; gap: 22px; }

    /* Matrice */
    .rq__haut { display: grid; grid-template-columns: minmax(0, 1fr) 250px; gap: 20px; align-items: start; }
    .rq__matrice-wrap { overflow-x: auto; min-width: 0; }
    .rq__matrice { display: grid; grid-template-columns: 24px 104px repeat(5, minmax(60px, 1fr)); gap: 4px; min-width: 460px; }
    .rq__axe-p { grid-column: 1; grid-row: 1 / span 5; display: flex; align-items: center; justify-content: center; }
    .rq__axe-p span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 12px; font-weight: 800; letter-spacing: .08em;
      text-transform: uppercase; color: #475569; }
    .rq__axe-g { grid-column: 3 / span 5; text-align: center; font-size: 12px; font-weight: 800; letter-spacing: .08em;
      text-transform: uppercase; color: #475569; }
    .rq__coin { grid-column: 1 / span 2; }
    .rq__lib { font-size: 11px; line-height: 1.25; color: #64748b; }
    .rq__lib-p { display: flex; align-items: center; justify-content: flex-end; text-align: right; padding-right: 4px; }
    .rq__lib-g { text-align: center; padding-top: 2px; }
    .rq__cel { position: relative; min-height: 62px; box-sizing: border-box; padding: 16px 4px 5px; border-radius: 6px; border: 1px solid;
      display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 4px; }
    .rq__cel-val { position: absolute; top: 3px; left: 5px; font-size: 10px; font-weight: 700; opacity: .75; }
    .rq__pastille { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 4px;
      box-sizing: border-box; border-radius: 12px; background: #162351; color: #fff; font-size: 11.5px; font-weight: 700;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .3); cursor: default; }
    .rq__pastille--edit { cursor: pointer; }
    .rq__pastille--edit:hover { transform: scale(1.1); }
    .rq__pastille:focus-visible { outline: 2px solid #3b82f6; outline-offset: 1px; }

    .rq__cote { display: flex; flex-direction: column; gap: 12px; }
    .rq__carte { padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; }
    .rq__carte h4 { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #1e293b; }
    .rq__leg, .rq__compte { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 13px; color: #334155; }
    .rq__leg i { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid; box-sizing: border-box; flex-shrink: 0; }
    .rq__leg small { margin-left: auto; color: #94a3b8; }
    .rq__formule { margin: 8px 0 0; font-size: 11.5px; color: #94a3b8; }
    .rq__compte i { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .rq__compte-nb { margin-left: auto; font-size: 15px; color: #1e293b; }
    .rq__total { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;
      font-size: 13px; color: #64748b; }
    .rq__total b { color: #1e293b; }

    /* Registre */
    .rq__registre-tete { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .rq__titre { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; }
    .rq__titre mat-icon { font-size: 20px; width: 20px; height: 20px; color: #dc2626; }
    .rq__vide { margin: 0; font-size: 13px; font-style: italic; color: #94a3b8; }
    .rq__table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .rq__table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .rq__table th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
      color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .rq__table td { padding: 9px 10px; vertical-align: top; color: #334155; border-bottom: 1px solid #f1f5f9; }
    .rq__table tr:last-child td { border-bottom: none; }
    .rq__ligne--edit { cursor: pointer; }
    .rq__ligne--edit:hover td { background: #f8fafc; }
    .rq__ligne--edit:focus-visible { outline: 2px solid #3b82f6; outline-offset: -2px; }
    .rq__ligne--sel td { background: #eff6ff !important; }
    .rq__c { text-align: center !important; white-space: nowrap; }
    .rq__nowrap { white-space: nowrap; }
    .rq__nom { min-width: 180px; }
    .rq__nom-txt { font-weight: 600; color: #1e293b; }
    .rq__desc { display: block; margin-top: 2px; font-size: 12px; color: #64748b; white-space: pre-line;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .rq__long { min-width: 180px; white-space: pre-line; }
    .rq__badge { margin-left: 6px; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 700; letter-spacing: .04em;
      vertical-align: 2px; background: rgba(37, 99, 235, .12); color: #1d4ed8; }
    .rq__crit { display: inline-flex; align-items: center; gap: 5px; padding: 1px 8px 1px 6px; border-radius: 10px; font-weight: 700; color: #1e293b; }
    .rq__crit i { width: 9px; height: 9px; border-radius: 50%; }
    .rq__crit-lib { margin-left: 6px; color: #64748b; }

    /* Formulaire intégré */
    .rq__form { margin-bottom: 14px; padding: 16px 18px; border-radius: 12px; background: #f8fafc; border: 1px solid #cbd5e1; scroll-margin: 16px; }
    .rq__form-titre { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #1e293b; }
    .rq__champs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .rq__champ { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: #334155; }
    .rq__champ--large { grid-column: 1 / -1; }
    .rq__champ input, .rq__champ select, .rq__champ textarea { box-sizing: border-box; width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1;
      border-radius: 8px; background: #fff; font: inherit; font-size: 13.5px; font-weight: 400; color: #1e293b; }
    .rq__champ textarea { resize: vertical; }
    .rq__champ input:focus, .rq__champ select:focus, .rq__champ textarea:focus { outline: none; border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, .2); }
    .rq__champ .rq__invalide { border-color: #dc2626; }
    .rq__erreur { font-size: 12px; font-weight: 500; color: #dc2626; }
    .rq__apercu { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
    .rq__apercu .rq__crit { background: #fff; border: 1px solid #e2e8f0; }
    .rq__actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
    .rq__espace { flex: 1; }
    .rq__supprimer { color: #dc2626 !important; }

    @container (max-width: 760px) {
      .rq__haut { grid-template-columns: 1fr; }
      .rq__cote { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rq__champs { grid-template-columns: 1fr 1fr; }
    }
    @container (max-width: 520px) {
      .rq__cote, .rq__champs { grid-template-columns: 1fr; }
    }
  `],
})
export class BpRisquesComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();
  @ViewChild('formulaire') formulaire?: ElementRef<HTMLElement>;

  /** Risque en cours de saisie (copie : rien n'est modifié avant « Enregistrer »). */
  brouillon: RisqueBp | null = null;
  erreurNom = false;

  readonly probas = PROBAS;
  readonly gravites = GRAVITES;
  readonly plages = PLAGES;
  readonly ordreZones = ORDRE_ZONES;
  readonly ordreZonesDesc = [...ORDRE_ZONES].reverse();

  // Constantes importées lues via des getters (ordre d'initialisation du bundle de test).
  get zones() { return ZONES_CRITICITE; }
  get echelleP(): string[] { return ECHELLE_PROBABILITE; }
  get echelleG(): string[] { return ECHELLE_GRAVITE; }
  get categories() { return CATEGORIES_RISQUE; }

  private get risques(): RisqueBp[] { return this.contenu?.risques ?? []; }

  /**
   * Risques triés par criticité décroissante (à criticité égale : gravité la plus forte, puis
   * ordre de saisie) ; le numéro est le rang dans ce tri, partagé par la matrice et le tableau.
   */
  get vue(): { lignes: LigneRisque[]; cellules: Partial<Record<string, LigneRisque[]>>; compte: Record<ZoneCriticite, number> } {
    const lignes = this.risques
      .map((r, i) => ({ r, i, ...criticite(r.probabilite, r.gravite) }))
      .sort((a, b) => b.valeur - a.valeur || b.r.gravite - a.r.gravite || a.i - b.i)
      .map(({ r, valeur, zone }, k) => ({ r, n: k + 1, valeur, zone }));
    const cellules: Partial<Record<string, LigneRisque[]>> = {};
    const compte: Record<ZoneCriticite, number> = { ACCEPTABLE: 0, TOLERABLE: 0, A_TRAITER: 0, INACCEPTABLE: 0 };
    for (const l of lignes) {
      (cellules[`${l.r.probabilite}-${l.r.gravite}`] ??= []).push(l);
      compte[l.zone]++;
    }
    return { lignes, cellules, compte };
  }

  zoneDe(p: number, g: number): ZoneCriticite { return criticite(p, g).zone; }
  criticiteDe(r: RisqueBp) { return criticite(Number(r.probabilite) || 1, Number(r.gravite) || 1); }
  libelleCategorie(code: string): string { return this.categories.find(c => c.code === code)?.label ?? code; }
  dateFr(d: string): string { return /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d.split('-').reverse().join('/') : '—'; }
  numeroDe(id: string): number { return this.vue.lignes.find(l => l.r.id === id)?.n ?? 0; }
  get estNouveau(): boolean { return !!this.brouillon && !this.risques.some(r => r.id === this.brouillon!.id); }

  // ── Édition ─────────────────────────────────────────────────────────────

  nouveau() {
    if (!this.editable) return;
    this.ouvrir({
      id: nouvelId(), nom: '', description: '', categorie: 'AUTRE', probabilite: 1, gravite: 1,
      planAction: '', responsable: '', dateCible: '',
    });
  }

  editer(r: RisqueBp) {
    if (!this.editable) return;
    this.ouvrir({ ...r });
  }

  private ouvrir(r: RisqueBp) {
    this.brouillon = r;
    this.erreurNom = false;
    setTimeout(() => this.formulaire?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  }

  annuler() {
    this.brouillon = null;
    this.erreurNom = false;
  }

  /** Le nom est obligatoire : sans nom, rien n'est ajouté ni modifié. */
  enregistrer() {
    const b = this.brouillon;
    if (!b) return;
    const nom = (b.nom ?? '').trim();
    if (!nom) { this.erreurNom = true; return; }
    const risque: RisqueBp = { ...b, nom, probabilite: borne(b.probabilite), gravite: borne(b.gravite), dateCible: b.dateCible ?? '' };
    const existant = this.risques.find(r => r.id === b.id);
    if (existant) Object.assign(existant, risque);
    else this.contenu.risques.push(risque);
    this.brouillon = null;
    this.contenuChange.emit(this.contenu);
  }

  private confirmation = inject(ConfirmService);

  /** Toute suppression passe par la fenêtre de confirmation de l'appli. */
  supprimer() {
    const b = this.brouillon;
    if (!b) return;
    const nom = this.risques.find(r => r.id === b.id)?.nom || b.nom;
    this.confirmation.confirm('Supprimer ce risque ?', `« ${nom} » sera retiré du registre. La suppression devient définitive à l'enregistrement de l'outil.`)
      .subscribe(ok => {
        if (!ok) return;
        const i = this.risques.findIndex(r => r.id === b.id);
        if (i >= 0) this.contenu.risques.splice(i, 1);
        this.brouillon = null;
        this.contenuChange.emit(this.contenu);
      });
  }
}
