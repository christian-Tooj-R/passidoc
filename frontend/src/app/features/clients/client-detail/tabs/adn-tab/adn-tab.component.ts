import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OnlyNumbersDirective } from '../../../../../shared/directives/only-numbers.directive';
import { QuestionnaireAdnService } from '../../../../../core/services/questionnaire-adn.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { SecteurService } from '../../../../../core/services/secteur.service';
import { Secteur } from '../../../../../core/models/secteur.model';
import { SecteurActivite, SECTEURS_LABELS, QuestionnaireAdnGlobal, QuestionnaireAdnSectoriel } from '../../../../../core/models/client.model';
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
  labelOf, labelsOf, QOption,
} from '../../../questionnaire-adn.options';

@Component({
  selector: 'app-adn-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSnackBarModule, MatProgressSpinnerModule, OnlyNumbersDirective,
  ],
  template: `
    @if (loading()) {
      <div class="adn-loading"><mat-spinner diameter="36"></mat-spinner></div>
    }

    @if (!loading()) {
      <div class="adn-wrap">

        <!-- ── Bandeau mode ─────────────────────────────── -->
        <div class="mode-bar">
          <div class="mode-bar__left">
            <mat-icon>fingerprint</mat-icon>
            <span>ADN Entreprise</span>
            @if (editMode()) {
              <span class="mode-badge mode-badge--edit">Mode édition</span>
            } @else {
              <span class="mode-badge mode-badge--read">Lecture seule</span>
            }
          </div>
          <div class="mode-bar__right">
            @if (!editMode()) {
              <button mat-stroked-button class="btn-edit" (click)="editMode.set(true)">
                <mat-icon>edit</mat-icon> Modifier
              </button>
            } @else {
              <button mat-stroked-button class="btn-cancel" (click)="cancelEdit()">Annuler</button>
              <button mat-flat-button class="btn-save" [disabled]="saving()" (click)="save()">
                @if (saving()) { <mat-spinner diameter="14"></mat-spinner> } @else { <mat-icon>save</mat-icon> }
                Enregistrer
              </button>
            }
          </div>
        </div>

        <!-- ══════════════════════════════════════════
             SECTEUR D'ACTIVITÉ
        ══════════════════════════════════════════ -->
        <div class="adn-card">
          <div class="card-header"><mat-icon>category</mat-icon><h3>Secteur d'activité</h3></div>
          @if (!editMode()) {
            <div class="fiche-field">
              <span class="ff-label">Secteur</span>
              <span class="ff-value">{{ secteurSelectionne ? secteurLabel(secteurSelectionne) : '—' }}</span>
            </div>
          } @else {
            <mat-form-field appearance="outline" class="field-wide">
              <mat-label>Secteur</mat-label>
              <mat-select [(ngModel)]="secteurSelectionne">
                <mat-option [value]="null">— Aucun —</mat-option>
                @for (s of allSecteurs(); track s.code) {
                  <mat-option [value]="s.code">{{ s.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>

        <!-- ══════════════════════════════════════════
             QUESTIONNAIRE GLOBAL — LECTURE / ÉDITION
        ══════════════════════════════════════════ -->
        <div class="adn-card">
          <div class="card-header"><mat-icon>psychology</mat-icon><h3>ADN Global — Tronc Commun</h3></div>

          @if (!editMode()) {
            <!-- MODE LECTURE -->
            <div class="fiche-section">I — Vision et Identité</div>
            <div class="fiche-row">
              <div class="fiche-field"><span class="ff-label">Mission</span><span class="ff-value">{{ global.mission || '—' }}</span></div>
              <div class="fiche-field"><span class="ff-label">Vision à 3 ans</span><span class="ff-value ff-chip">{{ labelOf(VISION_OPTS, global.visionActivite) }}</span></div>
              <div class="fiche-field"><span class="ff-label">Valeur n°1</span><span class="ff-value ff-chip">{{ labelOf(VALEUR_OPTS, global.valeurCle) }}</span></div>
            </div>
            <div class="fiche-section">II — Capital Humain</div>
            <div class="fiche-row">
              <div class="fiche-field"><span class="ff-label">Place du dirigeant</span><span class="ff-value ff-chip">{{ labelOf(PLACE_OPTS, global.placeExploitation) }}</span></div>
              <div class="fiche-field"><span class="ff-label">Ambiance équipe</span><span class="ff-value ff-chip">{{ labelOf(AMBIANCE_OPTS, global.ambianceEquipe) }}</span></div>
              <div class="fiche-field"><span class="ff-label">Enjeu RH</span><span class="ff-value ff-chip">{{ labelOf(ENJEUX_RH_OPTS, global.enjeuxRH) }}</span></div>
            </div>
            <div class="fiche-section">III — Modèle Économique</div>
            <div class="fiche-row">
              <div class="fiche-field full"><span class="ff-label">Canaux d'acquisition</span><span class="ff-value">{{ labelsOf(CANAUX_OPTS, global.canauxAcquisition) }}</span></div>
              <div class="fiche-field full"><span class="ff-label">Principal concurrent</span><span class="ff-value">{{ global.principalConcurrent || '—' }}</span></div>
              <div class="fiche-field"><span class="ff-label">Saisonnalité</span><span class="ff-value ff-chip">{{ labelOf(SAISONNALITE_OPTS, global.saisonnalite) }}</span></div>
            </div>
            <div class="fiche-section">IV — Vigilance et Projets</div>
            <div class="fiche-row">
              <div class="fiche-field"><span class="ff-label">Caillou dans la chaussure</span><span class="ff-value ff-chip ff-chip--warn">{{ labelOf(CAILLOU_OPTS, global.caillouChaussure) }}</span></div>
              <div class="fiche-field full"><span class="ff-label">Projets investissement</span><span class="ff-value">{{ labelsOf(PROJETS_OPTS, global.projetsInvestissement) }}</span></div>
              <div class="fiche-field"><span class="ff-label">Aisance numérique</span>
                <div class="ff-stars">
                  @for (n of [1,2,3,4,5]; track n) {
                    <span class="ff-star" [class.active]="n <= (global.niveauNumerique ?? 0)">★</span>
                  }
                  <span class="ff-star-label">{{ noteLabel(global.niveauNumerique) }}</span>
                </div>
              </div>
            </div>
          } @else {
            <!-- MODE ÉDITION -->
            <div class="edit-section">I — Vision et Identité</div>
            <div class="q-block"><label class="q-label">Mission principale</label>
              <mat-form-field appearance="outline" class="field-wide"><textarea matInput [(ngModel)]="global.mission" rows="2"></textarea></mat-form-field>
            </div>
            <div class="q-block"><label class="q-label">Vision à 3 ans</label>
              <div class="q-radio">@for(o of VISION_OPTS;track o.value){<label class="q-opt" [class.sel]="global.visionActivite===o.value" (click)="global.visionActivite=o.value"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="q-block"><label class="q-label">Valeur n°1</label>
              <div class="q-radio">@for(o of VALEUR_OPTS;track o.value){<label class="q-opt" [class.sel]="global.valeurCle===o.value" (click)="global.valeurCle=o.value"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="edit-section">II — Capital Humain</div>
            <div class="q-block"><label class="q-label">Place du dirigeant</label>
              <div class="q-radio">@for(o of PLACE_OPTS;track o.value){<label class="q-opt" [class.sel]="global.placeExploitation===o.value" (click)="global.placeExploitation=o.value"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="q-block"><label class="q-label">Ambiance équipe</label>
              <div class="q-radio">@for(o of AMBIANCE_OPTS;track o.value){<label class="q-opt" [class.sel]="global.ambianceEquipe===o.value" (click)="global.ambianceEquipe=o.value"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="q-block"><label class="q-label">Enjeu RH principal</label>
              <div class="q-radio q-radio--compact">@for(o of ENJEUX_RH_OPTS;track o.value){<label class="q-opt" [class.sel]="global.enjeuxRH===o.value" (click)="global.enjeuxRH=o.value"><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="edit-section">III — Modèle Économique</div>
            <div class="q-block"><label class="q-label">Canaux d'acquisition (plusieurs)</label>
              <div class="q-check">@for(o of CANAUX_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(global.canauxAcquisition,o.value)" (click)="toggleG('canauxAcquisition',o.value)"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="q-block"><label class="q-label">Principal concurrent</label>
              <mat-form-field appearance="outline" class="field-wide"><input matInput [(ngModel)]="global.principalConcurrent" /></mat-form-field>
            </div>
            <div class="q-block"><label class="q-label">Saisonnalité</label>
              <div class="q-radio q-radio--compact">@for(o of SAISONNALITE_OPTS;track o.value){<label class="q-opt" [class.sel]="global.saisonnalite===o.value" (click)="global.saisonnalite=o.value"><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="edit-section">IV — Vigilance et Projets</div>
            <div class="q-block"><label class="q-label">Caillou dans la chaussure</label>
              <div class="q-radio">@for(o of CAILLOU_OPTS;track o.value){<label class="q-opt" [class.sel]="global.caillouChaussure===o.value" (click)="global.caillouChaussure=o.value"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="q-block"><label class="q-label">Projets d'investissement (plusieurs)</label>
              <div class="q-check">@for(o of PROJETS_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(global.projetsInvestissement,o.value)" (click)="toggleG('projetsInvestissement',o.value)"><mat-icon>{{o.icon}}</mat-icon><span>{{o.label}}</span></label>}</div>
            </div>
            <div class="q-block"><label class="q-label">Aisance numérique (1 à 5)</label>
              <div class="note-row">
                @for(n of [1,2,3,4,5];track n){<button class="note-btn" [class.active]="global.niveauNumerique===n" (click)="global.niveauNumerique=n">{{n}}</button>}
                <span class="note-hint">{{ noteLabel(global.niveauNumerique) }}</span>
              </div>
            </div>
          }
        </div>

        <!-- ══════════════════════════════════════════
             QUESTIONNAIRE SECTORIEL
        ══════════════════════════════════════════ -->
        @if (secteurSelectionne) {
          <div class="adn-card adn-card--secteur">
            <div class="card-header card-header--secteur">
              <mat-icon>domain</mat-icon>
              <h3>{{ secteurLabel(secteurSelectionne) }}</h3>
            </div>

            @if (!editMode()) {
              <!-- LECTURE SECTORIELLE — secteurs codés en dur -->
              @if (isBuiltinSecteur(secteurSelectionne!)) {
                <div class="fiche-grid">
                  @for (item of ficheItems(); track item.label) {
                    <div class="fiche-field" [class.full]="item.full">
                      <span class="ff-label">{{ item.label }}</span>
                      <span class="ff-value" [class.ff-chip]="item.chip" [class.ff-chip--warn]="item.warn">{{ item.value }}</span>
                    </div>
                  }
                </div>
              }
              <!-- LECTURE SECTORIELLE — secteurs dynamiques -->
              @if (!isBuiltinSecteur(secteurSelectionne!) && currentSecteur()?.questions?.length) {
                <div class="fiche-grid">
                  @for (q of currentSecteur()!.questions; track q.id) {
                    <div class="fiche-field" [class.full]="q.type === 'textarea' || q.type === 'multiselect'">
                      <span class="ff-label">{{ q.label }}</span>
                      <span class="ff-value">{{ formatDynRead(q, r[q.id]) }}</span>
                    </div>
                  }
                </div>
              }
            } @else {
              <!-- ÉDITION SECTORIELLE — secteurs codés en dur -->
              @if (secteurSelectionne === 'RESTAURATION') { <ng-container [ngTemplateOutlet]="tplRestauEdit"></ng-container> }
              @if (secteurSelectionne === 'BTP')           { <ng-container [ngTemplateOutlet]="tplBtpEdit"></ng-container> }
              @if (secteurSelectionne === 'ASSOCIATION')   { <ng-container [ngTemplateOutlet]="tplAssoEdit"></ng-container> }
              @if (secteurSelectionne === 'HOLDING')       { <ng-container [ngTemplateOutlet]="tplHoldingEdit"></ng-container> }
              @if (secteurSelectionne === 'PROFESSION_LIBERALE') { <ng-container [ngTemplateOutlet]="tplLiberalEdit"></ng-container> }
              @if (secteurSelectionne === 'SCI')           { <ng-container [ngTemplateOutlet]="tplSciEdit"></ng-container> }
              <!-- ÉDITION SECTORIELLE — secteurs dynamiques -->
              @if (!isBuiltinSecteur(secteurSelectionne!) && currentSecteur()?.questions?.length) {
                @for (q of currentSecteur()!.questions; track q.id) {
                  <div class="q-block">
                    <label class="q-label">{{ q.label }}</label>
                    @if (q.hint) { <span class="q-hint">{{ q.hint }}</span> }
                    @if (q.type === 'text') {
                      <mat-form-field appearance="outline" class="field-wide">
                        <input matInput [(ngModel)]="r[q.id]" [placeholder]="q.placeholder || ''" />
                      </mat-form-field>
                    }
                    @if (q.type === 'textarea') {
                      <mat-form-field appearance="outline" class="field-wide">
                        <textarea matInput [(ngModel)]="r[q.id]" rows="3" [placeholder]="q.placeholder || ''"></textarea>
                      </mat-form-field>
                    }
                    @if (q.type === 'number') {
                      <mat-form-field appearance="outline">
                        <input matInput type="number" [(ngModel)]="r[q.id]" [placeholder]="q.placeholder || ''" />
                      </mat-form-field>
                    }
                    @if (q.type === 'radio' && q.options?.length) {
                      <div class="q-radio q-radio--compact">
                        @for (o of q.options!; track o.value) {
                          <label class="q-opt" [class.sel]="r[q.id] === o.value" (click)="r[q.id] = o.value">
                            @if (o.icon) { <mat-icon>{{ o.icon }}</mat-icon> }
                            <span>{{ o.label }}</span>
                          </label>
                        }
                      </div>
                    }
                    @if (q.type === 'multiselect' && q.options?.length) {
                      <div class="q-check">
                        @for (o of q.options!; track o.value) {
                          <label class="q-opt" [class.sel]="isIn(r[q.id], o.value)" (click)="toggleDyn(q.id, o.value)">
                            @if (o.icon) { <mat-icon>{{ o.icon }}</mat-icon> }
                            <span>{{ o.label }}</span>
                          </label>
                        }
                      </div>
                    }
                  </div>
                }
              }
            }
          </div>
        }

      </div>
    }

    <!-- ════════ TEMPLATES ÉDITION SECTORIELLE ════════ -->
    <ng-template #tplRestauEdit>
      <div class="edit-section">Infrastructure</div>
      <div class="surfaces-grid">
        <div class="q-block"><label class="q-label">Surface totale (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_totale" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Surface vente (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_vente" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Surface cuisine (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_production" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Surface stockage (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_stockage" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Terrasse (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_terrasse" /></mat-form-field></div>
      </div>
      <div class="q-block"><label class="q-label">Zone d'implantation</label><div class="q-radio q-radio--compact">@for(o of ZONE_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="r.zone_implantation===o.value" (click)="r.zone_implantation=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Accessibilité</label><div class="q-check">@for(o of ACCES_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.accessibilite,o.value)" (click)="toggleR('accessibilite',o.value)"><span>{{o.label}}</span></label>}</div></div>
      <div class="edit-section">Offre</div>
      <div class="surfaces-grid">
        <div class="q-block"><label class="q-label">CA Boutique (%)</label><mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" [(ngModel)]="r.ca_boutique" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">CA Sur place (%)</label><mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" [(ngModel)]="r.ca_sur_place" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">CA Traiteur (%)</label><mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" [(ngModel)]="r.ca_traiteur" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Ticket moyen (€)</label><mat-form-field appearance="outline"><mat-label>€</mat-label><input matInput type="number" [(ngModel)]="r.ticket_moyen" /></mat-form-field></div>
      </div>
      <div class="q-block"><label class="q-label">Signature</label><mat-form-field appearance="outline" class="field-wide"><input matInput [(ngModel)]="r.signature" /></mat-form-field></div>
      <div class="q-block"><label class="q-label">Invendus</label><div class="q-check">@for(o of INVENDUS_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.invendus,o.value)" (click)="toggleR('invendus',o.value)"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Commercialisation</label><div class="q-check">@for(o of COMMERCIALISATION_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.commercialisation,o.value)" (click)="toggleR('commercialisation',o.value)"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Organisation équipes</label><div class="q-radio q-radio--compact">@for(o of ORG_EQUIPE_OPTS;track o.value){<label class="q-opt" [class.sel]="r.organisation_equipe===o.value" (click)="r.organisation_equipe=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">HACCP</label><div class="q-radio q-radio--compact">@for(o of HACCP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.haccp===o.value" (click)="r.haccp=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Blocage principal</label><div class="q-radio q-radio--compact">@for(o of BLOCAGE_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="r.blocage_principal===o.value" (click)="r.blocage_principal=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Projets</label><div class="q-check">@for(o of PROJETS_RESTAU_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.projets,o.value)" (click)="toggleR('projets',o.value)"><span>{{o.label}}</span></label>}</div></div>
    </ng-template>

    <ng-template #tplBtpEdit>
      <div class="edit-section">Infrastructure</div>
      <div class="surfaces-grid">
        <div class="q-block"><label class="q-label">Surface totale (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_totale" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Dépôt (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_depot" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Bureaux (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_bureaux" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Atelier (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_atelier" /></mat-form-field></div>
      </div>
      <div class="q-block"><label class="q-label">Zone</label><div class="q-radio q-radio--compact">@for(o of ZONE_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.zone_implantation===o.value" (click)="r.zone_implantation=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Accessibilité logistique</label><div class="q-check">@for(o of ACCES_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.accessibilite,o.value)" (click)="toggleR('accessibilite',o.value)"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Spécialité</label><div class="q-radio q-radio--compact">@for(o of SPECIALITE_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.specialite===o.value" (click)="r.specialite=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Clients principaux</label><div class="q-radio q-radio--compact">@for(o of CLIENTS_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.nature_clients===o.value" (click)="r.nature_clients=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Périmètre géo</label><mat-form-field appearance="outline" class="field-wide"><input matInput [(ngModel)]="r.perimetre_geo" /></mat-form-field></div>
      <div class="q-block"><label class="q-label">Sous-traitance</label><div class="q-radio q-radio--compact">@for(o of SOUS_TRAITANCE_OPTS;track o.value){<label class="q-opt" [class.sel]="r.sous_traitance===o.value" (click)="r.sous_traitance=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Assurance décennale</label><div class="q-radio q-radio--compact">@for(o of ASSURANCE_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.assurance_decennale===o.value" (click)="r.assurance_decennale=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Méthode revenu</label><div class="q-radio q-radio--compact">@for(o of REVENU_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.methode_revenu===o.value" (click)="r.methode_revenu=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Carnet de commandes</label><div class="q-radio q-radio--compact">@for(o of CARNET_BTP_OPTS;track o.value){<label class="q-opt" [class.sel]="r.carnet_commandes===o.value" (click)="r.carnet_commandes=o.value"><span>{{o.label}}</span></label>}</div></div>
    </ng-template>

    <ng-template #tplAssoEdit>
      <div class="surfaces-grid">
        <div class="q-block"><label class="q-label">Surface totale (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_totale" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Bureaux (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_bureaux" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Accueil public (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_accueil" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Membres bureau</label><mat-form-field appearance="outline"><mat-label>Nb</mat-label><input matInput type="number" [(ngModel)]="r.nb_bureau" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Adhérents</label><mat-form-field appearance="outline"><mat-label>Nb</mat-label><input matInput type="number" [(ngModel)]="r.nb_adherents" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Bénévoles</label><mat-form-field appearance="outline"><mat-label>Nb</mat-label><input matInput type="number" [(ngModel)]="r.nb_benevoles" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Cotisations (%)</label><mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" [(ngModel)]="r.pct_cotisations" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Subventions (%)</label><mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" [(ngModel)]="r.pct_subventions" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Dons (%)</label><mat-form-field appearance="outline"><mat-label>%</mat-label><input matInput type="number" [(ngModel)]="r.pct_dons" /></mat-form-field></div>
      </div>
      <div class="q-block"><label class="q-label">Domaine</label><div class="q-radio q-radio--compact">@for(o of DOMAINE_ASSO_OPTS;track o.value){<label class="q-opt" [class.sel]="r.domaine===o.value" (click)="r.domaine=o.value"><span>{{o.label}}</span></label>}</div></div>
    </ng-template>

    <ng-template #tplHoldingEdit>
      <div class="q-block"><label class="q-label">Vocation</label><div class="q-radio q-radio--compact">@for(o of VOCATION_HOLDING_OPTS;track o.value){<label class="q-opt" [class.sel]="r.vocation===o.value" (click)="r.vocation=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Nb filiales</label><mat-form-field appearance="outline"><mat-label>Nb</mat-label><input matInput type="number" [(ngModel)]="r.nb_filiales" /></mat-form-field></div>
      <div class="q-block"><label class="q-label">Management</label><div class="q-radio q-radio--compact">@for(o of MANAGEMENT_HOLDING_OPTS;track o.value){<label class="q-opt" [class.sel]="r.politique_management===o.value" (click)="r.politique_management=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Management Fees</label><div class="q-check">@for(o of MANAGEMENT_FEES_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.management_fees,o.value)" (click)="toggleR('management_fees',o.value)"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Régimes fiscaux</label><div class="q-check">@for(o of REGIMES_HOLDING_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.regimes_fiscaux,o.value)" (click)="toggleR('regimes_fiscaux',o.value)"><span>{{o.label}}</span></label>}</div></div>
    </ng-template>

    <ng-template #tplLiberalEdit>
      <div class="surfaces-grid">
        <div class="q-block"><label class="q-label">Surface totale (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_totale" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Nb salles consult.</label><mat-form-field appearance="outline"><mat-label>Nb</mat-label><input matInput type="number" [(ngModel)]="r.nb_salles_consult" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Salle d'attente (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_attente" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">RDV / semaine</label><mat-form-field appearance="outline"><mat-label>Nb</mat-label><input matInput type="number" [(ngModel)]="r.nb_rdv_semaine" /></mat-form-field></div>
      </div>
      <div class="q-block"><label class="q-label">Zone cabinet</label><div class="q-radio q-radio--compact">@for(o of ZONE_LIBERAL_OPTS;track o.value){<label class="q-opt" [class.sel]="r.zone_cabinet===o.value" (click)="r.zone_cabinet=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Accessibilité</label><div class="q-check">@for(o of ACCES_LIBERAL_OPTS;track o.value){<label class="q-opt" [class.sel]="isIn(r.accessibilite,o.value)" (click)="toggleR('accessibilite',o.value)"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Mode d'exercice</label><div class="q-radio q-radio--compact">@for(o of MODE_LIBERAL_OPTS;track o.value){<label class="q-opt" [class.sel]="r.mode_exercice===o.value" (click)="r.mode_exercice=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Spécialité</label><mat-form-field appearance="outline" class="field-wide"><input matInput [(ngModel)]="r.specialite" /></mat-form-field></div>
      <div class="q-block"><label class="q-label">Secrétariat</label><div class="q-radio q-radio--compact">@for(o of SECRETARIAT_OPTS;track o.value){<label class="q-opt" [class.sel]="r.secretariat===o.value" (click)="r.secretariat=o.value"><span>{{o.label}}</span></label>}</div></div>
    </ng-template>

    <ng-template #tplSciEdit>
      <div class="q-block"><label class="q-label">Nature du patrimoine</label><div class="q-radio q-radio--compact">@for(o of PATRIMOINE_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.nature_patrimoine===o.value" (click)="r.nature_patrimoine=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="surfaces-grid">
        <div class="q-block"><label class="q-label">Surface totale (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_totale" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Surface habitable (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_habitable" /></mat-form-field></div>
        <div class="q-block"><label class="q-label">Dépendances (m²)</label><mat-form-field appearance="outline"><mat-label>m²</mat-label><input matInput type="number" [(ngModel)]="r.surface_dependances" /></mat-form-field></div>
      </div>
      <div class="q-block"><label class="q-label">État des biens</label><div class="q-radio q-radio--compact">@for(o of ETAT_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.etat_biens===o.value" (click)="r.etat_biens=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Objectif SCI</label><div class="q-radio q-radio--compact">@for(o of OBJECTIF_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.objectif_sci===o.value" (click)="r.objectif_sci=o.value"><span>{{o.label}}</span></label>}</div></div>
      <div class="q-block"><label class="q-label">Régime fiscal</label><div class="q-radio q-radio--compact">@for(o of REGIME_SCI_OPTS;track o.value){<label class="q-opt" [class.sel]="r.regime_fiscal===o.value" (click)="r.regime_fiscal=o.value"><span>{{o.label}}</span></label>}</div></div>
    </ng-template>
  `,
  styles: [`
    .adn-loading { display: flex; justify-content: center; padding: 60px; }
    .adn-wrap { display: flex; flex-direction: column; gap: 16px; }

    /* ── Mode bar ── */
    .mode-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: #F8F9FF;
      border: 1px solid #E0E2EC; border-radius: 14px;
    }
    .mode-bar__left { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1A1C1E; }
    .mode-bar__left mat-icon { color: #1565C0; font-size: 20px; width: 20px; height: 20px; }
    .mode-bar__right { display: flex; align-items: center; gap: 10px; }
    .mode-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: .4px; }
    .mode-badge--read { background: #E8F5E9; color: #2E7D32; }
    .mode-badge--edit { background: #FFF3CD; color: #B45309; }
    .btn-edit { border-radius: 20px !important; font-size: 13px !important; display: flex; align-items: center; gap: 4px; }
    .btn-cancel { border-radius: 20px !important; font-size: 13px !important; }
    .btn-save { border-radius: 20px !important; font-size: 13px !important; background: #1565C0 !important; color: white !important; display: flex; align-items: center; gap: 6px; }

    /* ── Cards ── */
    .adn-card { background: white; border: 1px solid #E0E2EC; border-radius: 16px; padding: 20px 24px; }
    .adn-card--secteur { border-color: #C0D1F0; background: #FAFBFF; }
    .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
    .card-header mat-icon { color: #1565C0; font-size: 20px; width: 20px; height: 20px; }
    .card-header h3 { font-size: 15px; font-weight: 700; color: #1A1C1E; margin: 0; }
    .card-header--secteur mat-icon { color: #5E35B1; }

    /* ── Fiche lecture seule ── */
    .fiche-section { font-size: 11.5px; font-weight: 800; color: #1565C0; text-transform: uppercase; letter-spacing: .5px; margin: 16px 0 10px; }
    .fiche-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 4px; }
    .fiche-grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .fiche-field { display: flex; flex-direction: column; gap: 4px; min-width: 160px; flex: 1; }
    .fiche-field.full { flex-basis: 100%; flex: 100%; }
    .ff-label { font-size: 11px; font-weight: 700; color: #74777F; text-transform: uppercase; letter-spacing: .4px; }
    .ff-value { font-size: 13.5px; color: #1A1C1E; font-weight: 500; }
    .ff-chip { display: inline-block; background: #E8F0FE; color: #1565C0; font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 20px; }
    .ff-chip--warn { background: #FFF3CD; color: #B45309; }
    .ff-stars { display: flex; align-items: center; gap: 3px; }
    .ff-star { font-size: 18px; color: #DDD; }
    .ff-star.active { color: #F59E0B; }
    .ff-star-label { font-size: 12px; color: #74777F; margin-left: 6px; }

    /* ── Édition ── */
    .edit-section { font-size: 11.5px; font-weight: 800; color: #1565C0; text-transform: uppercase; letter-spacing: .5px; margin: 16px 0 10px; }
    .q-block { margin-bottom: 16px; }
    .q-label { display: block; font-size: 13px; font-weight: 600; color: #44474F; margin-bottom: 8px; }
    .field-wide { width: 100%; }
    .surfaces-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 10px; margin-bottom: 8px; }
    .surfaces-grid mat-form-field { width: 100%; }
    .q-radio, .q-check { display: flex; flex-wrap: wrap; gap: 8px; }
    .q-radio--compact .q-opt { font-size: 12.5px; padding: 7px 12px; }
    .q-opt {
      display: flex; align-items: center; gap: 7px; padding: 9px 14px;
      border-radius: 10px; border: 1.5px solid #E0E2EC; cursor: pointer;
      font-size: 13px; color: #44474F; user-select: none;
      transition: border-color .15s, background .15s, color .15s;
    }
    .q-opt mat-icon { font-size: 16px; width: 16px; height: 16px; color: #74777F; flex-shrink: 0; }
    .q-opt:hover { border-color: #1565C0; background: #F0F4FF; }
    .q-opt.sel { border-color: #1565C0; background: #E8F0FE; color: #1565C0; font-weight: 600; }
    .q-opt.sel mat-icon { color: #1565C0; }
    .note-row { display: flex; align-items: center; gap: 8px; }
    .note-btn { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #E0E2EC; background: white; font-size: 14px; font-weight: 700; color: #44474F; cursor: pointer; transition: border-color .15s, background .15s; }
    .note-btn:hover { border-color: #1565C0; background: #E8F0FE; color: #1565C0; }
    .note-btn.active { border-color: #1565C0; background: #1565C0; color: white; }
    .note-hint { font-size: 12px; color: #74777F; }
    .q-hint { display: block; font-size: 11px; color: #94A3B8; margin: -4px 0 6px; }
  `],
})
export class AdnTabComponent implements OnInit {
  @Input({ required: true }) clientId!: number;
  @Input() secteurInitial?: SecteurActivite;

