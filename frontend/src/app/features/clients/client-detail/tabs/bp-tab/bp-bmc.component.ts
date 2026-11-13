import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BpListeComponent } from './bp-liste.component';
import { LIBELLES_ZONES, ZONES_BMC } from '../../../../../core/models/outils-bp.model';

type ZoneBmc = typeof ZONES_BMC[number];

/** Repères des 9 blocs : zone de la grille, icône, couleur d'accent, question guide (canevas d'Osterwalder). */
const BLOCS: Record<ZoneBmc, { aire: string; icon: string; couleur: string; question: string; placeholder: string }> = {
  partenaires: { aire: 'part', icon: 'handshake', couleur: '#6366f1',
    question: 'Qui sont nos partenaires et fournisseurs clés ?', placeholder: 'Un partenaire, un fournisseur…' },
  activites: { aire: 'act', icon: 'bolt', couleur: '#0ea5e9',
    question: 'Quelles activités clés notre proposition de valeur requiert-elle ?', placeholder: 'Une activité clé…' },
  ressources: { aire: 'res', icon: 'inventory_2', couleur: '#14b8a6',
    question: 'Quelles ressources clés sont indispensables ?', placeholder: 'Une ressource clé…' },
  proposition: { aire: 'prop', icon: 'card_giftcard', couleur: '#8b5cf6',
    question: 'Quelle valeur apportons-nous au client ?', placeholder: 'Un bénéfice apporté au client…' },
  relations: { aire: 'rel', icon: 'favorite', couleur: '#ec4899',
    question: 'Quelle relation chaque segment de clients attend-il ?', placeholder: 'Un type de relation…' },
  canaux: { aire: 'can', icon: 'campaign', couleur: '#f59e0b',
    question: 'Par quels canaux atteignons-nous nos clients ?', placeholder: 'Un canal de vente ou de communication…' },
  segments: { aire: 'seg', icon: 'groups', couleur: '#10b981',
    question: 'Pour qui créons-nous de la valeur ?', placeholder: 'Un segment de clients…' },
  couts: { aire: 'cout', icon: 'receipt_long', couleur: '#ef4444',
    question: 'Quels sont les coûts les plus importants ?', placeholder: 'Un poste de coût…' },
  revenus: { aire: 'rev', icon: 'savings', couleur: '#22c55e',
    question: 'Pour quelle valeur nos clients sont-ils prêts à payer ?', placeholder: 'Une source de revenus…' },
};

/** Business Model Canvas — 9 blocs dans la disposition classique, cartes blanches à liseré coloré (StratPilote). */
@Component({
  selector: 'app-bp-bmc',
  standalone: true,
  imports: [MatIconModule, BpListeComponent],
  template: `
<div class="bmc">
  @for (b of blocs; track b.zone) {
    <section class="bmc__bloc" [style.grid-area]="b.aire" [style.--b]="b.couleur" [attr.data-zone]="b.zone">
      <h3 class="bmc__titre">
        <span class="bmc__icone"><mat-icon>{{ b.icon }}</mat-icon></span>{{ b.label }}
      </h3>
      <p class="bmc__question">{{ b.question }}</p>
      <app-bp-liste [items]="contenu[b.zone]" [editable]="editable" [placeholder]="b.placeholder"
                    vide="Rien de noté" (changement)="contenuChange.emit(contenu)" />
    </section>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .bmc { display: grid; gap: 12px; padding: 14px; border-radius: 16px; background: #f8fafc;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      grid-template-areas:
        "part part act act prop prop rel rel seg seg"
        "part part res res prop prop can can seg seg"
        "cout cout cout cout cout rev rev rev rev rev"; }
    .bmc__bloc { background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid var(--b); border-radius: 12px;
      padding: 12px 14px 14px; min-width: 0; min-height: 150px; box-shadow: 0 1px 3px rgba(15, 23, 42, .05); --bl-accent: var(--b); }
    .bmc__bloc[data-zone="partenaires"], .bmc__bloc[data-zone="proposition"], .bmc__bloc[data-zone="segments"] { min-height: 320px; }
    .bmc__bloc[data-zone="proposition"] { background: color-mix(in srgb, var(--b) 5%, #fff); }
    .bmc__titre { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; font-weight: 700; color: #1e293b; }
    .bmc__icone { display: inline-flex; flex: none; padding: 5px; border-radius: 8px; color: var(--b);
      background: color-mix(in srgb, var(--b) 12%, #fff); }
    .bmc__icone mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .bmc__question { margin: 6px 0 10px; font-size: 11.5px; line-height: 1.4; color: #94a3b8; }
    @media (max-width: 760px) {
      /* Une colonne, dans l'ordre de lecture d'Osterwalder (du client vers les coûts). */
      .bmc { grid-template-columns: 1fr; grid-template-areas: "seg" "prop" "can" "rel" "rev" "res" "act" "part" "cout"; padding: 10px; }
      .bmc__bloc, .bmc__bloc[data-zone="partenaires"], .bmc__bloc[data-zone="proposition"], .bmc__bloc[data-zone="segments"] { min-height: 0; }
    }
  `],
})
export class BpBmcComponent {
  @Input({ required: true }) contenu: any;
  @Input() editable = false;
  @Output() contenuChange = new EventEmitter<any>();

  readonly blocs = ZONES_BMC.map(zone => ({ zone, label: LIBELLES_ZONES[zone], ...BLOCS[zone] }));
}
