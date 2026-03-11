import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-page">
      <div class="login-brand">
        <div class="login-brand__content">
          <div class="login-brand__logo">
            <mat-icon>description</mat-icon>
          </div>
          <h1>Passidoc</h1>
          <p>La plateforme de gestion des dossiers permanents dynamiques d'AFYM Audit Expertise.</p>
          <div class="login-brand__features">
            <div class="feature-item"><mat-icon>verified</mat-icon><span>Dossiers clients centralisés</span></div>
            <div class="feature-item"><mat-icon>trending_up</mat-icon><span>Score santé en temps réel</span></div>
            <div class="feature-item"><mat-icon>public</mat-icon><span>Multi-sites Réunion &amp; Madagascar</span></div>
          </div>
        </div>
        <div class="login-brand__footer">AFYM Audit Expertise &copy; {{ year }}</div>
      </div>

      <div class="login-form-panel">
        <div class="login-form-wrap">
          <div class="login-form-header">
            <h2>Connexion</h2>
            <p>Entrez vos identifiants pour accéder à la plateforme</p>
          </div>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-group">
              <label>Adresse email</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput type="email" formControlName="email" autocomplete="email" placeholder="vous@afym.re" />
                <mat-icon matPrefix class="field-icon">alternate_email</mat-icon>
                @if (form.get('email')?.touched && form.get('email')?.hasError('required')) {
                  <mat-error>Email requis</mat-error>
                }
              </mat-form-field>
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password" placeholder="••••••••" />
                <mat-icon matPrefix class="field-icon">lock_outline</mat-icon>
                <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword" tabindex="-1">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>
            </div>
            @if (error) {
              <div class="error-alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error }}</span>
              </div>
            }
            <button mat-flat-button color="primary" type="submit" class="submit-btn" [disabled]="loading || form.invalid">
              @if (loading) {
                <ng-container><mat-spinner diameter="20" /><span>Connexion...</span></ng-container>
              } @else {
                <ng-container><mat-icon>login</mat-icon><span>Se connecter</span></ng-container>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; display: flex; }
    .login-brand {
      width: 45%;
      background: linear-gradient(145deg, #1e3a5f 0%, #1e40af 55%, #3730a3 100%);
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 56px 48px; color: white; position: relative; overflow: hidden;
    }
    .login-brand::before {
      content: ''; position: absolute; top: -100px; right: -100px;
      width: 420px; height: 420px; background: rgba(255,255,255,0.05); border-radius: 50%;
    }
    .login-brand::after {
      content: ''; position: absolute; bottom: -80px; left: -80px;
      width: 300px; height: 300px; background: rgba(255,255,255,0.05); border-radius: 50%;
    }
    .login-brand__content { position: relative; z-index: 1; }
    .login-brand__logo {
      width: 64px; height: 64px; background: rgba(255,255,255,0.15);
      border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 32px;
    }
    .login-brand__logo mat-icon { font-size: 32px; width: 32px; height: 32px; color: white; }
    .login-brand h1 { font-size: 38px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 16px; }
    .login-brand p { font-size: 16px; color: rgba(255,255,255,0.75); line-height: 1.65; margin-bottom: 48px; }
    .login-brand__features { display: flex; flex-direction: column; gap: 18px; }
    .feature-item { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(255,255,255,0.85); }
    .feature-item mat-icon { font-size: 20px; width: 20px; height: 20px; color: #93c5fd; }
    .login-brand__footer { font-size: 12px; color: rgba(255,255,255,0.4); position: relative; z-index: 1; }
    .login-form-panel {
      flex: 1; display: flex; align-items: center; justify-content: center;
      background: #f8fafc; padding: 40px;
    }
    .login-form-wrap { width: 100%; max-width: 420px; }
    .login-form-header { margin-bottom: 36px; }
    .login-form-header h2 { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .login-form-header p { font-size: 15px; color: #64748b; margin: 0; }
    .form-group { margin-bottom: 6px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .full-width { width: 100%; }
    .field-icon { color: #94a3b8 !important; font-size: 20px !important; }
    .error-alert {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
      padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px;
    }
    .error-alert mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .submit-btn {
      width: 100%; height: 52px; font-size: 15px; font-weight: 600;
      border-radius: 10px !important; margin-top: 8px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    @media (max-width: 768px) {
      .login-brand { display: none; }
      .login-form-panel { padding: 24px; }
    }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  hidePassword = true;
  loading = false;
  error = '';
  year = new Date().getFullYear();

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.requires2FA) {
          this.router.navigate(['/auth/verify-2fa'], { state: { userId: res.userId } });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Identifiants incorrects';
      },
    });
  }
}
