import {
  Component, inject, OnInit, OnDestroy, ElementRef,
  HostListener, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, takeUntil } from 'rxjs';
import { PappersService, PappersResult } from '../../../core/services/pappers.service';
import { ClientsService } from '../../../core/services/clients.service';
import { QuestionnaireAdnService } from '../../../core/services/questionnaire-adn.service';
import { SecteurActivite, SECTEURS_LABELS, QuestionnaireAdnGlobal } from '../../../core/models/client.model';
import {
  VISION_OPTS, VALEUR_OPTS, PLACE_OPTS, AMBIANCE_OPTS, ENJEUX_RH_OPTS,
  CANAUX_OPTS, SAISONNALITE_OPTS, CAILLOU_OPTS, PROJETS_OPTS,
  ZONE_RESTAU_OPTS, ACCES_RESTAU_OPTS, INVENDUS_OPTS, COMMERCIALISATION_OPTS,
  ORG_EQUIPE_OPTS, HACCP_OPTS, BLOCAGE_RESTAU_OPTS, PROJETS_RESTAU_OPTS,
  ZONE_BTP_OPTS, ACCES_BTP_OPTS, SPECIALITE_BTP_OPTS, CLIENTS_BTP_OPTS,
  SOUS_TRAITANCE_OPTS, ASSURANCE_BTP_OPTS, REVENU_BTP_OPTS, CARNET_BTP_OPTS,
  DOMAINE_ASSO_OPTS,
  VOCATION_HOLDING_OPTS, MANAGEMENT_HOLDING_OPTS, MANAGEMENT_FEES_OPTS, REGIMES_HOLDING_OPTS,
  ZONE_LIBERAL_OPTS, ACCES_LIBERAL_OPTS, MODE_LIBERAL_OPTS, SECRETARIAT_OPTS,
  PATRIMOINE_SCI_OPTS, ETAT_SCI_OPTS, OBJECTIF_SCI_OPTS, REGIME_SCI_OPTS,
} from '../questionnaire-adn.options';

type StepId = 'entreprise' | 'secteur' | 'adn_global' | 'adn_sectoriel' | 'recap';
interface WizardStep { id: StepId; label: string; }

