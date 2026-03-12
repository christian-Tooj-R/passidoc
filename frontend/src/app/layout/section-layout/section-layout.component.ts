import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Layout réutilisable : panneau flottant sticky gauche + contenu principal.
 *
 * Usage :
 *   <app-section-layout>
 *     <div slot="panel"> ... </div>
 *     <div> contenu principal </div>
 *   </app-section-layout>
 */
@Component({
  selector: 'app-section-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-wrap" [style.padding]="padding()">
      <!-- Panneau flottant -->
      <aside class="float-panel">
        <ng-content select="[slot=panel]" />
      </aside>

      <!-- Contenu principal -->
      <div class="section-content">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .section-wrap {
      display: flex;
      align-items: flex-start;
      gap: 24px;
      max-width: 1600px;
      margin: 0 auto;
      padding: 28px 32px;
    }

    /* Panneau flottant */
    .float-panel {
      width: 240px;
      min-width: 240px;
      position: sticky;
      top: 24px;
      align-self: flex-start;
      background: white;
      border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow:
        0 4px 20px rgba(15,23,42,.07),
        0 1px 4px rgba(15,23,42,.04);
      overflow: hidden;
      flex-shrink: 0;
    }

    /* Contenu */
    .section-content {
      flex: 1;
      min-width: 0;
    }
  `],
})
export class SectionLayoutComponent {
  padding = input('28px 32px');
}