  loading = signal(true);
  saving  = signal(false);
  editMode = signal(false);

  global: Partial<QuestionnaireAdnGlobal> = {};
  sectoriel: QuestionnaireAdnSectoriel = {};
  private globalSnapshot: Partial<QuestionnaireAdnGlobal> = {};
  private sectorielSnapshot: QuestionnaireAdnSectoriel = {};

  secteurSelectionne: SecteurActivite | null = null;
  allSecteurs = signal<Secteur[]>([]);

  currentSecteur = computed(() =>
    this.allSecteurs().find(s => s.code === this.secteurSelectionne) ?? null
  );

  private readonly BUILTIN_SECTEURS = new Set([
    'RESTAURATION', 'BTP', 'ASSOCIATION', 'HOLDING', 'PROFESSION_LIBERALE', 'SCI',
  ]);

  isBuiltinSecteur(code: string | null) {
    return code ? this.BUILTIN_SECTEURS.has(code) : false;
  }

  get r(): any {
    if (!this.sectoriel.reponses) this.sectoriel.reponses = {};
    return this.sectoriel.reponses;
  }

  readonly secteurEntries = (Object.keys(SECTEURS_LABELS) as SecteurActivite[])
    .map(v => ({ value: v, label: SECTEURS_LABELS[v] }));

