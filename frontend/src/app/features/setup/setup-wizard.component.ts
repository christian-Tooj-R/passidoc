import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { environment } from '../../../environments/environment';
import { TenantService } from '../../core/services/tenant.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('password')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

@Component({
  selector: 'app-setup-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRippleModule,
  ],
  template: `
<!-- ══════════════════════════════════════════════════════
     ÉCRAN D'ACCUEIL
════════════════════════════════════════════════════════ -->
@if (screen() === 'welcome' || welcomeExit()) {
  <div class="wb" [class.wb--exit]="welcomeExit()">

    <!-- Fond animé -->
    <div class="wb-bg">
      <div class="wb-bg__mesh"></div>
      @for (p of particles; track $index) {
        <span class="wb-dot"
          [style.left.%]="p.x" [style.top.%]="p.y"
          [style.width.px]="p.s" [style.height.px]="p.s"
          [style.animation-delay.s]="p.d" [style.animation-duration.s]="p.dur">
        </span>
      }
      <div class="wb-orb wb-orb--a"></div>
      <div class="wb-orb wb-orb--b"></div>
      <div class="wb-orb wb-orb--c"></div>
    </div>

    <!-- Contenu centré -->
    <div class="wb-content">

      <!-- Logo animé avec orbites -->
      <div class="wb-logo">
        <div class="wb-ring wb-ring--1"></div>
        <div class="wb-ring wb-ring--2"></div>
        <div class="wb-ring wb-ring--3"></div>
        <div class="wb-logo__core">
          <mat-icon>description</mat-icon>
        </div>
      </div>

      <!-- Texte principal -->
      <div class="wb-hero">
        <p class="wb-hero__pre">Bienvenue dans</p>
        <h1 class="wb-hero__name">Passidoc</h1>
        <p class="wb-hero__sub">
          La plateforme intelligente de gestion de cabinet comptable,<br>
          conçue pour les équipes multi-sites.
        </p>
      </div>

      <!-- Chips de fonctionnalités -->
      <div class="wb-feats">
        @for (f of features; track f.label; let i = $index) {
          <div class="wb-feat" [style.animation-delay.s]="1.8 + i * 0.15">
            <mat-icon>{{ f.icon }}</mat-icon>
            <span>{{ f.label }}</span>
          </div>
        }
      </div>

      <!-- CTA -->
      <button class="wb-cta" matRipple (click)="startSetup()">
        <span>Commencer la configuration</span>
        <span class="wb-cta__arrow">
          <mat-icon>arrow_forward</mat-icon>
        </span>
      </button>

      <p class="wb-footer-hint">Configuration initiale · Quelques minutes suffisent</p>
    </div>

  </div>
}

<!-- ══════════════════════════════════════════════════════
     ASSISTANT DE CONFIGURATION
════════════════════════════════════════════════════════ -->
@if (screen() === 'wizard') {
  <div class="sw-page">

    <!-- Fond -->
    <div class="sw-bg">
      <div class="sw-bg__orb sw-bg__orb--1"></div>
      <div class="sw-bg__orb sw-bg__orb--2"></div>
    </div>

    <!-- Carte -->
    <div class="sw-card">

      <!-- En-tête -->
      <div class="sw-header">
        <div class="sw-header__logo">
          <mat-icon>description</mat-icon>
        </div>
        <div>
          <h2 class="sw-header__title">Configuration initiale</h2>
          <p class="sw-header__sub">Passidoc · Étape {{ currentStep() + 1 }} sur {{ steps.length }}</p>
        </div>
      </div>

      <!-- Barre de progression -->
      <div class="sw-progress">
        <div class="sw-progress__bar" [style.width.%]="((currentStep() + 1) / steps.length) * 100"></div>
      </div>

      <!-- Steps -->
      <div class="sw-steps">
        @for (s of steps; track s.n; let i = $index) {
          <div class="sw-step"
            [class.sw-step--done]="currentStep() > i"
            [class.sw-step--active]="currentStep() === i">
            <div class="sw-step__dot">
              @if (currentStep() > i) { <mat-icon>check</mat-icon> }
              @else { <span>{{ i + 1 }}</span> }
            </div>
            <span class="sw-step__lbl">{{ s.label }}</span>
          </div>
          @if (i < steps.length - 1) {
            <div class="sw-step__line" [class.sw-step__line--done]="currentStep() > i"></div>
          }
        }
      </div>

      <!-- ── Étape 0 : Votre cabinet ─────────────────── -->
      @if (currentStep() === 0) {
        <div class="sw-body" [formGroup]="step0">
          <div class="sw-step-hd">
            <div class="sw-step-icon" style="background:#EFF6FF">
              <mat-icon style="color:#1A73E8">business</mat-icon>
            </div>
            <div>
              <h3 class="sw-step-title">Votre cabinet</h3>
              <p class="sw-step-desc">Ces informations apparaîtront dans toute l'application.</p>
            </div>
          </div>

          <mat-form-field appearance="outline" class="sw-field--full">
            <mat-label>Sous-domaine *</mat-label>
            <mat-icon matPrefix>link</mat-icon>
            <input matInput formControlName="slug" placeholder="ex : afym" [readonly]="!!tenant.slug()" />
            <mat-hint>{{ step0.value.slug || '…' }}.passidoc.re</mat-hint>
            @if (step0.get('slug')?.hasError('required') && step0.get('slug')?.touched) {
              <mat-error>Le sous-domaine est obligatoire</mat-error>
            }
            @if (step0.get('slug')?.hasError('pattern') && step0.get('slug')?.touched) {
              <mat-error>Lettres minuscules, chiffres et tirets uniquement</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="sw-field--full">
            <mat-label>Nom du cabinet *</mat-label>
            <mat-icon matPrefix>corporate_fare</mat-icon>
            <input matInput formControlName="nomSociete" placeholder="ex : AFYM Audit Expertise" />
            @if (step0.get('nomSociete')?.hasError('required') && step0.get('nomSociete')?.touched) {
              <mat-error>Le nom du cabinet est obligatoire</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="sw-field--full">
            <mat-label>Slogan</mat-label>
            <mat-icon matPrefix>format_quote</mat-icon>
            <input matInput formControlName="slogan" placeholder="ex : Votre partenaire comptable de confiance" />
          </mat-form-field>

          <div class="sw-row">
            <mat-form-field appearance="outline" class="sw-field">
              <mat-label>Ville</mat-label>
              <mat-icon matPrefix>location_city</mat-icon>
              <input matInput formControlName="ville" placeholder="Saint-Denis" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="sw-field">
              <mat-label>Pays</mat-label>
              <mat-icon matPrefix>flag</mat-icon>
              <input matInput formControlName="pays" placeholder="France" />
            </mat-form-field>
          </div>

          <!-- Upload logo -->
          <div class="logo-section">
            <label class="logo-section__label">
              <mat-icon>image</mat-icon> Logo du cabinet
              <span class="logo-section__hint">PNG, JPG, SVG, WebP · max 2 Mo</span>
            </label>

            <div class="logo-drop"
              [class.logo-drop--over]="isDragOver()"
              [class.logo-drop--filled]="!!logoPreview()"
              (click)="logoInput.click()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)">

              @if (logoPreview()) {
                <img class="logo-drop__img" [src]="logoPreview()!" alt="Aperçu" />
                <div class="logo-drop__overlay">
                  <button class="logo-drop__change" (click)="logoInput.click(); $event.stopPropagation()">
                    <mat-icon>edit</mat-icon> Changer
                  </button>
                  <button class="logo-drop__remove" (click)="clearLogo($event)">
                    <mat-icon>delete_outline</mat-icon> Supprimer
                  </button>
                </div>
                @if (logoFileName()) {
                  <span class="logo-drop__name">{{ logoFileName() }}</span>
                }
              } @else {
                <div class="logo-drop__empty">
                  <div class="logo-drop__icon-wrap" [class.logo-drop__icon-wrap--over]="isDragOver()">
                    <mat-icon>cloud_upload</mat-icon>
                  </div>
                  <span class="logo-drop__text">Glissez votre logo ici</span>
                  <span class="logo-drop__or">ou</span>
                  <span class="logo-drop__browse">Parcourir les fichiers</span>
                </div>
              }
            </div>

            @if (logoError()) {
              <p class="logo-error"><mat-icon>error_outline</mat-icon> {{ logoError() }}</p>
            }

            <input #logoInput type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              (change)="onLogoFileChange($event)" style="display:none" />
          </div>
        </div>
      }

      <!-- ── Étape 1 : Pôles géographiques ──────────── -->
      @if (currentStep() === 1) {
        <div class="sw-body" [formGroup]="step1">
          <div class="sw-step-hd">
            <div class="sw-step-icon" style="background:#F0FDF4">
              <mat-icon style="color:#16A34A">language</mat-icon>
            </div>
            <div>
              <h3 class="sw-step-title">Pôles géographiques</h3>
              <p class="sw-step-desc">Ces libellés désignent vos deux entités dans toute l'application.</p>
            </div>
          </div>

          <div class="pole-row">
            <div class="pole-row__flag">🇷🇪</div>
            <mat-form-field appearance="outline" class="sw-field--flex">
              <mat-label>Pôle 1 — libellé affiché</mat-label>
              <input matInput formControlName="poleLabel1" />
              <mat-hint>Ex : La Réunion, Antenne RUN, Siège…</mat-hint>
            </mat-form-field>
          </div>

          <div class="pole-row">
            <div class="pole-row__flag">🇲🇬</div>
            <mat-form-field appearance="outline" class="sw-field--flex">
              <mat-label>Pôle 2 — libellé affiché</mat-label>
              <input matInput formControlName="poleLabel2" />
              <mat-hint>Ex : Madagascar, Antenne MADA…</mat-hint>
            </mat-form-field>
          </div>

          <div class="sw-info">
            <mat-icon>info_outline</mat-icon>
            <span>Les codes internes <strong>REUNION</strong> / <strong>MADAGASCAR</strong> restent inchangés. Seuls les libellés d'affichage sont personnalisés.</span>
          </div>
        </div>
      }

      <!-- ── Étape 2 : Compte administrateur ──────── -->
      @if (currentStep() === 2) {
        <div class="sw-body" [formGroup]="step2">
          <div class="sw-step-hd">
            <div class="sw-step-icon" style="background:#FFF7ED">
              <mat-icon style="color:#EA580C">manage_accounts</mat-icon>
            </div>
            <div>
              <h3 class="sw-step-title">Compte administrateur</h3>
              <p class="sw-step-desc">Ce compte disposera de tous les droits sur l'application.</p>
            </div>
          </div>

          <div class="sw-row">
            <mat-form-field appearance="outline" class="sw-field">
              <mat-label>Prénom *</mat-label>
              <mat-icon matPrefix>person_outline</mat-icon>
              <input matInput formControlName="adminFirstName" />
              @if (step2.get('adminFirstName')?.hasError('required') && step2.get('adminFirstName')?.touched) {
                <mat-error>Obligatoire</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="sw-field">
              <mat-label>Nom *</mat-label>
              <input matInput formControlName="adminLastName" />
              @if (step2.get('adminLastName')?.hasError('required') && step2.get('adminLastName')?.touched) {
                <mat-error>Obligatoire</mat-error>
              }
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="sw-field--full">
            <mat-label>Adresse e-mail *</mat-label>
            <mat-icon matPrefix>alternate_email</mat-icon>
            <input matInput formControlName="adminEmail" type="email" placeholder="admin@cabinet.com" />
            @if (step2.get('adminEmail')?.hasError('email') && step2.get('adminEmail')?.touched) {
              <mat-error>Adresse e-mail invalide</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="sw-field--full">
            <mat-label>Mot de passe *</mat-label>
            <mat-icon matPrefix>lock_outline</mat-icon>
            <input matInput [type]="showPw() ? 'text' : 'password'" formControlName="password" />
            <button matSuffix mat-icon-button type="button" (click)="showPw.set(!showPw())">
              <mat-icon>{{ showPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (step2.get('password')?.hasError('minlength') && step2.get('password')?.touched) {
              <mat-error>8 caractères minimum</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="sw-field--full">
            <mat-label>Confirmer le mot de passe *</mat-label>
            <mat-icon matPrefix>lock_outline</mat-icon>
            <input matInput [type]="showPw() ? 'text' : 'password'" formControlName="confirmPassword" />
            @if (step2.hasError('mismatch') && step2.get('confirmPassword')?.touched) {
              <mat-error>Les mots de passe ne correspondent pas</mat-error>
            }
          </mat-form-field>
        </div>
      }

      <!-- ── Étape 3 : Confirmation ────────────────── -->
      @if (currentStep() === 3) {
        <div class="sw-body">
          <div class="sw-step-hd">
            <div class="sw-step-icon" style="background:#F5F3FF">
              <mat-icon style="color:#7C3AED">rocket_launch</mat-icon>
            </div>
            <div>
              <h3 class="sw-step-title">Tout est prêt !</h3>
              <p class="sw-step-desc">Vérifiez le récapitulatif avant de lancer Passidoc.</p>
            </div>
          </div>

          <div class="recap">
            @if (logoPreview()) {
              <div class="recap__logo-preview">
                <img [src]="logoPreview()!" alt="Logo" />
              </div>
            }
            <div class="recap__rows">
              <div class="recap__row">
                <mat-icon>corporate_fare</mat-icon>
                <span class="rr-label">Cabinet</span>
                <span class="rr-val">{{ step0.value.nomSociete }}</span>
              </div>
              @if (step0.value.slogan) {
                <div class="recap__row">
                  <mat-icon>format_quote</mat-icon>
                  <span class="rr-label">Slogan</span>
                  <span class="rr-val">{{ step0.value.slogan }}</span>
                </div>
              }
              @if (step0.value.ville || step0.value.pays) {
                <div class="recap__row">
                  <mat-icon>location_city</mat-icon>
                  <span class="rr-label">Localisation</span>
                  <span class="rr-val">{{ locationText() }}</span>
                </div>
              }
              <div class="recap__divider"></div>
              <div class="recap__row">
                <span class="rr-flag">🇷🇪</span>
                <span class="rr-label">Pôle 1</span>
                <span class="rr-val">{{ step1.value.poleLabel1 }}</span>
              </div>
              <div class="recap__row">
                <span class="rr-flag">🇲🇬</span>
                <span class="rr-label">Pôle 2</span>
                <span class="rr-val">{{ step1.value.poleLabel2 }}</span>
              </div>
              <div class="recap__divider"></div>
              <div class="recap__row">
                <mat-icon>manage_accounts</mat-icon>
                <span class="rr-label">Admin</span>
                <span class="rr-val">{{ step2.value.adminFirstName }} {{ step2.value.adminLastName }}</span>
              </div>
              <div class="recap__row">
                <mat-icon>alternate_email</mat-icon>
                <span class="rr-label">E-mail</span>
                <span class="rr-val">{{ step2.value.adminEmail }}</span>
              </div>
            </div>
          </div>

          @if (submitError()) {
            <div class="sw-error">
              <mat-icon>error_outline</mat-icon>
              <span>{{ submitError() }}</span>
            </div>
          }
        </div>
      }

      <!-- Navigation -->
      <div class="sw-nav">
        @if (currentStep() > 0) {
          <button mat-button class="sw-back" (click)="prev()" [disabled]="loading()">
            <mat-icon>arrow_back</mat-icon> Retour
          </button>
        }
        <div style="flex:1"></div>
        @if (currentStep() < steps.length - 1) {
          <button mat-flat-button class="sw-next" (click)="next()" [disabled]="loading()">
            Suivant <mat-icon>arrow_forward</mat-icon>
          </button>
        } @else {
          <button mat-flat-button class="sw-launch" (click)="submit()" [disabled]="loading()">
            @if (loading()) {
              <mat-spinner diameter="18" style="display:inline-block;margin-right:8px;vertical-align:middle"></mat-spinner>
            }
            @if (!loading()) { <mat-icon>rocket_launch</mat-icon> }
            Lancer Passidoc
          </button>
        }
      </div>

    </div><!-- /sw-card -->
  </div><!-- /sw-page -->
}

<!-- ══════════════════════════════════════════════════════
     TRANSITION — FEUILLE DE CAHIER
════════════════════════════════════════════════════════ -->
@if (showPageTurn()) {
  <div class="pt-stage">
    <div class="pt-paper">
      <!-- Trous de reliure -->
      <div class="pt-holes">
        <span class="pt-hole"></span>
        <span class="pt-hole"></span>
        <span class="pt-hole"></span>
      </div>
      <!-- Reflet lumière qui traverse -->
      <div class="pt-shine"></div>
      <!-- Contenu central -->
      <div class="pt-center">
        <div class="pt-check">
          <mat-icon>check_circle</mat-icon>
        </div>
        <p class="pt-label">Passidoc est prêt !</p>
        <p class="pt-sub">Redirection vers la connexion…</p>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: block; }

    /* ════════════════════════════════════════════════════
       ÉCRAN D'ACCUEIL
    ════════════════════════════════════════════════════ */
    .wb {
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at 20% 30%, #0f1f4a 0%, #06101f 50%, #030810 100%);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; z-index: 200;
      transition: opacity .7s cubic-bezier(.4,0,.2,1), transform .7s cubic-bezier(.4,0,.2,1);
    }
    .wb--exit { opacity: 0; transform: scale(1.03); pointer-events: none; }

    /* ── Fond ─────────────────────────────────────────── */
    .wb-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }

    .wb-bg__mesh {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(96,165,250,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(96,165,250,.04) 1px, transparent 1px);
      background-size: 60px 60px;
    }

    .wb-orb {
      position: absolute; border-radius: 50%;
      filter: blur(90px); pointer-events: none;
    }
    .wb-orb--a { width: 600px; height: 600px; background: rgba(26,115,232,.18); top: -180px; left: -150px; }
    .wb-orb--b { width: 500px; height: 500px; background: rgba(124,58,237,.14); bottom: -100px; right: -80px; }
    .wb-orb--c { width: 350px; height: 350px; background: rgba(13,148,136,.12); top: 40%; left: 55%; }

    .wb-dot {
      position: absolute; border-radius: 50%;
      background: rgba(96,165,250,.55);
      animation: wb-rise linear infinite;
      opacity: 0;
    }
    @keyframes wb-rise {
      0%   { opacity: 0; transform: translateY(0) scale(1); }
      15%  { opacity: 1; }
      85%  { opacity: .4; }
      100% { opacity: 0; transform: translateY(-280px) scale(.4); }
    }

    /* ── Contenu ──────────────────────────────────────── */
    .wb-content {
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: center; gap: 0;
      padding: 24px 16px; text-align: center; max-width: 640px; width: 100%;
    }

    /* Logo avec anneaux orbitaux */
    .wb-logo {
      position: relative;
      width: 160px; height: 160px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 36px;
      animation: wb-logo-appear .8s cubic-bezier(.34,1.56,.64,1) forwards;
      opacity: 0;
    }
    @keyframes wb-logo-appear {
      from { opacity: 0; transform: scale(.3); }
      to   { opacity: 1; transform: scale(1); }
    }

    .wb-ring {
      position: absolute; border-radius: 50%;
      animation: wb-spin linear infinite;
    }
    .wb-ring--1 {
      width: 90px; height: 90px;
      border: 1.5px solid rgba(96,165,250,.35);
      animation-duration: 7s;
    }
    .wb-ring--1::after {
      content: ''; position: absolute; top: -5px; left: calc(50% - 5px);
      width: 10px; height: 10px; border-radius: 50%;
      background: #60a5fa; box-shadow: 0 0 10px #60a5fa, 0 0 20px rgba(96,165,250,.6);
    }
    .wb-ring--2 {
      width: 122px; height: 122px;
      border: 1px solid rgba(167,139,250,.25);
      animation-duration: 11s; animation-direction: reverse;
    }
    .wb-ring--2::after {
      content: ''; position: absolute; top: -4px; left: calc(50% - 4px);
      width: 8px; height: 8px; border-radius: 50%;
      background: #a78bfa; box-shadow: 0 0 8px #a78bfa, 0 0 16px rgba(167,139,250,.5);
    }
    .wb-ring--3 {
      width: 156px; height: 156px;
      border: 1px solid rgba(26,115,232,.15);
      animation-duration: 17s;
    }
    .wb-ring--3::after {
      content: ''; position: absolute; top: -3px; left: calc(50% - 3px);
      width: 6px; height: 6px; border-radius: 50%;
      background: #93c5fd; box-shadow: 0 0 6px #93c5fd;
    }
    @keyframes wb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .wb-logo__core {
      width: 52px; height: 52px; border-radius: 16px; z-index: 1;
      background: linear-gradient(135deg, #1565C0 0%, #7C3AED 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 30px rgba(26,115,232,.5), 0 0 60px rgba(124,58,237,.3);
      animation: wb-core-pulse 3s ease-in-out infinite;
    }
    .wb-logo__core mat-icon { color: #fff; font-size: 26px; width: 26px; height: 26px; }
    @keyframes wb-core-pulse {
      0%, 100% { box-shadow: 0 0 30px rgba(26,115,232,.5), 0 0 60px rgba(124,58,237,.3); }
      50%       { box-shadow: 0 0 45px rgba(26,115,232,.7), 0 0 90px rgba(124,58,237,.5); }
    }

    /* Texte hero */
    .wb-hero { margin-bottom: 32px; }
    .wb-hero__pre {
      font-size: 16px; font-weight: 400; color: rgba(255,255,255,.55);
      letter-spacing: .5px; margin: 0 0 6px;
      animation: wb-fade-up .7s ease forwards; animation-delay: .6s; opacity: 0;
    }
    .wb-hero__name {
      font-size: clamp(42px, 8vw, 68px); font-weight: 800; margin: 0 0 16px;
      letter-spacing: -2px; line-height: 1;
      background: linear-gradient(90deg, #60a5fa 0%, #c4b5fd 40%, #93c5fd 70%, #60a5fa 100%);
      background-size: 300% auto;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: wb-fade-up .7s ease forwards, wb-shimmer 4s linear infinite;
      animation-delay: .9s, 0s;
      opacity: 0;
    }
    @keyframes wb-shimmer { to { background-position: 300% center; } }
    .wb-hero__sub {
      font-size: 15px; line-height: 1.65; color: rgba(255,255,255,.45);
      margin: 0;
      animation: wb-fade-up .7s ease forwards; animation-delay: 1.3s; opacity: 0;
    }

    /* Feature chips */
    .wb-feats {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
      margin-bottom: 40px;
    }
    .wb-feat {
      display: flex; align-items: center; gap: 7px;
      padding: 8px 16px; border-radius: 100px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.10);
      font-size: 13px; font-weight: 500; color: rgba(255,255,255,.75);
      backdrop-filter: blur(8px);
      animation: wb-fade-up .6s ease forwards; opacity: 0;
      transition: background .2s, border-color .2s;
    }
    .wb-feat:hover {
      background: rgba(255,255,255,.10); border-color: rgba(96,165,250,.35);
      color: #fff;
    }
    .wb-feat mat-icon { font-size: 16px; width: 16px; height: 16px; color: #60a5fa; }

    /* CTA */
    .wb-cta {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 36px; border-radius: 100px; border: none; cursor: pointer;
      background: linear-gradient(90deg, #1A73E8 0%, #7C3AED 100%);
      color: #fff; font-size: 16px; font-weight: 700; letter-spacing: .2px;
      box-shadow: 0 8px 32px rgba(26,115,232,.4), 0 0 0 1px rgba(255,255,255,.08);
      position: relative; overflow: hidden;
      animation: wb-fade-up .7s ease forwards; animation-delay: 2.5s; opacity: 0;
      transition: transform .2s, box-shadow .2s;
    }
    .wb-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(26,115,232,.55), 0 0 0 1px rgba(255,255,255,.12); }
    .wb-cta:active { transform: translateY(0); }
    .wb-cta::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
      transform: translateX(-100%);
      animation: wb-cta-shine 3s ease infinite; animation-delay: 3.5s;
    }
    @keyframes wb-cta-shine {
      0%   { transform: translateX(-100%); }
      40%, 100% { transform: translateX(100%); }
    }
    .wb-cta__arrow {
      display: flex; align-items: center;
      transition: transform .25s;
    }
    .wb-cta:hover .wb-cta__arrow { transform: translateX(5px); }
    .wb-cta mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* Hint bas de page */
    .wb-footer-hint {
      font-size: 12px; color: rgba(255,255,255,.25); margin: 20px 0 0;
      letter-spacing: .5px;
      animation: wb-fade-up .6s ease forwards; animation-delay: 2.9s; opacity: 0;
    }

    @keyframes wb-fade-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ════════════════════════════════════════════════════
       WIZARD DE CONFIGURATION
    ════════════════════════════════════════════════════ */
    .sw-page {
      min-height: 100vh; width: 100%;
      background: linear-gradient(135deg, #0B1437 0%, #1E2D5C 55%, #0D2347 100%);
      display: flex; align-items: center; justify-content: center;
      padding: 32px 16px; position: relative; overflow: hidden;
      animation: sw-enter .65s cubic-bezier(.22,1,.36,1) forwards;
    }
    @keyframes sw-enter {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .sw-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .sw-bg__orb {
      position: absolute; border-radius: 50%; filter: blur(80px); opacity: .18;
    }
    .sw-bg__orb--1 { width: 500px; height: 500px; background: #1A73E8; top: -150px; left: -100px; }
    .sw-bg__orb--2 { width: 400px; height: 400px; background: #7C3AED; bottom: -80px; right: -60px; }

    /* Carte */
    .sw-card {
      position: relative; z-index: 1;
      width: 100%; max-width: 600px;
      background: #fff; border-radius: 22px;
      box-shadow: 0 32px 80px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.07);
      overflow: hidden; display: flex; flex-direction: column;
    }

    /* En-tête */
    .sw-header {
      display: flex; align-items: center; gap: 14px;
      padding: 24px 28px 16px;
      background: linear-gradient(90deg, #F8FAFF 0%, #fff 100%);
      border-bottom: 1px solid #EFF2F7;
    }
    .sw-header__logo {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, #1565C0, #7C3AED);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(21,101,192,.35);
    }
    .sw-header__logo mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .sw-header__title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0; letter-spacing: -.2px; }
    .sw-header__sub { font-size: 12px; color: #94A3B8; margin: 2px 0 0; }

    /* Barre de progression */
    .sw-progress {
      height: 3px; background: #EFF2F7;
    }
    .sw-progress__bar {
      height: 100%;
      background: linear-gradient(90deg, #1A73E8, #7C3AED);
      transition: width .5s cubic-bezier(.4,0,.2,1);
    }

    /* Steps indicateurs */
    .sw-steps {
      display: flex; align-items: center;
      padding: 16px 28px 0;
    }
    .sw-step { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; }
    .sw-step__dot {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      background: #E2E8F0; color: #94A3B8;
      transition: background .25s, box-shadow .25s;
    }
    .sw-step__dot mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .sw-step--active .sw-step__dot { background: #1A73E8; color: #fff; box-shadow: 0 3px 10px rgba(26,115,232,.4); }
    .sw-step--done   .sw-step__dot { background: #16A34A; color: #fff; }
    .sw-step__lbl { font-size: 10px; font-weight: 600; color: #94A3B8; letter-spacing: .3px; white-space: nowrap; }
    .sw-step--active .sw-step__lbl { color: #1A73E8; }
    .sw-step--done   .sw-step__lbl { color: #16A34A; }
    .sw-step__line { flex: 1; height: 2px; background: #E2E8F0; margin: 0 4px 22px; transition: background .25s; }
    .sw-step__line--done { background: #16A34A; }

    /* Corps d'étape */
    .sw-body { padding: 20px 28px 4px; display: flex; flex-direction: column; gap: 4px; }
    .sw-step-hd { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
    .sw-step-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .sw-step-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .sw-step-title { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
    .sw-step-desc  { font-size: 12.5px; color: #64748B; margin: 0; line-height: 1.5; }

    /* Champs */
    .sw-field--full { width: 100%; margin-bottom: 2px; }
    .sw-field--flex { flex: 1; }
    .sw-field       { flex: 1; }
    .sw-row { display: flex; gap: 12px; }
    .sw-row .sw-field { min-width: 0; }

    /* Upload logo */
    .logo-section { margin-top: 4px; margin-bottom: 6px; }
    .logo-section__label {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;
    }
    .logo-section__label mat-icon { font-size: 16px; width: 16px; height: 16px; color: #6B7280; }
    .logo-section__hint { font-size: 11px; color: #9CA3AF; font-weight: 400; margin-left: 4px; }

    .logo-drop {
      border: 2px dashed #D1D5DB; border-radius: 14px;
      cursor: pointer; transition: border-color .2s, background .2s;
      min-height: 130px; position: relative; overflow: hidden;
      background: #FAFAFA;
    }
    .logo-drop:hover     { border-color: #1A73E8; background: #F0F7FF; }
    .logo-drop--over     { border-color: #1A73E8; background: #EBF3FF; border-style: solid; }
    .logo-drop--filled   { border-style: solid; border-color: #D1FAE5; background: #F0FDF4; cursor: default; }
    .logo-drop--filled:hover { border-color: #6EE7B7; background: #ECFDF5; }

    .logo-drop__empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 28px 20px; pointer-events: none;
    }
    .logo-drop__icon-wrap {
      width: 48px; height: 48px; border-radius: 12px; background: #EFF6FF;
      display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
      transition: background .2s, transform .2s;
    }
    .logo-drop__icon-wrap--over { background: #BFDBFE; transform: scale(1.12); }
    .logo-drop__icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; color: #1A73E8; }
    .logo-drop__text   { font-size: 14px; font-weight: 600; color: #374151; }
    .logo-drop__or     { font-size: 12px; color: #9CA3AF; }
    .logo-drop__browse {
      font-size: 13px; font-weight: 600; color: #1A73E8;
      text-decoration: underline; text-underline-offset: 2px;
    }

    .logo-drop__img {
      width: 100%; height: 130px; object-fit: contain; padding: 16px;
    }
    .logo-drop__overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,.45); backdrop-filter: blur(2px);
      display: none; align-items: center; justify-content: center; gap: 12px;
      border-radius: 12px;
    }
    .logo-drop--filled:hover .logo-drop__overlay { display: flex; }
    .logo-drop__change, .logo-drop__remove {
      display: flex; align-items: center; gap: 5px;
      padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; font-family: inherit;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .logo-drop__change { background: #fff; color: #1A73E8; }
    .logo-drop__remove { background: rgba(239,68,68,.9); color: #fff; }
    .logo-drop__name {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 4px 10px; background: rgba(0,0,0,.5);
      font-size: 11px; color: rgba(255,255,255,.8);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .logo-error {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #DC2626; margin-top: 6px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    /* Pôles */
    .pole-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .pole-row__flag { font-size: 28px; flex-shrink: 0; }

    /* Info */
    .sw-info {
      display: flex; align-items: flex-start; gap: 9px;
      padding: 11px 14px; border-radius: 10px;
      background: #EFF6FF; border: 1px solid #BFDBFE;
      font-size: 12px; color: #1E40AF; line-height: 1.55;
      margin-top: 4px;
    }
    .sw-info mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px; }

    /* Recap */
    .recap { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
    .recap__logo-preview {
      display: flex; justify-content: center;
      padding: 14px; background: #F8FAFF; border-radius: 12px;
      border: 1px solid #E2E8F0;
    }
    .recap__logo-preview img { height: 50px; max-width: 200px; object-fit: contain; }
    .recap__rows { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
    .recap__row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid #F1F5F9;
    }
    .recap__row:last-child { border-bottom: none; }
    .recap__row mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94A3B8; flex-shrink: 0; }
    .rr-flag { font-size: 16px; flex-shrink: 0; }
    .rr-label { font-size: 11.5px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: .4px; flex-shrink: 0; min-width: 80px; }
    .rr-val   { font-size: 13.5px; font-weight: 500; color: #1E293B; flex: 1; text-align: right; }
    .recap__divider { height: 3px; background: linear-gradient(90deg, #1A73E8 0%, #7C3AED 100%); }

    /* Erreur */
    .sw-error {
      display: flex; align-items: center; gap: 9px;
      padding: 11px 14px; border-radius: 10px;
      background: #FEF2F2; border: 1px solid #FECACA;
      color: #DC2626; font-size: 13px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; }
    }

    /* Navigation */
    .sw-nav { display: flex; align-items: center; padding: 18px 28px 26px; }
    .sw-back {
      display: flex; align-items: center; gap: 5px;
      color: #64748B; font-size: 14px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .sw-next, .sw-launch {
      display: flex; align-items: center; gap: 8px;
      padding: 0 22px; height: 42px; border-radius: 10px;
      font-size: 14px; font-weight: 600;
      background: #1A73E8 !important; color: #fff !important;
      box-shadow: 0 4px 14px rgba(26,115,232,.35);
      transition: box-shadow .18s, transform .12s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .sw-next:hover:not([disabled]), .sw-launch:hover:not([disabled]) {
      box-shadow: 0 6px 20px rgba(26,115,232,.45); transform: translateY(-1px);
    }
    .sw-launch { background: linear-gradient(135deg, #1A73E8, #7C3AED) !important; }
    .sw-launch:hover:not([disabled]) { box-shadow: 0 6px 20px rgba(124,58,237,.45); }

    /* ════════════════════════════════════════════════════
       TRANSITION FEUILLE DE CAHIER
    ════════════════════════════════════════════════════ */
    .pt-stage {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: transparent;
      perspective: 1400px;
      pointer-events: none;
    }

    .pt-paper {
      position: fixed; inset: 0;
      background-color: #FEFEF8;
      /* Lignes horizontales de cahier */
      background-image:
        linear-gradient(rgba(160,175,210,.28) 1px, transparent 1px);
      background-size: 100% 30px;
      background-position: 0 48px;
      /* Marge verticale rouge */
      border-left: 3px solid rgba(255,100,100,.45);
      padding-left: 80px;
      box-shadow:
        -8px 0 40px rgba(0,0,0,.25),
        8px 0 40px rgba(0,0,0,.12),
        inset 4px 0 12px rgba(0,0,0,.06);
      transform-origin: 50% 50%;
      animation: pt-wave 2.1s cubic-bezier(.22,.6,.36,1) forwards;
      overflow: hidden;
    }

    @keyframes pt-wave {
      0% {
        transform: perspective(1400px)
                   translateY(55vh) translateX(15vw)
                   rotateX(30deg) rotateY(-40deg) rotateZ(8deg)
                   scale(.35);
        opacity: 0;
        filter: blur(4px);
      }
      10% {
        opacity: 1;
        filter: blur(0);
        transform: perspective(1400px)
                   translateY(5vh) translateX(-5vw)
                   rotateX(-18deg) rotateY(30deg) rotateZ(-5deg)
                   scale(.72);
      }
      22% {
        transform: perspective(1400px)
                   translateY(-4vh) translateX(3vw)
                   rotateX(12deg) rotateY(-22deg) rotateZ(4deg)
                   scale(.88);
      }
      34% {
        transform: perspective(1400px)
                   translateY(2vh) translateX(-2vw)
                   rotateX(-8deg) rotateY(16deg) rotateZ(-3deg)
                   scale(.96);
      }
      46% {
        transform: perspective(1400px)
                   translateY(-1.5vh)
                   rotateX(5deg) rotateY(-10deg) rotateZ(1.5deg)
                   scale(1.01);
      }
      58% {
        transform: perspective(1400px)
                   rotateX(-3deg) rotateY(6deg) rotateZ(-1deg)
                   scale(1.04);
      }
      70% {
        transform: perspective(1400px)
                   rotateX(1.5deg) rotateY(-3deg)
                   scale(1.06);
      }
      82% {
        transform: perspective(1400px)
                   rotateX(0deg) rotateY(0deg)
                   scale(1.08);
        opacity: 1;
      }
      100% {
        transform: perspective(1400px) scale(4.5);
        opacity: 0;
        filter: blur(8px);
      }
    }

    /* Reflet lumineux qui traverse la feuille */
    .pt-shine {
      position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(
        115deg,
        transparent 25%,
        rgba(255,255,255,.7) 48%,
        rgba(255,255,255,.4) 52%,
        transparent 72%
      );
      animation: pt-shine-pass 2.1s ease forwards;
    }
    @keyframes pt-shine-pass {
      0%   { transform: translateX(-130%); opacity: 0; }
      15%  { opacity: 1; }
      70%  { transform: translateX(130%); opacity: .5; }
      100% { opacity: 0; }
    }

    /* Trous de reliure */
    .pt-holes {
      position: absolute; left: 24px; top: 0; bottom: 0;
      display: flex; flex-direction: column;
      justify-content: space-evenly; padding: 15vh 0;
      pointer-events: none;
    }
    .pt-hole {
      width: 20px; height: 20px; border-radius: 50%;
      background: #E2E6F0;
      box-shadow: inset 0 1px 3px rgba(0,0,0,.25),
                  0 1px 0 rgba(255,255,255,.6);
    }

    /* Contenu au centre de la feuille */
    .pt-center {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px;
      animation: pt-content-appear .5s ease forwards;
      animation-delay: .5s; opacity: 0;
    }
    @keyframes pt-content-appear {
      from { opacity: 0; transform: scale(.85); }
      to   { opacity: 1; transform: scale(1); }
    }
    .pt-check {
      width: 70px; height: 70px; border-radius: 50%;
      background: linear-gradient(135deg, #1A73E8, #16A34A);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 28px rgba(22,163,74,.4);
      animation: pt-check-pop .4s cubic-bezier(.34,1.56,.64,1) forwards;
      animation-delay: .6s; transform: scale(0);
    }
    @keyframes pt-check-pop {
      from { transform: scale(0) rotate(-20deg); }
      to   { transform: scale(1) rotate(0deg); }
    }
    .pt-check mat-icon { color: #fff; font-size: 34px; width: 34px; height: 34px; }
    .pt-label {
      font-size: 22px; font-weight: 700; color: #1A1C1E;
      margin: 0; letter-spacing: -.3px;
      font-family: 'Georgia', serif;
    }
    .pt-sub {
      font-size: 13px; color: #94A3B8; margin: 0;
    }
  `],
})
export class SetupWizardComponent {
  @ViewChild('logoInput') logoInputRef!: ElementRef<HTMLInputElement>;

