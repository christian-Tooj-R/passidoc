import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-2fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="page">
      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>Vérification 2FA</mat-card-title>
          <mat-card-subtitle>Entrez le code de votre application d'authentification</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Code à 6 chiffres</mat-label>
              <input matInput formControlName="token" maxlength="6" placeholder="000000" />
            </mat-form-field>
            @if (error) { <div class="error">{{ error }}</div> }
            <button mat-flat-button color="primary" type="submit" class="full-width" [disabled]="form.invalid || loading">
              Vérifier
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9; }
    .card { width: 380px; padding: 16px; }
    .full-width { width: 100%; }
    .error { color: #dc2626; font-size: 14px; margin-bottom: 12px; }
  `],
})
export class Verify2faComponent {
  private fb = inject(FormBuilder);
  form = this.fb.group({ token: ['', [Validators.required, Validators.minLength(6)]] });
  loading = false;
  error = '';
  private userId: number;

  constructor(private auth: AuthService, private router: Router) {
    const nav = this.router.getCurrentNavigation();
    this.userId = nav?.extras?.state?.['userId'];
    if (!this.userId) this.router.navigate(['/auth/login']);
  }

  submit() {
    this.loading = true;
    this.auth.verify2fa(this.userId, this.form.value.token!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => { this.loading = false; this.error = err.message; },
    });
  }
}
