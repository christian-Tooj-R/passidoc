import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCardModule, MatDialogModule, MatSnackBarModule, MatChipsModule,
  ],
  template: `
    <div class="page">
      <h1>Administration</h1>

      <mat-card>
        <mat-card-header>
          <mat-card-title>Gestion des utilisateurs</mat-card-title>
          <div class="card-actions">
            <button mat-flat-button color="primary" (click)="showForm = !showForm">
              <mat-icon>person_add</mat-icon> Nouvel utilisateur
            </button>
          </div>
        </mat-card-header>

        <mat-card-content>
          @if (showForm) {
            <form [formGroup]="form" (ngSubmit)="createUser()" class="user-form">
              <mat-form-field appearance="outline">
                <mat-label>Prénom</mat-label>
                <input matInput formControlName="firstName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Nom</mat-label>
                <input matInput formControlName="lastName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Mot de passe</mat-label>
                <input matInput type="password" formControlName="password" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Rôle</mat-label>
                <mat-select formControlName="role">
                  <mat-option value="COLLABORATEUR">Collaborateur</mat-option>
                  <mat-option value="EXPERT_COMPTABLE">Expert-Comptable</mat-option>
                  <mat-option value="ADMIN">Admin</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Site</mat-label>
                <mat-select formControlName="site">
                  <mat-option value="REUNION">La Réunion</mat-option>
                  <mat-option value="MADAGASCAR">Madagascar</mat-option>
                </mat-select>
              </mat-form-field>
              <div class="form-actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">Créer</button>
                <button mat-button type="button" (click)="showForm = false">Annuler</button>
              </div>
            </form>
          }

          <table mat-table [dataSource]="users" class="full-width">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Nom</th>
              <td mat-cell *matCellDef="let u">{{ u.firstName }} {{ u.lastName }}</td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let u">{{ u.email }}</td>
            </ng-container>
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Rôle</th>
              <td mat-cell *matCellDef="let u">
                <mat-chip [color]="roleColor(u.role)" selected>{{ u.role }}</mat-chip>
              </td>
            </ng-container>
            <ng-container matColumnDef="site">
              <th mat-header-cell *matHeaderCellDef>Site</th>
              <td mat-cell *matCellDef="let u">{{ u.site === 'REUNION' ? '🇷🇪' : '🇲🇬' }} {{ u.site }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let u">
                <button mat-icon-button color="warn" (click)="deleteUser(u)">
                  <mat-icon>person_off</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page h1 { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 24px; }
    .card-actions { margin-left: auto; }
    mat-card-header { display: flex; align-items: center; }
    .user-form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px 0; }
    .form-actions { grid-column: 1 / -1; display: flex; gap: 8px; }
    .full-width { width: 100%; }
  `],
})
export class AdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  users: User[] = [];
  columns = ['name', 'email', 'role', 'site', 'actions'];
  showForm = false;
  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['COLLABORATEUR', Validators.required],
    site: ['REUNION', Validators.required],
  });

  constructor(private usersService: UsersService, private snack: MatSnackBar) {}
  ngOnInit() { this.load(); }
  load() { this.usersService.getAll().subscribe((d) => (this.users = d)); }

  createUser() {
    this.usersService.create(this.form.value).subscribe(() => {
      this.load(); this.showForm = false; this.form.reset();
      this.snack.open('Utilisateur créé', 'OK', { duration: 2000 });
    });
  }

  deleteUser(u: User) {
    this.usersService.delete(u.id).subscribe(() => {
      this.load();
      this.snack.open('Utilisateur désactivé', 'OK', { duration: 2000 });
    });
  }

  roleColor(role: string) {
    if (role === 'ADMIN') return 'warn';
    if (role === 'EXPERT_COMPTABLE') return 'primary';
    return 'accent';
  }
}
