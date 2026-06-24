import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../../../../core/services/toast.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FicheIdentiteService } from '../../../../../core/services/fiche-identite.service';
import { FiscalReferenceService, FiscalRef } from '../../../../../core/services/fiscal-reference.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { ClientSite, TypeFlux } from '../../../../../core/models/client.model';
import { OnlyNumbersDirective } from '../../../../../shared/directives/only-numbers.directive';

const PLATFORM_SVGS: Record<string, string> = {
  Facebook:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#1877F2"/><path fill="#fff" d="M13 10.5V8.8c0-.6.3-.9.8-.9H16V5h-2.5C11.4 5 10 6.5 10 8.8v1.7H8V13h2v7h3v-7h2l.5-2.5H13z"/></svg>`,
  Instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f9ed32"/><stop offset=".4" stop-color="#ee2a7b"/><stop offset="1" stop-color="#002aff"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)"/><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="16.5" cy="7.5" r="1.1" fill="#fff"/></svg>`,
  WhatsApp:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#25D366"/><path fill="#fff" d="M12 4C7.6 4 4 7.6 4 12c0 1.5.4 3 1.2 4.2L4 20l3.9-1.2C9 19.6 10.5 20 12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8zm4 11.3c-.2.4-1 .8-1.4.9-.9.1-1.6-.2-3.3-1.3-1.4-.9-2.3-2.4-2.4-2.5-.1-.1-.9-1.2-.9-2.3s.5-1.7.8-2c.2-.2.4-.3.6-.3h.4c.2 0 .3 0 .4.3l.7 1.8c.1.1.1.3 0 .5l-.4.5c-.1.1-.2.3-.1.5.4.7 1 1.4 1.6 1.9.6.5 1.3.8 1.6.9.2.1.4 0 .5-.1l.5-.6c.1-.2.3-.2.5-.1l1.5.7c.2.1.3.2.3.3.1.3-.1.7-.4 1.2z"/></svg>`,
  TikTok:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#010101"/><path fill="#69C9D0" d="M17.5 7.8A3.5 3.5 0 0 1 15 5.5V5H13v10.2a1.8 1.8 0 0 1-1.8 1.8 1.8 1.8 0 0 1-1.8-1.8 1.8 1.8 0 0 1 1.8-1.8v-2A3.8 3.8 0 0 0 7.4 15.2 3.8 3.8 0 0 0 11.2 19 3.8 3.8 0 0 0 15 15.2V10c.7.4 1.5.7 2.5.7V8.7a3.6 3.6 0 0 1-1 .1" opacity=".6"/><path fill="#EE1D52" d="M16.5 7.8A3.5 3.5 0 0 1 14 5.5V5H12v10.2a1.8 1.8 0 0 1-1.8 1.8 1.8 1.8 0 0 1-1.8-1.8 1.8 1.8 0 0 1 1.8-1.8v-2a3.8 3.8 0 0 0-3.8 3.8 3.8 3.8 0 0 0 3.8 3.8 3.8 3.8 0 0 0 3.8-3.8V10c.7.4 1.5.7 2.5.7V8.7a3.6 3.6 0 0 1-1 .1" opacity=".6"/><path fill="#fff" d="M17.5 7.8A3.5 3.5 0 0 1 15 5.5V5H13v10.2A1.8 1.8 0 0 1 11.2 17 1.8 1.8 0 0 1 9.4 15.2 1.8 1.8 0 0 1 11.2 13.4v-2A3.8 3.8 0 0 0 7.4 15.2 3.8 3.8 0 0 0 11.2 19 3.8 3.8 0 0 0 15 15.2V10c.7.4 1.5.7 2.5.7V8.7a3.6 3.6 0 0 1-2.5-1z"/></svg>`,
  YouTube:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#FF0000"/><path fill="#fff" d="M21 8.5s-.3-1.8-1-2.5c-.9-1-1.9-1-2.4-1.1C15.3 4.8 12 4.8 12 4.8s-3.3 0-5.6.2c-.5.1-1.5.1-2.4 1.1-.7.7-1 2.5-1 2.5S2.8 10.4 2.8 12.4v1.9c0 2 .2 3.7.2 3.7s.3 1.8 1 2.5c.9 1 2.2.9 2.8 1C8.4 21.7 12 21.7 12 21.7s3.3 0 5.6-.2c.5-.1 1.5-.1 2.4-1.1.7-.7 1-2.5 1-2.5s.2-1.8.2-3.7v-1.9C21.2 10.3 21 8.5 21 8.5zM10 15.5V9l5.5 3.3L10 15.5z"/></svg>`,
  LinkedIn:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#0A66C2"/><path fill="#fff" d="M7 9h2.5v8H7V9zm1.3-4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 9h2.5v1.1c.4-.7 1.3-1.3 2.5-1.3 2.4 0 2.8 1.6 2.8 3.6V17H17.3V13c0-1 0-2.2-1.3-2.2-1.4 0-1.5 1-1.5 2.1V17H12V9z"/></svg>`,
  'X/Twitter': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#000"/><path fill="#fff" d="M17.8 4.5h2.7l-5.9 6.8 6.9 9.2h-5.4l-4.3-5.7-4.9 5.7H4.2l6.3-7.3-6.6-8.7h5.5l3.9 5.1 4.5-5.1zm-1 13.5h1.5L7.5 6H5.9l10.9 12z"/></svg>`,
  Pinterest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#E60023"/><path fill="#fff" d="M12 3C7 3 3 7 3 12c0 3.8 2.2 7 5.5 8.5-.1-.7-.1-1.7.1-2.5l1-4.5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.9-2.4.9 0 1.3.7 1.3 1.5 0 .9-.6 2.3-.9 3.5-.3 1 .5 1.8 1.5 1.8 1.8 0 3-2.3 3-5 0-2.1-1.4-3.6-3.8-3.6-2.6 0-4.2 1.9-4.2 4 0 .7.2 1.4.5 1.9.1.1.1.3.1.4l-.4 1.5c-.1.2-.2.3-.4.2-1.4-.6-2.1-2.2-2.1-4 0-2.9 2.4-6.4 7.2-6.4 3.8 0 6.4 2.8 6.4 5.9 0 3.9-2.1 6.6-5.2 6.6-1 0-2-.6-2.4-1.2l-.6 2.4c-.2.9-.8 2-1.2 2.6.8.2 1.6.4 2.4.4 5 0 9-4 9-9s-4-9-9-9z"/></svg>`,
  Autre:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#64748B"/><path fill="#fff" d="M18 16c-.8 0-1.5.3-2 .8l-7.1-4.1c.1-.2.1-.5.1-.7s0-.5-.1-.7L16 7.2c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7L7.9 9.8C7.4 9.3 6.7 9 6 9 4.3 9 3 10.3 3 12s1.3 3 3 3c.7 0 1.4-.3 1.9-.8l7.2 4.2c-.1.2-.1.4-.1.6 0 1.7 1.3 3 3 3s3-1.3 3-3-1.3-3-3-3z"/></svg>`,
};