  private fb      = inject(FormBuilder);
  private router  = inject(Router);
  private  http   = inject(HttpClient);
  protected tenant = inject(TenantService);

  screen        = signal<'welcome' | 'wizard'>('welcome');
  welcomeExit   = signal(false);
  currentStep   = signal(0);
  loading       = signal(false);
  submitError   = signal('');
  showPw        = signal(false);
  showPageTurn  = signal(false);

  // Logo upload
  logoPreview  = signal<string | null>(null);
  logoFileName = signal<string | null>(null);
  isDragOver   = signal(false);
  logoError    = signal('');

  // Welcome screen data
  particles = Array.from({ length: 28 }, () => ({
    x:   Math.random() * 100,
    y:   Math.random() * 100 + 20,
    s:   2 + Math.random() * 3,
    d:   Math.random() * 6,
    dur: 7 + Math.random() * 9,
  }));

  features = [
    { icon: 'psychology',       label: 'IA intégrée' },
    { icon: 'public',           label: 'Multi-pôles' },
    { icon: 'sync',             label: 'Flux en temps réel' },
    { icon: 'security',         label: 'Accès sécurisé' },
    { icon: 'folder_shared',    label: 'Gestion des dossiers' },
    { icon: 'analytics',        label: 'Tableau de bord' },
  ];