  // Options exposées au template
  readonly VISION_OPTS = VISION_OPTS; readonly VALEUR_OPTS = VALEUR_OPTS;
  readonly PLACE_OPTS = PLACE_OPTS; readonly AMBIANCE_OPTS = AMBIANCE_OPTS;
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
  readonly VOCATION_HOLDING_OPTS = VOCATION_HOLDING_OPTS; readonly MANAGEMENT_HOLDING_OPTS = MANAGEMENT_HOLDING_OPTS;
  readonly MANAGEMENT_FEES_OPTS = MANAGEMENT_FEES_OPTS; readonly REGIMES_HOLDING_OPTS = REGIMES_HOLDING_OPTS;
  readonly ZONE_LIBERAL_OPTS = ZONE_LIBERAL_OPTS; readonly ACCES_LIBERAL_OPTS = ACCES_LIBERAL_OPTS;
  readonly MODE_LIBERAL_OPTS = MODE_LIBERAL_OPTS; readonly SECRETARIAT_OPTS = SECRETARIAT_OPTS;
  readonly PATRIMOINE_SCI_OPTS = PATRIMOINE_SCI_OPTS; readonly ETAT_SCI_OPTS = ETAT_SCI_OPTS;
  readonly OBJECTIF_SCI_OPTS = OBJECTIF_SCI_OPTS; readonly REGIME_SCI_OPTS = REGIME_SCI_OPTS;
  readonly labelOf = labelOf;
  readonly labelsOf = labelsOf;

