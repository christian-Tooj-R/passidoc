import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../../../core/services/toast.service';
import { environment } from '../../../../../../environments/environment';

interface CanvasData {
  id?: number;
  clientId?: number;
  partenairesClés: string;
  activitesClés: string;
  ressourcesClés: string;
  propositionValeur: string;
  relationClient: string;
  canaux: string;
  segmentsClients: string;
  structureCouts: string;
  sourcesRevenus: string;
}

interface CanvasBox {
  key: keyof Omit<CanvasData, 'id' | 'clientId'>;
  label: string;
  icon: string;
  color: string;
  description: string;
  gridArea: string;
}

@Component({
  selector: 'app-canvas-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
<div class="cv-wrap">
  <div class="cv-header">
    <div class="cv-header__left">
      <mat-icon class="cv-header__icon">grid_view</mat-icon>
      <div>
        <h2 class="cv-header__title">Modèle Canvas</h2>
        <p class="cv-header__sub">Business Model Canvas — client {{ clientId }}</p>
      </div>
    </div>
    <div class="cv-header__actions">
      <button mat-stroked-button (click)="save()" [disabled]="saving" class="cv-save-btn">
        <mat-icon>save</mat-icon> {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
      </button>
      <button mat-icon-button (click)="copyAll()" matTooltip="Copier tout le canvas">
        <mat-icon>content_copy</mat-icon>
      </button>
    </div>
  </div>

  @if (loading) {
    <div class="cv-loading">Chargement...</div>
  } @else {
    <div class="cv-grid">
      @for (box of boxes; track box.key) {
        <div class="cv-box" [style.--box-color]="box.color" [style.grid-area]="box.gridArea">
          <div class="cv-box__head">
            <mat-icon [style.color]="box.color">{{ box.icon }}</mat-icon>
            <span class="cv-box__label">{{ box.label }}</span>
          </div>
          <p class="cv-box__desc">{{ box.description }}</p>
          <textarea
            class="cv-box__textarea"
            [(ngModel)]="data[box.key]"
            [placeholder]="'Saisir ' + box.label.toLowerCase() + '...'"
            rows="4">
          </textarea>
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .cv-wrap { padding: 24px; }

    .cv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .cv-header__left { display: flex; align-items: center; gap: 14px; }
    .cv-header__icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .cv-header__title { margin: 0; font-size: 1.3rem; font-weight: 600; }
    .cv-header__sub { margin: 4px 0 0; color: #888; font-size: 0.85rem; }
    .cv-header__actions { display: flex; align-items: center; gap: 8px; }
    .cv-save-btn { height: 36px; font-size: 0.85rem; }

    .cv-loading { padding: 40px; text-align: center; color: #94a3b8; }

    .cv-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: auto auto;
      gap: 12px;
      grid-template-areas:
        "partenaires activites proposition relation segments"
        "ressources  activites proposition canaux    segments"
        "couts       couts     couts       revenus   revenus";
    }

    .cv-box {
      background: var(--cv-bg, #fff);
      border: 1.5px solid var(--box-color, #e5e7eb);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-top: 4px solid var(--box-color, #6366f1);
    }
    :host-context([data-theme="dark"]) .cv-box { --cv-bg: #1e2130; }

    .cv-box__head { display: flex; align-items: center; gap: 8px; }
    .cv-box__head mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .cv-box__label { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .cv-box__desc { font-size: 0.72rem; color: #94a3b8; margin: 0; font-style: italic; line-height: 1.4; }
    .cv-box__textarea {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 8px; font-size: 0.8rem; font-family: inherit;
      resize: vertical; background: transparent; color: inherit;
      box-sizing: border-box; flex: 1; min-height: 80px;
    }
    .cv-box__textarea:focus { outline: none; border-color: var(--box-color, #6366f1); }

    @media (max-width: 1024px) {
      .cv-grid {
        grid-template-columns: 1fr 1fr;
        grid-template-areas: none;
      }
      .cv-box { grid-area: auto !important; }
    }
  `],
})
export class CanvasTabComponent implements OnInit {
  @Input() clientId!: number;

  private http  = inject(HttpClient);
  private toast = inject(ToastService);

  loading = false;
  saving  = false;

  data: CanvasData = {
    partenairesClés: '', activitesClés: '', ressourcesClés: '',
    propositionValeur: '', relationClient: '', canaux: '',
    segmentsClients: '', structureCouts: '', sourcesRevenus: '',
  };

  readonly boxes: CanvasBox[] = [
    { key: 'partenairesClés',  label: 'Partenaires clés',     icon: 'handshake',       color: '#8b5cf6', gridArea: 'partenaires', description: 'Qui sont vos partenaires stratégiques ?' },
    { key: 'activitesClés',    label: 'Activités clés',        icon: 'construction',    color: '#3b82f6', gridArea: 'activites',   description: 'Quelles activités sont indispensables ?' },
    { key: 'ressourcesClés',   label: 'Ressources clés',       icon: 'inventory_2',     color: '#06b6d4', gridArea: 'ressources',  description: 'Quelles ressources sont nécessaires ?' },
    { key: 'propositionValeur',label: 'Proposition de valeur', icon: 'star',            color: '#f59e0b', gridArea: 'proposition', description: 'Quelle valeur créez-vous pour le client ?' },
    { key: 'relationClient',   label: 'Relation client',       icon: 'favorite',        color: '#ef4444', gridArea: 'relation',    description: 'Comment gérez-vous la relation ?' },
    { key: 'canaux',           label: 'Canaux',                icon: 'alt_route',       color: '#10b981', gridArea: 'canaux',      description: 'Comment atteignez-vous vos clients ?' },
    { key: 'segmentsClients',  label: 'Segments clients',      icon: 'people',          color: '#f97316', gridArea: 'segments',    description: 'Pour qui créez-vous de la valeur ?' },
    { key: 'structureCouts',   label: 'Structure des coûts',   icon: 'trending_down',   color: '#64748b', gridArea: 'couts',       description: 'Quels sont les coûts importants ?' },
    { key: 'sourcesRevenus',   label: 'Sources de revenus',    icon: 'attach_money',    color: '#22c55e', gridArea: 'revenus',     description: 'Comment générez-vous des revenus ?' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<CanvasData>(`${environment.apiUrl}/clients/${this.clientId}/canvas`).subscribe({
      next: (d) => { this.data = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  save() {
    this.saving = true;
    this.http.patch(`${environment.apiUrl}/clients/${this.clientId}/canvas`, this.data).subscribe({
      next: () => { this.toast.success('Canvas enregistré'); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  copyAll() {
    const lines = this.boxes.map(b => `${b.label.toUpperCase()}\n${this.data[b.key] || '(vide)'}`);
    navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
      this.toast.success('Canvas copié dans le presse-papiers');
    });
  }
}
