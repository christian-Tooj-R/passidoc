import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BpListeComponent } from './bp-liste.component';

/** PESTEL — bandeau des 6 lettres et 6 colonnes en dégradé, comme StratPilote. */
@Component({
  selector: 'app-bp-pestel',
  standalone: true,
  imports: [MatIconModule, BpListeComponent],
  template: `
<div class="pestel">
  @for (c of colonnes; track c.zone) {
    <div class="pestel__lettre" [style.background]="c.couleur">{{ c.lettre }}</div>
  }
  @for (c of colonnes; track c.zone) {
    <section class="pestel__col" [style.background]="'linear-gradient(180deg, ' + c.couleur + ' 0%, ' + c.clair + ' 100%)'">
      <h3 class="pestel__titre"><mat-icon>{{ c.icon }}</mat-icon>{{ c.label }}</h3>
      <app-bp-liste [items]="contenu[c.zone]" [editable]="editable" variante="cartes" [placeholder]="c.placeholder"
                    vide="Rien de noté" (changement)="contenuChange.emit(contenu)" />
    </section>
  }
</div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .pestel { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
    .pestel__lettre { border-radius: 12px; height: 56px; display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 24px; font-weight: 800; }
    .pestel__col { border-radius: 14px; padding: 16px 14px; min-height: 380px; color: #fff;
      --bl-texte: #fff; --bl-bord: rgba(255,255,255,.45); --bl-accent: #fff; }
    .pestel__titre { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; padding-bottom: 10px; font-size: 13px; font-weight: 800;
      border-bottom: 1px solid rgba(255,255,255,.35); color: #fff;
      min-width: 0; }
    .pestel__titre mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; color: #fff; }
    /* Après les règles de base : onglet étroit (fiche client) → 3 colonnes sur 2 rangées, sans le bandeau de lettres. */
    @container (max-width: 960px) {
      .pestel { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .pestel__lettre { display: none; }
      .pestel__col { min-height: 220px; }
    }
    @container (max-width: 520px) { .pestel { grid-template-columns: 1fr; } }
  `],
})
export class BpPestelComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();

  readonly colonnes = [
    { zone: 'politique', lettre: 'P', label: 'Politique', icon: 'account_balance', couleur: '#dc2626', clair: '#fca5a5', placeholder: 'Stabilité, politiques sectorielles…' },
    { zone: 'economique', lettre: 'E', label: 'Économique', icon: 'payments', couleur: '#2563eb', clair: '#93c5fd', placeholder: 'Inflation, taux de change MGA/EUR…' },
    { zone: 'socioculturel', lettre: 'S', label: 'Socioculturel', icon: 'groups', couleur: '#059669', clair: '#6ee7b7', placeholder: "Pouvoir d'achat, marché du travail…" },
    { zone: 'technologique', lettre: 'T', label: 'Technologique', icon: 'memory', couleur: '#7c3aed', clair: '#c4b5fd', placeholder: 'Accès internet, adoption digitale…' },
    { zone: 'environnemental', lettre: 'E', label: 'Environnemental', icon: 'eco', couleur: '#0d9488', clair: '#5eead4', placeholder: 'Cyclones, ressources…' },
    { zone: 'legal', lettre: 'L', label: 'Légal', icon: 'gavel', couleur: '#c2410c', clair: '#fdba74', placeholder: 'TVA, IS, CNAPS, droit du travail…' },
  ];
}
