import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';
import { TenantService } from '../../../core/services/tenant.service';

type Step = 'email' | 'code' | 'success';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="fp-page">
      <div class="fp-card">

        <!-- Logo -->
        <div class="fp-logo">
          <mat-icon>lock_reset</mat-icon>
        </div>

        <!-- Étape 1 : saisie email -->
        @if (step() === 'email') {
          <h1>Mot de passe oublié</h1>
          <p class="fp-subtitle">Entrez votre adresse email. Nous vous enverrons un code de vérification à 6 chiffres.</p>

          <form [formGroup]="emailForm" (ngSubmit)="submitEmail()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Adresse email</mat-label>
              <input matInput type="email" formControlName="email"
                     autocomplete="email" placeholder="vous@afym.re" />
              <mat-icon matPrefix>alternate_email</mat-icon>
              @if (emailForm.get('email')?.touched && emailForm.get('email')?.hasError('email')) {
                <mat-error>Email invalide</mat-error>
              }
            </mat-form-field>

            @if (error()) {
              <div class="fp-alert fp-alert--error">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <button mat-flat-button color="primary" type="submit" class="fp-btn"
                    [disabled]="loading() || emailForm.invalid">
              @if (loading()) {
                <mat-spinner diameter="20" /><span>Envoi en cours...</span>
              } @else {
                <mat-icon>send</mat-icon><span>Envoyer le code</span>
              }
            </button>
          </form>
        }

        <!-- Étape 2 : saisie code + nouveau mdp -->
        @if (step() === 'code') {
          <h1>Vérification</h1>
          <p class="fp-subtitle">
            Un code à 6 chiffres a été envoyé à <strong>{{ emailForm.value.email }}</strong>.<br>
            Il est valable 15 minutes.
          </p>

          <form [formGroup]="codeForm" (ngSubmit)="submitCode()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Code de vérification</mat-label>
              <input matInput formControlName="code" placeholder="123456"
                     maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
              <mat-icon matPrefix>pin</mat-icon>
              <mat-hint>6 chiffres reçus par email</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" style="margin-top: 8px;">
              <mat-label>Nouveau mot de passe</mat-label>
              <input matInput [type]="hidePassword() ? 'password' : 'text'"
                     formControlName="newPassword" placeholder="••••••••" />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <button mat-icon-button matSuffix type="button"
                      (click)="hidePassword.set(!hidePassword())" tabindex="-1">
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>Minimum 8 caractères</mat-hint>
            </mat-form-field>

            @if (error()) {
              <div class="fp-alert fp-alert--error">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <button mat-flat-button color="primary" type="submit" class="fp-btn"
                    [disabled]="loading() || codeForm.invalid">
              @if (loading()) {
                <mat-spinner diameter="20" /><span>Réinitialisation...</span>
              } @else {
                <mat-icon>check_circle</mat-icon><span>Réinitialiser le mot de passe</span>
              }
            </button>

            <button mat-button type="button" class="fp-link" (click)="backToEmail()">
              <mat-icon>arrow_back</mat-icon> Changer d'email
            </button>
          </form>
        }

        <!-- Étape 3 : succès -->
        @if (step() === 'success') {
          <div class="fp-success">
            <mat-icon class="fp-success__icon">check_circle</mat-icon>
            <h1>Mot de passe réinitialisé</h1>
            <p class="fp-subtitle">Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.</p>
            <button mat-flat-button color="primary" class="fp-btn" (click)="goToLogin()">
              <mat-icon>login</mat-icon><span>Se connecter</span>
            </button>
          </div>
        }

        <!-- Lien retour login (étapes 1 et 2) -->
        @if (step() !== 'success') {
          <div class="fp-back">
            <button mat-button type="button" (click)="goToLogin()">
              <mat-icon>arrow_back</mat-icon> Retour à la connexion
            </button>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .fp-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      padding: 24px;
    }

    .fp-card {
      width: 100%;
      max-width: 420px;
      background: #fff;
      border-radius: 16px;
      padding: 40px 36px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .fp-logo {
      width: 56px;
      height: 56px;
      background: #e8f0fe;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #1565C0;
      }
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 10px;
    }

    .fp-subtitle {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 28px;
    }

    .full-width { width: 100%; }

    .fp-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin: 12px 0;

      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .fp-alert--error {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .fp-btn {
      width: 100%;
      height: 48px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px !important;
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .fp-link {
      width: 100%;
      margin-top: 8px;
      color: #64748b;
      font-size: 13px;
    }

    .fp-back {
      margin-top: 20px;
      text-align: center;

      button {
        color: #64748b;
        font-size: 13px;
      }
    }

    .fp-success {
      text-align: center;

      &__icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: #16a34a;
        margin-bottom: 16px;
      }
    }
  `],
})
export class ForgotPasswordComponent {
  private fb     = inject(FormBuilder);
  private http   = inject(HttpClient);
  private router = inject(Router);
  private tenant = inject(TenantService);

  step        = signal<Step>('email');
  loading     = signal(false);
  error       = signal('');
  hidePassword = signal(true);

  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  codeForm = this.fb.group({
    code:        ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  submitEmail() {
    if (this.emailForm.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.http.post(`${environment.apiUrl}/auth/forgot-password`, {
      email: this.emailForm.value.email,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('code');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossible de contacter le serveur. Réessayez.');
      },
    });
  }

  submitCode() {
    if (this.codeForm.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.http.post(`${environment.apiUrl}/auth/reset-password`, {
      email:       this.emailForm.value.email,
      code:        this.codeForm.value.code,
      newPassword: this.codeForm.value.newPassword,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('success');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Code invalide ou expiré.');
      },
    });
  }

  backToEmail() {
    this.step.set('email');
    this.error.set('');
    this.codeForm.reset();
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
