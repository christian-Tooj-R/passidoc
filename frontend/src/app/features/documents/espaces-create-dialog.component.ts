import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-espaces-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  styles: [`
    :host { display: block; }

    .dlg-preview {
      display: flex; align-items: center; gap: 14px;
      padding: 22px 24px;
      transition: background .3s;
    }
    .dlg-avatar {
      width: 46px; height: 46px; border-radius: 13px; flex-shrink: 0;
      background: rgba(255,255,255,.25); border: 1.5px solid rgba(255,255,255,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 800; color: white;
      text-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .dlg-preview-nom {
      font-size: 15px; font-weight: 700; color: white;
      text-shadow: 0 1px 3px rgba(0,0,0,.15);
    }
    .dlg-preview-sub { font-size: 11px; color: rgba(255,255,255,.65); margin-top: 3px; }

    .dlg-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 6px; }

    .dlg-label {
      font-size: 11.5px; font-weight: 700; color: #64748B;
      text-transform: uppercase; letter-spacing: .6px;
      display: block; margin-bottom: 6px;
    }

    .dlg-input {
      width: 100%; box-sizing: border-box;
      border: 1.5px solid #E2E8F0; border-radius: 10px;
      padding: 11px 14px; font-size: 14px; font-family: inherit;
      outline: none; color: #0F172A; background: white;
      transition: border-color .15s, box-shadow .15s;
      margin-bottom: 16px;
    }
    .dlg-input:focus { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
    .dlg-input::placeholder { color: #94A3B8; }

    .dlg-palette { display: flex; flex-wrap: wrap; gap: 7px; }
    .dlg-swatch {
      width: 32px; height: 32px; border-radius: 9px;
      border: 2.5px solid transparent; cursor: pointer; padding: 0;
      transition: transform .12s, border-color .12s;
    }
    .dlg-swatch:hover { transform: scale(1.15); }
    .dlg-swatch--active { border-color: #0F172A; transform: scale(1.1); }

    .dlg-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid #F1F5F9;
    }
    .dlg-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 18px; border-radius: 10px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; font-family: inherit;
      transition: background .15s, box-shadow .15s, transform .12s;
    }
    .dlg-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .dlg-btn--cancel { background: #F1F5F9; color: #64748B; }
    .dlg-btn--cancel:hover { background: #E2E8F0; }
    .dlg-btn--ok {
      background: linear-gradient(135deg, #4527A0 0%, #7E57C2 100%);
      color: white; box-shadow: 0 4px 14px rgba(99,102,241,.28);
    }
    .dlg-btn--ok:hover:not(:disabled) {
      box-shadow: 0 6px 20px rgba(99,102,241,.38); transform: translateY(-1px);
    }
    .dlg-btn--ok:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }
  `],
  template: `
    <!-- Aperçu en-tête dynamique -->
    <div class="dlg-preview" [style.background]="couleur">
      <div class="dlg-avatar">{{ initiales() }}</div>
      <div>
        <div class="dlg-preview-nom">{{ nom.trim() || "Nom de l'espace" }}</div>
        <div class="dlg-preview-sub">Aperçu en temps réel</div>
      </div>
    </div>

    <!-- Corps -->
    <div class="dlg-body">
      <label class="dlg-label">Nom de l'espace</label>
      <input class="dlg-input"
             type="text"
             placeholder="Ex : Contrats clients, Factures…"
             [(ngModel)]="nom"
             (keyup.enter)="confirmer()"
             (keyup.escape)="annuler()"
             autofocus />

      <label class="dlg-label">Couleur</label>
      <div class="dlg-palette">
        @for (p of PALETTES; track p.val) {
          <button class="dlg-swatch"
                  [class.dlg-swatch--active]="couleur === p.val"
                  [style.background]="p.val"
                  [title]="p.label"
                  (click)="couleur = p.val">
          </button>
        }
      </div>
    </div>

    <!-- Footer -->
    <div class="dlg-footer">
      <button class="dlg-btn dlg-btn--cancel" (click)="annuler()">Annuler</button>
      <button class="dlg-btn dlg-btn--ok" [disabled]="!nom.trim()" (click)="confirmer()">
        <mat-icon>add</mat-icon>
        Créer l'espace
      </button>
    </div>
  `,
})
export class EspacesCreateDialogComponent {
  nom    = '';
  couleur = 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'; // noir par défaut

  readonly PALETTES = [
    { label: 'Noir',    val: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' },
    { label: 'Océan',   val: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)' },
    { label: 'Violet',  val: 'linear-gradient(135deg, #6A1B9A 0%, #AB47BC 100%)' },
    { label: 'Teal',    val: 'linear-gradient(135deg, #00695C 0%, #26A69A 100%)' },
    { label: 'Ambre',   val: 'linear-gradient(135deg, #E65100 0%, #FFA726 100%)' },
    { label: 'Forêt',   val: 'linear-gradient(135deg, #1B5E20 0%, #66BB6A 100%)' },
    { label: 'Rose',    val: 'linear-gradient(135deg, #880E4F 0%, #EC407A 100%)' },
    { label: 'Rouge',   val: 'linear-gradient(135deg, #B71C1C 0%, #EF5350 100%)' },
    { label: 'Indigo',  val: 'linear-gradient(135deg, #4527A0 0%, #7E57C2 100%)' },
    { label: 'Ardoise', val: 'linear-gradient(135deg, #455A64 0%, #90A4AE 100%)' },
    { label: 'Lime',    val: 'linear-gradient(135deg, #558B2F 0%, #AED581 100%)' },
    { label: 'Corail',  val: 'linear-gradient(135deg, #BF360C 0%, #FF8A65 100%)' },
    { label: 'Marine',  val: 'linear-gradient(135deg, #006064 0%, #26C6DA 100%)' },
  ];

  constructor(private ref: MatDialogRef<EspacesCreateDialogComponent>) {}

  initiales() {
    return this.nom.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
  }

  confirmer() {
    if (!this.nom.trim()) return;
    this.ref.close({ nom: this.nom.trim(), couleur: this.couleur });
  }

  annuler() { this.ref.close(null); }
}
