import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
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

          <!-- Onglets -->
          <div class="mode-tabs">
            <button class="mode-tab" [class.mode-tab--active]="mode() === 'login'"
                    (click)="switchMode('login')">
              <mat-icon>login</mat-icon> Connexion
            </button>
            <button class="mode-tab" [class.mode-tab--active]="mode() === 'register'"
                    (click)="switchMode('register')">
              <mat-icon>person_add</mat-icon> Créer un compte
            </button>
          </div>

          <!-- ── Connexion ── -->
          @if (mode() === 'login') {
            <div class="form-header">
              <h2>Bienvenue</h2>
              <p>Entrez vos identifiants pour accéder à la plateforme</p>
            </div>
            <form [formGroup]="loginForm" (ngSubmit)="submitLogin()">
              <div class="form-group">
                <label>Adresse email</label>
                <mat-form-field appearance="outline" class="full-width">
                  <input matInput type="email" formControlName="email"
                         autocomplete="email" placeholder="vous@afym.re" />
                  <mat-icon matPrefix class="field-icon">alternate_email</mat-icon>
                </mat-form-field>
              </div>
              <div class="form-group">
                <label>Mot de passe</label>
                <mat-form-field appearance="outline" class="full-width">
                  <input matInput [type]="hidePassword ? 'password' : 'text'"
                         formControlName="password" placeholder="••••••••" />
                  <mat-icon matPrefix class="field-icon">lock_outline</mat-icon>
                  <button mat-icon-button matSuffix type="button"
                          (click)="hidePassword = !hidePassword" tabindex="-1">
                    <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
              @if (loginError) {
                <div class="alert alert--error">
                  <mat-icon>error_outline</mat-icon><span>{{ loginError }}</span>
                </div>
              }
              <button mat-flat-button color="primary" type="submit" class="submit-btn"
                      [disabled]="loginLoading || loginForm.invalid">
                @if (loginLoading) {
                  <mat-spinner diameter="20" /><span>Connexion...</span>
                } @else {
                  <mat-icon>login</mat-icon><span>Se connecter</span>
                }
              </button>
            </form>
          }

          <!-- ── Créer un compte ── -->
          @if (mode() === 'register') {
            <div class="form-header">
              <h2>Créer un compte</h2>
              <p>Renseignez vos informations pour créer votre accès collaborateur</p>
            </div>

            @if (registerSuccess()) {
              <div class="alert alert--success">
                <mat-icon>check_circle</mat-icon>
                <div>
                  <strong>Compte créé avec succès !</strong>
                  <span>Vous pouvez maintenant vous connecter.</span>
                </div>
              </div>
              <button mat-flat-button color="primary" class="submit-btn"
                      (click)="switchMode('login')">
                <mat-icon>login</mat-icon><span>Se connecter</span>
              </button>
            } @else {
              <form [formGroup]="registerForm" (ngSubmit)="submitRegister()">
                <div class="form-row">
                  <div class="form-group">
                    <label>Prénom</label>
                    <mat-form-field appearance="outline" class="full-width">
                      <input matInput formControlName="firstName" placeholder="Jean" />
                    </mat-form-field>
                  </div>
                  <div class="form-group">
                    <label>Nom</label>
                    <mat-form-field appearance="outline" class="full-width">
                      <input matInput formControlName="lastName" placeholder="Dupont" />
                    </mat-form-field>
                  </div>
                </div>
                <div class="form-group">
                  <label>Adresse email</label>
                  <mat-form-field appearance="outline" class="full-width">
                    <input matInput type="email" formControlName="email"
                           autocomplete="email" placeholder="vous@afym.re" />
                    <mat-icon matPrefix class="field-icon">alternate_email</mat-icon>
                    @if (registerForm.get('email')?.touched && registerForm.get('email')?.hasError('email')) {
                      <mat-error>Email invalide</mat-error>
                    }
                  </mat-form-field>
                </div>
                <div class="form-group">
                  <label>Mot de passe</label>
                  <mat-form-field appearance="outline" class="full-width">
                    <input matInput [type]="hideRegisterPassword ? 'password' : 'text'"
                           formControlName="password" placeholder="••••••••" />
                    <mat-icon matPrefix class="field-icon">lock_outline</mat-icon>
                    <button mat-icon-button matSuffix type="button"
                            (click)="hideRegisterPassword = !hideRegisterPassword" tabindex="-1">
                      <mat-icon>{{ hideRegisterPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <mat-hint>Minimum 8 caractères</mat-hint>
                  </mat-form-field>
                </div>
                <div class="form-group">
                  <label>Site de rattachement</label>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="site">
                      <mat-option value="REUNION">🇷🇪 La Réunion</mat-option>
                      <mat-option value="MADAGASCAR">🇲🇬 Madagascar</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
                @if (registerError) {
                  <div class="alert alert--error">
                    <mat-icon>error_outline</mat-icon><span>{{ registerError }}</span>
                  </div>
                }
                <button mat-flat-button color="primary" type="submit" class="submit-btn"
                        [disabled]="registerLoading || registerForm.invalid">
                  @if (registerLoading) {
                    <mat-spinner diameter="20" /><span>Création...</span>
                  } @else {
                    <mat-icon>person_add</mat-icon><span>Créer mon compte</span>
                  }
                </button>
                <p class="register-note">
                  Votre compte sera créé avec le rôle <strong>Collaborateur</strong>.
                  Un administrateur pourra ajuster vos accès par la suite.
                </p>
              </form>
            }
          }

        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; display: flex; }

    /* ── Panneau gauche (branding) ── */
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

    /* ── Panneau droit (formulaire) ── */
    .login-form-panel {
      flex: 1; display: flex; align-items: center; justify-content: center;
      background: #f8fafc; padding: 40px;
    }
    .login-form-wrap { width: 100%; max-width: 420px; }

    /* ── Onglets mode ── */
    .mode-tabs {
      display: flex; gap: 4px;
      background: #e8ecf5; border-radius: 10px; padding: 4px;
      margin-bottom: 28px;
    }
    .mode-tab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px 12px; border: none; border-radius: 7px;
      font-size: 13px; font-weight: 500; color: #64748b;
      background: transparent; cursor: pointer; transition: all .15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { color: #1e293b; }
    }
    .mode-tab--active {
      background: #fff; color: #162351; font-weight: 700;
      box-shadow: 0 1px 4px rgba(22,35,81,.12);
    }

    /* ── En-tête formulaire ── */
    .form-header { margin-bottom: 28px; }
    .form-header h2 { font-size: 26px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .form-header p  { font-size: 14px; color: #64748b; margin: 0; }

    /* ── Champs ── */
    .form-group { margin-bottom: 4px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .full-width { width: 100%; }
    .field-icon { color: #94a3b8 !important; font-size: 20px !important; }

    /* ── Alertes ── */
    .alert {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
    }
    .alert--error  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert--success {
      background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;
      div { display: flex; flex-direction: column; gap: 2px; }
      strong { font-weight: 700; }
      span { font-size: 13px; opacity: .85; }
    }

    /* ── Bouton principal ── */
    .submit-btn {
      width: 100%; height: 50px; font-size: 15px; font-weight: 600;
      border-radius: 10px !important; margin-top: 8px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }

    /* ── Note inscription ── */
    .register-note {
      margin-top: 14px; font-size: 12px; color: #94a3b8; text-align: center;
      strong { color: #64748b; }
    }

    @media (max-width: 768px) {
      .login-brand { display: none; }
      .login-form-panel { padding: 24px; }
    }
  `],
})
export class LoginComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'login' | 'register'>('login');
  registerSuccess = signal(false);
  year = new Date().getFullYear();

  // Connexion
  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  hidePassword  = true;
  loginLoading  = false;
  loginError    = '';

  // Inscription
  registerForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName:  ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    password:  ['', [Validators.required, Validators.minLength(8)]],
    site:      ['REUNION', Validators.required],
  });
  hideRegisterPassword = true;
  registerLoading = false;
  registerError   = '';

  switchMode(m: 'login' | 'register') {
    this.mode.set(m);
    this.loginError    = '';
    this.registerError = '';
    this.registerSuccess.set(false);
  }

  submitLogin() {
    if (this.loginForm.invalid) return;
    this.loginLoading = true;
    this.loginError   = '';
    const { email, password } = this.loginForm.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        this.loginLoading = false;
        if (res.requires2FA) {
          this.router.navigate(['/auth/verify-2fa'], { state: { userId: res.userId } });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loginLoading = false;
        this.loginError = err.message || 'Identifiants incorrects';
      },
    });
  }

  submitRegister() {
    if (this.registerForm.invalid) return;
    this.registerLoading = true;
    this.registerError   = '';
    const v = this.registerForm.getRawValue();
    this.auth.register({
      firstName: v.firstName!, lastName: v.lastName!,
      email: v.email!, password: v.password!, site: v.site!,
    }).subscribe({
      next: () => {
        this.registerLoading = false;
        this.registerSuccess.set(true);
        // Pré-remplir l'email dans le formulaire de connexion
        this.loginForm.patchValue({ email: v.email! });
      },
      error: (err) => {
        this.registerLoading = false;
        this.registerError = err?.error?.message ?? 'Erreur lors de la création du compte';
      },
    });
  }
}
