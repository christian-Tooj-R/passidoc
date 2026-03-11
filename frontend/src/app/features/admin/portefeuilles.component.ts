import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UsersService } from '../../core/services/users.service';
import { ClientsService } from '../../core/services/clients.service';
import { User } from '../../core/models/user.model';
import { Client } from '../../core/models/client.model';

@Component({
  selector: 'app-portefeuilles',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatSnackBarModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-header__left">
          <mat-icon class="page-icon">folder_shared</mat-icon>
          <div>
            <h1>Portefeuilles</h1>
            <p>Assigner chaque dossier client à un collaborateur responsable</p>
          </div>
        </div>
        <div class="header-stats">
          <span class="stat">{{ clients.length }} dossiers</span>
          <span class="stat unassigned" *ngIf="unassignedCount > 0">
            <mat-icon>warning_amber</mat-icon> {{ unassignedCount }} non assigné(s)
          </span>
        </div>
      </div>

      <!-- Filtre site -->
      <div class="filters">
        <button mat-stroked-button [class.active]="siteFilter === null" (click)="siteFilter = null" class="filter-btn">
          Tous ({{ clients.length }})
        </button>
        <button mat-stroked-button [class.active]="siteFilter === 'REUNION'" (click)="siteFilter = 'REUNION'" class="filter-btn">
          🇷🇪 Réunion ({{ countSite('REUNION') }})
        </button>
        <button mat-stroked-button [class.active]="siteFilter === 'MADAGASCAR'" (click)="siteFilter = 'MADAGASCAR'" class="filter-btn">
          🇲🇬 Madagascar ({{ countSite('MADAGASCAR') }})
        </button>
      </div>

      <div class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Dossier client</th>
              <th>Site</th>
              <th>Santé</th>
              <th>Responsable actuel</th>
              <th>Réassigner à</th>
            </tr>
          </thead>
          <tbody>
            @for (c of filteredClients; track c.id) {
              <tr class="table-row">
                <td>
                  <div class="user-cell">
                    <div class="folder-avatar">{{ getInitials(c.nom) }}</div>
                    <span class="user-name">{{ c.nom }}</span>
                  </div>
                </td>
                <td>
                  <span [class]="c.site === 'REUNION' ? 'badge-re' : 'badge-mg'">
                    {{ c.site === 'REUNION' ? '🇷🇪 Réunion' : '🇲🇬 Madagascar' }}
                  </span>
                </td>
                <td>
                  <span class="score" [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span>
                </td>
                <td>
                  @if (c.responsable) {
                    <div class="user-cell">
                      <div class="user-avatar sm">{{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}</div>
                      <span class="text-muted">{{ c.responsable.firstName }} {{ c.responsable.lastName }}</span>
                    </div>
                  } @else {
                    <span class="none">Non assigné</span>
                  }
                </td>
                <td>
                  <mat-form-field appearance="outline" class="assign-field">
                    <mat-select [value]="c.responsable?.id || null" (selectionChange)="reassign(c, $event.value)">
                      <mat-option [value]="null">— Aucun —</mat-option>
                      @for (u of users; track u.id) {
                        <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </td>
              </tr>
            }
            @if (filteredClients.length === 0) {
              <tr><td colspan="5" class="empty-state">
                <mat-icon>folder_off</mat-icon><span>Aucun dossier</span>
              </td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon { font-size: 32px; width: 32px; height: 32px; color: #f59e0b; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-header p { font-size: 13px; color: #94a3b8; margin: 0; }
    .header-stats { display: flex; align-items: center; gap: 10px; }
    .stat { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 4px; }
    .stat.unassigned { background: #fff7ed; color: #c2410c; }
    .stat mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .filters { display: flex; gap: 8px; margin-bottom: 20px; }
    .filter-btn { border-radius: 20px !important; font-size: 13px; border-color: #e2e8f0 !important; color: #64748b; }
    .filter-btn.active { background: #1e293b !important; color: white !important; border-color: #1e293b !important; }

    .table-card { background: white; border-radius: 16px; border: 1px solid #e8ecf0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table thead th { padding: 14px 20px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; background: #f8fafc; border-bottom: 1px solid #e8ecf0; }
    .table-row { border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: #f8fafc; }
    .table td { padding: 12px 20px; vertical-align: middle; }

    .user-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #dbeafe, #c7d2fe); color: #1e40af; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .user-avatar.sm { width: 28px; height: 28px; font-size: 10px; }
    .folder-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .user-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .text-muted { font-size: 13px; color: #64748b; }
    .none { font-size: 13px; color: #cbd5e1; font-style: italic; }

    .badge-re { display: inline-flex; align-items: center; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-mg { display: inline-flex; align-items: center; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

    .score { font-size: 13px; font-weight: 700; }
    .score-high { color: #15803d; }
    .score-medium { color: #a16207; }
    .score-low { color: #dc2626; }

    .assign-field { width: 200px; }
    ::ng-deep .assign-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .assign-field .mat-mdc-text-field-wrapper { padding: 0 8px; }

    .empty-state { text-align: center; padding: 48px !important; color: #94a3b8; }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
  `],
})
export class PortefeuillesComponent implements OnInit {
  private usersService = inject(UsersService);
  private clientsService = inject(ClientsService);
  private snack = inject(MatSnackBar);

  users: User[] = [];
  clients: Client[] = [];
  siteFilter: string | null = null;

  get filteredClients(): Client[] {
    if (!this.siteFilter) return this.clients;
    return this.clients.filter(c => c.site === this.siteFilter);
  }
  get unassignedCount(): number {
    return this.clients.filter(c => !c.responsable).length;
  }

  ngOnInit() {
    this.usersService.getAll().subscribe(u => this.users = u);
    this.clientsService.getAll().subscribe(c => this.clients = c);
  }

  countSite(site: string): number {
    return this.clients.filter(c => c.site === site).length;
  }

  reassign(client: Client, responsableId: number | null) {
    if (!responsableId) return;
    this.clientsService.assign(client.id, responsableId).subscribe(updated => {
      client.responsable = updated.responsable;
      this.snack.open('Dossier réassigné', 'OK', { duration: 2000 });
    });
  }

  getInitials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  scoreClass(score: number): string {
    if (score >= 80) return 'score score-high';
    if (score >= 50) return 'score score-medium';
    return 'score score-low';
  }
}
