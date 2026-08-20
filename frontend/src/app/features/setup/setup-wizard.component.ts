import { Component, inject, signal, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { environment } from '../../../environments/environment';
import { TenantService } from '../../core/services/tenant.service';

interface Country { code: string; name: string; flag: string; }

function buildFlag(code: string): string {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1F1A5));
}

const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'AL', name: 'Albanie' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'AD', name: 'Andorre' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua-et-Barbuda' },
  { code: 'SA', name: 'Arabie saoudite' },
  { code: 'AR', name: 'Argentine' },
  { code: 'AM', name: 'Arménie' },
  { code: 'AU', name: 'Australie' },
  { code: 'AT', name: 'Autriche' },
  { code: 'AZ', name: 'Azerbaïdjan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahreïn' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbade' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'BT', name: 'Bhoutan' },
  { code: 'BY', name: 'Biélorussie' },
  { code: 'BO', name: 'Bolivie' },
  { code: 'BA', name: 'Bosnie-Herzégovine' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brésil' },
  { code: 'BN', name: 'Brunéi' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodge' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cap-Vert' },
  { code: 'CF', name: 'Centrafrique' },
  { code: 'CL', name: 'Chili' },
  { code: 'CN', name: 'Chine' },
  { code: 'CY', name: 'Chypre' },
  { code: 'CO', name: 'Colombie' },
  { code: 'KM', name: 'Comores' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (RDC)' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'KP', name: 'Corée du Nord' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatie' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'DK', name: 'Danemark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominique' },
  { code: 'EG', name: 'Égypte' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'AE', name: 'Émirats arabes unis' },
  { code: 'EC', name: 'Équateur' },
  { code: 'ER', name: 'Érythrée' },
  { code: 'ES', name: 'Espagne' },
  { code: 'EE', name: 'Estonie' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'US', name: 'États-Unis' },
  { code: 'ET', name: 'Éthiopie' },
  { code: 'FJ', name: 'Fidji' },
  { code: 'FI', name: 'Finlande' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambie' },
  { code: 'GE', name: 'Géorgie' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Grèce' },
  { code: 'GD', name: 'Grenade' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GF', name: 'Guyane française' },
  { code: 'GN', name: 'Guinée' },
  { code: 'GW', name: 'Guinée-Bissau' },
  { code: 'GQ', name: 'Guinée équatoriale' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haïti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IN', name: 'Inde' },
  { code: 'ID', name: 'Indonésie' },
  { code: 'IQ', name: 'Irak' },
  { code: 'IR', name: 'Iran' },
  { code: 'IE', name: 'Irlande' },
  { code: 'IS', name: 'Islande' },
  { code: 'IL', name: 'Israël' },
  { code: 'IT', name: 'Italie' },
  { code: 'JM', name: 'Jamaïque' },
  { code: 'JP', name: 'Japon' },
  { code: 'JO', name: 'Jordanie' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KG', name: 'Kirghizistan' },
  { code: 'KW', name: 'Koweït' },
  { code: 'LA', name: 'Laos' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LB', name: 'Liban' },
  { code: 'LR', name: 'Libéria' },
  { code: 'LY', name: 'Libye' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MK', name: 'Macédoine du Nord' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MY', name: 'Malaisie' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malte' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MA', name: 'Maroc' },
  { code: 'MU', name: 'Maurice' },
  { code: 'MR', name: 'Mauritanie' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexique' },
  { code: 'FM', name: 'Micronésie' },
  { code: 'MD', name: 'Moldavie' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolie' },
  { code: 'ME', name: 'Monténégro' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibie' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Népal' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigéria' },
  { code: 'NO', name: 'Norvège' },
  { code: 'NC', name: 'Nouvelle-Calédonie' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'OM', name: 'Oman' },
  { code: 'UG', name: 'Ouganda' },
  { code: 'UZ', name: 'Ouzbékistan' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palaos' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papouasie-Nouvelle-Guinée' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PE', name: 'Pérou' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PF', name: 'Polynésie française' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'DO', name: 'Rép. dominicaine' },
  { code: 'RE', name: 'La Réunion' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'RU', name: 'Russie' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BL', name: 'Saint-Barthélemy' },
  { code: 'KN', name: 'Saint-Kitts-et-Nevis' },
  { code: 'LC', name: 'Sainte-Lucie' },
  { code: 'MF', name: 'Saint-Martin' },
  { code: 'PM', name: 'Saint-Pierre-et-Miquelon' },
  { code: 'SM', name: 'Saint-Marin' },
  { code: 'VC', name: 'Saint-Vincent' },
  { code: 'WS', name: 'Samoa' },
  { code: 'ST', name: 'Sao Tomé-et-Principe' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'RS', name: 'Serbie' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapour' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SO', name: 'Somalie' },
  { code: 'SD', name: 'Soudan' },
  { code: 'SS', name: 'Soudan du Sud' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SE', name: 'Suède' },
  { code: 'CH', name: 'Suisse' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SY', name: 'Syrie' },
  { code: 'TJ', name: 'Tadjikistan' },
  { code: 'TW', name: 'Taïwan' },
  { code: 'TZ', name: 'Tanzanie' },
  { code: 'TD', name: 'Tchad' },
  { code: 'CZ', name: 'Tchéquie' },
  { code: 'TH', name: 'Thaïlande' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinité-et-Tobago' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'TM', name: 'Turkménistan' },
  { code: 'TR', name: 'Turquie' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Viêt Nam' },
  { code: 'WF', name: 'Wallis-et-Futuna' },
  { code: 'YE', name: 'Yémen' },
  { code: 'ZM', name: 'Zambie' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'SB', name: 'Îles Salomon' },
  { code: 'MH', name: 'Îles Marshall' },
].map(c => ({ ...c, flag: buildFlag(c.code) }));

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('password')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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
    MatAutocompleteModule,
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

    <!-- ── Navbar ── -->
    <nav class="lp-nav">
      <div class="lp-nav__brand">
        <div class="lp-nav__icon"><mat-icon>description</mat-icon></div>
        <span class="lp-nav__name">Passidoc</span>
      </div>
      <button class="lp-btn lp-btn--outline" matRipple (click)="openLoginModal()">
        <mat-icon>login</mat-icon>
        Se connecter
      </button>
    </nav>

    <!-- ── Hero ── -->
    <section class="lp-hero">
      <h1 class="lp-hero__title">
        Pilotez votre cabinet<br>
        <span class="lp-hero__title-grad">avec l'intelligence artificielle</span>
      </h1>
      <p class="lp-hero__sub">
        Clients, missions, équipes, documents et KPIs réunis dans une seule plateforme
        pensée pour les cabinets d'expertise comptable multi-sites.
      </p>
      <div class="lp-hero__ctas">
        <button class="lp-btn lp-btn--primary lp-btn--lg" matRipple (click)="startSetup()">
          Créer mon espace
          <mat-icon>arrow_forward</mat-icon>
        </button>
        <button class="lp-btn lp-btn--ghost lp-btn--lg" matRipple (click)="scrollToFeatures()">
          Voir les fonctionnalités
          <mat-icon>expand_more</mat-icon>
        </button>
      </div>
      <!-- Badges de confiance -->
      <div class="lp-hero__trust">
        <span class="lp-trust-pill"><mat-icon>lock</mat-icon> Données isolées par cabinet</span>
        <span class="lp-trust-pill"><mat-icon>public</mat-icon> La Réunion &amp; Madagascar</span>
        <span class="lp-trust-pill"><mat-icon>bolt</mat-icon> Environ 3 min pour démarrer</span>
      </div>
    </section>

    <!-- ── Bento features ── -->
    <section class="lp-features" id="lp-features">
      <div class="lp-bento">
        <!-- Grande carte IA -->
        <div class="lp-bento-card lp-bento-card--ai lp-bento-card--wide">
          <div class="lp-bento-card__glow"></div>
          <div class="lp-bento-card__icon lp-bci--blue"><mat-icon>psychology</mat-icon></div>
          <h3 class="lp-bento-card__title">IA intégrée</h3>
          <p class="lp-bento-card__desc">Synthèses automatiques, analyses de dossiers et recommandations intelligentes.</p>
          <div class="lp-bento-card__tag">Claude AI</div>
        </div>
        <!-- Multi-pôles -->
        <div class="lp-bento-card lp-bento-card--multi">
          <div class="lp-bento-card__icon lp-bci--purple"><mat-icon>public</mat-icon></div>
          <h3 class="lp-bento-card__title">Multi-pôles</h3>
          <p class="lp-bento-card__desc">🇷🇪 La Réunion &amp; 🇲🇬 Madagascar — une interface unifiée pour tous vos collaborateurs.</p>
        </div>
        <!-- Pilotage -->
        <div class="lp-bento-card lp-bento-card--pilot">
          <div class="lp-bento-card__icon lp-bci--teal"><mat-icon>analytics</mat-icon></div>
          <h3 class="lp-bento-card__title">Pilotage 360°</h3>
          <p class="lp-bento-card__desc">Tableaux de bord, KPIs en temps réel et suivi de missions pour une visibilité totale.</p>
        </div>
        <!-- Sécurité -->
        <div class="lp-bento-card lp-bento-card--secure">
          <div class="lp-bento-card__icon lp-bci--amber"><mat-icon>verified_user</mat-icon></div>
          <h3 class="lp-bento-card__title">Sécurisé &amp; conforme</h3>
          <p class="lp-bento-card__desc">Isolation des données par tenant, authentification 2FA et gestion fine des rôles.</p>
        </div>

        <!-- QR Code mobile -->
        <div class="lp-bento-card lp-bento-card--qr">
          <div class="lp-qr-block">
            <!-- QR code généré pour https://passidoc-app.onrender.com/passidoc.apk -->
            <svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 14 14" shape-rendering="crispEdges"><rect width="14" height="14" fill="#ffffff"/><path d="M0.4,0.4H0.8V0.8H0.4zM0.8,0.4H1.2V0.8H0.8zM1.2,0.4H1.6V0.8H1.2zM1.6,0.4H2V0.8H1.6zM2,0.4H2.4V0.8H2zM2.4,0.4H2.8V0.8H2.4zM2.8,0.4H3.2V0.8H2.8zM4,0.4H4.4V0.8H4zM4.8,0.4H5.2V0.8H4.8zM5.6,0.4H6V0.8H5.6zM7.2,0.4H7.6V0.8H7.2zM7.6,0.4H8V0.8H7.6zM8,0.4H8.4V0.8H8zM8.4,0.4H8.8V0.8H8.4zM8.8,0.4H9.2V0.8H8.8zM9.6,0.4H10V0.8H9.6zM10.8,0.4H11.2V0.8H10.8zM11.2,0.4H11.6V0.8H11.2zM11.6,0.4H12V0.8H11.6zM12,0.4H12.4V0.8H12zM12.4,0.4H12.8V0.8H12.4zM12.8,0.4H13.2V0.8H12.8zM13.2,0.4H13.6V0.8H13.2zM0.4,0.8H0.8V1.2H0.4zM2.8,0.8H3.2V1.2H2.8zM4.8,0.8H5.2V1.2H4.8zM5.2,0.8H5.6V1.2H5.2zM5.6,0.8H6V1.2H5.6zM6,0.8H6.4V1.2H6zM6.4,0.8H6.8V1.2H6.4zM7.2,0.8H7.6V1.2H7.2zM8.8,0.8H9.2V1.2H8.8zM10.8,0.8H11.2V1.2H10.8zM13.2,0.8H13.6V1.2H13.2zM0.4,1.2H0.8V1.6H0.4zM1.2,1.2H1.6V1.6H1.2zM1.6,1.2H2V1.6H1.6zM2,1.2H2.4V1.6H2zM2.8,1.2H3.2V1.6H2.8zM3.6,1.2H4V1.6H3.6zM4,1.2H4.4V1.6H4zM4.4,1.2H4.8V1.6H4.4zM4.8,1.2H5.2V1.6H4.8zM5.2,1.2H5.6V1.6H5.2zM5.6,1.2H6V1.6H5.6zM7.2,1.2H7.6V1.6H7.2zM7.6,1.2H8V1.6H7.6zM8,1.2H8.4V1.6H8zM8.4,1.2H8.8V1.6H8.4zM8.8,1.2H9.2V1.6H8.8zM10,1.2H10.4V1.6H10zM10.8,1.2H11.2V1.6H10.8zM11.6,1.2H12V1.6H11.6zM12,1.2H12.4V1.6H12zM12.4,1.2H12.8V1.6H12.4zM13.2,1.2H13.6V1.6H13.2zM0.4,1.6H0.8V2H0.4zM1.2,1.6H1.6V2H1.2zM1.6,1.6H2V2H1.6zM2,1.6H2.4V2H2zM2.8,1.6H3.2V2H2.8zM3.6,1.6H4V2H3.6zM4,1.6H4.4V2H4zM4.4,1.6H4.8V2H4.4zM4.8,1.6H5.2V2H4.8zM6,1.6H6.4V2H6zM6.4,1.6H6.8V2H6.4zM6.8,1.6H7.2V2H6.8zM8,1.6H8.4V2H8zM8.4,1.6H8.8V2H8.4zM9.2,1.6H9.6V2H9.2zM9.6,1.6H10V2H9.6zM10.8,1.6H11.2V2H10.8zM11.6,1.6H12V2H11.6zM12,1.6H12.4V2H12zM12.4,1.6H12.8V2H12.4zM13.2,1.6H13.6V2H13.2zM0.4,2H0.8V2.4H0.4zM1.2,2H1.6V2.4H1.2zM1.6,2H2V2.4H1.6zM2,2H2.4V2.4H2zM2.8,2H3.2V2.4H2.8zM3.6,2H4V2.4H3.6zM4.4,2H4.8V2.4H4.4zM5.2,2H5.6V2.4H5.2zM5.6,2H6V2.4H5.6zM6.4,2H6.8V2.4H6.4zM7.2,2H7.6V2.4H7.2zM7.6,2H8V2.4H7.6zM8.8,2H9.2V2.4H8.8zM9.6,2H10V2.4H9.6zM10.8,2H11.2V2.4H10.8zM11.6,2H12V2.4H11.6zM12,2H12.4V2.4H12zM12.4,2H12.8V2.4H12.4zM13.2,2H13.6V2.4H13.2zM0.4,2.4H0.8V2.8H0.4zM2.8,2.4H3.2V2.8H2.8zM3.6,2.4H4V2.8H3.6zM5.2,2.4H5.6V2.8H5.2zM5.6,2.4H6V2.8H5.6zM6,2.4H6.4V2.8H6zM6.4,2.4H6.8V2.8H6.4zM6.8,2.4H7.2V2.8H6.8zM7.2,2.4H7.6V2.8H7.2zM8.4,2.4H8.8V2.8H8.4zM8.8,2.4H9.2V2.8H8.8zM9.2,2.4H9.6V2.8H9.2zM10.8,2.4H11.2V2.8H10.8zM13.2,2.4H13.6V2.8H13.2zM0.4,2.8H0.8V3.2H0.4zM0.8,2.8H1.2V3.2H0.8zM1.2,2.8H1.6V3.2H1.2zM1.6,2.8H2V3.2H1.6zM2,2.8H2.4V3.2H2zM2.4,2.8H2.8V3.2H2.4zM2.8,2.8H3.2V3.2H2.8zM3.6,2.8H4V3.2H3.6zM4.4,2.8H4.8V3.2H4.4zM5.2,2.8H5.6V3.2H5.2zM6,2.8H6.4V3.2H6zM6.8,2.8H7.2V3.2H6.8zM7.6,2.8H8V3.2H7.6zM8.4,2.8H8.8V3.2H8.4zM9.2,2.8H9.6V3.2H9.2zM10,2.8H10.4V3.2H10zM10.8,2.8H11.2V3.2H10.8zM11.2,2.8H11.6V3.2H11.2zM11.6,2.8H12V3.2H11.6zM12,2.8H12.4V3.2H12zM12.4,2.8H12.8V3.2H12.4zM12.8,2.8H13.2V3.2H12.8zM13.2,2.8H13.6V3.2H13.2zM3.6,3.2H4V3.6H3.6zM6.4,3.2H6.8V3.6H6.4zM8.8,3.2H9.2V3.6H8.8zM10,3.2H10.4V3.6H10zM0.4,3.6H0.8V4H0.4zM1.2,3.6H1.6V4H1.2zM1.6,3.6H2V4H1.6zM2,3.6H2.4V4H2zM2.4,3.6H2.8V4H2.4zM2.8,3.6H3.2V4H2.8zM4.4,3.6H4.8V4H4.4zM5.2,3.6H5.6V4H5.2zM5.6,3.6H6V4H5.6zM6,3.6H6.4V4H6zM6.4,3.6H6.8V4H6.4zM6.8,3.6H7.2V4H6.8zM7.2,3.6H7.6V4H7.2zM9.2,3.6H9.6V4H9.2zM10,3.6H10.4V4H10zM10.8,3.6H11.2V4H10.8zM11.2,3.6H11.6V4H11.2zM11.6,3.6H12V4H11.6zM12,3.6H12.4V4H12zM12.4,3.6H12.8V4H12.4zM0.8,4H1.2V4.4H0.8zM1.6,4H2V4.4H1.6zM2.4,4H2.8V4.4H2.4zM4,4H4.4V4.4H4zM4.8,4H5.2V4.4H4.8zM6.8,4H7.2V4.4H6.8zM7.6,4H8V4.4H7.6zM8,4H8.4V4.4H8zM9.6,4H10V4.4H9.6zM10.8,4H11.2V4.4H10.8zM11.2,4H11.6V4.4H11.2zM12,4H12.4V4.4H12zM12.4,4H12.8V4.4H12.4zM13.2,4H13.6V4.4H13.2zM0.8,4.4H1.2V4.8H0.8zM1.2,4.4H1.6V4.8H1.2zM2,4.4H2.4V4.8H2zM2.4,4.4H2.8V4.8H2.4zM2.8,4.4H3.2V4.8H2.8zM4.4,4.4H4.8V4.8H4.4zM4.8,4.4H5.2V4.8H4.8zM6.4,4.4H6.8V4.8H6.4zM6.8,4.4H7.2V4.8H6.8zM7.6,4.4H8V4.8H7.6zM10.8,4.4H11.2V4.8H10.8zM11.6,4.4H12V4.8H11.6zM12.4,4.4H12.8V4.8H12.4zM0.4,4.8H0.8V5.2H0.4zM0.8,4.8H1.2V5.2H0.8zM2,4.8H2.4V5.2H2zM3.2,4.8H3.6V5.2H3.2zM3.6,4.8H4V5.2H3.6zM4,4.8H4.4V5.2H4zM6,4.8H6.4V5.2H6zM6.4,4.8H6.8V5.2H6.4zM6.8,4.8H7.2V5.2H6.8zM8.8,4.8H9.2V5.2H8.8zM9.2,4.8H9.6V5.2H9.2zM9.6,4.8H10V5.2H9.6zM10,4.8H10.4V5.2H10zM10.4,4.8H10.8V5.2H10.4zM11.6,4.8H12V5.2H11.6zM12,4.8H12.4V5.2H12zM12.4,4.8H12.8V5.2H12.4zM12.8,4.8H13.2V5.2H12.8zM0.4,5.2H0.8V5.6H0.4zM1.6,5.2H2V5.6H1.6zM2.8,5.2H3.2V5.6H2.8zM4.4,5.2H4.8V5.6H4.4zM4.8,5.2H5.2V5.6H4.8zM6.4,5.2H6.8V5.6H6.4zM7.6,5.2H8V5.6H7.6zM8.8,5.2H9.2V5.6H8.8zM10,5.2H10.4V5.6H10zM10.4,5.2H10.8V5.6H10.4zM11.2,5.2H11.6V5.6H11.2zM11.6,5.2H12V5.6H11.6zM12,5.2H12.4V5.6H12zM12.8,5.2H13.2V5.6H12.8zM13.2,5.2H13.6V5.6H13.2zM0.4,5.6H0.8V6H0.4zM2,5.6H2.4V6H2zM2.4,5.6H2.8V6H2.4zM3.6,5.6H4V6H3.6zM4,5.6H4.4V6H4zM4.4,5.6H4.8V6H4.4zM4.8,5.6H5.2V6H4.8zM5.2,5.6H5.6V6H5.2zM5.6,5.6H6V6H5.6zM6,5.6H6.4V6H6zM6.4,5.6H6.8V6H6.4zM6.8,5.6H7.2V6H6.8zM7.2,5.6H7.6V6H7.2zM8.4,5.6H8.8V6H8.4zM9.6,5.6H10V6H9.6zM10.8,5.6H11.2V6H10.8zM12,5.6H12.4V6H12zM12.8,5.6H13.2V6H12.8zM13.2,5.6H13.6V6H13.2zM1.2,6H1.6V6.4H1.2zM2,6H2.4V6.4H2zM2.8,6H3.2V6.4H2.8zM3.6,6H4V6.4H3.6zM4.8,6H5.2V6.4H4.8zM5.6,6H6V6.4H5.6zM6,6H6.4V6.4H6zM7.2,6H7.6V6.4H7.2zM8,6H8.4V6.4H8zM9.2,6H9.6V6.4H9.2zM10,6H10.4V6.4H10zM10.4,6H10.8V6.4H10.4zM10.8,6H11.2V6.4H10.8zM11.6,6H12V6.4H11.6zM12,6H12.4V6.4H12zM12.8,6H13.2V6.4H12.8zM0.8,6.4H1.2V6.8H0.8zM1.2,6.4H1.6V6.8H1.2zM1.6,6.4H2V6.8H1.6zM2,6.4H2.4V6.8H2zM3.2,6.4H3.6V6.8H3.2zM4,6.4H4.4V6.8H4zM5.6,6.4H6V6.8H5.6zM6.8,6.4H7.2V6.8H6.8zM7.6,6.4H8V6.8H7.6zM8,6.4H8.4V6.8H8zM8.4,6.4H8.8V6.8H8.4zM8.8,6.4H9.2V6.8H8.8zM9.2,6.4H9.6V6.8H9.2zM9.6,6.4H10V6.8H9.6zM10.4,6.4H10.8V6.8H10.4zM10.8,6.4H11.2V6.8H10.8zM11.2,6.4H11.6V6.8H11.2zM12,6.4H12.4V6.8H12zM12.4,6.4H12.8V6.8H12.4zM1.2,6.8H1.6V7.2H1.2zM1.6,6.8H2V7.2H1.6zM2.8,6.8H3.2V7.2H2.8zM3.2,6.8H3.6V7.2H3.2zM4,6.8H4.4V7.2H4zM5.2,6.8H5.6V7.2H5.2zM5.6,6.8H6V7.2H5.6zM7.2,6.8H7.6V7.2H7.2zM8,6.8H8.4V7.2H8zM8.4,6.8H8.8V7.2H8.4zM9.2,6.8H9.6V7.2H9.2zM9.6,6.8H10V7.2H9.6zM10.4,6.8H10.8V7.2H10.4zM11.2,6.8H11.6V7.2H11.2zM11.6,6.8H12V7.2H11.6zM12,6.8H12.4V7.2H12zM13.2,6.8H13.6V7.2H13.2zM0.8,7.2H1.2V7.6H0.8zM1.6,7.2H2V7.6H1.6zM2,7.2H2.4V7.6H2zM3.2,7.2H3.6V7.6H3.2zM3.6,7.2H4V7.6H3.6zM5.6,7.2H6V7.6H5.6zM6.8,7.2H7.2V7.6H6.8zM7.2,7.2H7.6V7.6H7.2zM8,7.2H8.4V7.6H8zM8.4,7.2H8.8V7.6H8.4zM9.6,7.2H10V7.6H9.6zM10.4,7.2H10.8V7.6H10.4zM10.8,7.2H11.2V7.6H10.8zM11.2,7.2H11.6V7.6H11.2zM12,7.2H12.4V7.6H12zM12.4,7.2H12.8V7.6H12.4zM13.2,7.2H13.6V7.6H13.2zM0.4,7.6H0.8V8H0.4zM0.8,7.6H1.2V8H0.8zM1.6,7.6H2V8H1.6zM2.4,7.6H2.8V8H2.4zM2.8,7.6H3.2V8H2.8zM3.6,7.6H4V8H3.6zM4,7.6H4.4V8H4zM6,7.6H6.4V8H6zM6.4,7.6H6.8V8H6.4zM7.2,7.6H7.6V8H7.2zM9.2,7.6H9.6V8H9.2zM10.4,7.6H10.8V8H10.4zM11.2,7.6H11.6V8H11.2zM11.6,7.6H12V8H11.6zM12.4,7.6H12.8V8H12.4zM12.8,7.6H13.2V8H12.8zM1.2,8H1.6V8.4H1.2zM2,8H2.4V8.4H2zM2.4,8H2.8V8.4H2.4zM3.2,8H3.6V8.4H3.2zM3.6,8H4V8.4H3.6zM4.8,8H5.2V8.4H4.8zM5.2,8H5.6V8.4H5.2zM5.6,8H6V8.4H5.6zM6,8H6.4V8.4H6zM6.4,8H6.8V8.4H6.4zM6.8,8H7.2V8.4H6.8zM7.2,8H7.6V8.4H7.2zM7.6,8H8V8.4H7.6zM9.6,8H10V8.4H9.6zM10,8H10.4V8.4H10zM11.2,8H11.6V8.4H11.2zM11.6,8H12V8.4H11.6zM12,8H12.4V8.4H12zM12.4,8H12.8V8.4H12.4zM12.8,8H13.2V8.4H12.8zM13.2,8H13.6V8.4H13.2zM0.4,8.4H0.8V8.8H0.4zM0.8,8.4H1.2V8.8H0.8zM1.2,8.4H1.6V8.8H1.2zM2.4,8.4H2.8V8.8H2.4zM2.8,8.4H3.2V8.8H2.8zM3.6,8.4H4V8.8H3.6zM4,8.4H4.4V8.8H4zM4.4,8.4H4.8V8.8H4.4zM5.2,8.4H5.6V8.8H5.2zM5.6,8.4H6V8.8H5.6zM6,8.4H6.4V8.8H6zM6.4,8.4H6.8V8.8H6.4zM6.8,8.4H7.2V8.8H6.8zM8.4,8.4H8.8V8.8H8.4zM8.8,8.4H9.2V8.8H8.8zM9.2,8.4H9.6V8.8H9.2zM10,8.4H10.4V8.8H10zM10.4,8.4H10.8V8.8H10.4zM11.6,8.4H12V8.8H11.6zM12,8.4H12.4V8.8H12zM12.8,8.4H13.2V8.8H12.8zM13.2,8.4H13.6V8.8H13.2zM0.4,8.8H0.8V9.2H0.4zM1.6,8.8H2V9.2H1.6zM2,8.8H2.4V9.2H2zM2.4,8.8H2.8V9.2H2.4zM3.6,8.8H4V9.2H3.6zM4,8.8H4.4V9.2H4zM4.8,8.8H5.2V9.2H4.8zM5.6,8.8H6V9.2H5.6zM6.4,8.8H6.8V9.2H6.4zM7.6,8.8H8V9.2H7.6zM8.8,8.8H9.2V9.2H8.8zM9.6,8.8H10V9.2H9.6zM10,8.8H10.4V9.2H10zM10.8,8.8H11.2V9.2H10.8zM12.4,8.8H12.8V9.2H12.4zM13.2,8.8H13.6V9.2H13.2zM0.4,9.2H0.8V9.6H0.4zM2.8,9.2H3.2V9.6H2.8zM3.2,9.2H3.6V9.6H3.2zM4,9.2H4.4V9.6H4zM5.2,9.2H5.6V9.6H5.2zM6,9.2H6.4V9.6H6zM6.4,9.2H6.8V9.6H6.4zM6.8,9.2H7.2V9.6H6.8zM7.2,9.2H7.6V9.6H7.2zM7.6,9.2H8V9.6H7.6zM8.4,9.2H8.8V9.6H8.4zM11.6,9.2H12V9.6H11.6zM12.4,9.2H12.8V9.6H12.4zM12.8,9.2H13.2V9.6H12.8zM0.4,9.6H0.8V10H0.4zM1.6,9.6H2V10H1.6zM2.4,9.6H2.8V10H2.4zM3.6,9.6H4V10H3.6zM4,9.6H4.4V10H4zM4.8,9.6H5.2V10H4.8zM5.2,9.6H5.6V10H5.2zM6.4,9.6H6.8V10H6.4zM7.6,9.6H8V10H7.6zM8.8,9.6H9.2V10H8.8zM9.2,9.6H9.6V10H9.2zM9.6,9.6H10V10H9.6zM10,9.6H10.4V10H10zM11.2,9.6H11.6V10H11.2zM12,9.6H12.4V10H12zM12.4,9.6H12.8V10H12.4zM13.2,9.6H13.6V10H13.2zM0.4,10H0.8V10.4H0.4zM1.2,10H1.6V10.4H1.2zM1.6,10H2V10.4H1.6zM2,10H2.4V10.4H2zM2.4,10H2.8V10.4H2.4zM2.8,10H3.2V10.4H2.8zM3.6,10H4V10.4H3.6zM4,10H4.4V10.4H4zM4.4,10H4.8V10.4H4.4zM5.6,10H6V10.4H5.6zM6.4,10H6.8V10.4H6.4zM7.2,10H7.6V10.4H7.2zM8.4,10H8.8V10.4H8.4zM10,10H10.4V10.4H10zM10.4,10H10.8V10.4H10.4zM10.8,10H11.2V10.4H10.8zM11.2,10H11.6V10.4H11.2zM11.6,10H12V10.4H11.6zM12.8,10H13.2V10.4H12.8zM13.2,10H13.6V10.4H13.2zM3.6,10.4H4V10.8H3.6zM4,10.4H4.4V10.8H4zM4.4,10.4H4.8V10.8H4.4zM4.8,10.4H5.2V10.8H4.8zM5.6,10.4H6V10.8H5.6zM6,10.4H6.4V10.8H6zM6.8,10.4H7.2V10.8H6.8zM7.6,10.4H8V10.8H7.6zM8,10.4H8.4V10.8H8zM8.4,10.4H8.8V10.8H8.4zM8.8,10.4H9.2V10.8H8.8zM9.6,10.4H10V10.8H9.6zM10,10.4H10.4V10.8H10zM11.6,10.4H12V10.8H11.6zM12.4,10.4H12.8V10.8H12.4zM13.2,10.4H13.6V10.8H13.2zM0.4,10.8H0.8V11.2H0.4zM0.8,10.8H1.2V11.2H0.8zM1.2,10.8H1.6V11.2H1.2zM1.6,10.8H2V11.2H1.6zM2,10.8H2.4V11.2H2zM2.4,10.8H2.8V11.2H2.4zM2.8,10.8H3.2V11.2H2.8zM4.4,10.8H4.8V11.2H4.4zM5.2,10.8H5.6V11.2H5.2zM6.4,10.8H6.8V11.2H6.4zM7.6,10.8H8V11.2H7.6zM8.4,10.8H8.8V11.2H8.4zM8.8,10.8H9.2V11.2H8.8zM9.6,10.8H10V11.2H9.6zM10,10.8H10.4V11.2H10zM10.8,10.8H11.2V11.2H10.8zM11.6,10.8H12V11.2H11.6zM12.4,10.8H12.8V11.2H12.4zM12.8,10.8H13.2V11.2H12.8zM0.4,11.2H0.8V11.6H0.4zM2.8,11.2H3.2V11.6H2.8zM3.6,11.2H4V11.6H3.6zM4,11.2H4.4V11.6H4zM4.8,11.2H5.2V11.6H4.8zM5.2,11.2H5.6V11.6H5.2zM6,11.2H6.4V11.6H6zM6.8,11.2H7.2V11.6H6.8zM8.8,11.2H9.2V11.6H8.8zM9.2,11.2H9.6V11.6H9.2zM9.6,11.2H10V11.6H9.6zM10,11.2H10.4V11.6H10zM11.6,11.2H12V11.6H11.6zM12,11.2H12.4V11.6H12zM12.4,11.2H12.8V11.6H12.4zM12.8,11.2H13.2V11.6H12.8zM13.2,11.2H13.6V11.6H13.2zM0.4,11.6H0.8V12H0.4zM1.2,11.6H1.6V12H1.2zM1.6,11.6H2V12H1.6zM2,11.6H2.4V12H2zM2.8,11.6H3.2V12H2.8zM3.6,11.6H4V12H3.6zM4.4,11.6H4.8V12H4.4zM5.6,11.6H6V12H5.6zM6,11.6H6.4V12H6zM7.6,11.6H8V12H7.6zM8.8,11.6H9.2V12H8.8zM10,11.6H10.4V12H10zM10.4,11.6H10.8V12H10.4zM10.8,11.6H11.2V12H10.8zM11.2,11.6H11.6V12H11.2zM11.6,11.6H12V12H11.6zM12,11.6H12.4V12H12zM0.4,12H0.8V12.4H0.4zM1.2,12H1.6V12.4H1.2zM1.6,12H2V12.4H1.6zM2,12H2.4V12.4H2zM2.8,12H3.2V12.4H2.8zM3.6,12H4V12.4H3.6zM4,12H4.4V12.4H4zM4.8,12H5.2V12.4H4.8zM5.6,12H6V12.4H5.6zM6,12H6.4V12.4H6zM6.4,12H6.8V12.4H6.4zM6.8,12H7.2V12.4H6.8zM8.4,12H8.8V12.4H8.4zM9.2,12H9.6V12.4H9.2zM9.6,12H10V12.4H9.6zM10,12H10.4V12.4H10zM10.4,12H10.8V12.4H10.4zM11.6,12H12V12.4H11.6zM12.4,12H12.8V12.4H12.4zM13.2,12H13.6V12.4H13.2zM0.4,12.4H0.8V12.8H0.4zM1.2,12.4H1.6V12.8H1.2zM1.6,12.4H2V12.8H1.6zM2,12.4H2.4V12.8H2zM2.8,12.4H3.2V12.8H2.8zM3.6,12.4H4V12.8H3.6zM4,12.4H4.4V12.8H4zM5.6,12.4H6V12.8H5.6zM8,12.4H8.4V12.8H8zM8.8,12.4H9.2V12.8H8.8zM9.2,12.4H9.6V12.8H9.2zM10,12.4H10.4V12.8H10zM10.8,12.4H11.2V12.8H10.8zM11.2,12.4H11.6V12.8H11.2zM12,12.4H12.4V12.8H12zM12.4,12.4H12.8V12.8H12.4zM0.4,12.8H0.8V13.2H0.4zM2.8,12.8H3.2V13.2H2.8zM4,12.8H4.4V13.2H4zM4.8,12.8H5.2V13.2H4.8zM5.2,12.8H5.6V13.2H5.2zM5.6,12.8H6V13.2H5.6zM6.8,12.8H7.2V13.2H6.8zM8,12.8H8.4V13.2H8zM8.4,12.8H8.8V13.2H8.4zM8.8,12.8H9.2V13.2H8.8zM9.2,12.8H9.6V13.2H9.2zM10.4,12.8H10.8V13.2H10.4zM10.8,12.8H11.2V13.2H10.8zM11.6,12.8H12V13.2H11.6zM12,12.8H12.4V13.2H12zM12.4,12.8H12.8V13.2H12.4zM0.4,13.2H0.8V13.6H0.4zM0.8,13.2H1.2V13.6H0.8zM1.2,13.2H1.6V13.6H1.2zM1.6,13.2H2V13.6H1.6zM2,13.2H2.4V13.6H2zM2.4,13.2H2.8V13.6H2.4zM2.8,13.2H3.2V13.6H2.8zM3.6,13.2H4V13.6H3.6zM4,13.2H4.4V13.6H4zM5.6,13.2H6V13.6H5.6zM6,13.2H6.4V13.6H6zM7.2,13.2H7.6V13.6H7.2zM8,13.2H8.4V13.6H8zM9.2,13.2H9.6V13.6H9.2zM9.6,13.2H10V13.6H9.6zM10,13.2H10.4V13.6H10zM10.4,13.2H10.8V13.6H10.4zM10.8,13.2H11.2V13.6H10.8zM11.2,13.2H11.6V13.6H11.2zM12,13.2H12.4V13.6H12zM12.8,13.2H13.2V13.6H12.8z" fill="#000000"/></svg>
          </div>
          <div class="lp-qr-text">
            <div class="lp-bento-card__icon lp-bci--pink" style="width:40px;height:40px;margin-bottom:12px">
              <mat-icon>android</mat-icon>
            </div>
            <h3>Application Android</h3>
            <p>Gérez votre cabinet depuis votre téléphone — tâches, congés, pointage et KPIs disponibles hors bureau. Scannez pour télécharger directement.</p>
            <div class="lp-qr-platforms">
              <span class="lp-platform-badge lp-platform-badge--android">
                <mat-icon>android</mat-icon> Android — disponible
              </span>
              <span class="lp-platform-badge lp-platform-badge--ios">
                <mat-icon>phone_iphone</mat-icon> iOS — bientôt
              </span>
            </div>
            <a class="lp-apk-dl" href="/passidoc.apk" download="passidoc.apk">
              <mat-icon>download</mat-icon>
              Télécharger l'APK directement
              <span class="lp-apk-dl__size">75 MB</span>
            </a>
          </div>
        </div>

      </div>
    </section>

    <!-- ── Stats ── -->
    <section class="lp-stats-bar">
      <div class="lp-stats-bar__inner">
        <div class="lp-sstat">
          <span class="lp-sstat__num">100%</span>
          <span class="lp-sstat__lbl">Sécurisé &amp; confidentiel</span>
        </div>
        <div class="lp-sstat-sep"></div>
        <div class="lp-sstat">
          <span class="lp-sstat__num">2</span>
          <span class="lp-sstat__lbl">Pôles géographiques</span>
        </div>
        <div class="lp-sstat-sep"></div>
        <div class="lp-sstat">
          <span class="lp-sstat__num">∞</span>
          <span class="lp-sstat__lbl">Dossiers &amp; collaborateurs</span>
        </div>
        <div class="lp-sstat-sep"></div>
        <div class="lp-sstat">
          <span class="lp-sstat__num">7</span>
          <span class="lp-sstat__lbl">Rôles &amp; permissions</span>
        </div>
      </div>
    </section>

    <!-- ── Footer ── -->
    <footer class="lp-footer">
      <span>© 2026 Passidoc — AFYM Audit Expertise</span>
      <span class="lp-footer__sep">·</span>
      <span>Solution sur mesure</span>
    </footer>

    <!-- ── Modal Se connecter ── -->
    @if (loginModalOpen()) {
      <div class="lp-overlay" (click)="closeLoginModal()">
        <div class="lp-modal" (click)="$event.stopPropagation()">
          <button class="lp-modal__close" (click)="closeLoginModal()">
            <mat-icon>close</mat-icon>
          </button>
          <div class="lp-modal__logo">
            <mat-icon>description</mat-icon>
          </div>
          <h2 class="lp-modal__title">Accéder à votre espace</h2>
          <p class="lp-modal__sub">Entrez l'identifiant unique de votre cabinet</p>
          <div class="lp-modal__field" [class.lp-modal__field--focus]="slugFocused" [class.lp-modal__field--error]="!!loginError()">
            <mat-icon class="lp-modal__field-icon">tag</mat-icon>
            <input class="lp-modal__input"
                   [formControl]="loginSlugControl"
                   placeholder="Identifiant de votre cabinet"
                   [attr.disabled]="loginLoading() ? true : null"
                   (focus)="slugFocused=true" (blur)="slugFocused=false"
                   (keyup.enter)="goToTenantLogin()" />
          </div>
          @if (loginError()) {
            <p class="lp-modal__error"><mat-icon>error_outline</mat-icon> {{ loginError() }}</p>
          }
          <button class="lp-btn lp-btn--primary lp-btn--full" matRipple (click)="goToTenantLogin()" [disabled]="loginLoading()">
            @if (loginLoading()) {
              <mat-progress-spinner diameter="16" mode="indeterminate"
                style="--mdc-circular-progress-active-indicator-color:rgba(255,255,255,.9)">
              </mat-progress-spinner>
              <span>Vérification…</span>
            } @else {
              <mat-icon>login</mat-icon>
              <span>Continuer</span>
            }
          </button>
          <p class="lp-modal__hint">
            Nouveau cabinet ?
            <button class="lp-modal__hint-link" (click)="closeLoginModal(); startSetup()">
              Créer mon espace →
            </button>
          </p>
        </div>
      </div>
    }

  </div><!-- /wb -->
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
            <div class="pole-row__flag">{{ flagFromCode(step1.get('poleCode1')?.value) }}</div>
            <mat-form-field appearance="outline" class="sw-field--flex">
              <mat-label>Pôle 1 — pays</mat-label>
              <input matInput [formControl]="poleSearch1" [matAutocomplete]="auto1"
                     placeholder="Chercher un pays…" />
              <mat-autocomplete #auto1 (optionSelected)="onPole1Selected($event.option.value)">
                @for (c of filteredCountries1; track c.code) {
                  <mat-option [value]="c.name">{{ c.flag }} {{ c.name }}</mat-option>
                }
              </mat-autocomplete>
              @if (step1.get('poleCode1')?.hasError('required') && step1.get('poleCode1')?.touched) {
                <mat-error>Sélectionnez un pays</mat-error>
              }
            </mat-form-field>
          </div>

          <div class="pole-row">
            <div class="pole-row__flag">{{ flagFromCode(step1.get('poleCode2')?.value) }}</div>
            <mat-form-field appearance="outline" class="sw-field--flex">
              <mat-label>Pôle 2 — pays</mat-label>
              <input matInput [formControl]="poleSearch2" [matAutocomplete]="auto2"
                     placeholder="Chercher un pays…" />
              <mat-autocomplete #auto2 (optionSelected)="onPole2Selected($event.option.value)">
                @for (c of filteredCountries2; track c.code) {
                  <mat-option [value]="c.name">{{ c.flag }} {{ c.name }}</mat-option>
                }
              </mat-autocomplete>
              @if (step1.get('poleCode2')?.hasError('required') && step1.get('poleCode2')?.touched) {
                <mat-error>Sélectionnez un pays</mat-error>
              }
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
                <span class="rr-flag">{{ flagFromCode(step1.get('poleCode1')?.value) }}</span>
                <span class="rr-label">Pôle 1</span>
                <span class="rr-val">{{ pole1Name }}</span>
              </div>
              <div class="recap__row">
                <span class="rr-flag">{{ flagFromCode(step1.get('poleCode2')?.value) }}</span>
                <span class="rr-label">Pôle 2</span>
                <span class="rr-val">{{ pole2Name }}</span>
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
     ÉCRAN SUCCÈS — LIEN DE L'APPLICATION
════════════════════════════════════════════════════════ -->
@if (screen() === 'success') {
  <div class="sc-page">
    <div class="sc-bg">
      <div class="sc-bg__orb sc-bg__orb--a"></div>
      <div class="sc-bg__orb sc-bg__orb--b"></div>
    </div>
    <div class="sc-card">
      <div class="sc-check">
        <mat-icon>check_circle</mat-icon>
      </div>
      <h2 class="sc-title">Passidoc est configuré !</h2>
      <p class="sc-desc">Votre application est prête. Partagez ce lien avec votre équipe pour accéder à l'espace de travail.</p>

      <div class="sc-url-block">
        <span class="sc-url-label">Adresse de votre application</span>
        <div class="sc-url-row">
          <span class="sc-url-val">{{ appUrl() }}</span>
          <button class="sc-copy-btn" (click)="copyUrl()" [class.sc-copy-btn--done]="urlCopied()" type="button">
            <mat-icon>{{ urlCopied() ? 'check' : 'content_copy' }}</mat-icon>
          </button>
        </div>
      </div>

      <div class="sc-info">
        <mat-icon>info_outline</mat-icon>
        <span>Connectez-vous avec les identifiants administrateur que vous venez de créer.</span>
      </div>

      <button class="sc-login-btn" matRipple (click)="goToLogin()" type="button">
        <mat-icon>login</mat-icon>
        <span>Se connecter</span>
      </button>
    </div>
  </div>
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
      background: radial-gradient(ellipse at 25% 25%, #162050 0%, #0d1a3a 45%, #0a1530 100%);
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
    .wb-orb--a { width: 700px; height: 700px; background: rgba(26,115,232,.22); top: -200px; left: -180px; }
    .wb-orb--b { width: 550px; height: 550px; background: rgba(124,58,237,.18); bottom: -120px; right: -100px; }
    .wb-orb--c { width: 400px; height: 400px; background: rgba(13,148,136,.15); top: 35%; left: 50%; }

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

    @keyframes wb-fade-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes wb-shimmer { to { background-position: 300% center; } }
    @keyframes wb-blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: .35; }
    }

    /* ══════════════════════════════════════════════════════
       LANDING PAGE
    ══════════════════════════════════════════════════════ */

    /* Conteneur de page */
    .wb {
      min-height: 100vh; width: 100%; position: relative;
      display: flex; flex-direction: column; align-items: center;
      overflow-x: hidden;
    }

    /* ── Navbar ── */
    .lp-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 48px; height: 64px;
      background: rgba(8,15,40,.75);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .lp-nav__brand {
      display: flex; align-items: center; gap: 10px;
    }
    .lp-nav__icon {
      width: 34px; height: 34px; border-radius: 10px;
      background: linear-gradient(135deg, #1565C0, #7C3AED);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 14px rgba(26,115,232,.4);
    }
    .lp-nav__icon mat-icon { color: #fff; font-size: 18px; width: 18px; height: 18px; }
    .lp-nav__name {
      font-size: 18px; font-weight: 800; color: #fff;
      letter-spacing: -.4px;
    }

    /* ── Boutons communs ── */
    .lp-btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 0 20px; height: 40px; border-radius: 10px;
      font-size: 13.5px; font-weight: 600; font-family: inherit;
      border: none; cursor: pointer;
      transition: transform .18s, box-shadow .18s, background .18s, opacity .18s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .lp-btn--lg { height: 48px; padding: 0 26px; font-size: 15px; border-radius: 12px; }
    .lp-btn--full { width: 100%; justify-content: center; }
    .lp-btn--primary {
      background: linear-gradient(90deg, #1A73E8, #3B82F6);
      color: #fff; box-shadow: 0 6px 20px rgba(26,115,232,.35);
    }
    .lp-btn--primary:hover:not([disabled]) {
      transform: translateY(-2px); box-shadow: 0 10px 30px rgba(26,115,232,.5);
    }
    .lp-btn--primary[disabled] { opacity: .55; cursor: not-allowed; }
    .lp-btn--ghost {
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.82);
    }
    .lp-btn--ghost:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.22); }
    .lp-btn--outline {
      background: transparent;
      border: 1px solid rgba(255,255,255,.18);
      color: rgba(255,255,255,.85);
    }
    .lp-btn--outline:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.35); }

    /* ── Hero ── */
    .lp-hero {
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 160px 24px 80px;
      max-width: 820px; width: 100%;
    }
    .lp-hero__badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 18px; border-radius: 100px;
      background: rgba(96,165,250,.10); border: 1px solid rgba(96,165,250,.22);
      font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.65);
      margin-bottom: 32px;
      animation: wb-fade-up .6s ease forwards; opacity: 0;
    }
    .lp-hero__badge-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #60a5fa; box-shadow: 0 0 7px #60a5fa;
      animation: wb-blink 2s ease-in-out infinite;
    }
    .lp-hero__title {
      font-size: clamp(40px, 7vw, 72px); font-weight: 800;
      line-height: 1.1; letter-spacing: -2.5px;
      color: rgba(255,255,255,.95); margin: 0 0 24px;
      animation: wb-fade-up .7s ease forwards; animation-delay: .15s; opacity: 0;
    }
    .lp-hero__title-grad {
      background: linear-gradient(90deg, #60a5fa 0%, #c4b5fd 40%, #93c5fd 70%, #60a5fa 100%);
      background-size: 300% auto;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: wb-shimmer 4s linear infinite;
    }
    .lp-hero__sub {
      font-size: 17px; line-height: 1.7; color: rgba(255,255,255,.48);
      margin: 0 0 40px; max-width: 600px;
      animation: wb-fade-up .7s ease forwards; animation-delay: .3s; opacity: 0;
    }
    .lp-hero__ctas {
      display: flex; align-items: center; flex-wrap: wrap; gap: 14px;
      justify-content: center; margin-bottom: 48px;
      animation: wb-fade-up .7s ease forwards; animation-delay: .45s; opacity: 0;
    }
    .lp-hero__trust {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
      animation: wb-fade-up .7s ease forwards; animation-delay: .6s; opacity: 0;
    }
    .lp-trust-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 100px;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
      font-size: 12px; color: rgba(255,255,255,.45);
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: rgba(255,255,255,.35); }
    }


    /* ── Bento features ── */
    .lp-features {
      position: relative; z-index: 1;
      width: 100%; max-width: 1100px; padding: 0 24px 80px;
      animation: wb-fade-up .7s ease forwards; animation-delay: .8s; opacity: 0;
    }
    .lp-bento {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 14px;
    }
    .lp-bento-card {
      position: relative; overflow: hidden;
      padding: 28px; border-radius: 20px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(12px);
      transition: border-color .25s, transform .25s, box-shadow .25s;
    }
    .lp-bento-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255,255,255,.15);
      box-shadow: 0 20px 50px rgba(0,0,0,.3);
    }
    .lp-bento-card--wide { grid-column: 1; grid-row: 1 / 3; }
    .lp-bento-card--multi  { grid-column: 2; }
    .lp-bento-card--pilot  { grid-column: 3; }
    .lp-bento-card--secure { grid-column: 2 / 4; }
    .lp-bento-card--qr { grid-column: 2 / 4; }

    .lp-bento-card__glow {
      position: absolute; top: -60px; right: -60px;
      width: 200px; height: 200px; border-radius: 50%;
      background: radial-gradient(circle, rgba(96,165,250,.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .lp-bento-card__icon {
      width: 48px; height: 48px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 18px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .lp-bci--blue   { background: rgba(96,165,250,.15); mat-icon { color: #60a5fa; } }
    .lp-bci--purple { background: rgba(167,139,250,.15); mat-icon { color: #a78bfa; } }
    .lp-bci--teal   { background: rgba(52,211,153,.15);  mat-icon { color: #34d399; } }
    .lp-bci--amber  { background: rgba(251,191,36,.12);  mat-icon { color: #fbbf24; } }
    .lp-bci--pink   { background: rgba(236,72,153,.12);  mat-icon { color: #ec4899; } }
    .lp-bento-card__title {
      font-size: 18px; font-weight: 700; color: rgba(255,255,255,.92);
      margin: 0 0 10px; letter-spacing: -.3px;
    }
    .lp-bento-card__desc {
      font-size: 13.5px; color: rgba(255,255,255,.42); line-height: 1.65; margin: 0;
    }
    .lp-bento-card--ai .lp-bento-card__title { font-size: 22px; }
    .lp-bento-card--ai .lp-bento-card__desc  { font-size: 15px; max-width: 340px; }
    .lp-bento-card__tag {
      display: inline-block; margin-top: 20px;
      padding: 4px 12px; border-radius: 100px;
      background: rgba(96,165,250,.12); border: 1px solid rgba(96,165,250,.22);
      font-size: 11px; font-weight: 600; color: #60a5fa; letter-spacing: .3px;
    }

    /* ── Carte QR Code ── */
    .lp-bento-card--qr {
      display: flex; align-items: center; gap: 32px;
    }
    .lp-qr-block {
      flex-shrink: 0; padding: 12px; border-radius: 14px;
      background: #fff;
    }
    .lp-qr-block svg { display: block; }
    .lp-qr-text { flex: 1; }
    .lp-qr-text h3 {
      font-size: 17px; font-weight: 700; color: rgba(255,255,255,.90);
      margin: 0 0 8px; letter-spacing: -.2px;
    }
    .lp-qr-text p {
      font-size: 13px; color: rgba(255,255,255,.42); line-height: 1.6; margin: 0 0 14px;
    }
    .lp-qr-platforms { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
    .lp-platform-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 13px; border-radius: 10px;
      font-size: 12px; font-weight: 600;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .lp-platform-badge--android {
      background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.25);
      color: #34d399;
    }
    .lp-platform-badge--ios {
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.10);
      color: rgba(255,255,255,.35);
    }
    .lp-apk-dl {
      display: inline-flex; align-items: center; gap: 8px;
      margin-top: 14px; padding: 9px 16px; border-radius: 10px;
      background: rgba(26,115,232,.12); border: 1px solid rgba(96,165,250,.25);
      color: #60a5fa; font-size: 13px; font-weight: 600;
      text-decoration: none; transition: background .2s, border-color .2s, transform .15s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .lp-apk-dl:hover {
      background: rgba(26,115,232,.22); border-color: rgba(96,165,250,.5);
      transform: translateY(-1px);
    }
    .lp-apk-dl__size {
      font-size: 11px; font-weight: 400; color: rgba(96,165,250,.55);
      padding-left: 4px;
    }

    /* ── Stats bar ── */
    .lp-stats-bar {
      position: relative; z-index: 1;
      width: 100%; max-width: 1100px; padding: 0 24px 80px;
      animation: wb-fade-up .7s ease forwards; animation-delay: 1s; opacity: 0;
    }
    .lp-stats-bar__inner {
      display: flex; align-items: center; justify-content: center;
      padding: 28px 40px; border-radius: 20px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
    }
    .lp-sstat { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
    .lp-sstat__num {
      font-size: 28px; font-weight: 800; color: #60a5fa;
      letter-spacing: -1.5px; line-height: 1;
    }
    .lp-sstat__lbl { font-size: 11px; color: rgba(255,255,255,.38); font-weight: 500; text-align: center; }
    .lp-sstat-sep { width: 1px; height: 40px; background: rgba(255,255,255,.08); flex-shrink: 0; margin: 0 20px; }

    /* ── Footer ── */
    .lp-footer {
      position: relative; z-index: 1;
      padding: 24px; display: flex; gap: 10px; align-items: center;
      font-size: 12px; color: rgba(255,255,255,.25);
    }
    .lp-footer__sep { color: rgba(255,255,255,.12); }

    /* ── Modal Se connecter ── */
    .lp-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,.65); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      animation: lp-overlay-in .2s ease;
    }
    @keyframes lp-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .lp-modal {
      position: relative; width: 100%; max-width: 420px;
      padding: 40px 36px 32px;
      background: linear-gradient(145deg, rgba(15,25,65,.97) 0%, rgba(10,18,50,.97) 100%);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 24px;
      box-shadow: 0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04);
      display: flex; flex-direction: column; align-items: center; gap: 0;
      animation: lp-modal-in .25s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes lp-modal-in {
      from { opacity: 0; transform: scale(.92) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .lp-modal__close {
      position: absolute; top: 16px; right: 16px;
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(255,255,255,.06); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,.4); transition: background .15s, color .15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .lp-modal__close:hover { background: rgba(255,255,255,.12); color: rgba(255,255,255,.8); }
    .lp-modal__logo {
      width: 52px; height: 52px; border-radius: 16px;
      background: linear-gradient(135deg, #1565C0, #7C3AED);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 24px rgba(26,115,232,.4);
      margin-bottom: 20px;
      mat-icon { color: #fff; font-size: 26px; width: 26px; height: 26px; }
    }
    .lp-modal__title {
      font-size: 20px; font-weight: 800; color: rgba(255,255,255,.92);
      margin: 0 0 6px; letter-spacing: -.4px; text-align: center;
    }
    .lp-modal__sub {
      font-size: 13px; color: rgba(255,255,255,.40); margin: 0 0 24px; text-align: center;
    }
    .lp-modal__field {
      display: flex; align-items: center; gap: 10px;
      width: 100%; height: 48px; padding: 0 16px;
      background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.11);
      border-radius: 12px; margin-bottom: 8px;
      transition: border-color .2s, background .2s;
    }
    .lp-modal__field--focus   { border-color: rgba(96,165,250,.5); background: rgba(96,165,250,.06); }
    .lp-modal__field--error   { border-color: rgba(248,113,113,.5); }
    .lp-modal__field-icon { font-size: 17px !important; width: 17px !important; height: 17px !important; color: rgba(255,255,255,.28) !important; flex-shrink: 0; }
    .lp-modal__input {
      flex: 1; background: none; border: none; outline: none;
      color: rgba(255,255,255,.88); font-size: 14px; font-family: inherit;
    }
    .lp-modal__input::placeholder { color: rgba(255,255,255,.25); }
    .lp-modal__error {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #f87171; margin-bottom: 12px; width: 100%;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .lp-modal__hint {
      font-size: 12.5px; color: rgba(255,255,255,.30); margin: 16px 0 0; text-align: center;
    }
    .lp-modal__hint-link {
      background: none; border: none; cursor: pointer;
      color: #60a5fa; font-size: inherit; font-family: inherit;
      padding: 0;
    }
    .lp-modal__hint-link:hover { color: #93c5fd; }

    /* Responsive landing page */
    @media (max-width: 900px) {
      .lp-nav { padding: 0 20px; }
      .lp-hero { padding: 120px 20px 60px; }
      .lp-features { padding: 0 16px 60px; }
      .lp-bento {
        grid-template-columns: 1fr 1fr;
      }
      .lp-bento-card--wide  { grid-column: 1 / 3; grid-row: auto; }
      .lp-bento-card--secure, .lp-bento-card--qr { grid-column: 1 / 3; }
      .lp-bento-card--qr { flex-direction: column; align-items: flex-start; }
      .lp-stats-bar__inner { flex-wrap: wrap; gap: 24px; }
      .lp-sstat-sep { display: none; }
    }
    @media (max-width: 600px) {
      .lp-hero__title { font-size: 36px; letter-spacing: -1.5px; }
      .lp-hero__ctas { flex-direction: column; align-items: stretch; }
      .lp-btn--lg { justify-content: center; }
      .lp-bento { grid-template-columns: 1fr; }
      .lp-bento-card--wide, .lp-bento-card--multi,
      .lp-bento-card--pilot, .lp-bento-card--secure,
      .lp-bento-card--qr { grid-column: 1; grid-row: auto; }
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

    /* ════════════════════════════════════════════════════
       ÉCRAN SUCCÈS
    ════════════════════════════════════════════════════ */
    .sc-page {
      position: fixed; inset: 0;
      background: linear-gradient(135deg, #0f1f4a 0%, #06101f 60%, #030810 100%);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; z-index: 200;
      animation: sc-appear .5s ease forwards;
    }
    @keyframes sc-appear {
      from { opacity: 0; transform: scale(.97); }
      to   { opacity: 1; transform: scale(1); }
    }
    .sc-bg { position: absolute; inset: 0; pointer-events: none; }
    .sc-bg__orb {
      position: absolute; border-radius: 50%; filter: blur(80px);
    }
    .sc-bg__orb--a { width: 500px; height: 500px; background: rgba(22,163,74,.15); top: -120px; right: -100px; }
    .sc-bg__orb--b { width: 400px; height: 400px; background: rgba(26,115,232,.12); bottom: -80px; left: -80px; }

    .sc-card {
      position: relative; z-index: 1;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 24px;
      padding: 48px 40px 40px;
      max-width: 520px; width: 100%;
      display: flex; flex-direction: column; align-items: center; gap: 0;
      box-shadow: 0 24px 64px rgba(0,0,0,.4);
      animation: sc-card-in .5s cubic-bezier(.34,1.56,.64,1) forwards;
      animation-delay: .1s; opacity: 0; transform: translateY(20px);
    }
    @keyframes sc-card-in {
      to { opacity: 1; transform: translateY(0); }
    }

    .sc-check {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, #16A34A, #15803d);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 12px rgba(22,163,74,.12), 0 8px 32px rgba(22,163,74,.35);
      margin-bottom: 24px;
      animation: sc-check-bounce .5s cubic-bezier(.34,1.56,.64,1) forwards;
      animation-delay: .25s; transform: scale(0);
    }
    @keyframes sc-check-bounce {
      to { transform: scale(1); }
    }
    .sc-check mat-icon { color: #fff; font-size: 40px; width: 40px; height: 40px; }

    .sc-title {
      font-size: 26px; font-weight: 800; color: #fff;
      margin: 0 0 12px; text-align: center; letter-spacing: -.5px;
    }
    .sc-desc {
      font-size: 14px; color: rgba(255,255,255,.55); line-height: 1.65;
      margin: 0 0 28px; text-align: center; max-width: 380px;
    }

    .sc-url-block {
      width: 100%;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(96,165,250,.25);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .sc-url-label {
      display: block; font-size: 11px; font-weight: 600; letter-spacing: .8px;
      text-transform: uppercase; color: #60a5fa; margin-bottom: 8px;
    }
    .sc-url-row {
      display: flex; align-items: center; gap: 10px;
    }
    .sc-url-val {
      flex: 1; font-size: 15px; font-weight: 600; color: #e2e8f0;
      word-break: break-all; letter-spacing: -.2px;
    }
    .sc-copy-btn {
      width: 36px; height: 36px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.07);
      color: rgba(255,255,255,.6);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: background .2s, color .2s, border-color .2s;
    }
    .sc-copy-btn:hover { background: rgba(255,255,255,.13); color: #fff; }
    .sc-copy-btn--done { background: rgba(22,163,74,.2); color: #4ade80; border-color: rgba(22,163,74,.3); }
    .sc-copy-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .sc-info {
      display: flex; align-items: flex-start; gap: 10px;
      background: rgba(251,191,36,.07);
      border: 1px solid rgba(251,191,36,.20);
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 28px; width: 100%;
    }
    .sc-info mat-icon { color: #fbbf24; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    .sc-info span { font-size: 13px; color: rgba(255,255,255,.6); line-height: 1.5; }

    .sc-login-btn {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 36px; border-radius: 100px; border: none; cursor: pointer;
      background: linear-gradient(90deg, #1A73E8 0%, #7C3AED 100%);
      color: #fff; font-size: 15px; font-weight: 700;
      box-shadow: 0 8px 28px rgba(26,115,232,.4);
      transition: transform .2s, box-shadow .2s;
      width: 100%; justify-content: center;
    }
    .sc-login-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(26,115,232,.55); }
    .sc-login-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `],
})
export class SetupWizardComponent implements OnInit {
  @ViewChild('logoInput') logoInputRef!: ElementRef<HTMLInputElement>;

  private fb      = inject(FormBuilder);
  private router  = inject(Router);
  private  http   = inject(HttpClient);
  protected tenant = inject(TenantService);

  screen        = signal<'welcome' | 'wizard' | 'success'>('welcome');
  welcomeExit   = signal(false);
  currentStep   = signal(0);
  loading       = signal(false);
  submitError   = signal('');
  showPw        = signal(false);
  showPageTurn  = signal(false);
  appUrl        = signal('');
  appUrlDisplay = signal('');
  urlCopied     = signal(false);

  // Logo upload
  logoPreview  = signal<string | null>(null);
  logoFileName = signal<string | null>(null);
  isDragOver   = signal(false);
  logoError    = signal('');

  // Login accès cabinet existant
  loginModalOpen   = signal(false);
  loginSlugControl = new FormControl('');
  loginError       = signal('');
  loginLoading     = signal(false);
  slugFocused      = false;

  openLoginModal()  { this.loginModalOpen.set(true);  this.loginError.set(''); }
  closeLoginModal() { this.loginModalOpen.set(false); }
  scrollToFeatures() {
    document.getElementById('lp-features')?.scrollIntoView({ behavior: 'smooth' });
  }

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
    nomSociete: ['', [Validators.required, Validators.minLength(2)]],
    slogan:     [''],
    ville:      [''],
    pays:       [''],
  });

  step1: FormGroup = this.fb.group({
    poleCode1: ['', Validators.required],
    poleCode2: ['', Validators.required],
  });

  poleSearch1 = new FormControl('');
  poleSearch2 = new FormControl('');

  get filteredCountries1(): Country[] {
    const q = (this.poleSearch1.value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }

  get filteredCountries2(): Country[] {
    const q = (this.poleSearch2.value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }

  get pole1Name(): string {
    return COUNTRIES.find(c => c.code === this.step1.value.poleCode1)?.name ?? this.step1.value.poleCode1;
  }

  get pole2Name(): string {
    return COUNTRIES.find(c => c.code === this.step1.value.poleCode2)?.name ?? this.step1.value.poleCode2;
  }

  flagFromCode(code: string): string {
    if (!code) return '🌍';
    return buildFlag(code);
  }

  onPole1Selected(name: string) {
    const c = COUNTRIES.find(x => x.name === name);
    if (c) this.step1.get('poleCode1')?.setValue(c.code, { emitEvent: false });
  }

  onPole2Selected(name: string) {
    const c = COUNTRIES.find(x => x.name === name);
    if (c) this.step1.get('poleCode2')?.setValue(c.code, { emitEvent: false });
  }

  step2: FormGroup = this.fb.group({
    adminFirstName:  ['', Validators.required],
    adminLastName:   ['', Validators.required],
    adminEmail:      ['', [Validators.required, Validators.email]],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  // ── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    this.tenant.resetForSetupPage();
  }

  // ── Actions ────────────────────────────────────────────

  startSetup() {
    this.welcomeExit.set(true);
    setTimeout(() => {
      this.screen.set('wizard');
      this.welcomeExit.set(false);
    }, 700);
  }

  goToTenantLogin() {
    const slug = (this.loginSlugControl.value || '').trim();
    if (!slug) {
      this.loginError.set('Entrez l\'identifiant de votre cabinet');
      return;
    }
    this.loginError.set('');
    this.loginLoading.set(true);
    this.tenant.switchTenant(slug);
    this.http.get<{ configured: boolean }>(`${environment.apiUrl}/setup/status`).subscribe({
      next: ({ configured }) => {
        this.loginLoading.set(false);
        if (configured) {
          this.tenant.markConfigured();
          this.router.navigate(['/auth/login']);
        } else {
          this.loginError.set(`Le cabinet "${slug}" n'est pas encore inscrit sur Passidoc.`);
        }
      },
      error: () => {
        this.loginLoading.set(false);
        this.loginError.set('Impossible de joindre le serveur. Vérifiez votre connexion.');
      },
    });
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

    const p1 = COUNTRIES.find(c => c.code === this.step1.value.poleCode1);
    const p2 = COUNTRIES.find(c => c.code === this.step1.value.poleCode2);

    // N'utilise le slug existant que s'il vient du paramètre URL (?tenant=) → reconfiguration admin.
    // Dans tous les autres cas (defaultTenantSlug, localStorage), on génère depuis le nom du cabinet.
    const fromUrl = new URLSearchParams(window.location.search).get('tenant');
    const payload = {
      slug:           fromUrl?.toLowerCase() ?? generateSlug(this.step0.value.nomSociete),
      nomSociete:     this.step0.value.nomSociete,
      slogan:         this.step0.value.slogan   || undefined,
      ville:          this.step0.value.ville    || undefined,
      pays:           this.step0.value.pays     || undefined,
      logoUrl:        this.logoPreview()         || undefined,
      poleLabel1:     p1?.name  ?? 'La Réunion',
      poleLabel2:     p2?.name  ?? 'Madagascar',
      poleFlag1:      p1?.flag  ?? '🇷🇪',
      poleFlag2:      p2?.flag  ?? '🇲🇬',
      adminFirstName: this.step2.value.adminFirstName,
      adminLastName:  this.step2.value.adminLastName,
      adminEmail:     this.step2.value.adminEmail,
      adminPassword:  this.step2.value.password,
    };

    this.http.post<{ message: string }>(`${environment.apiUrl}/setup`, payload).subscribe({
      next: () => {
        this.tenant.markConfigured({
          id:           0,
          nomSociete:   payload.nomSociete,
          logoUrl:      payload.logoUrl,
          slogan:       payload.slogan,
          ville:        payload.ville,
          pays:         payload.pays,
          poleLabel1:   payload.poleLabel1,
          poleLabel2:   payload.poleLabel2,
          poleFlag1:    payload.poleFlag1,
          poleFlag2:    payload.poleFlag2,
          isConfigured: true,
        });
        this.loading.set(false);
        const hostname = window.location.hostname;
        const isOnRender = hostname.includes('onrender.com');
        const isLocalhost = hostname === 'localhost';
        let appUrl: string;
        let appUrlDisplay: string;
        if (isOnRender || isLocalhost) {
          appUrl = `${window.location.origin}/?tenant=${payload.slug}`;
          // Affichage cosmétique : slug-passidoc-app.onrender.com
          appUrlDisplay = `${payload.slug}-${window.location.hostname}`;
        } else {
          const parts = hostname.split('.');
          const baseDomain = parts.length >= 3 ? parts.slice(1).join('.') : 'passidoc.re';
          appUrl = `https://${payload.slug}.${baseDomain}`;
          appUrlDisplay = appUrl;
        }
        this.appUrl.set(appUrl);
        this.appUrlDisplay.set(appUrlDisplay);
        // Met à jour le TenantService (signal + localStorage) pour que les navigations internes restent sur ce tenant
        this.tenant.setSlug(payload.slug);
        this.showPageTurn.set(true);
        setTimeout(() => {
          this.showPageTurn.set(false);
          this.screen.set('success');
        }, 2200);
      },
      error: (err) => {
        this.loading.set(false);
        this.submitError.set(err.error?.message ?? 'Une erreur s\'est produite. Veuillez réessayer.');
      },
    });
  }

  goToLogin() { this.router.navigate(['/auth/login'], { replaceUrl: true }); }

  copyUrl() {
    navigator.clipboard.writeText(this.appUrl()).then(() => {
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
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
