import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { debounceTime } from 'rxjs';
import { ClientsService } from '../../../core/services/clients.service';
import { AuthService } from '../../../core/services/auth.service';
import { Client } from '../../../core/models/client.model';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatDialogModule, MatProgressBarModule,
    MatSelectModule, MatTableModule,
  ],
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Dossiers clients</h1>
        @if (auth.isAdmin()) {
          <button mat-flat-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> Nouveau dossier
          </button>
        }
      </div>

      <div class="page__filters">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Rechercher un client</mat-label>
          <input matInput [formControl]="searchCtrl" placeholder="Nom du client..." />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Site</mat-label>
          <mat-select [formControl]="siteCtrl">
            <mat-option value="">Tous</mat-option>
            <mat-option value="REUNION">La Réunion</mat-option>
            <mat-option value="MADAGASCAR">Madagascar</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <mat-card>
        <table mat-table [dataSource]="filteredClients" class="full-width">
          <ng-container matColumnDef="nom">
            <th mat-header-cell *matHeaderCellDef>Client</th>
            <td mat-cell *matCellDef="let c">
              <strong>{{ c.nom }}</strong>
            </td>
          </ng-container>

          <ng-container matColumnDef="site">
            <th mat-header-cell *matHeaderCellDef>Site</th>
            <td mat-cell *matCellDef="let c">
              {{ c.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="sante">
            <th mat-header-cell *matHeaderCellDef>Santé de passation</th>
            <td mat-cell *matCellDef="let c">
              <div class="score-cell">
                <span [class]="getScoreClass(c.santePassation)">{{ c.santePassation }}%</span>
                <mat-progress-bar [value]="c.santePassation" [color]="getProgressColor(c.santePassation)" />
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button color="primary" [routerLink]="['/clients', c.id]">
                <mat-icon>open_in_new</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;" class="table-row" [routerLink]="['/clients', row.id]"></tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [`
    .page__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page__header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #1e293b; }
    .page__filters { display: flex; gap: 16px; margin-bottom: 16px; }
    .search-field { flex: 1; }
    .full-width { width: 100%; }
    .score-cell { display: flex; align-items: center; gap: 12px; }
    .score-cell mat-progress-bar { width: 100px; }
    .score-low { color: #dc2626; font-weight: 600; }
    .score-medium { color: #d97706; font-weight: 600; }
    .score-high { color: #16a34a; font-weight: 600; }
    .table-row:hover { background: #f8fafc; cursor: pointer; }
  `],
})
export class ClientListComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  columns = ['nom', 'site', 'sante', 'actions'];
  searchCtrl = new FormControl('');
  siteCtrl = new FormControl('');

  constructor(
    private clientsService: ClientsService,
    public auth: AuthService,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.load();
    this.searchCtrl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.applyFilters());
    this.siteCtrl.valueChanges.subscribe(() => this.applyFilters());
  }

  load() {
    this.clientsService.getAll().subscribe((data) => {
      this.clients = data;
      this.applyFilters();
    });
  }

  applyFilters() {
    const search = this.searchCtrl.value?.toLowerCase() || '';
    const site = this.siteCtrl.value || '';
    this.filteredClients = this.clients.filter(
      (c) => c.nom.toLowerCase().includes(search) && (!site || c.site === site),
    );
  }

  openCreateDialog() {
    const nom = prompt('Nom du client :');
    const site = prompt('Site (REUNION ou MADAGASCAR) :');
    if (nom && site) {
      this.clientsService.create({ nom, site }).subscribe(() => this.load());
    }
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
}
