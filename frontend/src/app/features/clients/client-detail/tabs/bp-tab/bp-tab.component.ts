import {
  Component, Input, OnChanges, OnInit, SimpleChanges, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CATEGORIES_RISQUE, LIBELLES_ZONES, OutilBpCode, NB_OUTILS_ANALYSE, QUADRANTS_BCG, OutilBpVue, ProfilAutoBp, SuggestionBp, TableauBp,
  appliquerSuggestion, ecarterSuggestion, evolutionN1, infoOutil, suggestionTraitee,
} from '../../../../../core/models/outils-bp.model';
import { OutilsBpService } from '../../../../../core/services/outils-bp.service';
import { DocumentsService } from '../../../../../core/services/documents.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { TenantService } from '../../../../../core/services/tenant.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { BpSwotComponent } from './bp-swot.component';
import { BpPorterComponent } from './bp-porter.component';
import { BpBmcComponent } from './bp-bmc.component';
import { BpPestelComponent } from './bp-pestel.component';
import { BpChaineValeurComponent } from './bp-chaine-valeur.component';
import { BpDiagnosticComponent } from './bp-diagnostic.component';
import { BpRisquesComponent } from './bp-risques.component';
import { BpPersonaComponent } from './bp-persona.component';
import { BpBcgComponent } from './bp-bcg.component';
import { BpEntretienComponent } from './bp-entretien.component';
import { BpSignatureComponent } from './bp-signature.component';
import { construireRapportBp, exporterQuestionnaireVierge, exporterRapportBp } from './bp.export';

const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Tableau de Bord BP — « Outils stratégiques PASSIDOC x Business Partner » (6 nov. 2026), partie 5 :
 * accès depuis la fiche client, un onglet par outil (présentés comme sur StratPilote), zones
 * pré-remplies (suggestions tirées du dossier) + saisie libre, export PDF par outil ou global,
 * comparaison N / N-1, validation réservée aux profils BP+.
 */