@Component({
  selector: 'app-create-client-wizard',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatDialogModule,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="wizard">

      <!-- ── Header ──────────────────────────────────────────── -->
      <div class="wizard-header">
        <div class="wh-icon"><mat-icon>fingerprint</mat-icon></div>
        <div class="wh-text">
          <h2>Nouveau dossier client</h2>
          <p>{{ stepTitle() }}</p>
        </div>
        <button class="wh-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <!-- ── Barre de progression ─────────────────────────────── -->
      <div class="wizard-progress">
        @for (step of visibleSteps; track step.id; let i = $index) {
          <div class="ps-step"
               [class.done]="i < currentStepIndex()"
               [class.current]="i === currentStepIndex()">
            <div class="ps-circle">
              @if (i < currentStepIndex()) {
                <mat-icon>check</mat-icon>
              } @else {
                {{ i + 1 }}
              }
            </div>
            <span class="ps-label">{{ step.label }}</span>
          </div>
          @if (i < visibleSteps.length - 1) {
            <div class="ps-line" [class.done]="i < currentStepIndex()"></div>
          }
        }
      </div>

      <!-- ── Contenu (scroll interne) ────────────────────────── -->
      <div class="wizard-content">

        @switch (currentStepId) {

          <!-- ═══ ÉTAPE 1 — ENTREPRISE ════════════════════════ -->
          @case ('entreprise') {

            <!-- Recherche Pappers -->
            <div class="search-wrap">
              <div class="search-field" [class.search-field--focus]="dropdownOpen">
                <mat-icon class="search-icon">search</mat-icon>
                <input #searchInput class="search-input" [formControl]="searchCtrl"
                  placeholder="Nom d'entreprise ou SIREN…" autocomplete="off"
                  (focus)="onFocus()" (blur)="onBlur()"
                  (keydown.escape)="closeDropdown()"
                  (keydown.arrowdown)="moveHighlight(1)"
                  (keydown.arrowup)="moveHighlight(-1)"
                  (keydown.enter)="confirmHighlight()" />
                @if (searching) {
                  <mat-spinner class="search-spinner" diameter="18"></mat-spinner>
                } @else if (searchCtrl.value) {
                  <button class="search-clear" (mousedown)="$event.preventDefault()" (click)="clearAll()">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </div>
              @if (dropdownOpen && searchCtrl.value) {
                <div class="search-dropdown">
                  @if (searching) {
                    <div class="dropdown-loading"><mat-spinner diameter="16"></mat-spinner><span>Recherche…</span></div>
                  }
                  @for (res of results; track res.siren; let i = $index) {
                    <div class="dropdown-option"
                         [class.dropdown-option--highlighted]="highlightIndex === i"
                         (mousedown)="$event.preventDefault()"
                         (click)="onSelect(res)">
                      <div class="opt-initials">{{ res.nomEntreprise[0] }}</div>
                      <div class="opt-body">
                        <div class="opt-name" [innerHTML]="highlight(res.nomEntreprise)"></div>
                        <div class="opt-meta">
                          <span class="opt-siren">{{ res.siren }}</span>
                          @if (res.formeJuridique) {
                            <span class="opt-sep">·</span>
                            <span class="opt-forme">{{ res.formeJuridique }}</span>
                          }
                        </div>
                        @if (res.adresse) {
                          <div class="opt-addr"><mat-icon>place</mat-icon>{{ res.adresse }}</div>
                        }
                      </div>
                    </div>
                  }
                  @if (!searching && hasSearched && results.length === 0) {
                    <div class="dropdown-empty">
                      <mat-icon>search_off</mat-icon>
                      <span>Aucun résultat pour « {{ searchCtrl.value }} »</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Aperçu entreprise sélectionnée -->
            @if (selected) {
              <div class="preview-card">
                <div class="preview-header">
                  <mat-icon class="preview-icon">verified</mat-icon>
                  <div class="preview-header__text">
                    <span class="preview-title">{{ selected.nomEntreprise }}</span>
                    <span class="preview-siren">SIREN {{ selected.siren }}</span>
                  </div>
                  <button class="preview-clear" (click)="clearAll()"><mat-icon>close</mat-icon></button>
                </div>
                <div class="preview-grid">
                  <div class="pi"><label>Forme juridique</label><span>{{ selected.formeJuridique || '—' }}</span></div>
                  <div class="pi"><label>SIRET siège</label><span>{{ selected.siret || '—' }}</span></div>
                  @if (selected.codeNaf) {
                    <div class="pi">
                      <label>Code NAF / APE</label>
                      <span class="naf-badge">
                        <strong>{{ selected.codeNaf }}</strong>
                        @if (selected.libelleNaf) { <em>{{ selected.libelleNaf }}</em> }
                      </span>
                    </div>
                  }
                  <div class="pi full"><label>Adresse</label><span>{{ selected.adresse || '—' }}</span></div>
                  @if (selected.dirigeants.length > 0) {
                    <div class="pi full">
                      <label>Dirigeant(s)</label>
                      <span>{{ selected.dirigeants.map(d => d.prenom + ' ' + d.nom + ' (' + d.qualite + ')').join(' · ') }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Saisie manuelle si pas de résultat Pappers -->
            @if (!selected) {
              <mat-form-field appearance="outline" class="full">
                <mat-label>Nom du dossier (saisie manuelle)</mat-label>
                <mat-icon matPrefix>business</mat-icon>
                <input matInput [formControl]="nomManuelCtrl"
                  placeholder="Si entreprise introuvable via la recherche" />
              </mat-form-field>
            }

            <!-- Site de rattachement -->
            <label class="field-label">Site de rattachement *</label>
            <div class="site-cards">
              <label class="site-card" [class.selected]="siteCtrl.value === 'REUNION'"
                     (click)="siteCtrl.setValue('REUNION')">
                <span class="site-flag">🇷🇪</span><span>La Réunion</span>
              </label>
              <label class="site-card" [class.selected]="siteCtrl.value === 'MADAGASCAR'"
                     (click)="siteCtrl.setValue('MADAGASCAR')">
                <span class="site-flag">🇲🇬</span><span>Madagascar</span>
              </label>
            </div>
          }

          <!-- ═══ ÉTAPE 2 — SECTEUR ════════════════════════════ -->
          @case ('secteur') {
            <p class="step-intro">Sélectionnez le secteur d'activité pour afficher le questionnaire adapté. Cliquez à nouveau pour désélectionner.</p>
            <div class="secteur-grid">
              @for (entry of secteurEntries; track entry.value) {
                <label class="secteur-card"
                       [class.selected]="secteurSelectionne === entry.value"
                       (click)="secteurSelectionne = secteurSelectionne === entry.value ? null : entry.value">
                  <mat-icon>{{ secteurIcon(entry.value) }}</mat-icon>
                  <span>{{ entry.label }}</span>
                  @if (secteurSelectionne === entry.value) {
                    <mat-icon class="check-overlay">check_circle</mat-icon>
                  }
                </label>
              }
            </div>
            @if (secteurSelectionne) {
              <button class="skip-link" (click)="secteurSelectionne = null">
                <mat-icon>close</mat-icon> Retirer la sélection
              </button>
            }
          }

          <!-- ═══ ÉTAPE 3 — ADN GLOBAL ═════════════════════════ -->
          @case ('adn_global') {

            <div class="q-section-title">I — Vision et Identité</div>

            <mat-form-field appearance="outline" class="full q-block">
              <mat-label>Mission principale en une phrase</mat-label>
              <mat-icon matPrefix>flag</mat-icon>
              <textarea matInput [(ngModel)]="global.mission" rows="2"
                placeholder="Ex : Proposer des pains artisanaux au levain…"></textarea>
            </mat-form-field>

            <div class="q-block">
              <label class="q-label">Vision de l'activité d'ici 3 ans</label>
              <div class="q-radio">
                @for (opt of VISION_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.visionActivite === opt.value"
                         (click)="toggleRadioG('visionActivite', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-block">
              <label class="q-label">Valeur n°1 que vos clients doivent retenir</label>
              <div class="q-radio">
                @for (opt of VALEUR_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.valeurCle === opt.value"
                         (click)="toggleRadioG('valeurCle', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-section-title">II — Capital Humain</div>

            <div class="q-block">
              <label class="q-label">Place du dirigeant dans l'exploitation quotidienne</label>
              <div class="q-radio">
                @for (opt of PLACE_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.placeExploitation === opt.value"
                         (click)="toggleRadioG('placeExploitation', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-block">
              <label class="q-label">Ambiance au sein de l'équipe</label>
              <div class="q-radio">
                @for (opt of AMBIANCE_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.ambianceEquipe === opt.value"
                         (click)="toggleRadioG('ambianceEquipe', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-block">
              <label class="q-label">Principal enjeu RH actuellement</label>
              <div class="q-radio q-radio--compact">
                @for (opt of ENJEUX_RH_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.enjeuxRH === opt.value"
                         (click)="toggleRadioG('enjeuxRH', opt.value)">
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-section-title">III — Modèle Économique</div>

            <div class="q-block">
              <label class="q-label">Comment vos clients vous trouvent-ils ? <span class="q-hint">(plusieurs choix)</span></label>
              <div class="q-check">
                @for (opt of CANAUX_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="isIn(global.canauxAcquisition, opt.value)"
                         (click)="toggleG('canauxAcquisition', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <mat-form-field appearance="outline" class="full q-block">
              <mat-label>Principal concurrent et différenciation</mat-label>
              <mat-icon matPrefix>compare_arrows</mat-icon>
              <input matInput [(ngModel)]="global.principalConcurrent"
                placeholder="Ex : Boulangerie X — nous on mise sur le bio local" />
            </mat-form-field>

            <div class="q-block">
              <label class="q-label">Saisonnalité de l'activité</label>
              <div class="q-radio q-radio--compact">
                @for (opt of SAISONNALITE_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.saisonnalite === opt.value"
                         (click)="toggleRadioG('saisonnalite', opt.value)">
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-section-title">IV — Vigilance et Projets</div>

            <div class="q-block">
              <label class="q-label">Principal « caillou dans la chaussure »</label>
              <div class="q-radio">
                @for (opt of CAILLOU_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="global.caillouChaussure === opt.value"
                         (click)="toggleRadioG('caillouChaussure', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-block">
              <label class="q-label">Projets d'investissement à 12 mois <span class="q-hint">(plusieurs choix)</span></label>
              <div class="q-check">
                @for (opt of PROJETS_OPTS; track opt.value) {
                  <label class="q-opt" [class.sel]="isIn(global.projetsInvestissement, opt.value)"
                         (click)="toggleG('projetsInvestissement', opt.value)">
                    @if (opt.icon) { <mat-icon>{{ opt.icon }}</mat-icon> }
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="q-block">
              <label class="q-label">Niveau d'aisance avec les outils numériques <span class="q-hint">(cliquez à nouveau pour effacer)</span></label>
              <div class="note-row">
                @for (n of [1,2,3,4,5]; track n) {
                  <button class="note-btn" [class.active]="global.niveauNumerique === n"
                          (click)="global.niveauNumerique = global.niveauNumerique === n ? undefined : n">{{ n }}</button>
                }
                <span class="note-hint">{{ noteLabel(global.niveauNumerique) }}</span>
              </div>
            </div>
          }

          <!-- ═══ ÉTAPE 4 — ADN SECTORIEL ══════════════════════ -->
          @case ('adn_sectoriel') {

            <!-- RESTAURATION -->
            @if (secteurSelectionne === 'RESTAURATION') {
              <div class="q-section-title">Infrastructure</div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>Surface totale</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_totale" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Surface vente / accueil</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_vente" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Cuisine / fournil</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_production" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Stockage</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_stockage" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Terrasse / extérieur</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_terrasse" /><span matSuffix>m²</span></mat-form-field>
              </div>
              <div class="q-block"><label class="q-label">Zone d'implantation</label>
                <div class="q-radio q-radio--compact">@for(o of ZONE_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="r.zone_implantation===o.value" (click)="toggleRadioR('zone_implantation',o.value)"><span>{{o.label}}</span></label>}</div>
              </div>
              <div class="q-block"><label class="q-label">Accessibilité <span class="q-hint">(plusieurs choix)</span></label>
                <div class="q-check">@for(o of ACCES_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.accessibilite,o.value)" (click)="toggleR('accessibilite',o.value)"><span>{{o.label}}</span></label>}</div>
              </div>
              <div class="q-section-title">Offre et Clientèle</div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>CA Boutique / À emporter</mat-label><input matInput type="number" min="0" max="100" [(ngModel)]="r.ca_boutique" /><span matSuffix>%</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>CA Restauration sur place</mat-label><input matInput type="number" min="0" max="100" [(ngModel)]="r.ca_sur_place" /><span matSuffix>%</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>CA Traiteur / B2B</mat-label><input matInput type="number" min="0" max="100" [(ngModel)]="r.ca_traiteur" /><span matSuffix>%</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Ticket moyen</mat-label><input matInput type="number" min="0" [(ngModel)]="r.ticket_moyen" /><span matSuffix>€</span></mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full q-block">
                <mat-label>Signature de l'établissement</mat-label>
                <mat-icon matPrefix>star</mat-icon>
                <input matInput [(ngModel)]="r.signature" placeholder="Ex : Le pain au levain maison" />
              </mat-form-field>
              <div class="q-section-title">Production, RH et Hygiène</div>
              <div class="q-block"><label class="q-label">Gestion des invendus</label><div class="q-check">@for(o of INVENDUS_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.invendus,o.value)" (click)="toggleR('invendus',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Mode de commercialisation</label><div class="q-check">@for(o of COMMERCIALISATION_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.commercialisation,o.value)" (click)="toggleR('commercialisation',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Organisation des équipes</label><div class="q-radio q-radio--compact">@for(o of ORG_EQUIPE_OPTS;track o.value){<label class="q-opt" [class.sel]="r.organisation_equipe===o.value" (click)="toggleRadioR('organisation_equipe',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Sécurité sanitaire (HACCP)</label><div class="q-radio q-radio--compact">@for(o of HACCP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.haccp===o.value" (click)="toggleRadioR('haccp',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Point de blocage principal</label><div class="q-radio q-radio--compact">@for(o of BLOCAGE_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="r.blocage_principal===o.value" (click)="toggleRadioR('blocage_principal',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Projets à venir</label><div class="q-check">@for(o of PROJETS_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.projets,o.value)" (click)="toggleR('projets',o.value)"><span>{{o.label}}</span></label>}</div></div>
            }

            <!-- BTP -->
            @if (secteurSelectionne === 'BTP') {
              <div class="q-section-title">Infrastructure</div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>Surface totale</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_totale" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Dépôt / stockage</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_depot" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Bureaux</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_bureaux" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Atelier</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_atelier" /><span matSuffix>m²</span></mat-form-field>
              </div>
              <div class="q-block"><label class="q-label">Zone du siège / dépôt</label><div class="q-radio q-radio--compact">@for(o of ZONE_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.zone_implantation===o.value" (click)="toggleRadioR('zone_implantation',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Accessibilité logistique</label><div class="q-check">@for(o of ACCES_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.accessibilite,o.value)" (click)="toggleR('accessibilite',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-section-title">Spécialité et Clientèle</div>
              <div class="q-block"><label class="q-label">Spécialité dominante</label><div class="q-radio q-radio--compact">@for(o of SPECIALITE_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.specialite===o.value" (click)="toggleRadioR('specialite',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Nature des clients principaux</label><div class="q-radio q-radio--compact">@for(o of CLIENTS_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.nature_clients===o.value" (click)="toggleRadioR('nature_clients',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <mat-form-field appearance="outline" class="full q-block">
                <mat-label>Périmètre d'intervention</mat-label>
                <mat-icon matPrefix>map</mat-icon>
                <input matInput [(ngModel)]="r.perimetre_geo" placeholder="Ex : Toute l'île" />
              </mat-form-field>
              <div class="q-section-title">Risques et Finance</div>
              <div class="q-block"><label class="q-label">Politique de sous-traitance</label><div class="q-radio q-radio--compact">@for(o of SOUS_TRAITANCE_OPTS;track o.value){<label class="q-opt" [class.sel]="r.sous_traitance===o.value" (click)="toggleRadioR('sous_traitance',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Assurance Décennale / RC Pro</label><div class="q-radio q-radio--compact">@for(o of ASSURANCE_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.assurance_decennale===o.value" (click)="toggleRadioR('assurance_decennale',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Méthode de reconnaissance du revenu</label><div class="q-radio q-radio--compact">@for(o of REVENU_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.methode_revenu===o.value" (click)="toggleRadioR('methode_revenu',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">État du carnet de commandes</label><div class="q-radio q-radio--compact">@for(o of CARNET_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.carnet_commandes===o.value" (click)="toggleRadioR('carnet_commandes',o.value)"><span>{{o.label}}</span></label>}</div></div>
            }

            <!-- ASSOCIATION -->
            @if (secteurSelectionne === 'ASSOCIATION') {
              <div class="q-section-title">Infrastructure</div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>Surface totale</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_totale" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Bureaux administratifs</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_bureaux" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Accueil public / Salles</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_accueil" /><span matSuffix>m²</span></mat-form-field>
              </div>
              <div class="q-block"><label class="q-label">Domaine d'intervention</label><div class="q-radio q-radio--compact">@for(o of DOMAINE_ASSO_OPTS;track o.value){<label class="q-opt" [class.sel]="r.domaine===o.value" (click)="toggleRadioR('domaine',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-section-title">Gouvernance et Financement</div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>Membres du Bureau</mat-label><input matInput type="number" min="0" [(ngModel)]="r.nb_bureau" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Adhérents à jour</mat-label><input matInput type="number" min="0" [(ngModel)]="r.nb_adherents" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Bénévoles réguliers</mat-label><input matInput type="number" min="0" [(ngModel)]="r.nb_benevoles" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Cotisations</mat-label><input matInput type="number" min="0" max="100" [(ngModel)]="r.pct_cotisations" /><span matSuffix>%</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Subventions publiques</mat-label><input matInput type="number" min="0" max="100" [(ngModel)]="r.pct_subventions" /><span matSuffix>%</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Dons / Mécénat</mat-label><input matInput type="number" min="0" max="100" [(ngModel)]="r.pct_dons" /><span matSuffix>%</span></mat-form-field>
              </div>
            }

            <!-- HOLDING -->
            @if (secteurSelectionne === 'HOLDING') {
              <div class="q-section-title">Structure et Gouvernance</div>
              <div class="q-block"><label class="q-label">Vocation principale</label><div class="q-radio q-radio--compact">@for(o of VOCATION_HOLDING_OPTS;track o.value){<label class="q-opt" [class.sel]="r.vocation===o.value" (click)="toggleRadioR('vocation',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <mat-form-field appearance="outline" class="q-block">
                <mat-label>Nombre de filiales</mat-label>
                <input matInput type="number" min="1" [(ngModel)]="r.nb_filiales" placeholder="Ex : 3" />
              </mat-form-field>
              <div class="q-block"><label class="q-label">Politique de management</label><div class="q-radio q-radio--compact">@for(o of MANAGEMENT_HOLDING_OPTS;track o.value){<label class="q-opt" [class.sel]="r.politique_management===o.value" (click)="toggleRadioR('politique_management',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-section-title">Flux Financiers</div>
              <div class="q-block"><label class="q-label">Services facturés aux filiales (Management Fees)</label><div class="q-check">@for(o of MANAGEMENT_FEES_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.management_fees,o.value)" (click)="toggleR('management_fees',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Régimes fiscaux activés</label><div class="q-check">@for(o of REGIMES_HOLDING_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.regimes_fiscaux,o.value)" (click)="toggleR('regimes_fiscaux',o.value)"><span>{{o.label}}</span></label>}</div></div>
            }

            <!-- PROFESSION LIBÉRALE -->
            @if (secteurSelectionne === 'PROFESSION_LIBERALE') {
              <div class="q-section-title">Cabinet</div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>Surface totale</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_totale" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Salles de consultation</mat-label><input matInput type="number" min="0" [(ngModel)]="r.nb_salles_consult" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Salle d'attente</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_attente" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>RDV par semaine</mat-label><input matInput type="number" min="0" [(ngModel)]="r.nb_rdv_semaine" /></mat-form-field>
              </div>
              <div class="q-block"><label class="q-label">Zone du cabinet</label><div class="q-radio q-radio--compact">@for(o of ZONE_LIBERAL_OPTS;track o.value){<label class="q-opt" [class.sel]="r.zone_cabinet===o.value" (click)="toggleRadioR('zone_cabinet',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Accessibilité</label><div class="q-check">@for(o of ACCES_LIBERAL_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.accessibilite,o.value)" (click)="toggleR('accessibilite',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Mode d'exercice</label><div class="q-radio q-radio--compact">@for(o of MODE_LIBERAL_OPTS;track o.value){<label class="q-opt" [class.sel]="r.mode_exercice===o.value" (click)="toggleRadioR('mode_exercice',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <mat-form-field appearance="outline" class="full q-block">
                <mat-label>Spécialité / Niche</mat-label>
                <mat-icon matPrefix>medical_services</mat-icon>
                <input matInput [(ngModel)]="r.specialite" placeholder="Ex : Chirurgie dentaire pédiatrique" />
              </mat-form-field>
              <div class="q-block"><label class="q-label">Gestion du secrétariat</label><div class="q-radio q-radio--compact">@for(o of SECRETARIAT_OPTS;track o.value){<label class="q-opt" [class.sel]="r.secretariat===o.value" (click)="toggleRadioR('secretariat',o.value)"><span>{{o.label}}</span></label>}</div></div>
            }

            <!-- SCI -->
            @if (secteurSelectionne === 'SCI') {
              <div class="q-section-title">Patrimoine</div>
              <div class="q-block"><label class="q-label">Nature du patrimoine</label><div class="q-radio q-radio--compact">@for(o of PATRIMOINE_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.nature_patrimoine===o.value" (click)="toggleRadioR('nature_patrimoine',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="surfaces-grid">
                <mat-form-field appearance="outline"><mat-label>Surface totale gérée</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_totale" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Surface habitable / utile</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_habitable" /><span matSuffix>m²</span></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Dépendances / parkings</mat-label><input matInput type="number" min="0" [(ngModel)]="r.surface_dependances" /><span matSuffix>m²</span></mat-form-field>
              </div>
              <div class="q-block"><label class="q-label">État général des biens</label><div class="q-radio q-radio--compact">@for(o of ETAT_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.etat_biens===o.value" (click)="toggleRadioR('etat_biens',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Objectif principal de la SCI</label><div class="q-radio q-radio--compact">@for(o of OBJECTIF_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.objectif_sci===o.value" (click)="toggleRadioR('objectif_sci',o.value)"><span>{{o.label}}</span></label>}</div></div>
              <div class="q-block"><label class="q-label">Régime fiscal</label><div class="q-radio q-radio--compact">@for(o of REGIME_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.regime_fiscal===o.value" (click)="toggleRadioR('regime_fiscal',o.value)"><span>{{o.label}}</span></label>}</div></div>
            }
          }

          <!-- ═══ ÉTAPE FINALE — RÉCAPITULATIF ══════════════════ -->
          @case ('recap') {
            <div class="recap-card">
              <div class="recap-row">
                <mat-icon>business</mat-icon>
                <span class="recap-label">Entreprise</span>
                <span class="recap-val">{{ nomFinal() }}</span>
              </div>
              <div class="recap-row">
                <mat-icon>location_on</mat-icon>
                <span class="recap-label">Site</span>
                <span class="recap-val">{{ siteCtrl.value === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span>
              </div>
              @if (secteurSelectionne) {
                <div class="recap-row">
                  <mat-icon>category</mat-icon>
                  <span class="recap-label">Secteur</span>
                  <span class="recap-val">{{ secteurLabel(secteurSelectionne) }}</span>
                </div>
              }
              @if (global.mission) {
                <div class="recap-row">
                  <mat-icon>flag</mat-icon>
                  <span class="recap-label">Mission</span>
                  <span class="recap-val">{{ global.mission }}</span>
                </div>
              }
              @if (global.visionActivite) {
                <div class="recap-row">
                  <mat-icon>trending_up</mat-icon>
                  <span class="recap-label">Vision</span>
                  <span class="recap-val">{{ labelOf(VISION_OPTS, global.visionActivite) }}</span>
                </div>
              }
              @if (global.caillouChaussure) {
                <div class="recap-row">
                  <mat-icon>warning</mat-icon>
                  <span class="recap-label">Point de vigilance</span>
                  <span class="recap-val">{{ labelOf(CAILLOU_OPTS, global.caillouChaussure) }}</span>
                </div>
              }
            </div>
            <p class="recap-hint">
              Le dossier sera créé avec toutes vos réponses. Vous pourrez les consulter
              et les modifier dans l'onglet <strong>ADN Entreprise</strong>.
            </p>
          }

        }
      </div>

      <!-- ── Barre d'actions (toujours en bas) ───────────────── -->
      <div class="wizard-actions">
        @if (currentStepIndex() > 0) {
          <button mat-stroked-button [disabled]="creating()" (click)="prevStep()">
            <mat-icon>arrow_back</mat-icon> Retour
          </button>
        } @else {
          <span></span>
        }

        @if (!isLastStep) {
          <button mat-flat-button class="btn-next"
                  [disabled]="!canProceed()"
                  (click)="nextStep()">
            {{ nextBtnLabel }} <mat-icon>arrow_forward</mat-icon>
          </button>
        } @else {
          <button mat-flat-button class="btn-create"
                  [disabled]="creating() || !step1Valid()"
                  (click)="confirm()">
            @if (creating()) { <mat-spinner diameter="16"></mat-spinner> }
            @else { <mat-icon>check</mat-icon> }
            Créer le dossier
          </button>
        }
      </div>

    </div>
  `,
  styles: [`
    /* ── Conteneur principal ── */
    .wizard {
      width: 680px;
      max-width: 100%;
      height: 90vh;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: white;
    }

    /* ── Header ── */
    .wizard-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 24px 16px;
      border-bottom: 1px solid #E0E2EC;
      flex-shrink: 0;
    }
    .wh-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, #1565C0, #42A5F5);
      display: flex; align-items: center; justify-content: center;
    }
    .wh-icon mat-icon { color: white; font-size: 22px; width: 22px; height: 22px; }
    .wh-text h2 { font-size: 16px; font-weight: 700; color: #1A1C1E; margin: 0 0 2px; }
    .wh-text p { font-size: 12px; color: #74777F; margin: 0; }
    .wh-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: #74777F; padding: 6px; border-radius: 8px; display: flex;
      transition: background .12s, color .12s;
    }
    .wh-close:hover { background: #F3F4F6; color: #1A1C1E; }

    /* ── Barre de progression ── */
    .wizard-progress {
      display: flex;
      align-items: center;
      padding: 10px 24px;
      background: #F8F9FF;
      border-bottom: 1px solid #E0E2EC;
      flex-shrink: 0;
      gap: 0;
    }
    .ps-step {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
    }
    .ps-circle {
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 2px solid #CBD5E1;
      background: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #94A3B8;
      flex-shrink: 0;
      transition: all .2s;
    }
    .ps-circle mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .ps-label {
      font-size: 11px; color: #94A3B8; font-weight: 500;
      white-space: nowrap;
      transition: color .2s;
    }
    .ps-step.done .ps-circle { border-color: #1565C0; background: #E8F0FE; color: #1565C0; }
    .ps-step.done .ps-label { color: #1565C0; }
    .ps-step.current .ps-circle { border-color: #1565C0; background: #1565C0; color: white; }
    .ps-step.current .ps-label { color: #1A1C1E; font-weight: 700; }
    .ps-line {
      flex: 1;
      height: 2px;
      background: #E2E8F0;
      margin: 0 6px;
      min-width: 12px;
      transition: background .2s;
    }
    .ps-line.done { background: #1565C0; }

    /* ── Zone de contenu (scrollable) ── */
    .wizard-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px 28px 16px;
    }

    /* ── Barre d'actions ── */
    .wizard-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      border-top: 1px solid #ECEEF4;
      flex-shrink: 0;
      background: white;
    }
    .btn-next {
      display: flex; align-items: center; gap: 6px;
      background: #1565C0 !important; color: white !important;
      border-radius: 20px !important; padding: 0 20px !important;
      height: 38px;
    }
    .btn-next mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .btn-create {
      display: flex; align-items: center; gap: 6px;
      background: #2E7D32 !important; color: white !important;
      border-radius: 20px !important; padding: 0 24px !important;
      height: 38px;
    }

    /* ── Recherche Pappers ── */
    .search-wrap { position: relative; margin-bottom: 16px; }
    .search-field {
      display: flex; align-items: center; gap: 10px;
      background: white; border: 1.5px solid #E2E8F0;
      border-radius: 12px; padding: 0 12px; height: 50px;
      transition: border-color .15s, box-shadow .15s;
    }
    .search-field--focus { border-color: #1565C0; box-shadow: 0 0 0 3px rgba(21,101,192,.1); }
    .search-icon { color: #94A3B8; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .search-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 14px; font-weight: 500; color: #0F172A; font-family: inherit;
    }
    .search-input::placeholder { color: #94A3B8; font-weight: 400; }
    .search-clear { flex-shrink: 0; background: none; border: none; cursor: pointer; color: #94A3B8; padding: 4px; border-radius: 6px; display: flex; }
    .search-spinner { flex-shrink: 0; }
    .search-dropdown {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0;
      background: white; border: 1px solid #E2E8F0; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.12); overflow-y: auto;
      max-height: 260px; z-index: 1000;
    }
    .dropdown-loading { display: flex; align-items: center; gap: 10px; padding: 14px 16px; font-size: 13px; color: #64748B; }
    .dropdown-option {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; cursor: pointer;
      border-bottom: 1px solid #F8FAFC;
      transition: background .1s;
    }
    .dropdown-option:hover, .dropdown-option--highlighted { background: #EFF6FF; }
    .opt-initials {
      width: 36px; height: 36px; border-radius: 10px;
      background: #E8F0FE; color: #1565C0; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .opt-body { flex: 1; min-width: 0; }
    .opt-name { font-size: 13px; font-weight: 600; color: #0F172A; }
    .opt-meta { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
    .opt-siren { font-size: 11px; font-weight: 700; color: #1565C0; background: #E8F0FE; padding: 1px 7px; border-radius: 6px; }
    .opt-sep { color: #CBD5E1; }
    .opt-forme { font-size: 11px; color: #64748B; }
    .opt-addr { display: flex; align-items: center; gap: 3px; font-size: 11.5px; color: #94A3B8; margin-top: 2px; }
    .opt-addr mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .dropdown-empty { display: flex; align-items: center; gap: 8px; padding: 18px 16px; font-size: 13px; color: #94A3B8; }

    /* ── Aperçu Pappers ── */
    .preview-card { background: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
    .preview-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .preview-icon { color: #16A34A; font-size: 20px; width: 20px; height: 20px; }
    .preview-header__text { flex: 1; }
    .preview-title { display: block; font-size: 14px; font-weight: 700; color: #15803D; }
    .preview-siren { font-size: 11px; color: #4ADE80; font-weight: 600; }
    .preview-clear { background: none; border: none; cursor: pointer; color: #86EFAC; padding: 4px; border-radius: 6px; display: flex; }
    .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pi { display: flex; flex-direction: column; gap: 2px; }
    .pi.full { grid-column: 1 / -1; }
    .pi label { font-size: 10px; font-weight: 700; color: #86EFAC; text-transform: uppercase; }
    .pi span { font-size: 12.5px; color: #14532D; font-weight: 500; }
    .naf-badge { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
    .naf-badge strong { font-size: 13px; font-weight: 800; color: #14532D; font-family: monospace; }
    .naf-badge em { font-style: normal; font-size: 12px; color: #166534; opacity: .85; }

    /* ── Champ nom manuel ── */
    .full { width: 100%; }

    /* ── Cartes site ── */
    .field-label { display: block; font-size: 13px; font-weight: 600; color: #44474F; margin: 16px 0 10px; }
    .site-cards { display: flex; gap: 12px; }
    .site-card {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 14px; border: 2px solid #E0E2EC; border-radius: 12px; cursor: pointer;
      font-size: 14px; font-weight: 500; color: #44474F;
      transition: border-color .15s, background .15s;
    }
    .site-card.selected { border-color: #1565C0; background: #E8F0FE; color: #1565C0; font-weight: 700; }
    .site-flag { font-size: 22px; }

    /* ── Intro étape ── */
    .step-intro { font-size: 13px; color: #74777F; margin: 0 0 20px; }

    /* ── Cartes secteur ── */
    .secteur-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .secteur-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; border: 2px solid #E0E2EC; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 500; color: #44474F;
      transition: border-color .15s, background .15s, color .15s;
    }
    .secteur-card mat-icon:first-child { color: #74777F; font-size: 22px; width: 22px; height: 22px; flex-shrink: 0; }
    .secteur-card:hover { border-color: #1565C0; background: #F0F4FF; }
    .secteur-card.selected { border-color: #1565C0; background: #E8F0FE; color: #1565C0; font-weight: 700; }
    .secteur-card.selected mat-icon:first-child { color: #1565C0; }
    .check-overlay { margin-left: auto; font-size: 18px !important; width: 18px !important; height: 18px !important; color: #1565C0 !important; }
    .skip-link {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: 1px solid #FFCDD2; border-radius: 8px; cursor: pointer;
      font-size: 12px; color: #C62828; padding: 6px 12px;
      transition: background .12s;
    }
    .skip-link mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .skip-link:hover { background: #FFF0F0; }

    /* ── Questionnaire ── */
    .q-section-title {
      font-size: 10.5px; font-weight: 800; color: #1565C0;
      text-transform: uppercase; letter-spacing: .8px;
      margin: 24px 0 14px;
      padding: 8px 12px;
      background: #EEF2FF;
      border-radius: 8px;
      border-left: 3px solid #1565C0;
    }
    .q-block { margin-bottom: 20px; }
    .q-label { display: block; font-size: 13px; font-weight: 600; color: #1E293B; margin-bottom: 10px; }
    .q-hint { font-weight: 400; color: #94A3B8; font-size: 11.5px; }
    /* Grille champs numériques : 2 colonnes fixes, plus stables que auto-fill */
    .surfaces-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 16px; }
    .surfaces-grid mat-form-field { width: 100%; }
    /* Supprime l'espace réservé aux hints/erreurs sous chaque champ (évite les chevauchements) */
    ::ng-deep .wizard .mat-mdc-form-field-subscript-wrapper { height: 0 !important; min-height: 0 !important; overflow: hidden !important; }
    /* Champs compacts : hauteur réduite de 56px → 40px */
    ::ng-deep .wizard mat-form-field { --mat-form-field-container-height: 40px; --mat-form-field-container-vertical-padding: 8px; }
    ::ng-deep .wizard .mat-mdc-form-field-infix { min-height: 40px !important; padding-top: 8px !important; padding-bottom: 8px !important; }
    ::ng-deep .wizard .mdc-text-field--outlined .mdc-notched-outline { font-size: 13px; }
    ::ng-deep .wizard .mat-mdc-form-field .mat-mdc-floating-label { font-size: 13px !important; }
    /* Champ texte pleine largeur dans la grille */
    .surfaces-grid .full-col { grid-column: 1 / -1; }
    .q-radio, .q-check { display: flex; flex-wrap: wrap; gap: 8px; }
    .q-radio--compact .q-opt { font-size: 12.5px; padding: 7px 12px; }
    .q-opt {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 16px; border-radius: 20px;
      border: 1.5px solid #E2E8F0; cursor: pointer;
      font-size: 13px; color: #475569;
      transition: border-color .15s, background .15s, color .15s, box-shadow .15s;
      user-select: none;
      background: white;
    }
    .q-opt mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94A3B8; flex-shrink: 0; }
    .q-opt:hover { border-color: #93C5FD; background: #F0F4FF; color: #1565C0; box-shadow: 0 1px 4px rgba(21,101,192,.08); }
    .q-opt.sel { border-color: #1565C0; background: #1565C0; color: white; font-weight: 600; box-shadow: 0 2px 6px rgba(21,101,192,.25); }
    .q-opt.sel mat-icon { color: white; }
    .note-row { display: flex; align-items: center; gap: 8px; }
    .note-btn {
      width: 38px; height: 38px; border-radius: 50%;
      border: 2px solid #E0E2EC; background: white;
      font-size: 14px; font-weight: 700; color: #44474F; cursor: pointer;
      transition: border-color .15s, background .15s, color .15s;
    }
    .note-btn:hover { border-color: #1565C0; background: #E8F0FE; color: #1565C0; }
    .note-btn.active { border-color: #1565C0; background: #1565C0; color: white; }
    .note-hint { font-size: 12px; color: #74777F; }

    /* ── Récapitulatif ── */
    .recap-card {
      background: #F8F9FF; border: 1px solid #E0E2EC;
      border-radius: 14px; padding: 16px 20px; margin-bottom: 16px;
    }
    .recap-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid #ECEEF4;
    }
    .recap-row:last-child { border-bottom: none; }
    .recap-row mat-icon { color: #1565C0; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    .recap-label { font-size: 12px; font-weight: 700; color: #74777F; width: 130px; flex-shrink: 0; }
    .recap-val { font-size: 13px; color: #1A1C1E; font-weight: 500; flex: 1; }
    .recap-hint { font-size: 12.5px; color: #74777F; line-height: 1.6; }
    .recap-hint strong { color: #1565C0; }
  `],
})
export class CreateClientWizardComponent implements OnInit, OnDestroy {
  private dialogRef  = inject(MatDialogRef<CreateClientWizardComponent>);
  private pappers    = inject(PappersService);
  private clientsSvc = inject(ClientsService);
  private qSvc       = inject(QuestionnaireAdnService);
  private snack      = inject(MatSnackBar);
  private elRef      = inject(ElementRef);
  private destroy$   = new Subject<void>();

  // ── Étape 1 ──
  searchCtrl    = new FormControl('');
  nomManuelCtrl = new FormControl('');
  siteCtrl      = new FormControl('');
  results: PappersResult[] = [];
  selected: PappersResult | null = null;
  searching = false; hasSearched = false; dropdownOpen = false; highlightIndex = -1;
  private search$ = new Subject<string>();

  // ── Étape 2 ──
  secteurSelectionne: SecteurActivite | null = null;

  // ── Étape 3 ──
  global: Partial<QuestionnaireAdnGlobal> = {};

  // ── Étape 4 ──
  private reponses: Record<string, any> = {};

  // ── Navigation ──
  currentStepIndex = signal(0);
  creating = signal(false);

  // ── Étapes visibles (recalculées si secteur change) ──
  get visibleSteps(): WizardStep[] {
    return [
      { id: 'entreprise', label: 'Entreprise' },
      { id: 'secteur',    label: 'Secteur' },
      { id: 'adn_global', label: 'ADN Global' },
      ...(this.secteurSelectionne
        ? [{ id: 'adn_sectoriel' as StepId, label: this.secteurLabelShort() }]
        : []),
      { id: 'recap', label: 'Créer' },
    ];
  }

  get currentStepId(): StepId {
    return this.visibleSteps[this.currentStepIndex()]?.id ?? 'entreprise';
  }

  get isLastStep(): boolean {
    return this.currentStepIndex() === this.visibleSteps.length - 1;
  }

  get nextBtnLabel(): string {
    if (this.currentStepId === 'secteur' && !this.secteurSelectionne) return 'Passer';
    if (this.currentStepId === 'adn_global' && !this.secteurSelectionne) return 'Récapitulatif';
    return 'Suivant';
  }

  stepTitle(): string {
    const titles: Record<StepId, string> = {
      entreprise:    'Identifiez l\'entreprise et le site',
      secteur:       'Sélectionnez le secteur d\'activité',
      adn_global:    'Questionnaire ADN — partie commune',
      adn_sectoriel: 'Questionnaire sectoriel spécifique',
      recap:         'Vérifiez et créez le dossier',
    };
    return titles[this.currentStepId] ?? '';
  }

  nextStep() {
    if (!this.isLastStep) this.currentStepIndex.update(i => i + 1);
  }

  prevStep() {
    if (this.currentStepIndex() > 0) this.currentStepIndex.update(i => i - 1);
  }

  canProceed(): boolean {
    if (this.currentStepId === 'entreprise') return this.step1Valid();
    return true;
  }

  // ── Constantes exposées au template ──
  readonly VISION_OPTS  = VISION_OPTS;  readonly VALEUR_OPTS = VALEUR_OPTS;
  readonly PLACE_OPTS   = PLACE_OPTS;   readonly AMBIANCE_OPTS = AMBIANCE_OPTS;
  readonly ENJEUX_RH_OPTS = ENJEUX_RH_OPTS; readonly CANAUX_OPTS = CANAUX_OPTS;
  readonly SAISONNALITE_OPTS = SAISONNALITE_OPTS; readonly CAILLOU_OPTS = CAILLOU_OPTS;
  readonly PROJETS_OPTS = PROJETS_OPTS;
  readonly ZONE_RESTAU_OPTS = ZONE_RESTAU_OPTS; readonly ACCES_RESTAU_OPTS = ACCES_RESTAU_OPTS;
  readonly INVENDUS_OPTS = INVENDUS_OPTS; readonly COMMERCIALISATION_OPTS = COMMERCIALISATION_OPTS;
  readonly ORG_EQUIPE_OPTS = ORG_EQUIPE_OPTS; readonly HACCP_OPTS = HACCP_OPTS;
  readonly BLOCAGE_RESTAU_OPTS = BLOCAGE_RESTAU_OPTS; readonly PROJETS_RESTAU_OPTS = PROJETS_RESTAU_OPTS;
  readonly ZONE_BTP_OPTS = ZONE_BTP_OPTS; readonly ACCES_BTP_OPTS = ACCES_BTP_OPTS;
  readonly SPECIALITE_BTP_OPTS = SPECIALITE_BTP_OPTS; readonly CLIENTS_BTP_OPTS = CLIENTS_BTP_OPTS;
  readonly SOUS_TRAITANCE_OPTS = SOUS_TRAITANCE_OPTS; readonly ASSURANCE_BTP_OPTS = ASSURANCE_BTP_OPTS;
  readonly REVENU_BTP_OPTS = REVENU_BTP_OPTS; readonly CARNET_BTP_OPTS = CARNET_BTP_OPTS;
  readonly DOMAINE_ASSO_OPTS = DOMAINE_ASSO_OPTS;
  readonly VOCATION_HOLDING_OPTS = VOCATION_HOLDING_OPTS;
  readonly MANAGEMENT_HOLDING_OPTS = MANAGEMENT_HOLDING_OPTS;
  readonly MANAGEMENT_FEES_OPTS = MANAGEMENT_FEES_OPTS;
  readonly REGIMES_HOLDING_OPTS = REGIMES_HOLDING_OPTS;
  readonly ZONE_LIBERAL_OPTS = ZONE_LIBERAL_OPTS; readonly ACCES_LIBERAL_OPTS = ACCES_LIBERAL_OPTS;
  readonly MODE_LIBERAL_OPTS = MODE_LIBERAL_OPTS; readonly SECRETARIAT_OPTS = SECRETARIAT_OPTS;
  readonly PATRIMOINE_SCI_OPTS = PATRIMOINE_SCI_OPTS; readonly ETAT_SCI_OPTS = ETAT_SCI_OPTS;
  readonly OBJECTIF_SCI_OPTS = OBJECTIF_SCI_OPTS; readonly REGIME_SCI_OPTS = REGIME_SCI_OPTS;

  readonly labelOf = (opts: any[], v: string) => opts.find(o => o.value === v)?.label ?? v;
  readonly secteurEntries = (Object.keys(SECTEURS_LABELS) as SecteurActivite[])
    .map(v => ({ value: v, label: SECTEURS_LABELS[v] }));

  // Proxy réponses sectorielles (any pour éviter TS4111)
  get r(): any { return this.reponses; }

  ngOnInit() {
    this.search$.pipe(
      debounceTime(180), distinctUntilChanged(),
      switchMap(q => {
        if (!q?.trim()) { this.results = []; this.hasSearched = false; return of([]); }
        this.searching = true; this.hasSearched = false;
        return this.pappers.search(q.trim()).pipe(catchError(() => of([])));
      }),
      takeUntil(this.destroy$),
    ).subscribe(res => {
      this.searching = false; this.hasSearched = true;
      this.results = res; this.highlightIndex = -1;
    });

    this.searchCtrl.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(v => { if (typeof v === 'string') this.search$.next(v); });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.elRef.nativeElement.contains(e.target)) this.closeDropdown();
  }

  onFocus()     { this.dropdownOpen = true; }
  onBlur()      { setTimeout(() => this.closeDropdown(), 150); }
  closeDropdown(){ this.dropdownOpen = false; this.highlightIndex = -1; }
  moveHighlight(d: number) {
    if (!this.results.length) return;
    this.highlightIndex = Math.max(0, Math.min(this.results.length - 1, this.highlightIndex + d));
  }
  confirmHighlight() { if (this.highlightIndex >= 0) this.onSelect(this.results[this.highlightIndex]); }

  highlight(text: string) {
    const q = (this.searchCtrl.value ?? '').trim();
    if (!q) return text;
    return text.replace(
      new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      m => `<mark>${m}</mark>`,
    );
  }

  onSelect(res: PappersResult) {
    this.selected = res;
    this.searchCtrl.setValue(res.nomEntreprise, { emitEvent: false });
    this.results = [];
    this.closeDropdown();
  }

  clearAll() {
    this.selected = null;
    this.searchCtrl.setValue('');
    this.results = [];
    this.hasSearched = false;
  }

  step1Valid()   { return !!this.siteCtrl.value && !!(this.selected || this.nomManuelCtrl.value?.trim()); }
  nomFinal()     { return this.selected ? this.selected.nomEntreprise : (this.nomManuelCtrl.value?.trim() ?? ''); }
  secteurLabel(s: SecteurActivite) { return SECTEURS_LABELS[s] ?? s; }
  secteurLabelShort() {
    const short: Record<string, string> = {
      RESTAURATION: 'Restauration', BTP: 'BTP',
      ASSOCIATION: 'Association', HOLDING: 'Holding',
      PROFESSION_LIBERALE: 'Prof. Lib.', SCI: 'SCI',
    };
    return short[this.secteurSelectionne ?? ''] ?? '';
  }
  secteurIcon(s: SecteurActivite) {
    const icons: Record<string, string> = {
      RESTAURATION: 'restaurant', BTP: 'construction',
      ASSOCIATION: 'volunteer_activism', HOLDING: 'account_tree',
      PROFESSION_LIBERALE: 'medical_services', SCI: 'apartment',
    };
    return icons[s] ?? 'business';
  }

  isIn(arr: string[] | undefined, v: string) { return arr?.includes(v) ?? false; }

  // Choix unique — cliquer à nouveau désélectionne
  toggleRadioG(field: keyof QuestionnaireAdnGlobal, val: string) {
    (this.global as any)[field] = (this.global as any)[field] === val ? undefined : val;
  }

  toggleRadioR(field: string, val: string) {
    this.reponses[field] = this.reponses[field] === val ? undefined : val;
  }

  // Choix multiple — bascule présence dans le tableau
  toggleG(field: keyof QuestionnaireAdnGlobal, val: string) {
    const arr = [...((this.global[field] as string[]) ?? [])];
    const i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
    (this.global as any)[field] = arr;
  }

  toggleR(field: string, val: string) {
    const arr = [...((this.reponses[field] as string[]) ?? [])];
    const i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
    this.reponses[field] = arr;
  }

  noteLabel(n?: number) {
    return n ? (['', 'Débutant', 'Faible', 'Moyen', 'À l\'aise', 'Expert'][n] ?? '') : '';
  }

  async confirm() {
    if (!this.step1Valid() || this.creating()) return;
    this.creating.set(true);
    try {
      const ficheData = this.selected ? {
        raisonSociale: this.selected.nomEntreprise,
        siren: this.selected.siren,
        siret: this.selected.siret,
        formeJuridique: this.selected.formeJuridique,
        adresse: this.selected.adresse,
        gerants: this.selected.dirigeants.map(d => ({
          nom: `${d.prenom} ${d.nom}`.trim(),
          qualite: d.qualite,
        })),
      } : null;

      const client = await this.clientsSvc.create({
        nom: this.nomFinal(),
        site: this.siteCtrl.value!,
        secteurActivite: this.secteurSelectionne ?? undefined,
        ficheData: ficheData ?? undefined,
      } as any).toPromise();

      if (!client) throw new Error('Échec création client');

      await this.qSvc.updateGlobal(client.id, this.global).toPromise();

      if (this.secteurSelectionne) {
        await this.qSvc.updateSectoriel(client.id, {
          secteur: this.secteurSelectionne,
          reponses: { ...this.reponses },
        }).toPromise();
      }

      this.dialogRef.close(client);
    } catch {
      this.snack.open('Erreur lors de la création du dossier', undefined, { duration: 3000 });
      this.creating.set(false);
    }
  }

  cancel() { this.dialogRef.close(null); }
}