const ALL_TYPES: { key: TypeFlux; label: string; icon: string; hint: string }[] = [
  { key: 'RELEVE_BANCAIRE',   label: 'Relevés bancaires',    icon: 'account_balance', hint: 'Mensuel' },
  { key: 'TVA_MENSUELLE',     label: 'TVA Mensuelle',        icon: 'receipt',         hint: 'Chaque mois' },
  { key: 'TVA_TRIMESTRIELLE', label: 'TVA Trimestrielle',    icon: 'receipt_long',    hint: 'Mar · Juin · Sep · Déc' },
  { key: 'TVA_ANNUELLE',      label: 'TVA Annuelle (DCA12)', icon: 'description',     hint: 'Décembre uniquement' },
  { key: 'PAIE',              label: 'Paie (SILAE)',         icon: 'people',          hint: 'Mensuel' },
  { key: 'RAPPORT_VENTE',     label: 'Rapport de vente',     icon: 'point_of_sale',   hint: 'Mensuel' },
  { key: 'RECETTE_AMENITIZ',  label: 'Recette Amenitiz',     icon: 'hotel',           hint: 'Hôtellerie — mensuel' },
  { key: 'PIECES_COMPTABLES', label: 'Pièces comptables',    icon: 'folder_open',     hint: 'Mensuel' },
];