@Component({
  selector: 'app-bp-tab',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule,
    BpEntretienComponent, BpSignatureComponent, BpSwotComponent, BpPorterComponent, BpBmcComponent, BpPestelComponent, BpChaineValeurComponent,
    BpDiagnosticComponent, BpRisquesComponent, BpPersonaComponent, BpBcgComponent,
  ],
  template: `
@if (!exerciceId) {
  <div class="bp-vide"><mat-icon>event_busy</mat-icon>Créez un exercice pour utiliser le tableau de bord BP.</div>
} @else if (chargement()) {
  <div class="bp-vide">Chargement du tableau de bord BP…</div>
} @else if (erreur()) {
  <div class="bp-vide bp-vide--erreur"><mat-icon>error_outline</mat-icon>{{ erreur() }}</div>
} @else if (tableau(); as tb) {
<div class="bp">
  <!-- Le choix de l'outil se fait dans le menu de gauche de la fiche (mode Tableau de bord BP). -->
  <main class="bp__main">
    @let vue = vueActive();
    @let info = infoActive();
    <header class="bp__entete">
      <div class="bp__titre">
        <span class="bp__pastille" [style.background]="info.couleur"><mat-icon>{{ info.icon }}</mat-icon></span>
        <div>
          <h2>{{ info.label }}</h2>
          <p>{{ info.description }}</p>
        </div>
      </div>
      <div class="bp__actions">
        @if (modifies().has(actif())) {
          <span class="bp__statut bp__statut--modifie"><mat-icon>edit</mat-icon>Non enregistré</span>
        } @else if (vue.statut === 'VALIDE') {
          <span class="bp__statut bp__statut--valide"><mat-icon>verified</mat-icon>
            Validé{{ vue.validePar?.nom ? ' par ' + vue.validePar?.nom : '' }}{{ vue.valideLe ? ' le ' + (vue.valideLe | date:'dd/MM/yyyy') : '' }}
          </span>
        } @else if (vue.origine === 'ENREGISTRE') {
          <span class="bp__statut"><mat-icon>edit_note</mat-icon>Brouillon</span>
        } @else {
          <span class="bp__statut bp__statut--neuf"><mat-icon>radio_button_unchecked</mat-icon>Non enregistré</span>
        }
        @if (tb.precedent) {
          <button mat-stroked-button type="button" (click)="comparer.set(!comparer())" [class.bp__btn-actif]="comparer()">
            <mat-icon>compare_arrows</mat-icon>Comparer à {{ tb.precedent.annee }}
          </button>
        }
        <button mat-stroked-button type="button" [matMenuTriggerFor]="menuExport">
          <mat-icon>picture_as_pdf</mat-icon>Exporter
        </button>
        <mat-menu #menuExport="matMenu">
          <button mat-menu-item type="button" (click)="exporter('outil')"><mat-icon>description</mat-icon>{{ info.label }} (PDF)</button>
          <button mat-menu-item type="button" (click)="exporter('rapport')"><mat-icon>library_books</mat-icon>Rapport BP {{ tb.exercice.annee }} complet (PDF)</button>
          @if (actif() === 'ENTRETIEN') {
            <button mat-menu-item type="button" (click)="exporterVierge()"><mat-icon>print</mat-icon>Questionnaire vierge à imprimer (PDF)</button>
          }
        </mat-menu>
        @if (editable() && tb.droits.valider) {
          <button mat-stroked-button type="button" class="bp__valider" (click)="ouvrirValidation()" [disabled]="enCours() || validationOuverte() || (vue.statut === 'VALIDE' && !modifies().has(actif()))"
                  matTooltip="Valider et publier cet outil (profils BP+)">
            <mat-icon>verified</mat-icon>Valider
          </button>
        }
        @if (editable()) {
          <button mat-stroked-button type="button" class="bp__ouvrir-signature" (click)="ouvrirSignature()" [disabled]="signatureOuverte()"
                  matTooltip="Signer le rapport BP avec le dirigeant et l'archiver dans les Documents du dossier">
            <mat-icon>draw</mat-icon>Signer le rapport
          </button>
          <button mat-flat-button color="primary" type="button" class="bp__enregistrer" (click)="enregistrer()" [disabled]="enCours()">
            <mat-icon>save</mat-icon>Enregistrer
          </button>
        }
      </div>
    </header>

    @if (signatureOuverte()) {
      <section class="bp__signature" aria-label="Co-signature du rapport">
        <h3><mat-icon>draw</mat-icon>Co-signature du rapport BP {{ tb.exercice.annee }}</h3>
        <p class="bp__signature-intro">Le rapport complet (outils renseignés, entretien en annexe) est généré avec les deux signatures,
          téléchargé et archivé dans les Documents du dossier.</p>
        @if (modifies().size) {
          <p class="bp__signature-alerte"><mat-icon>warning_amber</mat-icon>Enregistrez d'abord les modifications en cours : le rapport reprend la version enregistrée.</p>
        }
        <div class="bp__signature-noms">
          <label>Business Partner<input class="bp__signataire-bp" maxlength="120" [(ngModel)]="signataireBp"></label>
          <label>Dirigeant<input class="bp__signataire-dirigeant" maxlength="120" [(ngModel)]="signataireDirigeant" placeholder="Nom du dirigeant"></label>
        </div>
        <div class="bp__signature-zones">
          <app-bp-signature class="bp__sig-bp" libelle="Signature du Business Partner" (signature)="signatureBp = $event" />
          <app-bp-signature class="bp__sig-dirigeant" libelle="Signature du dirigeant" (signature)="signatureDirigeant = $event" />
        </div>
        <div class="bp__validation-actions">
          <button mat-stroked-button type="button" (click)="signatureOuverte.set(false)">Annuler</button>
          <button mat-flat-button color="primary" type="button" class="bp__signer" [disabled]="!peutSigner()" (click)="signerEtArchiver()">
            <mat-icon>verified</mat-icon>Signer et archiver le rapport
          </button>
        </div>
      </section>
    }
    @if (dernierRapport(); as r) {
      <div class="bp__info bp__info--ok"><mat-icon>task</mat-icon>Rapport BP signé le {{ r.date | date:'dd/MM/yyyy à HH:mm' }} et archivé dans les Documents du dossier ({{ r.nom }}).</div>
    }
    @if (validationOuverte()) {
      <section class="bp__validation" aria-label="Valider l'outil">
        <label class="bp__validation-lib" for="bp-commentaire">Commentaire du BP <small>(facultatif, repris dans le rapport PDF)</small></label>
        <textarea id="bp-commentaire" class="bp__validation-champ" rows="2" maxlength="1000" [(ngModel)]="commentaireValidation"
                  placeholder="Points clés, réserves, prochaines étapes…"></textarea>
        <div class="bp__validation-actions">
          <button mat-stroked-button type="button" (click)="validationOuverte.set(false)">Annuler</button>
          <button mat-flat-button color="primary" type="button" class="bp__confirmer-validation" (click)="valider()" [disabled]="enCours()">
            <mat-icon>verified</mat-icon>Valider {{ info.label }}
          </button>
        </div>
      </section>
    }
    @if (vue.statut === 'VALIDE' && vue.commentaire && !modifies().has(actif())) {
      <div class="bp__commentaire"><mat-icon>chat</mat-icon>
        <div><strong>Commentaire de validation{{ vue.validePar?.nom ? ' — ' + vue.validePar?.nom : '' }}</strong><p>{{ vue.commentaire }}</p></div>
      </div>
    }
    @if (actif() === 'RISQUES' && !tb.exercice.cloture && joursDepuisMaj(vue) > 90) {
      <div class="bp__info bp__info--alerte"><mat-icon>update</mat-icon>
        Matrice mise à jour il y a {{ joursDepuisMaj(vue) }} jours : le document prévoit une mise à jour trimestrielle des risques.</div>
    }
    @if (vue.origine === 'REPRISE_N1' && !modifies().has(actif())) {
      <div class="bp__info"><mat-icon>history</mat-icon>Repris de l'exercice {{ tb.precedent?.annee }} : mettez-le à jour puis enregistrez.</div>
    }
    @if (vue.origine === 'REPRISE_ANCIENNE' && !modifies().has(actif())) {
      <div class="bp__info"><mat-icon>move_down</mat-icon>Repris des anciens onglets « Stratégie » et « Modèle Canvas » : vérifiez puis enregistrez.</div>
    }
    @if (tb.exercice.cloture) {
      <div class="bp__info"><mat-icon>lock</mat-icon>Exercice clôturé : consultation seule.</div>
    }

    @if (comparer() && tb.precedent) {
      @let ev = evolution();
      <section class="bp__evolution" aria-label="Évolution depuis l'exercice précédent">
        <h3><mat-icon>compare_arrows</mat-icon>Évolution {{ tb.precedent.annee }} → {{ tb.exercice.annee }}</h3>
        @if (!tb.precedent.outils[actif()]) {
          <p class="bp__evolution-vide">Cet outil n'a pas été enregistré en {{ tb.precedent.annee }}.</p>
        } @else if (!ev.ajouts.length && !ev.retraits.length && !ev.changements.length) {
          <p class="bp__evolution-vide">Aucun changement depuis {{ tb.precedent.annee }}.</p>
        } @else {
          <div class="bp__evolution-cols">
            @if (ev.ajouts.length) { <div><h4 class="plus">Nouveau</h4>@for (l of ev.ajouts; track $index) { <p>+ {{ l }}</p> }</div> }
            @if (ev.retraits.length) { <div><h4 class="moins">Retiré</h4>@for (l of ev.retraits; track $index) { <p>− {{ l }}</p> }</div> }
            @if (ev.changements.length) { <div><h4>Modifié</h4>@for (l of ev.changements; track $index) { <p>{{ l }}</p> }</div> }
          </div>
        }
      </section>
    }

    @if (editable() && (suggestionsActives().length || iaPossible())) {
      <section class="bp__sugg" aria-label="Suggestions PASSIDOC">
        <div class="bp__sugg-tete">
          <button type="button" class="bp__sugg-entete" (click)="suggestionsOuvertes.set(!suggestionsOuvertes())"
                  [attr.aria-expanded]="suggestionsOuvertes()">
            <mat-icon>auto_awesome</mat-icon>
            @if (suggestionsActives().length) {
              <strong>{{ suggestionsActives().length }} suggestion{{ suggestionsActives().length > 1 ? 's' : '' }} PASSIDOC</strong>
              <span>tirées des données du dossier : ajoutez-les ou écartez-les</span>
            } @else {
              <strong>Aucune suggestion PASSIDOC</strong><span>pour cet outil : l'IA peut en proposer à partir du dossier</span>
            }
            <mat-icon class="bp__sugg-chevron">{{ suggestionsOuvertes() ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
          @if (iaPossible()) {
            <button mat-stroked-button type="button" class="bp__ia" (click)="proposerIa()" [disabled]="iaEnCours()"
                    matTooltip="L'IA propose de nouveaux éléments à partir des données du dossier et de ce qui est déjà saisi">
              <mat-icon>{{ iaEnCours() ? 'hourglass_top' : 'psychology' }}</mat-icon>{{ iaEnCours() ? 'Analyse en cours…' : "Proposer avec l'IA" }}
            </button>
          }
        </div>
        @if (suggestionsOuvertes()) {
          <div class="bp__sugg-grille">
            @for (s of suggestionsActives(); track s.cle) {
              <div class="bp__sugg-item">
                <span class="bp__sugg-zone">{{ libelleZone(s) }}@if (s.cle.startsWith('ia.')) { <span class="bp__sugg-ia">IA</span> }</span>
                <p>{{ s.texte }}</p>
                <div class="bp__sugg-pied">
                  <small>{{ s.source }}</small>
                  <button mat-button type="button" color="primary" (click)="ajouter(s)"><mat-icon>add</mat-icon>Ajouter</button>
                  <button mat-button type="button" (click)="ecarter(s)">Écarter</button>
                </div>
              </div>
            }
          </div>
        }
      </section>
    }

    <div class="bp__outil">
      @let c = contenuActif();
      @switch (actif()) {
        @case ('SWOT') { <app-bp-swot [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('PORTER') { <app-bp-porter [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('BMC') { <app-bp-bmc [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('PESTEL') { <app-bp-pestel [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('CHAINE_VALEUR') { <app-bp-chaine-valeur [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('DIAGNOSTIC') { <app-bp-diagnostic [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('RISQUES') { <app-bp-risques [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('PERSONA') { <app-bp-persona [contenu]="c" [editable]="editable()" [profil]="profil()" (contenuChange)="modifie()" /> }
        @case ('BCG') { <app-bp-bcg [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
        @case ('ENTRETIEN') { <app-bp-entretien [contenu]="c" [editable]="editable()" (contenuChange)="modifie()" /> }
      }
    </div>
  </main>
</div>
}
  `,
  styles: [`
    :host { display: block; }
    .bp-vide { display: flex; align-items: center; gap: 8px; padding: 40px; justify-content: center; color: #64748b; }
    .bp-vide--erreur { color: #b91c1c; }
    .bp { display: flex; flex-direction: column; gap: 14px; }
    .bp__main { min-width: 0; }
    .bp__valider { color: #047857; }
    .bp__validation { border: 1px solid #a7f3d0; background: #f0fdf4; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
    .bp__validation-lib { display: block; font-size: 13px; font-weight: 600; color: #065f46; margin-bottom: 6px; }
    .bp__validation-lib small { font-weight: 400; color: #64748b; }
    .bp__validation-champ { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; padding: 8px 10px; border: 1px solid #a7f3d0;
      border-radius: 8px; resize: vertical; background: #fff; }
    .bp__validation-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .bp__signature { border: 1px solid #c7d2fe; background: #f8faff; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
    .bp__signature h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 4px; font-size: 15px; color: #312e81; }
    .bp__signature-intro { margin: 0 0 10px; font-size: 12.5px; color: #64748b; }
    .bp__signature-alerte { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 13px; color: #b45309; }
    .bp__signature-noms, .bp__signature-zones { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 10px; }
    .bp__signature-noms label { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: #334155; }
    .bp__signature-noms input { font: inherit; font-size: 14px; font-weight: 400; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .bp__info--alerte { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .bp__info--alerte mat-icon { color: #d97706; }
    .bp__info--ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .bp__info--ok mat-icon { color: #059669; }
    @media (max-width: 760px) { .bp__signature-noms, .bp__signature-zones { grid-template-columns: 1fr; } }
    .bp__commentaire { display: flex; gap: 10px; padding: 10px 14px; margin-bottom: 12px; border-radius: 10px; background: #ecfdf5;
      border: 1px solid #a7f3d0; font-size: 13px; color: #065f46; }
    .bp__commentaire mat-icon { font-size: 19px; width: 19px; height: 19px; flex-shrink: 0; }
    .bp__commentaire p { margin: 2px 0 0; color: #134e4a; white-space: pre-wrap; }
    .bp__entete { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    .bp__titre { display: flex; align-items: center; gap: 12px; }
    .bp__titre h2 { margin: 0; font-size: 20px; color: #0f172a; }
    .bp__titre p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
    .bp__pastille { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; }
    .bp__actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-left: auto; }
    .bp__statut { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; padding: 4px 10px; border-radius: 14px;
      background: #fef3c7; color: #92400e; }
    .bp__statut mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .bp__statut--valide { background: #d1fae5; color: #065f46; }
    .bp__statut--modifie { background: #dbeafe; color: #1e40af; }
    .bp__statut--neuf { background: #f1f5f9; color: #475569; }
    .bp__btn-actif { background: #eff6ff; }
    .bp__info { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 12px; border-radius: 8px;
      background: #f8fafc; border: 1px solid #e2e8f0; font-size: 13px; color: #475569; }
    .bp__info mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
    .bp__evolution { border: 1px solid #c7d2fe; background: #f5f7ff; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; }
    .bp__evolution h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 14px; color: #3730a3; }
    .bp__evolution-vide { margin: 0; font-size: 13px; color: #64748b; }
    .bp__evolution-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .bp__evolution-cols h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
    .bp__evolution-cols h4.plus { color: #047857; }
    .bp__evolution-cols h4.moins { color: #b91c1c; }
    .bp__evolution-cols p { margin: 2px 0; font-size: 12.5px; color: #334155; }
    .bp__outil { min-width: 0; }
    .bp__sugg { border: 1px solid #dbeafe; background: #f8fbff; border-radius: 12px; margin-bottom: 14px; }
    .bp__sugg-entete { display: flex; align-items: center; gap: 8px; width: 100%; border: none; background: none; cursor: pointer;
      padding: 10px 14px; font: inherit; font-size: 13px; color: #475569; text-align: left; flex-wrap: wrap; }
    .bp__sugg-entete strong { color: #1d4ed8; }
    .bp__sugg-entete mat-icon { color: #2563eb; font-size: 19px; width: 19px; height: 19px; }
    .bp__sugg-chevron { margin-left: auto; }
    .bp__sugg-tete { display: flex; align-items: center; gap: 8px; padding-right: 10px; }
    .bp__sugg-tete .bp__sugg-entete { flex: 1; min-width: 0; }
    .bp__ia { flex-shrink: 0; color: #6d28d9; }
    .bp__sugg-ia { margin-left: 6px; padding: 0 5px; border-radius: 6px; background: #ede9fe; color: #6d28d9; font-size: 9.5px; }
    .bp__sugg-grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; padding: 0 12px 12px;
      max-height: 300px; overflow: auto; }
    .bp__sugg-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; }
    .bp__sugg-zone { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #2563eb; }
    .bp__sugg-item p { margin: 3px 0 4px; font-size: 13px; color: #1e293b; flex: 1; }
    .bp__sugg-pied { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
    .bp__sugg-pied small { font-size: 11px; color: #94a3b8; margin-right: auto; }
  `],
})
export class BpTabComponent implements OnInit, OnChanges {
  @Input() clientId!: number;
  @Input() exerciceId: number | null | undefined = null;
  @Input() readonly = false;
  @Input() clientNom = '';
  /** Contact légal de la fiche identité, proposé comme signataire du rapport. */
  @Input() dirigeantNom = '';

