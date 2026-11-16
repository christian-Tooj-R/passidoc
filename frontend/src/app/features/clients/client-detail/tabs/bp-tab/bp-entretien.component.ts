import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { NOTES_ENTRETIEN, QUESTIONS_ENTRETIEN, THEMES_ENTRETIEN, destinationQuestion } from '../../../../../core/models/outils-bp.model';

/**
 * Questionnaire d'entretien BP standard (document client, partie 5) : saisie en direct pendant la
 * revue stratégique annuelle, sur ordinateur ou tablette. Chaque réponse alimente un outil sous forme
 * de suggestions PASSIDOC (une ligne = une suggestion).
 */
@Component({
  selector: 'app-bp-entretien',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, TextFieldModule],
  template: `
<div class="en">
  <section class="en__entete">
    <label class="en__champ">Date de l'entretien
      @if (editable) {
        <input type="date" class="en__date" [(ngModel)]="contenu.date" (ngModelChange)="emettre()">
      } @else { <span class="en__valeur">{{ dateFr(contenu.date) }}</span> }
    </label>
    <label class="en__champ en__champ--large">Participants
      @if (editable) {
        <input type="text" class="en__participants" maxlength="300" [(ngModel)]="contenu.participants" (ngModelChange)="emettre()"
               placeholder="Ex. : M. Hoarau (gérant), Marie Dubois (collaboratrice BP)">
      } @else { <span class="en__valeur">{{ contenu.participants || '—' }}</span> }
    </label>
    <div class="en__avancement">
      <span class="en__avancement-val">{{ nbRenseignees }} / {{ total }}</span>
      <span class="en__avancement-lib">questions renseignées</span>
      <div class="en__jauge"><i [style.width.%]="nbRenseignees / total * 100"></i></div>
    </div>
  </section>

  @if (editable) {
    <p class="en__astuce"><mat-icon>tips_and_updates</mat-icon>
      Une ligne = une idée. Après enregistrement, chaque ligne devient une suggestion PASSIDOC dans l'outil indiqué à droite de la question.</p>
  }

  @for (th of themes; track th.code; let i = $index) {
    <section class="en__theme" [attr.data-theme]="th.code" [style.--t]="th.couleur">
      <header class="en__theme-tete">
        <span class="en__num">{{ i + 1 }}</span>
        <div>
          <h3>{{ th.label }}</h3>
          <p>{{ th.aide }}</p>
        </div>
        <mat-icon class="en__theme-icone">{{ th.icon }}</mat-icon>
      </header>
      @for (n of notesDe(th.code); track n.cle) {
        <div class="en__note" [attr.data-note]="n.cle">
          <span class="en__libelle">{{ n.label }}</span>
          <div class="en__echelle" role="group" [attr.aria-label]="n.label">
            @for (v of [1, 2, 3, 4, 5]; track v) {
              @if (editable) {
                <button type="button" [class.on]="contenu.notes[n.cle] === v" [attr.aria-pressed]="contenu.notes[n.cle] === v"
                        (click)="noter(n.cle, v)">{{ v }}</button>
              } @else { <span [class.on]="contenu.notes[n.cle] === v">{{ v }}</span> }
            }
          </div>
          @if (n.vers) { <span class="en__vers"><mat-icon>east</mat-icon>{{ destination(n.vers) }}</span> }
        </div>
      }
      @for (q of questionsDe(th.code); track q.cle) {
        <div class="en__q" [attr.data-question]="q.cle">
          <div class="en__q-tete">
            <label class="en__libelle" [attr.for]="'en-' + q.cle">{{ q.question }}</label>
            @if (q.vers) { <span class="en__vers" matTooltip="Outil alimenté par cette réponse"><mat-icon>east</mat-icon>{{ destination(q.vers) }}</span> }
          </div>
          @if (editable) {
            <textarea [id]="'en-' + q.cle" class="en__reponse-champ" cdkTextareaAutosize cdkAutosizeMinRows="2" maxlength="3000"
                      [(ngModel)]="contenu.reponses[q.cle]" (ngModelChange)="emettre()"></textarea>
          } @else {
            <p class="en__reponse" [class.en__reponse--vide]="!contenu.reponses[q.cle]">{{ contenu.reponses[q.cle] || 'Sans réponse' }}</p>
          }
        </div>
      }
    </section>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .en { display: flex; flex-direction: column; gap: 16px; }
    .en__entete { display: grid; grid-template-columns: 200px minmax(0, 1fr) 220px; gap: 16px; align-items: end;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; }
    .en__champ { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #475569; }
    .en__champ input { font: inherit; font-size: 14px; font-weight: 400; color: #0f172a; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .en__champ input:focus { outline: none; border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15,118,110,.12); }
    .en__valeur { font-size: 14px; font-weight: 400; color: #0f172a; padding: 8px 0; }
    .en__avancement { display: flex; flex-direction: column; gap: 2px; }
    .en__avancement-val { font-size: 22px; font-weight: 800; color: #0f766e; line-height: 1; }
    .en__avancement-lib { font-size: 12px; color: #64748b; }
    .en__jauge { height: 5px; border-radius: 3px; background: #e2e8f0; overflow: hidden; margin-top: 4px; }
    .en__jauge i { display: block; height: 100%; background: #0f766e; transition: width .3s; }
    .en__astuce { display: flex; align-items: center; gap: 8px; margin: 0; padding: 9px 14px; border-radius: 10px;
      background: #f0fdfa; border: 1px solid #ccfbf1; font-size: 13px; color: #115e59; }
    .en__astuce mat-icon { font-size: 19px; width: 19px; height: 19px; color: #0d9488; }
    .en__theme { background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid var(--t); border-radius: 14px; padding: 16px 20px 18px; }
    .en__theme-tete { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .en__theme-tete h3 { margin: 0; font-size: 16px; color: #0f172a; }
    .en__theme-tete p { margin: 2px 0 0; font-size: 12.5px; color: #64748b; }
    .en__num { width: 30px; height: 30px; border-radius: 50%; background: var(--t); color: #fff; font-weight: 800;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .en__theme-icone { margin-left: auto; color: var(--t); opacity: .5; }
    .en__q, .en__note { padding: 10px 0; border-top: 1px solid #f1f5f9; }
    .en__q-tete { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
    .en__libelle { flex: 1; font-size: 13.5px; font-weight: 600; color: #1e293b; }
    .en__vers { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; font-size: 11px; font-weight: 600; color: #64748b;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 2px 8px; white-space: nowrap; }
    .en__vers mat-icon { font-size: 13px; width: 13px; height: 13px; }
    /* content-box : l'agrandissement automatique (cdkTextareaAutosize) compte le texte sans le padding */
    .en__reponse-champ { width: calc(100% - 22px); box-sizing: content-box; resize: none; overflow: hidden; font: inherit; font-size: 13.5px; line-height: 1.5;
      color: #0f172a; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fcfdfe; }
    .en__reponse-champ:focus { outline: none; border-color: var(--t); box-shadow: 0 0 0 3px color-mix(in srgb, var(--t) 15%, transparent); background: #fff; }
    .en__reponse { margin: 0; font-size: 13.5px; line-height: 1.5; color: #334155; white-space: pre-wrap; }
    .en__reponse--vide { color: #94a3b8; font-style: italic; }
    .en__note { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .en__note .en__libelle { flex: 0 1 auto; }
    .en__echelle { display: flex; gap: 6px; }
    .en__echelle button, .en__echelle span { width: 38px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff;
      font: inherit; font-weight: 700; color: #475569; display: flex; align-items: center; justify-content: center; }
    .en__echelle button { cursor: pointer; }
    .en__echelle .on { background: var(--t); border-color: var(--t); color: #fff; }
    @media (max-width: 900px) { .en__entete { grid-template-columns: 1fr 1fr; } .en__champ--large { grid-column: 1 / -1; order: 3; } }
  `],
})
export class BpEntretienComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();

  get themes() { return THEMES_ENTRETIEN; }
  get total() { return QUESTIONS_ENTRETIEN.length + NOTES_ENTRETIEN.length; }
  get nbRenseignees() {
    return QUESTIONS_ENTRETIEN.filter(q => (this.contenu.reponses?.[q.cle] ?? '').trim()).length
      + NOTES_ENTRETIEN.filter(n => this.contenu.notes?.[n.cle]).length;
  }

  questionsDe(theme: string) { return QUESTIONS_ENTRETIEN.filter(q => q.theme === theme); }
  notesDe(theme: string) { return NOTES_ENTRETIEN.filter(n => n.theme === theme); }
  destination(vers: any) { return destinationQuestion(vers); }
  dateFr(d: string) { return /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d.split('-').reverse().join('/') : '—'; }

  /** Un clic sur la note déjà choisie la retire. */
  noter(cle: string, v: number) {
    this.contenu.notes[cle] = this.contenu.notes[cle] === v ? 0 : v;
    this.emettre();
  }

  emettre() { this.contenuChange.emit(this.contenu); }
}