  readonly steps = [
    { n: 0, label: 'Cabinet'  },
    { n: 1, label: 'Pôles'    },
    { n: 2, label: 'Admin'    },
    { n: 3, label: 'Résumé'   },
  ];

  step0: FormGroup = this.fb.group({
    slug:       [this.tenant.slug() ?? '', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    nomSociete: ['', [Validators.required, Validators.minLength(2)]],
    slogan:     [''],
    ville:      [''],
    pays:       [''],
  });

  step1: FormGroup = this.fb.group({
    poleLabel1: ['La Réunion', Validators.required],
    poleLabel2: ['Madagascar',  Validators.required],
  });

  step2: FormGroup = this.fb.group({
    adminFirstName:  ['', Validators.required],
    adminLastName:   ['', Validators.required],
    adminEmail:      ['', [Validators.required, Validators.email]],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  // ── Actions ────────────────────────────────────────────

  startSetup() {
    this.welcomeExit.set(true);
    setTimeout(() => this.screen.set('wizard'), 700);
  }

  next() {
    const form = this.currentForm();
    if (form) { form.markAllAsTouched(); if (form.invalid) return; }
    this.currentStep.update(s => s + 1);
  }

  prev() { this.currentStep.update(s => s - 1); }

  submit() {
    this.submitError.set('');
    this.loading.set(true);

    const payload = {
      slug:           this.step0.value.slug,
      nomSociete:     this.step0.value.nomSociete,
      slogan:         this.step0.value.slogan   || undefined,
      ville:          this.step0.value.ville    || undefined,
      pays:           this.step0.value.pays     || undefined,
      logoUrl:        this.logoPreview()         || undefined,
      poleLabel1:     this.step1.value.poleLabel1,
      poleLabel2:     this.step1.value.poleLabel2,
      adminFirstName: this.step2.value.adminFirstName,
      adminLastName:  this.step2.value.adminLastName,
      adminEmail:     this.step2.value.adminEmail,
      adminPassword:  this.step2.value.password,
    };

    this.http.post<{ message: string }>(`${environment.apiUrl}/setup`, payload).subscribe({
      next: () => {
        this.tenant.markConfigured();
        this.loading.set(false);
        this.showPageTurn.set(true);
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.submitError.set(err.error?.message ?? 'Une erreur s\'est produite. Veuillez réessayer.');
      },
    });
  }

  // ── Logo upload ────────────────────────────────────────

  onLogoFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processLogoFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  onDragOver(e: DragEvent)  { e.preventDefault(); this.isDragOver.set(true); }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragOver.set(false); }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.processLogoFile(file);
  }

  clearLogo(e: Event) {
    e.stopPropagation();
    this.logoPreview.set(null);
    this.logoFileName.set(null);
    this.logoError.set('');
  }

  processLogoFile(file: File) {
    this.logoError.set('');
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.logoError.set('Format non supporté. Utilisez PNG, JPG, SVG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.logoError.set('Fichier trop volumineux (max 2 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.logoPreview.set(ev.target?.result as string);
      this.logoFileName.set(`${file.name} (${Math.round(file.size / 1024)} Ko)`);
    };
    reader.readAsDataURL(file);
  }

  locationText(): string {
    return [this.step0.value.ville, this.step0.value.pays].filter(v => !!v).join(', ');
  }

  private currentForm(): FormGroup | null {
    if (this.currentStep() === 0) return this.step0;
    if (this.currentStep() === 1) return this.step1;
    if (this.currentStep() === 2) return this.step2;
    return null;
  }
}