  constructor(
    private svc: QuestionnaireAdnService,
    private clientsSvc: ClientsService,
    private secteurSvc: SecteurService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.secteurSelectionne = this.secteurInitial ?? null;
    // Chargement des secteurs dynamiques (admin)
    this.secteurSvc.getAll().subscribe(secteurs => this.allSecteurs.set(secteurs));

    Promise.all([
      this.svc.getGlobal(this.clientId).toPromise(),
      this.svc.getSectoriel(this.clientId).toPromise(),
    ]).then(([g, s]) => {
      this.global = g ?? {};
      this.sectoriel = s ?? {};
      if (s?.secteur) this.secteurSelectionne = s.secteur;
      this.takeSnapshot();
    }).catch(() => {
      this.snack.open('Erreur lors du chargement de l\'ADN', undefined, { duration: 3000 });
    }).finally(() => {
      this.loading.set(false);
    });
  }

  private takeSnapshot() {
    this.globalSnapshot   = JSON.parse(JSON.stringify(this.global));
    this.sectorielSnapshot = JSON.parse(JSON.stringify(this.sectoriel));
  }

  cancelEdit() {
    this.global    = JSON.parse(JSON.stringify(this.globalSnapshot));
    this.sectoriel = JSON.parse(JSON.stringify(this.sectorielSnapshot));
    this.secteurSelectionne = this.sectoriel.secteur ?? (this.secteurInitial ?? null);
    this.editMode.set(false);
  }

