import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UsersService } from '../../core/services/users.service';
import { ClientsService } from '../../core/services/clients.service';
import { User } from '../../core/models/user.model';
import { Client } from '../../core/models/client.model';

/* ── Dialog création utilisateur ── */
@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="dialog-header__icon"><mat-icon>person_add</mat-icon></div>
        <div>
          <h2>Nouvel utilisateur</h2>
          <p>Créer un compte collaborateur ou expert</p>
        </div>
      </div>
      <form [formGroup]="form" (ngSubmit)="confirm()" class="dialog-body">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Prénom</mat-label>
            <input matInput formControlName="firstName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Nom</mat-label>
            <input matInput formControlName="lastName" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Adresse email</mat-label>
          <mat-icon matPrefix>alternate_email</mat-icon>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Mot de passe</mat-label>
          <mat-icon matPrefix>lock_outline</mat-icon>
          <input matInput type="password" formControlName="password" />
          <mat-hint>Minimum 8 caractères</mat-hint>
        </mat-form-field>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Rôle</mat-label>
            <mat-select formControlName="role">
              <mat-option value="COLLABORATEUR">Collaborateur</mat-option>
              <mat-option value="EXPERT_COMPTABLE">Expert-Comptable</mat-option>
              <mat-option value="ADMIN">Administrateur</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Site</mat-label>
            <mat-select formControlName="site">
              <mat-option value="REUNION">🇷🇪 La Réunion</mat-option>
              <mat-option value="MADAGASCAR">🇲🇬 Madagascar</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </form>
      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="cancel()">Annuler</button>
        <button mat-flat-button class="btn-create" [disabled]="form.invalid" (click)="confirm()">
          <mat-icon>person_add</mat-icon> Créer le compte
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { width: 500px; max-width: 100%; }
    .dialog-header { display: flex; align-items: center; gap: 16px; padding: 28px 28px 20px; border-bottom: 1px solid #f1f5f9; }
    .dialog-header__icon { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #1e40af, #3730a3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .dialog-header__icon mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .dialog-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .dialog-header p { font-size: 13px; color: #64748b; margin: 0; }
    .dialog-body { padding: 20px 28px; display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 28px 24px; border-top: 1px solid #f1f5f9; }
    .btn-create { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #1e40af, #3730a3) !important; }
  `],
})
export class CreateUserDialogComponent {
  dialogRef = inject(MatDialogRef<CreateUserDialogComponent>);
  fb = inject(FormBuilder);
  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['COLLABORATEUR', Validators.required],
    site: ['REUNION', Validators.required],
  });
  confirm() { if (this.form.valid) this.dialogRef.close(this.form.value); else this.form.markAllAsTouched(); }
  cancel() { this.dialogRef.close(null); }
}

/* ── Page Administration ── */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule, MatFormFieldModule, MatSelectModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Administration</h1>
          <p class="page-subtitle">{{ users.length }} utilisateur(s) · {{ clients.length }} dossier(s)</p>
        </div>
        <button mat-flat-button class="btn-create" (click)="openCreate()">
          <mat-icon>person_add</mat-icon> Nouvel utilisateur
        </button>
      </div>

      <!-- Stats mini -->
      <div class="stats-row">
        <div class="stat-chip">
          <mat-icon>manage_accounts</mat-icon>
          <span>{{ countRole('ADMIN') }} Admin</span>
        </div>
        <div class="stat-chip">
          <mat-icon>work</mat-icon>
          <span>{{ countRole('EXPERT_COMPTABLE') }} Expert-comptable</span>
        </div>
        <div class="stat-chip">
          <mat-icon>badge</mat-icon>
          <span>{{ countRole('COLLABORATEUR') }} Collaborateur</span>
        </div>
        <div class="stat-chip">
          <mat-icon>flag</mat-icon>
          <span>{{ countSite('REUNION') }} Réunion · {{ countSite('MADAGASCAR') }} Madagascar</span>
        </div>
      </div>

      <!-- Section utilisateurs -->
      <h2 class="section-title"><mat-icon>group</mat-icon> Utilisateurs</h2>
      <div class="table-card">
        <table class="users-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Site</th>
              <th>2FA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (u of users; track u.id) {
              <tr class="table-row">
                <td>
                  <div class="user-cell">
                    <div class="user-avatar">{{ (u.firstName?.[0] || '') + (u.lastName?.[0] || '') }}</div>
                    <span class="user-name">{{ u.firstName }} {{ u.lastName }}</span>
                  </div>
                </td>
                <td class="text-muted">{{ u.email }}</td>
                <td>
                  <span class="role-badge" [class]="'role-' + u.role?.toLowerCase()">
                    {{ roleLabel(u.role) }}
                  </span>
                </td>
                <td>
                  <span [class]="u.site === 'REUNION' ? 'badge-reunion' : 'badge-madagascar'">
                    {{ u.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                  </span>
                </td>
                <td>
                  <span class="twofa-badge" [class.active]="u.isTwoFactorEnabled">
                    <mat-icon>{{ u.isTwoFactorEnabled ? 'verified_user' : 'gpp_maybe' }}</mat-icon>
                    {{ u.isTwoFactorEnabled ? 'Activé' : 'Inactif' }}
                  </span>
                </td>
                <td class="action-cell">
                  <button mat-icon-button class="btn-delete" matTooltip="Désactiver l'utilisateur"
                          (click)="deleteUser(u)">
                    <mat-icon>person_off</mat-icon>
                  </button>
                </td>
              </tr>
            }
            @if (users.length === 0) {
              <tr>
                <td colspan="6" class="empty-state">
                  <mat-icon>group_off</mat-icon>
                  <span>Aucun utilisateur</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Section dossiers -->
      <h2 class="section-title" style="margin-top:36px"><mat-icon>folder_shared</mat-icon> Assignation des dossiers</h2>
      <div class="table-card">
        <table class="users-table">
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
            @for (c of clients; track c.id) {
              <tr class="table-row">
                <td>
                  <div class="user-cell">
                    <div class="folder-avatar">{{ getInitials(c.nom) }}</div>
                    <span class="user-name">{{ c.nom }}</span>
                  </div>
                </td>
                <td>
                  <span [class]="c.site === 'REUNION' ? 'badge-reunion' : 'badge-madagascar'">
                    {{ c.site === 'REUNION' ? '🇷🇪 Réunion' : '🇲🇬 Madagascar' }}
                  </span>
                </td>
                <td>
                  <span class="score-text" [class]="getScoreClass(c.santePassation)">{{ c.santePassation }}%</span>
                </td>
                <td>
                  @if (c.responsable) {
                    <div class="user-cell">
                      <div class="user-avatar small">{{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}</div>
                      <span class="text-muted">{{ c.responsable.firstName }} {{ c.responsable.lastName }}</span>
                    </div>
                  } @else {
                    <span class="resp-none">Non assigné</span>
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
            @if (clients.length === 0) {
              <tr>
                <td colspan="5" class="empty-state">
                  <mat-icon>folder_off</mat-icon>
                  <span>Aucun dossier</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1280px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.5px; }
    .page-subtitle { font-size: 14px; color: #64748b; margin: 0; }
    .btn-create { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #1e40af, #3730a3) !important; color: white !important; }

    .section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }
    .section-title mat-icon { font-size: 20px; width: 20px; height: 20px; color: #6366f1; }

    /* Stats */
    .stats-row { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat-chip {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e8ecf0;
      border-radius: 10px; padding: 8px 14px;
      font-size: 13px; font-weight: 500; color: #475569;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .stat-chip mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }

    /* Table */
    .table-card {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
      overflow: hidden; margin-bottom: 8px;
    }
    .users-table { width: 100%; border-collapse: collapse; }
    .users-table thead th {
      padding: 14px 20px; text-align: left;
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.8px;
      background: #f8fafc; border-bottom: 1px solid #e8ecf0;
    }
    .table-row { border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: #f8fafc; }
    .users-table td { padding: 12px 20px; vertical-align: middle; }

    .user-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #dbeafe, #c7d2fe);
      color: #1e40af; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      text-transform: uppercase;
    }
    .user-avatar.small { width: 26px; height: 26px; font-size: 10px; }
    .folder-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .user-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .text-muted { font-size: 13px; color: #64748b; }
    .resp-none { font-size: 13px; color: #cbd5e1; font-style: italic; }

    .role-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .role-admin { background: #ede9fe; color: #7c3aed; }
    .role-expert_comptable { background: #dbeafe; color: #1d4ed8; }
    .role-collaborateur { background: #f0fdf4; color: #15803d; }

    .badge-reunion { display: inline-flex; align-items: center; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-madagascar { display: inline-flex; align-items: center; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

    .twofa-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; color: #94a3b8; }
    .twofa-badge mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .twofa-badge.active { color: #15803d; }

    .score-text { font-size: 13px; font-weight: 700; }
    .score-high { color: #15803d; }
    .score-medium { color: #a16207; }
    .score-low { color: #dc2626; }

    .assign-field { width: 200px; }
    ::ng-deep .assign-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .assign-field .mat-mdc-text-field-wrapper { padding: 0 8px; }

    .action-cell { text-align: right; }
    .btn-delete { color: #cbd5e1 !important; }
    .btn-delete:hover { color: #f87171 !important; }

    .empty-state { text-align: center; padding: 48px !important; color: #94a3b8; }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
  `],
})
export class AdminComponent implements OnInit {
  private usersService = inject(UsersService);
  private clientsService = inject(ClientsService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  users: User[] = [];
  clients: Client[] = [];

  ngOnInit() {
    this.loadUsers();
    this.loadClients();
  }

  loadUsers() { this.usersService.getAll().subscribe((d) => (this.users = d)); }
  loadClients() { this.clientsService.getAll().subscribe((d) => (this.clients = d)); }

  openCreate() {
    const ref = this.dialog.open(CreateUserDialogComponent, { panelClass: 'rounded-dialog' });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.usersService.create(result).subscribe(() => {
          this.loadUsers();
          this.snack.open('Utilisateur créé avec succès', 'OK', { duration: 3000 });
        });
      }
    });
  }

  deleteUser(u: User) {
    if (!confirm(`Désactiver le compte de ${u.firstName} ${u.lastName} ?`)) return;
    this.usersService.delete(u.id).subscribe(() => {
      this.loadUsers();
      this.snack.open('Utilisateur désactivé', 'OK', { duration: 2500 });
    });
  }

  reassign(client: Client, responsableId: number | null) {
    if (!responsableId) return;
    this.clientsService.assign(client.id, responsableId).subscribe((updated) => {
      client.responsable = updated.responsable;
      this.snack.open(`Dossier réassigné avec succès`, 'OK', { duration: 2500 });
    });
  }

  getInitials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getScoreClass(score: number) {
    if (score >= 80) return 'score-text score-high';
    if (score >= 50) return 'score-text score-medium';
    return 'score-text score-low';
  }

  roleLabel(role: string) {
    if (role === 'ADMIN') return 'Admin';
    if (role === 'EXPERT_COMPTABLE') return 'Expert-comptable';
    return 'Collaborateur';
  }
  countRole(role: string) { return this.users.filter((u) => u.role === role).length; }
  countSite(site: string) { return this.users.filter((u) => u.site === site).length; }
}