  private service = inject(OutilsBpService);
  private toast = inject(ToastService);
  private tenant = inject(TenantService);
  private documents = inject(DocumentsService);
  private auth = inject(AuthService);

  readonly tableau = signal<TableauBp | null>(null);
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly actif = signal<OutilBpCode>('SWOT');
  readonly comparer = signal(false);
  readonly suggestionsOuvertes = signal(true);
  readonly enCours = signal(false);
  readonly suggestions = signal<SuggestionBp[]>([]);
  readonly profil = signal<ProfilAutoBp | null>(null);
  /** Outils modifiés depuis le dernier enregistrement. */
  readonly modifies = signal<Set<OutilBpCode>>(new Set());
  /** Copies de travail (l'outil affiché les modifie en place) ; `rev` signale chaque modification. */
  private copies = new Map<OutilBpCode, any>();
  private readonly rev = signal(0);

  readonly editable = computed(() => {
    const tb = this.tableau();
    return !this.readonly && !!tb && tb.droits.modifier && !tb.exercice.cloture;
  });
  readonly vueActive = computed(() => this.vue(this.actif())!);
  readonly infoActive = computed(() => infoOutil(this.actif()));
  /** Outils d'analyse validés (le questionnaire d'entretien n'en fait pas partie). */
  readonly nbValides = computed(() => (this.tableau()?.outils ?? []).filter(o => o.outil !== 'ENTRETIEN' && o.statut === 'VALIDE').length);
  readonly nbOutilsAnalyse = NB_OUTILS_ANALYSE;
  readonly validationOuverte = signal(false);
  commentaireValidation = '';
  readonly signatureOuverte = signal(false);
  readonly iaEnCours = signal(false);
  /** L'entretien est la source des suggestions : l'IA ne propose rien dedans. */
  readonly iaPossible = computed(() => this.actif() !== 'ENTRETIEN');
  readonly dernierRapport = signal<{ date: string; nom: string } | null>(null);
  signataireBp = '';
  signataireDirigeant = '';
  signatureBp = '';
  signatureDirigeant = '';
  readonly suggestionsActives = computed(() => {
    this.rev();
    const c = this.contenuActif();
    return this.suggestions().filter(s => s.outil === this.actif() && !suggestionTraitee(c, s));
  });
  readonly evolution = computed(() => {
    this.rev();
    const n1 = this.tableau()?.precedent?.outils[this.actif()];
    return evolutionN1(this.actif(), this.contenuActif(), n1?.contenu);
  });