  save() {
    this.saving.set(true);
    // Strip backend-only fields — NestJS forbidNonWhitelisted rejects id/updatedAt/clientId
    const { id: _id, updatedAt: _upd, clientId: _cid, createdAt: _cr, ...globalPayload } = this.global as any;
    const s1 = this.svc.updateGlobal(this.clientId, globalPayload).toPromise();
    const s2 = this.svc.updateSectoriel(this.clientId, {
      secteur: this.secteurSelectionne ?? undefined,
      reponses: { ...this.r },
    }).toPromise();
    const s3 = this.clientsSvc.update(this.clientId, { secteurActivite: this.secteurSelectionne } as any).toPromise();

    Promise.all([s1, s2, s3]).then(([g, sec]) => {
      this.global    = g ?? {};
      this.sectoriel = sec ?? {};
      this.takeSnapshot();
      this.saving.set(false);
      this.editMode.set(false);
      this.snack.open('Dossier ADN enregistré', undefined, { duration: 2500 });
    }).catch(() => {
      this.saving.set(false);
      this.snack.open('Erreur lors de l\'enregistrement', undefined, { duration: 3000 });
    });
  }

  isIn(arr: string[] | undefined, v: string) { return arr?.includes(v) ?? false; }

  toggleG(field: keyof QuestionnaireAdnGlobal, val: string) {
    const arr = [...((this.global[field] as string[]) ?? [])];
    const i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); else arr.push(val);
    (this.global as any)[field] = arr;
  }

  toggleR(field: string, val: string) {
    if (!this.sectoriel.reponses) this.sectoriel.reponses = {};
    const arr = [...((this.sectoriel.reponses[field] as string[]) ?? [])];
    const i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); else arr.push(val);
    this.sectoriel.reponses[field] = arr;
  }

  toggleDyn(fieldId: string, val: string) {
    if (!this.sectoriel.reponses) this.sectoriel.reponses = {};
    const arr = [...((this.sectoriel.reponses[fieldId] as string[]) ?? [])];
    const i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); else arr.push(val);
    this.sectoriel.reponses[fieldId] = arr;
  }

  formatDynRead(q: any, val: any): string {
    if (val == null || val === '') return '—';
    if (Array.isArray(val)) {
      if (!val.length) return '—';
      if (q.options?.length) {
        return val.map((v: string) => q.options.find((o: any) => o.value === v)?.label ?? v).join(', ');
      }
      return val.join(', ');
    }
    if (q.options?.length) {
      return q.options.find((o: any) => o.value === val)?.label ?? val;
    }
    return String(val);
  }

  secteurLabel(s: SecteurActivite) {
    return this.allSecteurs().find(sec => sec.code === s)?.label ?? SECTEURS_LABELS[s] ?? s;
  }
  noteLabel(n?: number) { return n ? (['','Débutant','Faible','Moyen','À l\'aise','Expert'][n] ?? '') : ''; }

  // Génère les champs de la fiche lecture selon le secteur
  ficheItems(): { label: string; value: string; chip?: boolean; warn?: boolean; full?: boolean }[] {
    const rep = this.sectoriel.reponses ?? {};
    const items: { label: string; value: string; chip?: boolean; warn?: boolean; full?: boolean }[] = [];
    const add = (label: string, value: string, opts?: { chip?: boolean; warn?: boolean; full?: boolean }) =>
      items.push({ label, value: value || '—', ...opts });

    const s = this.secteurSelectionne;
    if (!s) return [];

    const num = (v: any) => v != null ? `${v} m²` : '—';
    const pct = (v: any) => v != null ? `${v} %` : '—';

    if (s === 'RESTAURATION') {
      add('Surface totale', num(rep['surface_totale']));
      add('Surface vente', num(rep['surface_vente']));
      add('Surface cuisine', num(rep['surface_production']));
      add('Surface stockage', num(rep['surface_stockage']));
      add('Terrasse', num(rep['surface_terrasse']));
      add('Zone', labelOf(ZONE_RESTAU_OPTS, rep['zone_implantation']), { chip: true });
      add('Accessibilité', labelsOf(ACCES_RESTAU_OPTS, rep['accessibilite']), { full: true, warn: rep['accessibilite']?.includes('ZONE_TRAVAUX') });
      add('CA Boutique', pct(rep['ca_boutique']));
      add('CA Sur place', pct(rep['ca_sur_place']));
      add('CA Traiteur', pct(rep['ca_traiteur']));
      add('Ticket moyen', rep['ticket_moyen'] ? `${rep['ticket_moyen']} €` : '—');
      add('Signature', rep['signature'] || '—', { full: true });
      add('Invendus', labelsOf(INVENDUS_OPTS, rep['invendus']), { full: true });
      add('Commercialisation', labelsOf(COMMERCIALISATION_OPTS, rep['commercialisation']), { full: true });
      add('Org. équipes', labelOf(ORG_EQUIPE_OPTS, rep['organisation_equipe']), { chip: true });
      add('HACCP', labelOf(HACCP_OPTS, rep['haccp']), { chip: true });
      add('Blocage principal', labelOf(BLOCAGE_RESTAU_OPTS, rep['blocage_principal']), { chip: true, warn: true });
      add('Projets', labelsOf(PROJETS_RESTAU_OPTS, rep['projets']), { full: true });
    } else if (s === 'BTP') {
      add('Surface totale', num(rep['surface_totale']));
      add('Dépôt', num(rep['surface_depot']));
      add('Bureaux', num(rep['surface_bureaux']));
      add('Atelier', num(rep['surface_atelier']));
      add('Zone', labelOf(ZONE_BTP_OPTS, rep['zone_implantation']), { chip: true });
      add('Accessibilité', labelsOf(ACCES_BTP_OPTS, rep['accessibilite']), { full: true });
      add('Spécialité', labelOf(SPECIALITE_BTP_OPTS, rep['specialite']), { chip: true });
      add('Clients', labelOf(CLIENTS_BTP_OPTS, rep['nature_clients']), { chip: true });
      add('Périmètre', rep['perimetre_geo'] || '—', { full: true });
      add('Sous-traitance', labelOf(SOUS_TRAITANCE_OPTS, rep['sous_traitance']), { chip: true });
      add('Décennale', labelOf(ASSURANCE_BTP_OPTS, rep['assurance_decennale']), { chip: true, warn: rep['assurance_decennale'] === 'EN_COURS' });
      add('Méthode revenu', labelOf(REVENU_BTP_OPTS, rep['methode_revenu']), { chip: true });
      add('Carnet commandes', labelOf(CARNET_BTP_OPTS, rep['carnet_commandes']), { chip: true, warn: rep['carnet_commandes'] === 'FLUX_TENDU' });
    } else if (s === 'ASSOCIATION') {
      add('Surface totale', num(rep['surface_totale']));
      add('Bureaux', num(rep['surface_bureaux']));
      add('Accueil public', num(rep['surface_accueil']));
      add('Domaine', labelOf(DOMAINE_ASSO_OPTS, rep['domaine']), { chip: true });
      add('Membres bureau', rep['nb_bureau'] ?? '—');
      add('Adhérents', rep['nb_adherents'] ?? '—');
      add('Bénévoles', rep['nb_benevoles'] ?? '—');
      add('Cotisations', pct(rep['pct_cotisations']));
      add('Subventions', pct(rep['pct_subventions']), { warn: rep['pct_subventions'] > 70 });
      add('Dons', pct(rep['pct_dons']));
    } else if (s === 'HOLDING') {
      add('Vocation', labelOf(VOCATION_HOLDING_OPTS, rep['vocation']), { chip: true });
      add('Nb filiales', rep['nb_filiales'] ?? '—');
      add('Management', labelOf(MANAGEMENT_HOLDING_OPTS, rep['politique_management']), { chip: true, full: true });
      add('Management Fees', labelsOf(MANAGEMENT_FEES_OPTS, rep['management_fees']), { full: true });
      add('Régimes fiscaux', labelsOf(REGIMES_HOLDING_OPTS, rep['regimes_fiscaux']), { full: true });
    } else if (s === 'PROFESSION_LIBERALE') {
      add('Surface totale', num(rep['surface_totale']));
      add('Salles consult.', rep['nb_salles_consult'] ?? '—');
      add('Salle d\'attente', num(rep['surface_attente']));
      add('RDV / semaine', rep['nb_rdv_semaine'] ?? '—');
      add('Zone cabinet', labelOf(ZONE_LIBERAL_OPTS, rep['zone_cabinet']), { chip: true });
      add('Accessibilité', labelsOf(ACCES_LIBERAL_OPTS, rep['accessibilite']), { full: true, warn: !rep['accessibilite']?.includes('PMR') });
      add('Mode d\'exercice', labelOf(MODE_LIBERAL_OPTS, rep['mode_exercice']), { chip: true });
      add('Spécialité', rep['specialite'] || '—', { full: true });
      add('Secrétariat', labelOf(SECRETARIAT_OPTS, rep['secretariat']), { chip: true });
    } else if (s === 'SCI') {
      add('Patrimoine', labelOf(PATRIMOINE_SCI_OPTS, rep['nature_patrimoine']), { chip: true });
      add('Surface totale', num(rep['surface_totale']));
      add('Surface habitable', num(rep['surface_habitable']));
      add('Dépendances', num(rep['surface_dependances']));
      add('État des biens', labelOf(ETAT_SCI_OPTS, rep['etat_biens']), { chip: true, warn: rep['etat_biens'] === 'RENOVATION' });
      add('Objectif SCI', labelOf(OBJECTIF_SCI_OPTS, rep['objectif_sci']), { chip: true, full: true });
      add('Régime fiscal', labelOf(REGIME_SCI_OPTS, rep['regime_fiscal']), { chip: true });
    }
    return items;
  }
}
