import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { ItemBp, nouvelId } from '../../../../../core/models/outils-bp.model';

/**
 * Liste d'éléments d'un outil BP (quadrant SWOT, colonne PESTEL, bloc BMC…), comme les cartes
 * de StratPilote : modification en place, suppression, « + Ajouter » en pointillés.
 * Les éléments venus d'une suggestion portent le badge PASSIDOC.
 * Modifie le tableau reçu en place, puis émet `changement`.
 */
@Component({
  selector: 'app-bp-liste',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, TextFieldModule],
  template: `
<ul class="bl" [class.bl--cartes]="variante === 'cartes'">
  @for (item of items; track item.id) {
    <li class="bl__item">
      @if (editable) {
        <textarea class="bl__input" cdkTextareaAutosize cdkAutosizeMinRows="1" [(ngModel)]="item.texte" (ngModelChange)="changement.emit()"
                  (blur)="nettoyer()" [attr.aria-label]="'Élément ' + ($index + 1)"></textarea>
        <button type="button" class="bl__suppr" (click)="supprimer($index)" matTooltip="Supprimer" aria-label="Supprimer">
          <mat-icon>close</mat-icon>
        </button>
      } @else {
        <span class="bl__texte">{{ item.texte }}</span>
      }
      @if (item.cle) { <span class="bl__badge" matTooltip="Suggestion tirée des données du dossier">PASSIDOC</span> }
    </li>
  } @empty {
    @if (!editable) { <li class="bl__vide">{{ vide }}</li> }
  }
</ul>
@if (editable) {
  @if (saisie !== null) {
    <textarea #champ class="bl__input bl__input--nouveau" cdkTextareaAutosize cdkAutosizeMinRows="2" [(ngModel)]="saisie" [placeholder]="placeholder"
              (keydown.enter)="$event.preventDefault(); valider()" (keydown.escape)="saisie = null" (blur)="valider()"></textarea>
  } @else {
    <button type="button" class="bl__ajouter" (click)="ouvrir()">+ Ajouter</button>
  }
}
  `,
  styles: [`
    :host { display: block; }
    .bl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .bl__item { position: relative; display: flex; align-items: flex-start; gap: 4px; font-size: 13.5px; line-height: 1.45;
      color: var(--bl-texte, #475569); }
    .bl--cartes .bl__item { background: var(--bl-carte, rgba(255,255,255,.18)); border: 1px solid var(--bl-bord, rgba(255,255,255,.3));
      border-radius: 6px; padding: 8px 10px; color: var(--bl-texte, #fff); }
    .bl__texte { flex: 1; white-space: pre-wrap; word-break: break-word; }
    .bl__input { flex: 1; resize: none; overflow: hidden; min-height: 22px; border: 1px solid transparent; border-radius: 4px; background: transparent;
      font: inherit; color: inherit; padding: 2px 4px; }
    .bl__input:hover { border-color: var(--bl-bord, #cbd5e1); }
    .bl__input:focus { outline: none; border-color: var(--bl-accent, #3b82f6); background: var(--bl-focus, rgba(255,255,255,.7)); color: #1e293b; }
    .bl__input--nouveau { width: 100%; box-sizing: border-box; border-color: var(--bl-accent, #3b82f6); background: rgba(255,255,255,.85); color: #1e293b; margin-top: 4px; }
    .bl__suppr { border: none; background: none; cursor: pointer; padding: 2px; color: inherit; opacity: .45; line-height: 0; }
    .bl__suppr:hover { opacity: 1; }
    .bl__suppr mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .bl__badge { font-size: 9px; font-weight: 700; letter-spacing: .04em; padding: 1px 5px; border-radius: 8px; align-self: center;
      background: rgba(37,99,235,.12); color: #1d4ed8; white-space: nowrap; }
    .bl--cartes .bl__badge { background: rgba(255,255,255,.3); color: #fff; }
    .bl__vide { font-size: 12.5px; font-style: italic; opacity: .55; }
    .bl__ajouter { width: 100%; margin-top: 8px; padding: 7px; border: 1.5px dashed var(--bl-bord, #cbd5e1); border-radius: 6px;
      background: transparent; color: inherit; font: inherit; font-size: 12.5px; cursor: pointer; opacity: .8; }
    .bl__ajouter:hover { opacity: 1; border-color: var(--bl-accent, #3b82f6); }
  `],
})
export class BpListeComponent {
  @Input({ required: true }) items: ItemBp[] = [];
  @Input() editable = false;
  @Input() variante: 'texte' | 'cartes' = 'texte';
  @Input() placeholder = 'Nouvel élément…';
  @Input() vide = 'Aucun élément';
  @Output() changement = new EventEmitter<void>();
  @ViewChild('champ') champ?: ElementRef<HTMLTextAreaElement>;

  saisie: string | null = null;

  ouvrir() {
    this.saisie = '';
    setTimeout(() => this.champ?.nativeElement.focus());
  }

  valider() {
    const texte = (this.saisie ?? '').trim();
    this.saisie = null;
    if (!texte) return;
    this.items.push({ id: nouvelId(), texte });
    this.changement.emit();
  }

  supprimer(i: number) {
    this.items.splice(i, 1);
    this.changement.emit();
  }

  /** Un élément vidé à la main disparaît en quittant le champ. */
  nettoyer() {
    const avant = this.items.length;
    for (let i = this.items.length - 1; i >= 0; i--) if (!this.items[i].texte.trim()) this.items.splice(i, 1);
    if (this.items.length !== avant) this.changement.emit();
  }
}
