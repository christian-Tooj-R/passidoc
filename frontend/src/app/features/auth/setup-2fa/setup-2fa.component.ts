import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-setup-2fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatStepperModule],
  template: `
    <div class="page">
      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>Configuration 2FA</mat-card-title>
          <mat-card-subtitle>Sécurisez votre compte avec l'authentification à deux facteurs</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-stepper orientation="vertical" #stepper>
            <mat-step label="Scanner le QR Code">
              <p>Scannez ce QR Code avec Google Authenticator ou Authy :</p>
              @if (qrCode) {
                <img [src]="qrCode" alt="QR Code 2FA" class="qr-code" />
              }
              <div>
                <button mat-flat-button color="primary" matStepperNext>Suivant</button>
              </div>
            </mat-step>
            <mat-step label="Confirmer le code">
              <form [formGroup]="form" (ngSubmit)="enable()">
                <mat-form-field appearance="outline">
                  <mat-label>Code à 6 chiffres</mat-label>
                  <input matInput formControlName="token" maxlength="6" />
                </mat-form-field>
                @if (error) { <div class="error">{{ error }}</div> }
                @if (success) { <div class="success">2FA activé avec succès !</div> }
                <div>
                  <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading">Activer</button>
                  <button mat-button type="button" (click)="router.navigate(['/dashboard'])">Ignorer</button>
                </div>
              </form>
            </mat-step>
          </mat-stepper>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9; }
    .card { width: 480px; padding: 16px; }
    .qr-code { display: block; margin: 16px auto; border: 1px solid #e2e8f0; border-radius: 8px; }
    .error { color: #dc2626; font-size: 14px; }
    .success { color: #16a34a; font-size: 14px; }
  `],
})
export class Setup2faComponent implements OnInit {
  private fb = inject(FormBuilder);
  form = this.fb.group({ token: ['', [Validators.required, Validators.minLength(6)]] });
  qrCode = '';
  loading = false;
  error = '';
  success = false;

  constructor(public auth: AuthService, public router: Router) {}

  ngOnInit() {
    this.auth.setup2fa().subscribe((res) => (this.qrCode = res.qrCode));
  }

  enable() {
    this.loading = true;
    this.auth.enable2fa(this.form.value.token!).subscribe({
      next: () => { this.success = true; setTimeout(() => this.router.navigate(['/dashboard']), 1500); },
      error: (err) => { this.loading = false; this.error = err.message; },
    });
  }
}
