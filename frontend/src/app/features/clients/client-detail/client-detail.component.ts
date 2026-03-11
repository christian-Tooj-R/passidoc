import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.model';
import { FicheIdentiteTabComponent } from './tabs/fiche-identite-tab/fiche-identite-tab.component';
import { FluxMensuelTabComponent } from './tabs/flux-mensuel-tab/flux-mensuel-tab.component';
import { FournisseursTabComponent } from './tabs/fournisseurs-tab/fournisseurs-tab.component';
import { SyntheseTabComponent } from './tabs/synthese-tab/synthese-tab.component';
import { DocumentsTabComponent } from './tabs/documents-tab/documents-tab.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatTabsModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatCardModule, MatTooltipModule,
    FicheIdentiteTabComponent, FluxMensuelTabComponent,
    FournisseursTabComponent, SyntheseTabComponent, DocumentsTabComponent,
  ],
  template: `
    @if (client) {
      <div class="detail">
        <div class="detail__header">
          <div class="detail__breadcrumb">
            <a routerLink="/clients">Dossiers</a>
            <mat-icon>chevron_right</mat-icon>
            <span>{{ client.nom }}</span>
          </div>

          <div class="detail__title-row">
            <div>
              <h1>{{ client.nom }}</h1>
              <span class="detail__site">{{ client.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span>
            </div>
            <div class="detail__actions">
              <button mat-stroked-button (click)="exportPdf()" matTooltip="Générer la note de passation PDF">
                <mat-icon>picture_as_pdf</mat-icon> Note de passation
              </button>
            </div>
          </div>

          <div class="detail__sante">
            <span class="detail__sante-label">Santé de passation : <strong [class]="getScoreClass(client.santePassation)">{{ client.santePassation }}%</strong></span>
            <span class="detail__sante-status">{{ getScoreLabel(client.santePassation) }}</span>
            <mat-progress-bar [value]="client.santePassation" [color]="getProgressColor(client.santePassation)" />
          </div>
        </div>

        <mat-tab-group animationDuration="200ms">
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>badge</mat-icon>&nbsp;Fiche Identité
            </ng-template>
            <app-fiche-identite-tab [clientId]="client.id" />
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>bar_chart</mat-icon>&nbsp;Pilotage
            </ng-template>
            <app-flux-mensuel-tab [clientId]="client.id" />
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>people</mat-icon>&nbsp;Fournisseurs
            </ng-template>
            <app-fournisseurs-tab [clientId]="client.id" />
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>analytics</mat-icon>&nbsp;Analyse Financière
            </ng-template>
            <app-synthese-tab [clientId]="client.id" />
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>attach_file</mat-icon>&nbsp;Documents
            </ng-template>
            <app-documents-tab [clientId]="client.id" />
          </mat-tab>
        </mat-tab-group>
      </div>
    }
  `,
  styles: [`
    .detail__header { background: white; padding: 24px; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .detail__breadcrumb { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #64748b; margin-bottom: 16px; }
    .detail__breadcrumb a { color: #2563eb; text-decoration: none; }
    .detail__title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .detail__title-row h1 { margin: 0; font-size: 26px; font-weight: 700; color: #1e293b; }
    .detail__site { font-size: 14px; color: #64748b; }
    .detail__sante-label { font-size: 14px; display: block; margin-bottom: 4px; }
    .detail__sante-status { font-size: 12px; color: #94a3b8; display: block; margin-bottom: 8px; }
    .score-low { color: #dc2626; }
    .score-medium { color: #d97706; }
    .score-high { color: #16a34a; }
  `],
})
export class ClientDetailComponent implements OnInit {
  client: Client | null = null;

  constructor(private route: ActivatedRoute, private clientsService: ClientsService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.clientsService.getOne(id).subscribe((c) => (this.client = c));
  }

  exportPdf() {
    if (!this.client) return;
    this.clientsService.exportPdf(this.client.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note-passation-${this.client!.nom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  getScoreClass(score: number) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
  getProgressColor(score: number): 'primary' | 'accent' | 'warn' {
    if (score >= 80) return 'primary';
    if (score >= 50) return 'accent';
    return 'warn';
  }
  getScoreLabel(score: number) {
    if (score >= 80) return '✓ Transmissible';
    if (score >= 50) return '⚠ Partiellement renseigné';
    return '✗ Risque de perte d\'information';
  }
}
