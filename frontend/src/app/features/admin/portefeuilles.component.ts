import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UsersService } from '../../core/services/users.service';
import { ClientsService } from '../../core/services/clients.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { Client } from '../../core/models/client.model';

@Component({
  selector: 'app-portefeuilles',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatSnackBarModule],
  template: `
    <div class="page">

      <!-- Header admin -->
      @if (auth.isAdmin()) {
        <div class="page-header">
          <div class="page-header__left">
            <mat-icon class="page-icon">folder_shared</mat-icon>
            <div>
              <h1>Portefeuilles</h1>
              <p>Assigner chaque dossier à un collaborateur Réunion</p>
            </div>
          </div>
          <div class="header-stats">
            <span class="stat">{{ clients.length }} dossiers</span>
            @if (unassignedCount > 0) {
              <span class="stat warn">
                <mat-icon>warning_amber</mat-icon> {{ unassignedCount }} non assigné(s)
              </span>
            }
          </div>
        </div>

        <!-- Filtre site (admin) -->
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
                <th>Collaborateur Réunion actuel</th>
                <th>Assigner à</th>
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
                  <td><span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span></td>
                  <td>
                    @if (c.responsable) {
                      <div class="user-cell">
                        <div class="user-avatar re sm">{{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}</div>
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
                        @for (u of reunionUsers; track u.id) {
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
      }

      <!-- Vue collaborateur Réunion -->
      @if (!auth.isAdmin() && auth.isReunion()) {
        <div class="page-header">
          <div class="page-header__left">
            <mat-icon class="page-icon re">folder_shared</mat-icon>
            <div>
              <h1>Mon portefeuille</h1>
              <p>Distribuer mes dossiers à mon équipe Madagascar ({{ clients.length }} dossier(s))</p>
            </div>
          </div>
          <div class="header-stats">
            @if (unassignedMgCount > 0) {
              <span class="stat warn">
                <mat-icon>warning_amber</mat-icon> {{ unassignedMgCount }} sans collaborateur MG
              </span>
            } @else {
              <span class="stat ok"><mat-icon>check_circle</mat-icon> Tout distribué</span>
            }
          </div>
        </div>

        <div class="info-banner">
          <mat-icon>info</mat-icon>
          <span>Assignez chaque dossier à un membre de votre équipe Madagascar. Ils n'auront accès qu'à leurs dossiers assignés.</span>
        </div>

        <div class="table-card">
          <table class="table">
            <thead>
              <tr>
                <th>Dossier client</th>
                <th>Santé</th>
                <th>Collaborateur Madagascar actuel</th>
                <th>Assigner à</th>
              </tr>
            </thead>
            <tbody>
              @for (c of clients; track c.id) {
                <tr class="table-row">
                  <td>
                    <div class="user-cell">
                      <div class="folder-avatar">{{ getInitials(c.nom) }}</div>
                      <span class="user-name">{{ c.nom }}</span>
                    </div>
                  </td>
                  <td><span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span></td>
                  <td>
                    @if (c.collaborateurMg) {
                      <div class="user-cell">
                        <div class="user-avatar mg sm">{{ c.collaborateurMg.firstName[0] }}{{ c.collaborateurMg.lastName[0] }}</div>
                        <span class="text-muted">{{ c.collaborateurMg.firstName }} {{ c.collaborateurMg.lastName }}</span>
                      </div>
                    } @else {
                      <span class="none">Non distribué</span>
                    }
                  </td>
                  <td>
                    <mat-form-field appearance="outline" class="assign-field">
                      <mat-select [value]="c.collaborateurMg?.id || null" (selectionChange)="assignMg(c, $event.value)">
                        <mat-option [value]="null">— Aucun —</mat-option>
                        @for (u of mgTeam; track u.id) {
                          <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </td>
                </tr>
              }
              @if (clients.length === 0) {
                <tr><td colspan="4" class="empty-state">
                  <mat-icon>folder_off</mat-icon><span>Aucun dossier dans votre portefeuille</span>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      }

    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon { font-size: 32px; width: 32px; height: 32px; color: #f59e0b; }
    .page-icon.re { color: #3b82f6; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-header p { font-size: 13px; color: #94a3b8; margin: 0; }
    .header-stats { display: flex; align-items: center; gap: 10px; }
    .stat { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 4px; }
    .stat.warn { background: #fff7ed; color: #c2410c; }
    .stat.ok { background: #f0fdf4; color: #15803d; }
    .stat mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .info-banner { display: flex; align-items: flex-start; gap: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #1d4ed8; line-height: 1.5; }
    .info-banner mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }

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
    .user-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .user-avatar.re { background: linear-gradient(135deg, #dbeafe, #bfdbfe); color: #1d4ed8; }
    .user-avatar.mg { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #15803d; }
    .user-avatar.sm { width: 28px; height: 28px; }
    .folder-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .user-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .text-muted { font-size: 13px; color: #64748b; }
    .none { font-size: 13px; color: #cbd5e1; font-style: italic; }

    .badge-re { display: inline-flex; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-mg { display: inline-flex; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .score-high { color: #15803d; font-size: 13px; font-weight: 700; }
    .score-medium { color: #a16207; font-size: 13px; font-weight: 700; }
    .score-low { color: #dc2626; font-size: 13px; font-weight: 700; }

    .assign-field { width: 200px; }
    ::ng-deep .assign-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .assign-field .mat-mdc-text-field-wrapper { padding: 0 8px; }

    .empty-state { text-align: center; padding: 48px !important; color: #94a3b8; }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
  `],
})
export class PortefeuillesComponent implements OnInit {
  auth = inject(AuthService);
  private usersService = inject(UsersService);
  private clientsService = inject(ClientsService);
  private snack = inject(MatSnackBar);

  users: User[] = [];
  mgTeam: User[] = [];
  clients: Client[] = [];
  siteFilter: string | null = null;

  get reunionUsers(): User[] {
    return this.users.filter(u => u.site === 'REUNION' && u.isActive);
  }
  get filteredClients(): Client[] {
    if (!this.siteFilter) return this.clients;
    return this.clients.filter(c => c.site === this.siteFilter);
  }
  get unassignedCount(): number {
    return this.clients.filter(c => !c.responsable).length;
  }
  get unassignedMgCount(): number {
    return this.clients.filter(c => !c.collaborateurMg).length;
  }

  ngOnInit() {
    this.clientsService.getAll().subscribe(c => this.clients = c);
    if (this.auth.isAdmin()) {
      this.usersService.getAll().subscribe(u => this.users = u);
    } else {
      // Réunion collaborateur : charger son équipe MG (getAssignable retourne leur équipe)
      this.usersService.getAssignable().subscribe(u => this.mgTeam = u.filter(u => u.site === 'MADAGASCAR'));
    }
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

  assignMg(client: Client, collaborateurMgId: number | null) {
    this.clientsService.assignMg(client.id, collaborateurMgId).subscribe(updated => {
      client.collaborateurMg = updated.collaborateurMg;
      this.snack.open(collaborateurMgId ? 'Dossier distribué' : 'Distribution retirée', 'OK', { duration: 2000 });
    });
  }

  getInitials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  scoreClass(score: number): string {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
}