  constructor() {
    // Le commentaire de validation en cours concerne l'outil affiché : changer d'outil l'abandonne.
    effect(() => { this.actif(); untracked(() => this.validationOuverte.set(false)); });
  }

  ngOnInit() { this.charger(); }

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['exerciceId'] ?? changes['clientId'];
    if (change && !change.firstChange) this.charger();
  }

  /** Contenu affiché : la copie de travail en édition, sinon le contenu chargé. */
  contenuActif(): any {
    const code = this.actif();
    if (!this.editable()) return this.vue(code)?.contenu;
    if (!this.copies.has(code)) this.copies.set(code, copie(this.vue(code)?.contenu));
    return this.copies.get(code);
  }

  etat(code: OutilBpCode): 'valide' | 'brouillon' | 'modifie' | 'vide' {
    if (this.modifies().has(code)) return 'modifie';
    const v = this.vue(code);
    return v?.statut === 'VALIDE' ? 'valide' : v?.origine === 'ENREGISTRE' ? 'brouillon' : 'vide';
  }

  libelleEtat(code: OutilBpCode): string {
    return { valide: 'Validé', brouillon: 'Brouillon', modifie: 'Modifications non enregistrées', vide: 'Pas encore enregistré' }[this.etat(code)];
  }

  libelleZone(s: SuggestionBp): string {
    if (s.outil === 'RISQUES' && s.risque) {
      const cat = CATEGORIES_RISQUE.find(c => c.code === s.risque!.categorie)?.label ?? s.risque.categorie;
      return `Risque ${cat.toLowerCase()} · P${s.risque.probabilite} × G${s.risque.gravite}`;
    }
    if (s.outil === 'BCG') return `Activité · ${QUADRANTS_BCG.find(q => q.code === s.zone)?.label ?? s.zone}`;
    const cle = s.zone.split(/[:.]/).pop()!;
    const lib = LIBELLES_ZONES[cle] ?? cle;
    return s.score ? `${lib} · note proposée ${s.score}/5` : lib;
  }

  modifie() {
    this.modifies.update(m => new Set(m).add(this.actif()));
    this.rev.update(v => v + 1);
  }

  ajouter(s: SuggestionBp) {
    this.copies.set(this.actif(), appliquerSuggestion(this.actif(), this.contenuActif(), s));
    this.modifie();
  }

  ecarter(s: SuggestionBp) {
    this.copies.set(this.actif(), ecarterSuggestion(this.contenuActif(), s));
    this.modifie();
  }

  /** Enregistre les outils modifiés, et l'outil affiché s'il vient d'être repris (N-1 ou anciens onglets). */
  enregistrer(apres?: () => void) {
    const codes = [...this.modifies()];
    const origine = this.vue(this.actif())?.origine;
    if ((origine === 'REPRISE_N1' || origine === 'REPRISE_ANCIENNE') && !codes.includes(this.actif())) codes.push(this.actif());
    if (!codes.length) { apres ? apres() : this.toast.info('Aucune modification à enregistrer'); return; }
    this.enCours.set(true);
    forkJoin(codes.map(code => this.service.enregistrer(this.clientId, this.exerciceId!, code, this.copies.get(code) ?? this.vue(code)!.contenu)))
      .subscribe({
        next: vues => {
          vues.forEach(v => this.remplacer(v));
          this.modifies.set(new Set());
          this.enCours.set(false);
          // Les réponses de l'entretien deviennent des suggestions dans les autres outils.
          if (codes.includes('ENTRETIEN')) this.rechargerSuggestions();
          if (apres) apres();
          else this.toast.success(codes.length > 1 ? `${codes.length} outils BP enregistrés` : `${infoOutil(codes[0]).label} enregistré`);
        },
        error: e => { this.enCours.set(false); this.toast.error(e?.error?.message ?? "Échec de l'enregistrement"); },
      });
  }

  /** Valide l'outil affiché (enregistré d'abord s'il a été modifié). */
  /** « Valider » ouvre la saisie du commentaire du BP ; la validation se confirme ensuite. */
  ouvrirValidation() {
    this.commentaireValidation = '';
    this.validationOuverte.set(true);
  }

  valider() {
    const code = this.actif();
    const commentaire = this.commentaireValidation.trim();
    const go = () => {
      this.enCours.set(true);
      this.service.valider(this.clientId, this.exerciceId!, code, commentaire).subscribe({
        next: v => {
          this.remplacer(v); this.enCours.set(false); this.validationOuverte.set(false);
          this.toast.success(`${infoOutil(code).label} validé`);
        },
        error: e => { this.enCours.set(false); this.toast.error(e?.error?.message ?? 'Validation impossible'); },
      });
    };
    if (this.modifies().size || this.vue(code)?.origine !== 'ENREGISTRE') {
      if (!this.modifies().has(code)) this.modifies.update(m => new Set(m).add(code));
      this.enregistrer(go);
    } else go();
  }

  ouvrirSignature() {
    const u = this.auth.currentUser();
    this.signataireBp = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
    this.signataireDirigeant = this.dirigeantNom ?? '';
    this.signatureBp = this.signatureDirigeant = '';
    this.signatureOuverte.set(true);
  }

  peutSigner(): boolean {
    return !this.enCours() && !this.modifies().size && !!this.signatureBp && !!this.signatureDirigeant
      && !!this.signataireBp.trim() && !!this.signataireDirigeant.trim();
  }

  /** Rapport complet co-signé : téléchargé et archivé dans les Documents du dossier (partie 5 du document). */
  signerEtArchiver() {
    const tb = this.tableau();
    if (!tb || !this.peutSigner()) return;
    const date = new Date().toISOString();
    const doc = construireRapportBp({
      client: this.clientNom || 'Dossier', cabinet: this.tenant.nomSociete(), annee: tb.exercice.annee, profil: this.profil(),
      outils: tb.outils,
      signatures: {
        date, bp: { nom: this.signataireBp.trim(), image: this.signatureBp }, dirigeant: { nom: this.signataireDirigeant.trim(), image: this.signatureDirigeant },
      },
    });
    const client = (this.clientNom || 'dossier').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-');
    const nom = `Rapport-BP-${tb.exercice.annee}-signe-${client}.pdf`;
    const fichier = new File([doc.output('blob')], nom, { type: 'application/pdf' });
    this.enCours.set(true);
    this.documents.upload(this.clientId, fichier, { typeDoc: 'AUTRE', periodeAnnee: tb.exercice.annee }).subscribe({
      next: () => {
        this.enCours.set(false);
        this.signatureOuverte.set(false);
        this.dernierRapport.set({ date, nom });
        doc.save(nom);
        this.toast.success('Rapport signé et archivé dans les Documents du dossier');
      },
      error: e => { this.enCours.set(false); this.toast.error(e?.error?.message ?? "Archivage du rapport impossible"); },
    });
  }

  proposerIa() {
    const outil = this.actif();
    this.iaEnCours.set(true);
    this.service.suggestionsIa(this.clientId, this.exerciceId!, outil).subscribe({
      next: r => {
        this.iaEnCours.set(false);
        const connues = new Set(this.suggestions().map(s => s.cle));
        const nouvelles = r.suggestions.filter(s => !connues.has(s.cle));
        this.suggestions.update(l => [...nouvelles, ...l]);
        this.suggestionsOuvertes.set(true);
        if (nouvelles.length) this.toast.success(`${nouvelles.length} suggestion${nouvelles.length > 1 ? 's' : ''} de l'IA`);
        else this.toast.info("L'IA n'a rien de nouveau à proposer pour cet outil");
      },
      error: e => { this.iaEnCours.set(false); this.toast.error(e?.error?.message ?? 'Suggestions IA indisponibles'); },
    });
  }

  /** Jours depuis le dernier enregistrement de l'outil (repris de N-1 : celui de N-1), -1 s'il n'a jamais été enregistré. */
  joursDepuisMaj(v: OutilBpVue | undefined): number {
    if (!v?.modifieLe || v.origine === 'VIDE' || v.origine === 'REPRISE_ANCIENNE') return -1;
    return Math.floor((Date.now() - new Date(v.modifieLe).getTime()) / 86_400_000);
  }

  exporterVierge() {
    exporterQuestionnaireVierge({ client: this.clientNom || 'Dossier', cabinet: this.tenant.nomSociete(), annee: this.tableau()?.exercice.annee });
  }

  exporter(mode: 'outil' | 'rapport') {
    const tb = this.tableau();
    if (!tb) return;
    if (this.modifies().size) this.toast.warning("Modifications non enregistrées : l'export reprend la dernière version enregistrée");
    exporterRapportBp({
      client: this.clientNom || 'Dossier', cabinet: this.tenant.nomSociete(), annee: tb.exercice.annee, profil: this.profil(),
      outils: mode === 'outil' ? [this.vue(this.actif())!] : tb.outils,
    });
  }

  // ── Interne ──

  private rechargerSuggestions() {
    if (!this.clientId || !this.exerciceId) return;
    this.service.suggestions(this.clientId, this.exerciceId).pipe(catchError(() => of(null))).subscribe(s => {
      if (!s) return;
      this.suggestions.set(s.suggestions);
      this.profil.set(s.profil);
    });
  }

  private vue(code: OutilBpCode): OutilBpVue | undefined {
    return this.tableau()?.outils.find(o => o.outil === code);
  }

  private remplacer(v: OutilBpVue) {
    this.tableau.update(tb => tb && { ...tb, outils: tb.outils.map(o => (o.outil === v.outil ? v : o)) });
    this.copies.delete(v.outil);
    this.rev.update(x => x + 1);
  }

  private charger() {
    this.copies.clear();
    this.modifies.set(new Set());
    this.erreur.set(null);
    if (!this.clientId || !this.exerciceId) { this.chargement.set(false); this.tableau.set(null); return; }
    this.chargement.set(true);
    // Les suggestions donnent aussi le profil auto (Persona) : leur échec ne bloque pas le tableau.
    forkJoin([
      this.service.tableau(this.clientId, this.exerciceId),
      this.service.suggestions(this.clientId, this.exerciceId).pipe(catchError(() => of({ suggestions: [], profil: null }))),
    ]).subscribe({
      next: ([tb, s]) => {
        this.tableau.set(tb);
        this.suggestions.set(s.suggestions);
        this.profil.set(s.profil);
        this.chargement.set(false);
      },
      error: e => { this.chargement.set(false); this.erreur.set(e?.error?.message ?? 'Impossible de charger le tableau de bord BP'); },
    });
  }
}
