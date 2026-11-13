import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BpListeComponent } from './bp-liste.component';

/** SWOT — 4 quadrants pastel, comme StratPilote (thème « Pastel »). */
@Component({
  selector: 'app-bp-swot',
  standalone: true,
  imports: [MatIconModule, BpListeComponent],
  template: `
<div class="swot">
  @for (q of quadrants; track q.zone) {
    <section class="swot__q" [style.--q]="q.couleur" [style.--q-fond]="q.fond" [attr.data-zone]="q.zone">
      <h3 class="swot__titre"><mat-icon>{{ q.icon }}</mat-icon>{{ q.label }}</h3>
      <p class="swot__aide">{{ q.aide }}</p>
      <app-bp-liste [items]="contenu[q.zone]" [editable]="editable" [placeholder]="q.placeholder"
                    vide="Rien de noté" (changement)="contenuChange.emit(contenu)" />
    </section>
  }
</div>
  `,
  styles: [`
    .swot { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    @media (max-width: 760px) { .swot { grid-template-columns: 1fr; } }
    .swot__q { background: var(--q-fond); border-radius: 14px; padding: 18px 20px 20px; min-height: 220px; --bl-accent: var(--q); }
    .swot__titre { display: flex; align-items: center; gap: 8px; margin: 0; padding-bottom: 10px; font-size: 16px; font-weight: 700;
      color: var(--q); border-bottom: 3px solid var(--q); }
    .swot__titre mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .swot__aide { margin: 10px 0 8px; font-size: 12px; color: #64748b; }
  `],
})
export class BpSwotComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();

  readonly quadrants = [
    { zone: 'forces', label: 'Forces', icon: 'shield', couleur: '#10b981', fond: '#e7f8f1',
      aide: 'Avantages compétitifs, ressources uniques, compétences clés', placeholder: 'Une force interne…' },
    { zone: 'faiblesses', label: 'Faiblesses', icon: 'warning_amber', couleur: '#ef4444', fond: '#fde8e8',
      aide: 'Points à améliorer, ressources manquantes, vulnérabilités', placeholder: 'Une faiblesse interne…' },
    { zone: 'opportunites', label: 'Opportunités', icon: 'track_changes', couleur: '#3b82f6', fond: '#e6effd',
      aide: 'Tendances du marché, besoins non couverts, innovations', placeholder: 'Une opportunité externe…' },
    { zone: 'menaces', label: 'Menaces', icon: 'error_outline', couleur: '#f59e0b', fond: '#fdf2e1',
      aide: 'Concurrence, risques externes, obstacles', placeholder: 'Une menace externe…' },
  ];
}
