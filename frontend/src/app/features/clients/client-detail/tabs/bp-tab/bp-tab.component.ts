import {
  Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CATEGORIES_RISQUE, LIBELLES_ZONES, OutilBpCode, OutilBpVue, ProfilAutoBp, SuggestionBp, TableauBp,
  appliquerSuggestion, ecarterSuggestion, evolutionN1, infoOutil, suggestionTraitee,
} from '../../../../../core/models/outils-bp.model';
import { OutilsBpService } from '../../../../../core/services/outils-bp.service';
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
import { exporterRapportBp } from './bp.export';

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
    DatePipe, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule,
    BpSwotComponent, BpPorterComponent, BpBmcComponent, BpPestelComponent, BpChaineValeurComponent,
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
        </mat-menu>
        @if (editable() && tb.droits.valider) {
          <button mat-stroked-button type="button" class="bp__valider" (click)="valider()" [disabled]="enCours() || (vue.statut === 'VALIDE' && !modifies().has(actif()))"
                  matTooltip="Valider et publier cet outil (profils BP+)">
            <mat-icon>verified</mat-icon>Valider
          </button>
        }
        @if (editable()) {
          <button mat-flat-button color="primary" type="button" class="bp__enregistrer" (click)="enregistrer()" [disabled]="enCours()">
            <mat-icon>save</mat-icon>Enregistrer
          </button>
        }
      </div>
    </header>

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

    @if (editable() && suggestionsActives().length) {
      <section class="bp__sugg" aria-label="Suggestions PASSIDOC">
        <button type="button" class="bp__sugg-entete" (click)="suggestionsOuvertes.set(!suggestionsOuvertes())"
                [attr.aria-expanded]="suggestionsOuvertes()">
          <mat-icon>auto_awesome</mat-icon>
          <strong>{{ suggestionsActives().length }} suggestion{{ suggestionsActives().length > 1 ? 's' : '' }} PASSIDOC</strong>
          <span>tirées des données du dossier : ajoutez-les ou écartez-les</span>
          <mat-icon class="bp__sugg-chevron">{{ suggestionsOuvertes() ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        @if (suggestionsOuvertes()) {
          <div class="bp__sugg-grille">
            @for (s of suggestionsActives(); track s.cle) {
              <div class="bp__sugg-item">
                <span class="bp__sugg-zone">{{ libelleZone(s) }}</span>
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

  private service = inject(OutilsBpService);
  private toast = inject(ToastService);
  private tenant = inject(TenantService);

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
  readonly nbValides = computed(() => (this.tableau()?.outils ?? []).filter(o => o.statut === 'VALIDE').length);
  readonly suggestionsActives = computed(() => {
    this.rev();
    const c = this.contenuActif();
    return this.suggestions().filter(s => s.outil === this.actif() && s.outil !== 'BCG' && !suggestionTraitee(c, s));
  });
  readonly evolution = computed(() => {
    this.rev();
    const n1 = this.tableau()?.precedent?.outils[this.actif()];
    return evolutionN1(this.actif(), this.contenuActif(), n1?.contenu);
  });

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
          if (apres) apres();
          else this.toast.success(codes.length > 1 ? `${codes.length} outils BP enregistrés` : `${infoOutil(codes[0]).label} enregistré`);
        },
        error: e => { this.enCours.set(false); this.toast.error(e?.error?.message ?? "Échec de l'enregistrement"); },
      });
  }

  /** Valide l'outil affiché (enregistré d'abord s'il a été modifié). */
  valider() {
    const code = this.actif();
    const go = () => {
      this.enCours.set(true);
      this.service.valider(this.clientId, this.exerciceId!, code).subscribe({
        next: v => { this.remplacer(v); this.enCours.set(false); this.toast.success(`${infoOutil(code).label} validé`); },
        error: e => { this.enCours.set(false); this.toast.error(e?.error?.message ?? 'Validation impossible'); },
      });
    };
    if (this.modifies().size || this.vue(code)?.origine !== 'ENREGISTRE') {
      if (!this.modifies().has(code)) this.modifies.update(m => new Set(m).add(code));
      this.enregistrer(go);
    } else go();
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