@Component({
  selector: 'app-fiche-identite-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatExpansionModule, MatSelectModule,
    MatChipsModule, MatTooltipModule, MatCheckboxModule, OnlyNumbersDirective,
  ],
  template: `
    <div class="tab-content">
      <form [formGroup]="form" (ngSubmit)="save()">
        <mat-accordion multi>
          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>business</mat-icon>&nbsp;Identité légale</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Raison sociale</mat-label>
                <input matInput formControlName="raisonSociale" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Forme juridique</mat-label>
                <input matInput formControlName="formeJuridique" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>SIREN</mat-label>
                <input matInput formControlName="siren" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>SIRET</mat-label>
                <input matInput formControlName="siret" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Adresse</mat-label>
                <input matInput formControlName="adresse" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Activité</mat-label>
                <input matInput formControlName="activite" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Surface commerciale (m²)</mat-label>
                <input matInput type="number" formControlName="surfaceCommerciale" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Email de contact</mat-label>
                <mat-icon matPrefix>email</mat-icon>
                <input matInput type="email" formControlName="emailContact" placeholder="contact@entreprise.re" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Téléphone de contact</mat-label>
                <mat-icon matPrefix>phone</mat-icon>
                <input matInput formControlName="telephoneContact" placeholder="0262 XX XX XX" />
              </mat-form-field>
            </div>
          </mat-expansion-panel>

          @if (fiscalRef) {
            <mat-expansion-panel expanded>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>account_balance</mat-icon>&nbsp;Spécificités fiscales
                  <span class="site-badge" [class]="site === 'REUNION' ? 'badge-re' : 'badge-mg'">
                    {{ site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
                  </span>
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="fiscal-section">
                <div class="fiscal-group">
                  <div class="fiscal-group-title">
                    <mat-icon class="icon-success">check_circle</mat-icon>
                    Zones d'exonération applicables
                  </div>
                  <mat-chip-set>
                    @for (z of fiscalRef.zonesExoneration; track z) {
                      <mat-chip [matTooltip]="z" class="chip-success">{{ z }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>

                <div class="fiscal-group">
                  <div class="fiscal-group-title">
                    <mat-icon class="icon-warn">warning</mat-icon>
                    Points de vigilance fiscale
                  </div>
                  <mat-chip-set>
                    @for (z of fiscalRef.zonesRisque; track z) {
                      <mat-chip [matTooltip]="z" class="chip-warn">{{ z }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>

                <div class="fiscal-group">
                  <div class="fiscal-group-title">
                    <mat-icon class="icon-info">gavel</mat-icon>
                    Réglementations applicables
                  </div>
                  <mat-chip-set>
                    @for (r of fiscalRef.reglementations; track r) {
                      <mat-chip [matTooltip]="r" class="chip-info">{{ r }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>
              </div>
            </mat-expansion-panel>
          }
          <!-- Actionnariat -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>account_circle</mat-icon>&nbsp;Actionnariat
                @if (actionnaires.length > 0) {
                  <span class="act-total-badge">{{ actionnaires.length }}</span>
                }
              </mat-panel-title>
            </mat-expansion-panel-header>
            <div class="actionnaires-section">
              @for (ctrl of actionnaires.controls; track $index) {
                @if (isEditingActionnaire($index)) {
                  <!-- Mode édition -->
                  <div class="act-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Prénom <span class="req">*</span></mat-label>
                      <input matInput [formControl]="fc($index, 'prenom')" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Nom <span class="req">*</span></mat-label>
                      <input matInput [formControl]="fc($index, 'nom')" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="pct-field">
                      <mat-label>% <span class="req">*</span></mat-label>
                      <input matInput type="number" [formControl]="fc($index, 'pourcentage')" min="0" max="100" />
                      <span matSuffix>%</span>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Régime <span class="req">*</span></mat-label>
                      <mat-select [formControl]="fc($index, 'regimeFiscal')">
                        <mat-option value="IR">IR</mat-option>
                        <mat-option value="IS">IS</mat-option>
                        <mat-option value="LMNP">LMNP</mat-option>
                        <mat-option value="Autre">Autre</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <div style="display:flex;gap:2px;flex-shrink:0">
                      <button type="button" mat-icon-button matTooltip="Valider"
                              (click)="stopEditActionnaire($index)">
                        <mat-icon style="color:#16a34a">check_circle</mat-icon>
                      </button>
                      <button type="button" mat-icon-button color="warn"
                              matTooltip="Supprimer" (click)="removeActionnaire($index)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                } @else {
                  <!-- Mode affichage -->
                  <div class="act-view-row">
                    <span class="act-view-name">
                      {{ fc($index, 'prenom').value }} {{ fc($index, 'nom').value }}
                    </span>
                    @if (fc($index, 'pourcentage').value != null) {
                      <span class="act-badge act-badge--pct">{{ fc($index, 'pourcentage').value }}%</span>
                    }
                    @if (fc($index, 'regimeFiscal').value) {
                      <span class="act-badge act-badge--regime">{{ fc($index, 'regimeFiscal').value }}</span>
                    }
                    <div style="display:flex;gap:2px;margin-left:auto;flex-shrink:0">
                      <button type="button" mat-icon-button matTooltip="Modifier"
                              (click)="startEditActionnaire($index)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button type="button" mat-icon-button color="warn"
                              matTooltip="Supprimer" (click)="removeActionnaire($index)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              }

              @if (actionnaires.length === 0) {
                <p style="color:#94a3b8;font-size:13px;padding:8px 0 0">Aucun actionnaire enregistré.</p>
              }

              @if (actionnaires.length < 5) {
                <button type="button" class="act-add-btn" (click)="addActionnaire()">
                  <mat-icon>add</mat-icon> Ajouter un actionnaire
                </button>
              }
            </div>
          </mat-expansion-panel>

          <!-- Honoraires -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>euro</mat-icon>&nbsp;Honoraires annuels (€)</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Comptables</mat-label>
                <mat-icon matPrefix>calculate</mat-icon>
                <input matInput type="number" [formControl]="honorairesComptablesCtrl" />
                <span matSuffix>€</span>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Juridiques</mat-label>
                <mat-icon matPrefix>gavel</mat-icon>
                <input matInput type="number" [formControl]="honorairesJuridiquesCtrl" />
                <span matSuffix>€</span>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Sociaux</mat-label>
                <mat-icon matPrefix>people</mat-icon>
                <input matInput type="number" [formControl]="honorairesSociauxCtrl" />
                <span matSuffix>€</span>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Commissariat aux comptes</mat-label>
                <mat-icon matPrefix>verified</mat-icon>
                <input matInput type="number" [formControl]="honorairesCommissariatCtrl" />
                <span matSuffix>€</span>
              </mat-form-field>
            </div>
          </mat-expansion-panel>

          <!-- Présence digitale & marché -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>store</mat-icon>&nbsp;Présence digitale & marché</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Concurrents dans le quartier</mat-label>
                <mat-icon matPrefix>place</mat-icon>
                <input matInput type="number" [formControl]="nbConcurrentsQuartierCtrl" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Concurrence générale</mat-label>
                <mat-icon matPrefix>public</mat-icon>
                <input matInput type="number" [formControl]="nbConcurrentsGeneralCtrl" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Site web</mat-label>
                <mat-icon matPrefix>language</mat-icon>
                <input matInput [formControl]="siteWebCtrl" placeholder="https://..." />
                @if (siteWebCtrl.value) {
                  <a matSuffix [href]="formatUrl(siteWebCtrl.value ?? '')"
                     target="_blank" rel="noopener"
                     mat-icon-button matTooltip="Ouvrir le site"
                     style="color:#2563eb">
                    <mat-icon>open_in_new</mat-icon>
                  </a>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Évolution du secteur</mat-label>
                <textarea matInput rows="3" [formControl]="evolutionSecteurCtrl" placeholder="Tendances, données sectorielles, évolution du marché local..."></textarea>
              </mat-form-field>
            </div>

            <!-- Réseaux sociaux structurés -->
            <div class="reseaux-section">
              <div class="reseaux-header">
                <mat-icon>share</mat-icon>
                <span>Réseaux sociaux</span>
              </div>
              @for (ctrl of reseauxSociaux.controls; track $index) {
                @if (isEditing($index)) {
                  <!-- Mode édition -->
                  <div class="reseau-row">
                    <img class="reseau-plat-icon"
                         [src]="platIconUrl(rsCtrl($index, 'plateforme').value || 'Autre')"
                         width="36" height="36" alt="">
                    <mat-form-field appearance="outline" class="reseau-plateforme">
                      <mat-label>Plateforme</mat-label>
                      <mat-select [formControl]="rsCtrl($index, 'plateforme')">
                        @for (p of plateformes; track p.value) {
                          <mat-option [value]="p.value">
                            <span class="plat-option">
                              <img [src]="platIconUrl(p.value)" width="18" height="18" alt="">
                              {{ p.label }}
                            </span>
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="reseau-url">
                      <mat-label>URL ou nom de profil</mat-label>
                      <input matInput [formControl]="rsCtrl($index, 'url')" placeholder="https://..." />
                    </mat-form-field>
                    <div style="display:flex;gap:2px">
                      <button type="button" mat-icon-button matTooltip="Valider"
                              (click)="stopEdit($index)">
                        <mat-icon style="color:#16a34a">check_circle</mat-icon>
                      </button>
                      <button type="button" mat-icon-button color="warn"
                              matTooltip="Supprimer" (click)="removeReseau($index)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                } @else {
                  <!-- Mode affichage : lien cliquable -->
                  <div class="reseau-link-row">
                    <img class="reseau-plat-icon"
                         [src]="platIconUrl(rsCtrl($index, 'plateforme').value || 'Autre')"
                         width="32" height="32" alt="">
                    <div class="reseau-link-info">
                      <span class="reseau-plat-name">{{ rsCtrl($index, 'plateforme').value || 'Autre' }}</span>
                      @if (rsCtrl($index, 'url').value) {
                        <a class="reseau-link"
                           [href]="formatUrl(rsCtrl($index, 'url').value)"
                           target="_blank" rel="noopener noreferrer"
                           matTooltip="{{ rsCtrl($index, 'url').value }}">
                          <mat-icon class="reseau-ext-icon">open_in_new</mat-icon>
                          {{ displayUrl(rsCtrl($index, 'url').value) }}
                        </a>
                      } @else {
                        <span class="reseau-link-empty">Aucun lien renseigné</span>
                      }
                    </div>
                    <div class="reseau-link-actions">
                      <button type="button" mat-icon-button matTooltip="Modifier"
                              (click)="startEdit($index)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button type="button" mat-icon-button color="warn"
                              matTooltip="Supprimer" (click)="removeReseau($index)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              }
              <!-- Boutons rapides pour les plateformes populaires -->
              <div class="reseaux-quick">
                @for (p of plateformes.slice(0, 4); track p.value) {
                  @if (!hasReseau(p.value)) {
                    <button type="button" class="quick-btn"
                            matTooltip="Ajouter {{ p.label }}"
                            (click)="addReseau(p.value)">
                      <img [src]="platIconUrl(p.value)" width="22" height="22" alt="">
                      <span>{{ p.label }}</span>
                    </button>
                  }
                }
                <button type="button" mat-stroked-button (click)="addReseau()">
                  <mat-icon>add</mat-icon> Autre
                </button>
              </div>
            </div>
          </mat-expansion-panel>

          <!-- Documents mensuels attendus -->
          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>inbox</mat-icon>&nbsp;Documents mensuels attendus</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="flux-types-section">
              <p class="flux-hint">Cochez les documents que ce client doit fournir chaque mois.</p>
              <div class="flux-types-grid">
                @for (t of allTypes; track t.key) {
                  <div class="flux-type-item" [class.flux-type-active]="isTypeActif(t.key)"
                       (click)="toggleType(t.key)">
                    <mat-icon class="flux-type-icon">{{ t.icon }}</mat-icon>
                    <div class="flux-type-body">
                      <span class="flux-type-label">{{ t.label }}</span>
                      <span class="flux-type-hint">{{ t.hint }}</span>
                    </div>
                    <mat-checkbox [checked]="isTypeActif(t.key)"
                                  (click)="$event.stopPropagation()"
                                  (change)="toggleType(t.key)" color="primary" />
                  </div>
                }
              </div>
            </div>
          </mat-expansion-panel>

        </mat-accordion>

        <div class="tab-content__actions">
          <button mat-flat-button color="primary" type="submit" [disabled]="saving">
            <mat-icon>save</mat-icon> {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 0; }
    .full-col { grid-column: 1 / -1; }
    .tab-content__actions { margin-top: 24px; display: flex; justify-content: flex-end; }

    .site-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; margin-left: 8px; }
    .badge-re { background: #dbeafe; color: #1d4ed8; }
    .badge-mg { background: #dcfce7; color: #15803d; }

    .fiscal-section { display: flex; flex-direction: column; gap: 20px; padding: 16px 0; }
    .fiscal-group-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px;
    }
    .icon-success { color: #16a34a; font-size: 18px; width: 18px; height: 18px; }
    .icon-warn    { color: #d97706; font-size: 18px; width: 18px; height: 18px; }
    .icon-info    { color: #2563eb; font-size: 18px; width: 18px; height: 18px; }

    .flux-hint { font-size: 12px; color: #94a3b8; margin: 0 0 14px; padding: 16px 0 0; }
    .flux-types-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;
      padding-bottom: 8px;
    }
    .flux-type-item {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-radius: 12px;
      border: 1.5px solid #e2e8f0; background: #f8fafc;
      cursor: pointer; transition: all .15s;
    }
    .flux-type-item:hover { border-color: #c7d2fe; background: #f5f3ff; }
    .flux-type-active { border-color: #6366f1 !important; background: #eef2ff !important; }
    .flux-type-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; flex-shrink: 0; }
    .flux-type-body { display: flex; flex-direction: column; gap: 1px; flex: 1; }
    .flux-type-label { font-size: 13px; font-weight: 500; color: #1e293b; }
    .flux-type-hint  { font-size: 11px; color: #94a3b8; }

    mat-chip-set { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip-success { --mdc-chip-label-text-color: #166534; background: #dcfce7 !important; font-size: 12px; }
    .chip-warn    { --mdc-chip-label-text-color: #92400e; background: #fef3c7 !important; font-size: 12px; }
    .chip-info    { --mdc-chip-label-text-color: #1e40af; background: #dbeafe !important; font-size: 12px; }

    .section-hint { font-size: 12px; color: #94a3b8; margin: 0 0 12px; }

    /* Actionnariat */
    .actionnaires-section { padding: 16px 0; display: flex; flex-direction: column; gap: 4px; }
    .act-row {
      display: grid; grid-template-columns: 1fr 1fr 110px 1fr auto;
      gap: 10px; align-items: center;
    }
    .pct-field { max-width: 110px; }
    .act-total-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: #6366f1; color: white;
      font-size: 10px; font-weight: 700; margin-left: 6px;
    }
    .req { color: #dc2626; }
    .act-view-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; border-radius: 8px;
      background: #f8fafc; border: 1px solid #e2e8f0;
    }
    .act-view-name { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; }
    .act-badge {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 20px;
      font-size: 12px; font-weight: 600;
    }
    .act-badge--pct { background: #e0e7ff; color: #4338ca; }
    .act-badge--regime { background: #d1fae5; color: #065f46; }
    .act-add-btn {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 4px; padding: 6px 14px; border-radius: 8px;
      border: 1.5px dashed #c7d2fe; background: transparent;
      color: #6366f1; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all .15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #eef2ff; border-style: solid; }
    }

    .reseaux-section { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
    .reseaux-header {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #6366f1; }
    }
    .reseau-row { display: grid; grid-template-columns: 40px 160px 1fr auto; gap: 10px; align-items: center; }
    .reseau-plat-icon { border-radius: 8px; display: block; flex-shrink: 0; }
    .plat-option { display: flex; align-items: center; gap: 8px; }
    .plat-option img { border-radius: 4px; display: block; flex-shrink: 0; }

    /* Reseau — mode affichage */
    .reseau-link-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border-radius: 12px;
      border: 1.5px solid #e2e8f0; background: #f8fafc;
      transition: border-color .15s, box-shadow .15s;
    }
    .reseau-link-row:hover {
      border-color: #bfdbfe; box-shadow: 0 1px 4px rgba(99,102,241,.08);
    }
    .reseau-link-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .reseau-plat-name {
      font-size: 10.5px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .5px;
    }
    .reseau-link {
      display: inline-flex; align-items: center; gap: 5px;
      color: #2563eb; font-size: 13.5px; font-weight: 500;
      text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 100%; transition: color .12s;
    }
    .reseau-link:hover { color: #1d4ed8; text-decoration: underline; }
    .reseau-ext-icon { font-size: 13px; width: 13px; height: 13px; flex-shrink: 0; }
    .reseau-link-empty { font-size: 13px; color: #cbd5e1; font-style: italic; }
    .reseau-link-actions {
      display: flex; gap: 2px; opacity: 0; transition: opacity .15s; flex-shrink: 0;
    }
    .reseau-link-row:hover .reseau-link-actions { opacity: 1; }

    .reseaux-quick { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .quick-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 20px;
      border: 1.5px solid #e2e8f0; background: #f8fafc;
      cursor: pointer; font-size: 13px; font-weight: 500; color: #374151;
      font-family: inherit; transition: all .15s;
      img { border-radius: 4px; display: block; }
      &:hover { border-color: #c7d2fe; background: #f5f3ff; }
    }
  `],
})
export class FicheIdentiteTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private fiscalRefService = inject(FiscalReferenceService);

  @Input() clientId!: number;
  @Input() site: ClientSite = 'REUNION';
  @Output() typesChanged = new EventEmitter<TypeFlux[]>();

  @Input() set typesFluxActifs(val: TypeFlux[] | undefined) {
    this.selectedTypes = val?.length ? [...val] : ALL_TYPES.map(t => t.key);
  }

  fiscalRef: FiscalRef | null = null;
  selectedTypes: TypeFlux[] = ALL_TYPES.map(t => t.key);
  readonly allTypes = ALL_TYPES;

  readonly plateformes = [
    { value: 'Facebook',   label: 'Facebook'   },
    { value: 'Instagram',  label: 'Instagram'  },
    { value: 'WhatsApp',   label: 'WhatsApp'   },
    { value: 'TikTok',     label: 'TikTok'     },
    { value: 'YouTube',    label: 'YouTube'    },
    { value: 'LinkedIn',   label: 'LinkedIn'   },
    { value: 'X/Twitter',  label: 'X / Twitter'},
    { value: 'Pinterest',  label: 'Pinterest'  },
    { value: 'Autre',      label: 'Autre'      },
  ];

  platIconUrl(v: string): string {
    const svg = PLATFORM_SVGS[v] ?? PLATFORM_SVGS['Autre'];
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Contrôles déclarés explicitement pour garantir le binding dans les panels lazy
  readonly nbConcurrentsQuartierCtrl = new FormControl<number | null>(null);
  readonly nbConcurrentsGeneralCtrl  = new FormControl<number | null>(null);
  readonly siteWebCtrl               = new FormControl('');
  readonly evolutionSecteurCtrl      = new FormControl('');
  readonly honorairesComptablesCtrl           = new FormControl<number | null>(null);
  readonly honorairesJuridiquesCtrl           = new FormControl<number | null>(null);
  readonly honorairesSociauxCtrl              = new FormControl<number | null>(null);
  readonly honorairesCommissariatCtrl         = new FormControl<number | null>(null);

  form = this.fb.group({
    raisonSociale: [''], siren: [''], siret: [''],
    formeJuridique: [''], adresse: [''], activite: [''],
    surfaceCommerciale: [null as number | null],
    emailContact: [''], telephoneContact: [''],
    nbConcurrentsQuartier: this.nbConcurrentsQuartierCtrl,
    nbConcurrentsGeneral:  this.nbConcurrentsGeneralCtrl,
    siteWeb:               this.siteWebCtrl,
    evolutionSecteur:      this.evolutionSecteurCtrl,
    honoraires: this.fb.group({
      comptables:            this.honorairesComptablesCtrl,
      juridiques:            this.honorairesJuridiquesCtrl,
      sociaux:               this.honorairesSociauxCtrl,
      commissariatAuxComptes:this.honorairesCommissariatCtrl,
    }),
    actionnaires: this.fb.array([]),
    reseauxSociaux: this.fb.array([]),
  });

  saving = false;

  private toast = inject(ToastService);

  get actionnaires(): FormArray { return this.form.get('actionnaires') as FormArray; }
  get reseauxSociaux(): FormArray { return this.form.get('reseauxSociaux') as FormArray; }

  asGroup(ctrl: any): FormGroup { return ctrl as FormGroup; }

  /** Accès direct à un FormControl — contourne la chaîne DI des mat-expansion-panel lazily rendus */
  ctrl(path: string): FormControl { return this.form.get(path) as FormControl; }

  fc(index: number, field: string): FormControl {
    return this.actionnaires.at(index).get(field) as FormControl;
  }

  rsCtrl(index: number, field: string): FormControl {
    return this.reseauxSociaux.at(index).get(field) as FormControl;
  }

  constructor(
    private service: FicheIdentiteService,
    private clientsService: ClientsService,
  ) {}

  ngOnInit() {
    this.service.get(this.clientId).subscribe((fiche: any) => {
      this.form.patchValue({
        ...fiche,
        honoraires: fiche.honoraires ?? {},
      });

      this.actionnaires.clear();
      (fiche.actionnaires ?? []).forEach((a: any) => this.actionnaires.push(this.newActionnaire(a)));

      this.reseauxSociaux.clear();
      const reseaux = fiche.reseauxSociauxStructures ?? [];
      if (reseaux.length) {
        reseaux.forEach((r: any) => this.reseauxSociaux.push(this.newReseau(r)));
      } else {
        (fiche.reseauxSociaux ?? []).forEach((s: string) =>
          this.reseauxSociaux.push(this.newReseau({ plateforme: 'Autre', url: s }))
        );
      }
    });
    this.fiscalRefService.get().then(data => { this.fiscalRef = data[this.site]; });
  }

  private newActionnaire(a?: any): FormGroup {
    return this.fb.group({
      nom:          [a?.nom ?? '',         Validators.required],
      prenom:       [a?.prenom ?? '',      Validators.required],
      pourcentage:  [a?.pourcentage ?? null, Validators.required],
      regimeFiscal: [a?.regimeFiscal ?? '', Validators.required],
    });
  }

  private newReseau(r?: any): FormGroup {
    return this.fb.group({
      plateforme: [r?.plateforme ?? ''],
      url:        [r?.url ?? ''],
    });
  }

  private actionnaireEditingIndices = new Set<number>();

  isEditingActionnaire(i: number): boolean { return this.actionnaireEditingIndices.has(i); }
  startEditActionnaire(i: number) { this.actionnaireEditingIndices.add(i); }
  stopEditActionnaire(i: number) { this.actionnaireEditingIndices.delete(i); }

  actionnaireInitials(ctrl: FormGroup): string {
    const p = (ctrl.get('prenom')?.value ?? '').trim();
    const n = (ctrl.get('nom')?.value ?? '').trim();
    return ((p[0] ?? '') + (n[0] ?? '')).toUpperCase() || '?';
  }

  addActionnaire() {
    if (this.actionnaires.length < 5) {
      const newIndex = this.actionnaires.length;
      this.actionnaires.push(this.newActionnaire());
      this.actionnaireEditingIndices.add(newIndex);
    }
  }

  removeActionnaire(i: number) {
    this.actionnaires.removeAt(i);
    this.actionnaireEditingIndices.delete(i);
    const updated = new Set<number>();
    this.actionnaireEditingIndices.forEach(idx => {
      if (idx < i) updated.add(idx);
      else if (idx > i) updated.add(idx - 1);
    });
    this.actionnaireEditingIndices = updated;
  }

  private editingIndices = new Set<number>();

  isEditing(i: number): boolean { return this.editingIndices.has(i); }
  startEdit(i: number) { this.editingIndices.add(i); }
  stopEdit(i: number) { this.editingIndices.delete(i); }

  addReseau(plateforme?: string) {
    this.reseauxSociaux.push(this.newReseau(plateforme ? { plateforme, url: '' } : undefined));
    this.editingIndices.add(this.reseauxSociaux.length - 1);
  }
  removeReseau(i: number) {
    this.reseauxSociaux.removeAt(i);
    this.editingIndices.delete(i);
    // recalculer les indices supérieurs
    const updated = new Set<number>();
    this.editingIndices.forEach(idx => { if (idx < i) updated.add(idx); else if (idx > i) updated.add(idx - 1); });
    this.editingIndices = updated;
  }
  hasReseau(plateforme: string): boolean {
    return this.reseauxSociaux.controls.some(c => c.get('plateforme')?.value === plateforme);
  }

  formatUrl(url: string): string {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  displayUrl(url: string): string {
    try {
      const u = new URL(this.formatUrl(url));
      return (u.hostname + u.pathname).replace(/^www\./, '').replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  isTypeActif(key: TypeFlux): boolean { return this.selectedTypes.includes(key); }

  toggleType(key: TypeFlux) {
    if (this.isTypeActif(key)) {
      if (this.selectedTypes.length === 1) return;
      this.selectedTypes = this.selectedTypes.filter(k => k !== key);
    } else {
      this.selectedTypes = [...this.selectedTypes, key];
    }
    this.clientsService.update(this.clientId, { typesFluxActifs: this.selectedTypes }).subscribe(() => {
      this.typesChanged.emit(this.selectedTypes);
    });
  }

  save() {
    this.saving = true;
    const v = this.form.getRawValue() as any;
    const payload = {
      ...v,
      actionnaires:             v.actionnaires,
      honoraires:               v.honoraires,
      reseauxSociauxStructures: v.reseauxSociaux,
    };
    delete payload['reseauxSociaux'];
    this.service.update(this.clientId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.editingIndices.clear();
        this.actionnaireEditingIndices.clear();
        this.toast.success('Fiche enregistrée');
      },
      error: () => { this.saving = false; this.toast.error('Erreur lors de la sauvegarde'); },
    });
  }
}
