import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-create-client-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="dialog-header__icon">
          <mat-icon>folder_shared</mat-icon>
        </div>
        <div>
          <h2>Nouveau dossier client</h2>
          <p>Renseignez les informations de base du dossier</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="confirm()" class="dialog-body">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Nom du client / raison sociale</mat-label>
          <mat-icon matPrefix>business</mat-icon>
          <input matInput formControlName="nom" placeholder="Ex: SARL Dupont &amp; Associés" autofocus />
          @if (form.get('nom')?.touched && form.get('nom')?.hasError('required')) {
            <mat-error>Le nom est requis</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Site de rattachement</mat-label>
          <mat-icon matPrefix>location_on</mat-icon>
          <mat-select formControlName="site">
            <mat-option value="REUNION">
              <span class="site-option">🇷🇪 &nbsp;La Réunion</span>
            </mat-option>
            <mat-option value="MADAGASCAR">
              <span class="site-option">🇲🇬 &nbsp;Madagascar</span>
            </mat-option>
          </mat-select>
          @if (form.get('site')?.touched && form.get('site')?.hasError('required')) {
            <mat-error>Le site est requis</mat-error>
          }
        </mat-form-field>
      </form>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="cancel()">Annuler</button>
        <button mat-flat-button color="primary" class="btn-create"
                [disabled]="form.invalid" (click)="confirm()">
          <mat-icon>add</mat-icon>
          Créer le dossier
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { width: 460px; max-width: 100%; }

    .dialog-header {
      display: flex; align-items: center; gap: 16px;
      padding: 28px 28px 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .dialog-header__icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .dialog-header__icon mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .dialog-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .dialog-header p { font-size: 13px; color: #64748b; margin: 0; }

    .dialog-body {
      padding: 24px 28px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .full { width: 100%; }

    .site-option { font-size: 14px; }

    .dialog-actions {
      display: flex; justify-content: flex-end; align-items: center; gap: 10px;
      padding: 16px 28px 24px;
      border-top: 1px solid #f1f5f9;
    }
    .btn-create {
      border-radius: 10px !important;
      font-weight: 600;
      background: linear-gradient(135deg, #1e40af, #3730a3) !important;
      display: flex; align-items: center; gap: 4px;
    }
    .btn-create mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class CreateClientDialogComponent {
  private dialogRef = inject(MatDialogRef<CreateClientDialogComponent>);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    nom: ['', [Validators.required, Validators.minLength(2)]],
    site: ['', Validators.required],
  });

  confirm() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
