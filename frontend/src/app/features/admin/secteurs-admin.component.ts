import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SecteurService } from '../../core/services/secteur.service';
import { ToastService } from '../../core/services/toast.service';
import { Secteur, SecteurQuestion } from '../../core/models/secteur.model';
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
} from '../clients/questionnaire-adn.options';

// ── Icônes disponibles ────────────────────────────────────────────
const ICON_LIST = [
  'business','store','apartment','home','work','category',
  'inventory','warehouse','factory','local_shipping','storefront','domain',
  'restaurant','local_dining','fastfood','coffee','lunch_dining','bakery_dining',
  'construction','engineering','handyman','architecture','foundation','build',
  'account_balance','savings','payments','receipt','attach_money','euro',
  'gavel','balance','policy','verified','description','article',
  'local_hospital','health_and_safety','psychology','favorite','spa','healing',
  'school','menu_book','science','biotech','calculate','quiz',
  'computer','devices','code','wifi','cloud','smartphone',
  'people','groups','person','manage_accounts','supervisor_account','badge',
  'sports_soccer','sports','emoji_events','volunteer_activism','park','forest',
  'real_estate_agent','location_city','villa','cottage','landscape','terrain',
  'star','label','flag','eco','agriculture','recycling',
];

// ── Questions par défaut ──────────────────────────────────────────
const GLOBAL_QUESTIONS: SecteurQuestion[] = [
  { id: 'global_vision',       section: 'Vision et Identité',  label: 'Vision à 3 ans',              type: 'radio',       required: true,  options: VISION_OPTS },
  { id: 'global_valeurs',      section: 'Vision et Identité',  label: 'Valeurs phares',               type: 'multiselect', required: true,  options: VALEUR_OPTS },
  { id: 'global_place',        section: 'Vision et Identité',  label: 'Place du dirigeant',           type: 'radio',       required: true,  options: PLACE_OPTS },
  { id: 'global_ambiance',     section: 'Vision et Identité',  label: 'Ambiance de l\'équipe',        type: 'radio',       required: false, options: AMBIANCE_OPTS },
  { id: 'global_rh',           section: 'Vision et Identité',  label: 'Enjeux RH prioritaires',       type: 'multiselect', required: false, options: ENJEUX_RH_OPTS },
  { id: 'global_canaux',       section: 'Marché et Clients',   label: 'Canaux commerciaux',           type: 'multiselect', required: false, options: CANAUX_OPTS },
  { id: 'global_saisonnalite', section: 'Marché et Clients',   label: 'Saisonnalité',                 type: 'radio',       required: false, options: SAISONNALITE_OPTS },
  { id: 'global_cailloux',     section: 'Performance',         label: 'Points de blocage',            type: 'multiselect', required: false, options: CAILLOU_OPTS },
  { id: 'global_projets',      section: 'Performance',         label: 'Projets d\'investissement',    type: 'multiselect', required: false, options: PROJETS_OPTS },
];

const QUESTIONS_BY_SECTOR: Record<string, SecteurQuestion[]> = {
  RESTAURATION: [
    ...GLOBAL_QUESTIONS,
    { id: 'r_zone',              section: 'Spécifique Restauration', label: 'Zone d\'implantation',          type: 'radio',       options: ZONE_RESTAU_OPTS },
    { id: 'r_acces',             section: 'Spécifique Restauration', label: 'Caractéristiques emplacement',  type: 'multiselect', options: ACCES_RESTAU_OPTS },
    { id: 'r_invendus',          section: 'Spécifique Restauration', label: 'Gestion des invendus',          type: 'multiselect', options: INVENDUS_OPTS },
    { id: 'r_commercialisation', section: 'Spécifique Restauration', label: 'Canaux de commercialisation',   type: 'multiselect', options: COMMERCIALISATION_OPTS },
    { id: 'r_org_equipe',        section: 'Spécifique Restauration', label: 'Organisation équipe',           type: 'radio',       options: ORG_EQUIPE_OPTS },
    { id: 'r_haccp',             section: 'Spécifique Restauration', label: 'Conformité HACCP',              type: 'radio',       options: HACCP_OPTS },
    { id: 'r_blocage',           section: 'Spécifique Restauration', label: 'Poste de coût principal',        type: 'radio',       options: BLOCAGE_RESTAU_OPTS },
    { id: 'r_projets',           section: 'Spécifique Restauration', label: 'Projets restauration',          type: 'multiselect', options: PROJETS_RESTAU_OPTS },
  ],
  BTP: [
    ...GLOBAL_QUESTIONS,
    { id: 'btp_zone',        section: 'Spécifique BTP', label: 'Zone géographique',          type: 'radio',       options: ZONE_BTP_OPTS },
    { id: 'btp_acces',       section: 'Spécifique BTP', label: 'Avantages emplacement',       type: 'multiselect', options: ACCES_BTP_OPTS },
    { id: 'btp_specialite',  section: 'Spécifique BTP', label: 'Spécialité principale',       type: 'radio',       options: SPECIALITE_BTP_OPTS },
    { id: 'btp_clients',     section: 'Spécifique BTP', label: 'Clientèle cible',             type: 'multiselect', options: CLIENTS_BTP_OPTS },
    { id: 'btp_sstraitance', section: 'Spécifique BTP', label: 'Sous-traitance',              type: 'radio',       options: SOUS_TRAITANCE_OPTS },
    { id: 'btp_assurance',   section: 'Spécifique BTP', label: 'Assurances professionnelles', type: 'radio',       options: ASSURANCE_BTP_OPTS },
    { id: 'btp_revenu',      section: 'Spécifique BTP', label: 'Mode de facturation',          type: 'radio',       options: REVENU_BTP_OPTS },
    { id: 'btp_carnet',      section: 'Spécifique BTP', label: 'Carnet de commandes',         type: 'radio',       options: CARNET_BTP_OPTS },
  ],
  ASSOCIATION: [
    ...GLOBAL_QUESTIONS,
    { id: 'asso_domaine', section: 'Spécifique Association', label: 'Domaine d\'activité', type: 'radio', options: DOMAINE_ASSO_OPTS },
  ],
  HOLDING: [
    ...GLOBAL_QUESTIONS,
    { id: 'h_vocation',   section: 'Spécifique Holding', label: 'Vocation de la holding',       type: 'radio',       options: VOCATION_HOLDING_OPTS },
    { id: 'h_management', section: 'Spécifique Holding', label: 'Mode de management',            type: 'radio',       options: MANAGEMENT_HOLDING_OPTS },
    { id: 'h_fees',       section: 'Spécifique Holding', label: 'Services management fees',      type: 'multiselect', options: MANAGEMENT_FEES_OPTS },
    { id: 'h_regimes',    section: 'Spécifique Holding', label: 'Régimes fiscaux',               type: 'multiselect', options: REGIMES_HOLDING_OPTS },
  ],
  PROFESSION_LIBERALE: [
    ...GLOBAL_QUESTIONS,
    { id: 'lib_zone',        section: 'Spécifique Profession Libérale', label: 'Zone du cabinet',        type: 'radio',       options: ZONE_LIBERAL_OPTS },
    { id: 'lib_acces',       section: 'Spécifique Profession Libérale', label: 'Accessibilité cabinet',   type: 'multiselect', options: ACCES_LIBERAL_OPTS },
    { id: 'lib_mode',        section: 'Spécifique Profession Libérale', label: 'Mode d\'exercice',        type: 'radio',       options: MODE_LIBERAL_OPTS },
    { id: 'lib_secretariat', section: 'Spécifique Profession Libérale', label: 'Type de secrétariat',     type: 'radio',       options: SECRETARIAT_OPTS },
  ],
  SCI: [
    ...GLOBAL_QUESTIONS,
    { id: 'sci_patrimoine', section: 'Spécifique SCI', label: 'Type de patrimoine', type: 'radio', options: PATRIMOINE_SCI_OPTS },
    { id: 'sci_etat',       section: 'Spécifique SCI', label: 'État du patrimoine',  type: 'radio', options: ETAT_SCI_OPTS },
    { id: 'sci_objectif',   section: 'Spécifique SCI', label: 'Objectif principal',  type: 'radio', options: OBJECTIF_SCI_OPTS },
    { id: 'sci_regime',     section: 'Spécifique SCI', label: 'Régime fiscal',        type: 'radio', options: REGIME_SCI_OPTS },
  ],
};

const TYPE_LABELS: Record<string, string> = { text: 'Texte', textarea: 'Long', radio: 'Unique', multiselect: 'Multiple', number: 'Nombre' };
const TYPE_COLORS: Record<string, string> = { text: '#166534', textarea: '#166534', radio: '#1d4ed8', multiselect: '#7e22ce', number: '#c2410c' };
const TYPE_BG:     Record<string, string> = { text: '#f0fdf4', textarea: '#f0fdf4', radio: '#eff6ff', multiselect: '#fdf4ff', number: '#fff7ed' };

// ── Options editor ────────────────────────────────────────────────
interface OptRow { id: number; v: string; l: string; editV: boolean; }
let _oid = 0;
const mkOpt = (v = '', l = ''): OptRow => ({ id: ++_oid, v, l, editV: false });

@Component({
  selector: 'app-secteurs-admin',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  template: `
<div class="sa-layout">

  <!-- ══ Colonne gauche : liste ═══════════════════════════════════ -->
  <aside class="sa-list">
    <div class="sa-list-header">
      <h1>Secteurs</h1>
      <button mat-flat-button class="btn-new" (click)="openNew()">
        <mat-icon>add</mat-icon> Nouveau
      </button>
    </div>
    <div class="sa-list-toolbar">
      <mat-icon class="si">search</mat-icon>
      <input class="sa-search" type="text" placeholder="Rechercher…" [(ngModel)]="searchText" />
    </div>
    @if (loading()) {
      <div class="sa-list-loading"><mat-spinner diameter="28"></mat-spinner></div>
    } @else {
      <div class="sa-items">
        @for (s of filteredSecteurs(); track s.id) {
          <button class="sa-item" [class.active]="selectedId()===s.id" [class.inactive]="!s.isActive" (click)="select(s)">
            <div class="sa-item__icon"><mat-icon>{{ s.icon || 'business' }}</mat-icon></div>
            <div class="sa-item__body">
              <span class="sa-item__label">{{ s.label }}</span>
              <span class="sa-item__meta">{{ questionCount(s) }} questions@if (s.codeNaf) { · {{ s.codeNaf }} }@if (!s.isActive) { · <em>Inactif</em> }</span>
            </div>
            <mat-icon class="sa-item__chevron">chevron_right</mat-icon>
          </button>
        }
        @if (filteredSecteurs().length === 0) { <p class="sa-empty">Aucun secteur</p> }
      </div>
    }
  </aside>

  <!-- ══ Zone droite : détail ═════════════════════════════════════ -->
  <main class="sa-detail">
    @if (!selected()) {
      <div class="sa-placeholder">
        <mat-icon>category</mat-icon>
        <p>Sélectionnez un secteur</p>
      </div>
    } @else {

      <div class="sd-header">
        <div class="sd-header__icon"><mat-icon>{{ selected()!.icon || 'business' }}</mat-icon></div>
        <div class="sd-header__info">
          <h2>{{ selected()!.label }}</h2>
          <span class="sd-code">{{ selected()!.code }}</span>
        </div>
        <div class="sd-header__actions">
          <button mat-stroked-button (click)="syncOneNaf(selected()!)"><mat-icon>sync</mat-icon> Sync NAF</button>
          @if (selected()!.isActive) {
            <button mat-stroked-button class="btn-danger-o" (click)="toggleActive(selected()!)"><mat-icon>visibility_off</mat-icon> Désactiver</button>
          } @else {
            <button mat-stroked-button (click)="toggleActive(selected()!)"><mat-icon>visibility</mat-icon> Réactiver</button>
          }
        </div>
      </div>

      <!-- Onglets -->
      <div class="sd-tabs">
        <button class="sd-tab" [class.active]="activeTab()==='info'" (click)="activeTab.set('info')">
          <mat-icon>info</mat-icon> Informations
        </button>
        <button class="sd-tab" [class.active]="activeTab()==='questions'" (click)="activeTab.set('questions')">
          <mat-icon>quiz</mat-icon> Questionnaire
          <span class="sd-tab__badge">{{ editingQuestions().length }}</span>
        </button>
      </div>

      <!-- ── Tab Informations ── -->
      @if (activeTab() === 'info') {
        <div class="sd-body">
          <form [formGroup]="form" (ngSubmit)="saveForm()">
            <div class="sd-form-grid">
              <div class="sd-field">
                <label>Libellé affiché</label>
                <mat-form-field appearance="outline" class="w100">
                  <input matInput formControlName="label" />
                </mat-form-field>
              </div>

              <!-- Sélecteur d'icône -->
              <div class="sd-field">
                <label>Icône</label>
                <div class="icon-picker-wrap">
                  <button type="button" class="icon-preview-btn" (click)="toggleIconPicker('form')">
                    <mat-icon>{{ form.value.icon || 'business' }}</mat-icon>
                    <span>{{ form.value.icon || 'business' }}</span>
                    <mat-icon class="icon-preview-arrow">expand_more</mat-icon>
                  </button>
                  @if (iconPickerOpen() === 'form') {
                    <div class="icon-picker-dropdown" (click)="$event.stopPropagation()">
                      <div class="icon-grid">
                        @for (ico of icons; track ico) {
                          <button type="button" class="icon-cell" [class.selected]="form.value.icon === ico"
                                  [matTooltip]="ico" (click)="pickIcon('form', ico)">
                            <mat-icon>{{ ico }}</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="sd-field">
                <label>Code NAF / APE</label>
                <mat-form-field appearance="outline" class="w100">
                  <input matInput formControlName="codeNaf" placeholder="Ex: 56.10A" />
                </mat-form-field>
              </div>
              <div class="sd-field">
                <label>Libellé NAF</label>
                <mat-form-field appearance="outline" class="w100">
                  <input matInput formControlName="codeNafLibelle" placeholder="Auto-rempli par Sync NAF" />
                </mat-form-field>
              </div>
            </div>
            <div class="sd-form-footer">
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- ── Tab Questionnaire ── -->
      @if (activeTab() === 'questions') {
        <div class="sd-body sd-body--q">

          <div class="sq-topbar">
            <span class="sq-count">{{ editingQuestions().length }} questions · {{ editingSections().length }} sections</span>
            <div class="sq-topbar-actions">
              @if (hasDefaultsForSector()) {
                <button mat-stroked-button class="btn-sm" (click)="restoreDefaults()">
                  <mat-icon>restore</mat-icon> Réinitialiser
                </button>
              }
              @if (unsaved()) {
                <button mat-flat-button color="primary" (click)="saveQuestions()" [disabled]="savingQ()">
                  {{ savingQ() ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
              }
            </div>
          </div>

          <!-- Questions par section -->
          @for (section of editingSections(); track section) {
            <div class="sq-section">
              <!-- En-tête de section -->
              <div class="sq-section-head">
                @if (renamingSection() === section) {
                  <input class="sq-section-rename" [(ngModel)]="renameSectionValue"
                         (keydown.enter)="confirmRenameSection(section)"
                         (keydown.escape)="renamingSection.set(null)"
                         (blur)="confirmRenameSection(section)" />
                } @else {
                  <span class="sq-section-title" (dblclick)="startRenameSection(section)">{{ section }}</span>
                }
                <span class="sq-section-count">{{ questionsBySection(section).length }}</span>
                <div class="sq-section-actions">
                  <button mat-icon-button class="btn-xs" (click)="startRenameSection(section)" matTooltip="Renommer la section">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button class="btn-xs btn-danger-icon" (click)="deleteSection(section)" matTooltip="Supprimer la section et ses questions">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Questions de la section -->
              @for (q of questionsBySection(section); track q.id) {
                <div class="sq-row" [class.sq-row--editing]="editingQId() === q.id">
                  @if (editingQId() === q.id) {
                    <div class="sq-edit">
                      <div class="sq-edit-row">
                        <input class="sq-input sq-input--label" [(ngModel)]="inlineLabel" placeholder="Libellé de la question" />
                        <select class="sq-select" [ngModel]="inlineType" (ngModelChange)="onTypeChange('inline', $event)">
                          @for (t of typeOptions; track t.v) { <option [value]="t.v">{{ t.l }}</option> }
                        </select>
                      </div>
                      @if (inlineType === 'radio' || inlineType === 'multiselect') {
                        <div class="opts-editor">
                          <div class="opts-ed-hd">
                            <span>Options</span>
                            <span class="opts-count">{{ inlineOptsArr().length }}</span>
                          </div>
                          @for (opt of inlineOptsArr(); track opt.id; let i = $index) {
                            <div class="opt-row">
                              <span class="opt-num">{{ i + 1 }}</span>
                              <input class="opt-label-inp" [ngModel]="opt.l"
                                     (ngModelChange)="onLabelChange('inline', i, $event)"
                                     placeholder="Libellé de l'option…" />
                              @if (opt.editV) {
                                <input class="opt-val-inp" [ngModel]="opt.v"
                                       (ngModelChange)="onValueChange('inline', i, $event)"
                                       placeholder="VALEUR" />
                              } @else {
                                <span class="opt-val-tag" [class.opt-val-empty]="!opt.v"
                                      (click)="toggleEditV('inline', i)"
                                      title="Valeur technique — cliquer pour modifier">
                                  {{ opt.v || 'valeur' }}
                                </span>
                              }
                              <button type="button" class="opt-del" (click)="removeOpt('inline', i)">
                                <mat-icon>close</mat-icon>
                              </button>
                            </div>
                          }
                          <button type="button" class="opt-add-row" (click)="addOpt('inline')">
                            <mat-icon>add</mat-icon> Ajouter une option
                          </button>
                        </div>
                      }
                      <div class="sq-edit-btns">
                        <button mat-button (click)="cancelEdit()">Annuler</button>
                        <button mat-flat-button color="primary" (click)="confirmEdit(q.id)" [disabled]="!inlineLabel">
                          <mat-icon>check</mat-icon> Valider
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="sq-row-read">
                      <span class="sq-badge" [style.color]="typeColor(q.type)" [style.background]="typeBg(q.type)">
                        {{ typeLabel(q.type) }}
                      </span>
                      <span class="sq-row-label">{{ q.label }}</span>
                      @if (q.options?.length) { <span class="sq-row-opts">{{ q.options!.length }} opts</span> }
                    </div>
                    <div class="sq-row-actions">
                      <button mat-icon-button class="btn-xs" (click)="startEdit(q)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                      <button mat-icon-button class="btn-xs btn-danger-icon" (click)="removeQ(q.id)" matTooltip="Supprimer"><mat-icon>delete_outline</mat-icon></button>
                    </div>
                  }
                </div>
                <!-- Aperçu rendu formulaire — en dehors du sq-row pour éviter les conflits flex -->
                @if (editingQId() !== q.id) {
                  <div class="sq-preview">
                    @if (q.type === 'text') {
                      <span class="sq-prev-input">Saisie libre…</span>
                    } @else if (q.type === 'number') {
                      <span class="sq-prev-input sq-prev-input--num">0</span>
                    } @else if (q.type === 'textarea') {
                      <span class="sq-prev-textarea">Texte long…</span>
                    } @else if (q.type === 'radio' && q.options?.length) {
                      @for (opt of (q.options!.length > 4 ? q.options!.slice(0,4) : q.options!); track opt.value) {
                        <span class="sq-prev-pill sq-prev-pill--radio">
                          <span class="sq-prev-circle"></span>{{ opt.label }}
                        </span>
                      }
                      @if (q.options!.length > 4) {
                        <span class="sq-prev-more">+{{ q.options!.length - 4 }}</span>
                      }
                    } @else if (q.type === 'multiselect' && q.options?.length) {
                      @for (opt of (q.options!.length > 4 ? q.options!.slice(0,4) : q.options!); track opt.value) {
                        <span class="sq-prev-pill sq-prev-pill--check">
                          <span class="sq-prev-square"></span>{{ opt.label }}
                        </span>
                      }
                      @if (q.options!.length > 4) {
                        <span class="sq-prev-more">+{{ q.options!.length - 4 }}</span>
                      }
                    }
                  </div>
                }
              }

              <!-- Formulaire ajout inline dans cette section -->
              @if (addingInSection() === section) {
                <div class="sq-add-inline">
                  <div class="sq-edit-row">
                    <input class="sq-input sq-input--label" [(ngModel)]="newLabel" placeholder="Libellé de la question…" />
                    <select class="sq-select" [ngModel]="newType" (ngModelChange)="onTypeChange('new', $event)">
                      @for (t of typeOptions; track t.v) { <option [value]="t.v">{{ t.l }}</option> }
                    </select>
                  </div>
                  @if (newType === 'radio' || newType === 'multiselect') {
                    <div class="opts-editor">
                      <div class="opts-ed-hd">
                        <span>Options</span>
                        <span class="opts-count">{{ newOptsArr().length }}</span>
                      </div>
                      @for (opt of newOptsArr(); track opt.id; let i = $index) {
                        <div class="opt-row">
                          <span class="opt-num">{{ i + 1 }}</span>
                          <input class="opt-label-inp" [ngModel]="opt.l"
                                 (ngModelChange)="onLabelChange('new', i, $event)"
                                 placeholder="Libellé de l'option…" />
                          @if (opt.editV) {
                            <input class="opt-val-inp" [ngModel]="opt.v"
                                   (ngModelChange)="onValueChange('new', i, $event)"
                                   placeholder="VALEUR" />
                          } @else {
                            <span class="opt-val-tag" [class.opt-val-empty]="!opt.v"
                                  (click)="toggleEditV('new', i)"
                                  title="Valeur technique — cliquer pour modifier">
                              {{ opt.v || 'valeur' }}
                            </span>
                          }
                          <button type="button" class="opt-del" (click)="removeOpt('new', i)">
                            <mat-icon>close</mat-icon>
                          </button>
                        </div>
                      }
                      <button type="button" class="opt-add-row" (click)="addOpt('new')">
                        <mat-icon>add</mat-icon> Ajouter une option
                      </button>
                    </div>
                  }
                  <div class="sq-edit-btns">
                    <button mat-button (click)="cancelAddInSection()">Annuler</button>
                    <button mat-flat-button color="primary" (click)="addQuestion(section)" [disabled]="!newLabel">
                      <mat-icon>add</mat-icon> Ajouter
                    </button>
                  </div>
                </div>
              } @else {
                <button class="sq-add-btn" (click)="openAddInSection(section)">
                  <mat-icon>add</mat-icon> Ajouter une question
                </button>
              }
            </div>
          }

          <!-- Ajouter une nouvelle section -->
          @if (addingSection()) {
            <div class="sq-new-section">
              <input class="sq-input sq-input--section" [(ngModel)]="newSectionName"
                     placeholder="Nom de la nouvelle section…"
                     (keydown.enter)="confirmNewSection()"
                     (keydown.escape)="addingSection.set(false)" />
              <button mat-flat-button color="primary" (click)="confirmNewSection()" [disabled]="!newSectionName">Créer</button>
              <button mat-button (click)="addingSection.set(false)">Annuler</button>
            </div>
          } @else {
            <button class="sq-new-section-btn" (click)="addingSection.set(true); newSectionName=''">
              <mat-icon>add_circle_outline</mat-icon> Nouvelle section
            </button>
          }

          @if (unsaved()) {
            <div class="sq-save-bar">
              <span class="sq-unsaved-label">Modifications non enregistrées</span>
              <button mat-flat-button color="primary" (click)="saveQuestions()" [disabled]="savingQ()">
                {{ savingQ() ? 'Enregistrement...' : 'Enregistrer le questionnaire' }}
              </button>
            </div>
          }

        </div>
      }
    }
  </main>
</div>

<!-- Overlay ferme le picker d'icône si on clique ailleurs -->
@if (iconPickerOpen()) {
  <div class="icon-overlay" (click)="iconPickerOpen.set(null)"></div>
}

<!-- ── Modal nouveau secteur ── -->
@if (showNewModal()) {
  <div class="modal-backdrop" (click)="closeNew()">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Nouveau secteur</h3>
        <button mat-icon-button (click)="closeNew()"><mat-icon>close</mat-icon></button>
      </div>
      <form [formGroup]="newForm" class="modal-body" (ngSubmit)="saveNew()">
        <mat-form-field appearance="outline" class="w100">
          <mat-label>Code unique (ex: RESTAURATION)</mat-label>
          <input matInput formControlName="code" placeholder="MAJUSCULES_SANS_ESPACE" />
          <mat-hint>Non modifiable après création</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w100">
          <mat-label>Libellé affiché</mat-label>
          <input matInput formControlName="label" />
        </mat-form-field>

        <!-- Icône dans le modal -->
        <div class="modal-field">
          <label class="modal-label">Icône</label>
          <div class="icon-picker-wrap">
            <button type="button" class="icon-preview-btn" (click)="toggleIconPicker('newForm')">
              <mat-icon>{{ newIconValue || 'business' }}</mat-icon>
              <span>{{ newIconValue || 'business' }}</span>
              <mat-icon class="icon-preview-arrow">expand_more</mat-icon>
            </button>
            @if (iconPickerOpen() === 'newForm') {
              <div class="icon-picker-dropdown" (click)="$event.stopPropagation()">
                <div class="icon-grid">
                  @for (ico of icons; track ico) {
                    <button type="button" class="icon-cell" [class.selected]="newIconValue === ico"
                            [matTooltip]="ico" (click)="pickIcon('newForm', ico)">
                      <mat-icon>{{ ico }}</mat-icon>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <div class="modal-footer">
          <button mat-button type="button" (click)="closeNew()">Annuler</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="newForm.invalid || saving()">
            {{ saving() ? 'Création...' : 'Créer' }}
          </button>
        </div>
      </form>
    </div>
  </div>
}
  `,
  styles: [`
    /* ══ Layout ═══════════════════════════════════════════════════ */
    .sa-layout { display: flex; height: 100%; overflow: hidden; }

    /* ── Liste ─────────────────────────────────────────────────── */
    .sa-list {
      width: 260px; flex-shrink: 0; border-right: 1px solid #e2e8f0;
      display: flex; flex-direction: column; background: #fafbff; overflow: hidden;
    }
    .sa-list-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 14px 8px;
      h1 { font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0; }
    }
    .btn-new { font-size: 11px !important; height: 30px !important; padding: 0 10px !important; background: #6366f1 !important; color: #fff !important; }
    .sa-list-toolbar { display: flex; align-items: center; gap: 6px; padding: 0 10px 8px; }
    .si { color: #94a3b8; font-size: 17px; width: 17px; height: 17px; }
    .sa-search {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 9px;
      font-size: 12px; outline: none; background: #fff;
      &:focus { border-color: #6366f1; }
    }
    .sa-list-loading { display: flex; justify-content: center; padding: 28px; }
    .sa-items { flex: 1; overflow-y: auto; padding: 0 6px 16px; display: flex; flex-direction: column; gap: 2px; }
    .sa-empty { text-align: center; color: #94a3b8; font-size: 12px; padding: 20px; }

    .sa-item {
      display: flex; align-items: center; gap: 9px; padding: 9px 8px;
      border-radius: 9px; border: none; width: 100%; background: transparent;
      cursor: pointer; text-align: left; transition: background .1s;
    }
    .sa-item:hover { background: #f1f5f9; }
    .sa-item.active { background: #ede9fe; }
    .sa-item.inactive { opacity: .5; }
    .sa-item__icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; background: #e0e7ff; display: flex; align-items: center; justify-content: center; mat-icon { color: #4f46e5; font-size: 17px; width: 17px; height: 17px; } }
    .sa-item.active .sa-item__icon { background: #ddd6fe; }
    .sa-item__body { flex: 1; min-width: 0; }
    .sa-item__label { display: block; font-size: 12px; font-weight: 600; color: #1e293b; }
    .sa-item__meta { display: block; font-size: 10.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sa-item__chevron { color: #cbd5e1; font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .sa-item.active .sa-item__chevron { color: #7c3aed; }

    /* ── Détail ────────────────────────────────────────────────── */
    .sa-detail { flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: #fff; }
    .sa-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; color: #94a3b8; mat-icon { font-size: 38px; width: 38px; height: 38px; } p { font-size: 13px; margin: 0; } }

    .sd-header { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
    .sd-header__icon { width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0; background: #e0e7ff; display: flex; align-items: center; justify-content: center; mat-icon { color: #4f46e5; font-size: 21px; width: 21px; height: 21px; } }
    .sd-header__info { flex: 1; min-width: 0; h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; } }
    .sd-code { font-size: 10.5px; color: #94a3b8; font-family: monospace; display: block; margin-top: 2px; }
    .sd-header__actions { display: flex; gap: 6px; }
    .btn-danger-o { color: #dc2626 !important; border-color: #fecaca !important; }

    .sd-tabs { display: flex; border-bottom: 1px solid #f1f5f9; padding: 0 22px; flex-shrink: 0; }
    .sd-tab { display: flex; align-items: center; gap: 6px; padding: 11px 14px; border: none; background: none; cursor: pointer; font-size: 12.5px; font-weight: 500; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .12s, border-color .12s; mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    .sd-tab:hover { color: #4338ca; }
    .sd-tab.active { color: #4338ca; border-bottom-color: #6366f1; }
    .sd-tab__badge { background: #e0e7ff; color: #4338ca; border-radius: 10px; font-size: 10px; font-weight: 700; padding: 1px 6px; }

    .sd-body { padding: 20px 22px; flex: 1; }
    .sd-body--q { padding: 14px 22px; }
    .sd-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    .sd-field { display: flex; flex-direction: column; label { font-size: 11px; font-weight: 600; color: #64748b; } }
    .w100 { width: 100%; }
    .sd-form-footer { display: flex; justify-content: flex-end; margin-top: 4px; }

    /* ── Sélecteur d'icône ─────────────────────────────────────── */
    .icon-overlay { position: fixed; inset: 0; z-index: 99; }
    .icon-picker-wrap { position: relative; }
    .icon-preview-btn {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px;
      background: #fff; cursor: pointer; font-size: 13px; color: #374151;
      transition: border-color .13s;
      &:hover { border-color: #6366f1; }
      mat-icon:first-child { font-size: 22px; width: 22px; height: 22px; color: #4f46e5; }
    }
    .icon-preview-arrow { font-size: 18px !important; width: 18px !important; height: 18px !important; color: #94a3b8 !important; margin-left: auto; }
    .icon-picker-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; z-index: 100;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,.12);
      padding: 10px; width: 300px; max-height: 260px; overflow-y: auto;
    }
    .icon-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
    }
    .icon-cell {
      display: flex; align-items: center; justify-content: center;
      width: 42px; height: 42px; border-radius: 8px; border: 1px solid transparent;
      background: none; cursor: pointer; transition: background .1s, border-color .1s;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #475569; }
      &:hover { background: #f1f5f9; }
      &.selected { background: #ede9fe; border-color: #7c3aed; mat-icon { color: #7c3aed; } }
    }

    /* ── Questionnaire ─────────────────────────────────────────── */
    .sq-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .sq-count { font-size: 12px; color: #64748b; }
    .sq-topbar-actions { display: flex; gap: 8px; align-items: center; }
    .btn-sm { font-size: 11px !important; height: 30px !important; }

    .sq-section { margin-bottom: 16px; }
    .sq-section-head {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 0 4px; border-bottom: 1px solid #e0e7ff; margin-bottom: 4px;
    }
    .sq-section-title {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
      color: #6366f1; flex: 1; cursor: pointer;
    }
    .sq-section-rename {
      flex: 1; border: 1px solid #6366f1; border-radius: 5px; padding: 2px 7px;
      font-size: 11px; font-weight: 700; color: #4338ca; outline: none;
    }
    .sq-section-count { background: #e0e7ff; color: #4338ca; border-radius: 10px; font-size: 9.5px; font-weight: 700; padding: 1px 6px; }
    .sq-section-actions { display: flex; }
    .btn-xs { width: 24px !important; height: 24px !important; line-height: 24px !important; mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; } }
    .btn-danger-icon { color: #dc2626 !important; }

    .sq-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 8px; border-radius: 7px; gap: 8px; transition: background .1s;
    }
    .sq-row:hover { background: #f8fafc; }
    .sq-row--editing { flex-direction: column; align-items: stretch; background: #f5f7ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 10px; }
    .sq-row-read { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
    .sq-row-label { font-size: 12.5px; font-weight: 500; color: #1e293b; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sq-row-opts { font-size: 10px; color: #94a3b8; background: #f1f5f9; padding: 1px 5px; border-radius: 6px; flex-shrink: 0; }
    .sq-row-actions { display: flex; button { color: #94a3b8 !important; } button:hover { color: #475569 !important; } }

    /* ── Aperçu formulaire (frère du sq-row) ────────────── */
    .sq-preview {
      display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
      padding: 2px 8px 4px; min-height: 0;
    }
    .sq-prev-input {
      font-size: 10.5px; color: #94a3b8; background: #f8fafc;
      border: 1px solid #e2e8f0; border-radius: 5px; padding: 2px 8px;
      font-style: italic;
    }
    .sq-prev-input--num { width: 36px; text-align: center; }
    .sq-prev-textarea {
      font-size: 10.5px; color: #94a3b8; background: #f8fafc;
      border: 1px solid #e2e8f0; border-radius: 5px; padding: 2px 8px;
      font-style: italic; width: 100%; max-width: 180px;
    }
    .sq-prev-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10.5px; color: #475569; background: #f8fafc;
      border: 1px solid #e2e8f0; border-radius: 20px; padding: 1px 7px 1px 4px;
      white-space: nowrap;
    }
    .sq-prev-circle {
      width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
      border: 1.5px solid #94a3b8; display: inline-block;
    }
    .sq-prev-square {
      width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0;
      border: 1.5px solid #94a3b8; display: inline-block;
    }
    .sq-prev-pill--radio .sq-prev-circle { border-color: #6366f1; }
    .sq-prev-pill--check .sq-prev-square { border-color: #6366f1; }
    .sq-prev-more {
      font-size: 10px; color: #6366f1; background: #eef2ff;
      border-radius: 10px; padding: 1px 6px; font-weight: 600;
    }
    .sq-badge { font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 6px; flex-shrink: 0; }

    /* Inputs partagés édition/ajout */
    .sq-edit, .sq-add-inline { display: flex; flex-direction: column; gap: 7px; }
    .sq-edit-row { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
    .sq-input {
      border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 10px; font-size: 13px;
      outline: none; background: #fff;
      &:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.1); }
    }
    .sq-input--label { flex: 1; min-width: 180px; }
    .sq-input--section { flex: 1; min-width: 200px; }
    .sq-select {
      height: 38px; border: 1px solid #d1d5db; border-radius: 6px;
      padding: 0 8px; font-size: 13px; background: #fff; cursor: pointer; min-width: 130px;
      &:focus { border-color: #6366f1; outline: none; }
    }
    .sq-edit-btns { display: flex; justify-content: flex-end; gap: 6px; }

    /* ── Éditeur d'options ─────────────────────────────────────── */
    .opts-editor {
      background: #f8f9ff; border: 1px solid #e0e7ff; border-radius: 10px;
      padding: 8px 10px; display: flex; flex-direction: column; gap: 4px;
    }
    .opts-ed-hd {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 10.5px; font-weight: 700; color: #4338ca; margin-bottom: 2px;
    }
    .opts-count { background: #e0e7ff; color: #4338ca; border-radius: 10px; font-size: 9.5px; font-weight: 700; padding: 1px 6px; }
    .opt-row {
      display: flex; align-items: center; gap: 6px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 7px; padding: 5px 8px;
      transition: border-color .1s;
      &:focus-within { border-color: #a5b4fc; box-shadow: 0 0 0 2px rgba(99,102,241,.08); }
    }
    .opt-num { font-size: 10px; font-weight: 700; color: #94a3b8; min-width: 16px; text-align: center; flex-shrink: 0; }
    .opt-label-inp {
      flex: 1; border: none; outline: none; font-size: 13px; color: #1e293b; background: transparent;
      min-width: 0;
    }
    .opt-val-tag {
      font-size: 9.5px; font-family: monospace; background: #f1f5f9; color: #64748b;
      padding: 2px 7px; border-radius: 5px; cursor: pointer; flex-shrink: 0;
      border: 1px dashed #cbd5e1; white-space: nowrap;
      &:hover { background: #e2e8f0; border-color: #94a3b8; }
    }
    .opt-val-empty { color: #c0ccda; font-style: italic; border-style: dashed; }
    .opt-val-inp {
      font-size: 11px; font-family: monospace; width: 110px; flex-shrink: 0;
      border: 1px solid #a5b4fc; border-radius: 5px; padding: 2px 6px;
      outline: none; background: #eef2ff; color: #3730a3; text-transform: uppercase;
    }
    .opt-del {
      border: none; background: none; cursor: pointer; padding: 1px; flex-shrink: 0;
      display: flex; align-items: center; color: #94a3b8;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { color: #dc2626; }
    }
    .opt-add-row {
      display: flex; align-items: center; gap: 4px; width: 100%;
      border: 1px dashed #c7d2fe; border-radius: 7px; padding: 5px 10px;
      background: transparent; cursor: pointer; font-size: 11.5px; color: #6366f1;
      margin-top: 2px; transition: background .1s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #eef2ff; }
    }

    .sq-add-btn {
      display: flex; align-items: center; gap: 5px; width: 100%;
      padding: 6px 8px; border: none; background: transparent; cursor: pointer;
      font-size: 11.5px; color: #6366f1; border-radius: 7px; margin-top: 2px;
      transition: background .1s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #f0f0ff; }
    }

    .sq-add-inline {
      margin-top: 4px; padding: 10px; background: #f5f7ff;
      border: 1px dashed #c7d2fe; border-radius: 9px;
    }

    .sq-new-section-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; width: 100%; border: 1px dashed #cbd5e1; border-radius: 9px;
      background: transparent; cursor: pointer; font-size: 12px; font-weight: 600;
      color: #6366f1; margin-top: 4px; transition: background .1s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #f5f3ff; border-color: #a5b4fc; }
    }
    .sq-new-section { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }

    .sq-save-bar {
      display: flex; align-items: center; justify-content: flex-end; gap: 12px;
      margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9;
    }
    .sq-unsaved-label { font-size: 12px; color: #f59e0b; font-weight: 500; }

    /* ── Modal ── */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 16px; width: 90vw; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 0; h3 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; } }
    .modal-body { padding: 10px 18px; display: flex; flex-direction: column; gap: 6px; }
    .modal-field { display: flex; flex-direction: column; gap: 4px; }
    .modal-label { font-size: 11px; font-weight: 600; color: #64748b; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 18px 16px; }
  `],
})
export class SecteursAdminComponent implements OnInit {
  private service = inject(SecteurService);
  private toast   = inject(ToastService);
  private fb      = inject(FormBuilder);

  secteurs     = signal<Secteur[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  selectedId   = signal<number | null>(null);
  activeTab    = signal<'info' | 'questions'>('info');
  showNewModal = signal(false);
  searchText   = '';

  // Icônes
  readonly icons    = ICON_LIST;
  iconPickerOpen    = signal<'form' | 'newForm' | null>(null);
  newIconValue      = 'business';

  // Questions
  editingQuestions  = signal<SecteurQuestion[]>([]);
  editingQId        = signal<string | null>(null);
  savingQ           = signal(false);
  unsaved           = signal(false);
  addingInSection   = signal<string | null>(null);
  addingSection     = signal(false);
  pendingSections   = signal<string[]>([]);
  renamingSection   = signal<string | null>(null);

  // Champs inline edit
  inlineLabel   = '';
  inlineType: SecteurQuestion['type'] = 'text';
  inlineOptsArr = signal<OptRow[]>([]);

  // Champs ajout nouvelle question
  newLabel   = '';
  newType: SecteurQuestion['type'] = 'text';
  newOptsArr = signal<OptRow[]>([]);
  newSectionName = '';
  renameSectionValue = '';

  readonly typeOptions = [
    { v: 'text',        l: 'Texte court'  },
    { v: 'textarea',    l: 'Texte long'   },
    { v: 'radio',       l: 'Choix unique' },
    { v: 'multiselect', l: 'Choix multiple' },
    { v: 'number',      l: 'Nombre'       },
  ];

  form = this.fb.group({
    label:          ['', Validators.required],
    icon:           [''],
    codeNaf:        [''],
    codeNafLibelle: [''],
  });
  newForm = this.fb.group({
    code:  ['', Validators.required],
    label: ['', Validators.required],
  });

  selected = computed(() => this.secteurs().find(s => s.id === this.selectedId()) ?? null);
  filteredSecteurs = computed(() => {
    const q = this.searchText.toLowerCase();
    return !q ? this.secteurs() : this.secteurs().filter(s => s.label.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.service.getAll(true).subscribe({
      next: list => { this.secteurs.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  select(s: Secteur) {
    this.selectedId.set(s.id);
    this.editingQId.set(null);
    this.addingInSection.set(null);
    this.pendingSections.set([]);
    this.unsaved.set(false);
    this.activeTab.set('info');
    this.form.patchValue({ label: s.label, icon: s.icon ?? '', codeNaf: s.codeNaf ?? '', codeNafLibelle: s.codeNafLibelle ?? '' });
    const defaults = QUESTIONS_BY_SECTOR[s.code] ?? [];
    // Initialisation immédiate depuis les données locales (purge les ghosts)
    const localSaved = ((s.questions ?? []) as SecteurQuestion[]).filter(q => q.label?.trim());
    this.editingQuestions.set(JSON.parse(JSON.stringify(localSaved.length > 0 ? localSaved : defaults)));
    // Refresh API en arrière-plan pour garantir la fraîcheur
    this.service.getOne(s.id).subscribe({
      next: fresh => {
        if (this.selectedId() !== fresh.id) return; // sélection changée entre-temps
        if (this.unsaved()) return; // l'utilisateur a déjà modifié, ne pas écraser
        this.secteurs.update(list => list.map(x => x.id === fresh.id ? fresh : x));
        const saved = ((fresh.questions ?? []) as SecteurQuestion[]).filter(q => q.label?.trim());
        this.editingQuestions.set(JSON.parse(JSON.stringify(saved.length > 0 ? saved : defaults)));
      },
    });
  }

  questionCount(s: Secteur): number {
    const n = (s.questions ?? []).filter(q => q.label?.trim()).length;
    return n > 0 ? n : (QUESTIONS_BY_SECTOR[s.code]?.length ?? 0);
  }

  hasDefaultsForSector(): boolean { return !!QUESTIONS_BY_SECTOR[this.selected()?.code ?? '']; }

  restoreDefaults() {
    const code = this.selected()?.code;
    if (!code || !QUESTIONS_BY_SECTOR[code]) return;
    this.editingQuestions.set(JSON.parse(JSON.stringify(QUESTIONS_BY_SECTOR[code])));
    this.editingQId.set(null);
    this.addingInSection.set(null);
    this.unsaved.set(true);
  }

  readonly editingSections = computed(() => {
    const seen: string[] = [];
    for (const q of this.editingQuestions()) {
      const s = q.section ?? 'Général';
      if (!seen.includes(s)) seen.push(s);
    }
    for (const p of this.pendingSections()) {
      if (!seen.includes(p)) seen.push(p);
    }
    return seen;
  });

  questionsBySection(sec: string): SecteurQuestion[] {
    return this.editingQuestions().filter(q => (q.section ?? 'Général') === sec && q.label?.trim());
  }

  typeLabel(t: string): string { return TYPE_LABELS[t] ?? t; }
  typeColor(t: string): string { return TYPE_COLORS[t] ?? '#374151'; }
  typeBg(t: string):    string { return TYPE_BG[t] ?? '#f1f5f9'; }

  // ── Éditeur d'options ──────────────────────────────────────────
  private sigFor(which: 'inline' | 'new') {
    return which === 'inline' ? this.inlineOptsArr : this.newOptsArr;
  }

  addOpt(which: 'inline' | 'new') {
    this.sigFor(which).update(a => [...a, mkOpt()]);
  }

  removeOpt(which: 'inline' | 'new', i: number) {
    this.sigFor(which).update(a => a.filter((_, idx) => idx !== i));
  }

  onLabelChange(which: 'inline' | 'new', i: number, val: string) {
    this.sigFor(which).update(a => a.map((o, idx) =>
      idx === i ? { ...o, l: val } : o
    ));
  }

  onValueChange(which: 'inline' | 'new', i: number, val: string) {
    this.sigFor(which).update(a => a.map((o, idx) =>
      idx === i ? { ...o, v: val.toUpperCase().replace(/[^A-Z0-9_]/g, '_') } : o
    ));
  }

  toggleEditV(which: 'inline' | 'new', i: number) {
    this.sigFor(which).update(a => a.map((o, idx) =>
      idx === i ? { ...o, editV: !o.editV } : o
    ));
  }

  onTypeChange(which: 'inline' | 'new', val: string) {
    const type = val as SecteurQuestion['type'];
    if (which === 'inline') { this.inlineType = type; }
    else                    { this.newType    = type; }
    if ((type === 'radio' || type === 'multiselect') && this.sigFor(which)().length === 0) {
      this.sigFor(which).update(a => [...a, mkOpt()]);
    }
  }

  private toSlug(s: string): string {
    return s.toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'OPT';
  }

  private optsFromArr(arr: OptRow[]): { value: string; label: string }[] | undefined {
    const items = arr.filter(o => o.l.trim());
    return items.length ? items.map(o => ({ value: o.v || this.toSlug(o.l), label: o.l })) : undefined;
  }

  // ── Édition inline ──────────────────────────────────────────────
  startEdit(q: SecteurQuestion) {
    this.addingInSection.set(null);
    this.editingQId.set(q.id);
    this.inlineLabel = q.label;
    this.inlineType  = q.type;
    this.inlineOptsArr.set(q.options?.map(o => mkOpt(o.value, o.label)) ?? []);
  }

  cancelEdit() { this.editingQId.set(null); }

  confirmEdit(id: string) {
    if (!this.inlineLabel) return;
    const section = this.editingQuestions().find(q => q.id === id)?.section;
    const updated: SecteurQuestion = {
      id, section,
      label:   this.inlineLabel,
      type:    this.inlineType,
      options: this.optsFromArr(this.inlineOptsArr()),
    };
    this.editingQuestions.update(list => list.map(q => q.id === id ? updated : q));
    this.editingQId.set(null);
    this.unsaved.set(true);
  }

  removeQ(id: string) {
    this.editingQuestions.update(list => list.filter(q => q.id !== id));
    this.unsaved.set(true);
  }

  // ── Ajout de question dans une section ─────────────────────────
  openAddInSection(section: string) {
    this.editingQId.set(null);
    this.newLabel = ''; this.newType = 'text';
    this.newOptsArr.set([]);
    this.addingInSection.set(section);
  }

  addQuestion(section: string) {
    if (!this.newLabel) return;
    const q: SecteurQuestion = {
      id:      `q_${Date.now()}`,
      label:   this.newLabel,
      type:    this.newType,
      section,
      options: this.optsFromArr(this.newOptsArr()),
    };
    this.editingQuestions.update(list => [...list, q]);
    this.pendingSections.update(a => a.filter(p => p !== section));
    this.unsaved.set(true);
    this.addingInSection.set(null);
  }

  cancelAddInSection() {
    const sec = this.addingInSection();
    if (sec && this.questionsBySection(sec).length === 0) {
      this.pendingSections.update(a => a.filter(p => p !== sec));
    }
    this.addingInSection.set(null);
  }

  // ── Gestion des sections ────────────────────────────────────────
  confirmNewSection() {
    if (!this.newSectionName.trim()) return;
    const name = this.newSectionName.trim();
    if (!this.editingSections().includes(name)) {
      this.pendingSections.update(a => [...a, name]);
    }
    this.addingSection.set(false);
    this.unsaved.set(true);
    setTimeout(() => this.openAddInSection(name), 50);
    this.newSectionName = '';
  }

  startRenameSection(section: string) {
    this.renameSectionValue = section;
    this.renamingSection.set(section);
  }

  confirmRenameSection(oldName: string) {
    const newName = this.renameSectionValue.trim();
    if (!newName || newName === oldName) { this.renamingSection.set(null); return; }
    this.editingQuestions.update(list => list.map(q => ({
      ...q, section: q.section === oldName ? newName : q.section,
    })));
    this.pendingSections.update(a => a.map(p => p === oldName ? newName : p));
    this.renamingSection.set(null);
    this.unsaved.set(true);
  }

  deleteSection(section: string) {
    if (!confirm(`Supprimer la section "${section}" et toutes ses questions ?`)) return;
    this.editingQuestions.update(list => list.filter(q => (q.section ?? 'Général') !== section));
    this.pendingSections.update(a => a.filter(p => p !== section));
    this.unsaved.set(true);
  }

  // ── Sélecteur d'icône ──────────────────────────────────────────
  toggleIconPicker(target: 'form' | 'newForm') {
    this.iconPickerOpen.set(this.iconPickerOpen() === target ? null : target);
  }

  pickIcon(target: 'form' | 'newForm', icon: string) {
    if (target === 'form') {
      this.form.patchValue({ icon });
    } else {
      this.newIconValue = icon;
    }
    this.iconPickerOpen.set(null);
  }

  // ── Sauvegarde questionnaire ────────────────────────────────────
  saveQuestions() {
    const s = this.selected();
    if (!s) return;
    this.savingQ.set(true);
    const savedQuestions = this.editingQuestions().filter(q => q.label?.trim());
    this.service.update(s.id, { questions: savedQuestions }).subscribe({
      next: updated => {
        // L'API peut retourner questions: null si la colonne JSON n'est pas re-sérialisée
        const merged = { ...updated, questions: updated.questions?.length ? updated.questions : savedQuestions };
        this.secteurs.update(list => list.map(x => x.id === s.id ? merged : x));
        this.toast.success('Questionnaire enregistré');
        this.savingQ.set(false);
        this.unsaved.set(false);
      },
      error: () => this.savingQ.set(false),
    });
  }

  // ── Infos secteur ───────────────────────────────────────────────
  saveForm() {
    const s = this.selected();
    if (!s || this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.service.update(s.id, raw as Partial<Secteur>).subscribe({
      next: updated => {
        this.secteurs.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.toast.success('Secteur mis à jour');
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(s: Secteur) {
    if (s.isActive) {
      this.service.delete(s.id).subscribe(() => { this.toast.success('Secteur désactivé'); this.load(); });
    } else {
      this.service.update(s.id, { isActive: true }).subscribe(() => { this.toast.success('Secteur réactivé'); this.load(); });
    }
  }

  syncOneNaf(s: Secteur) {
    this.service.syncNaf(s.id).subscribe(updated => {
      this.secteurs.update(list => list.map(x => x.id === updated.id ? updated : x));
      if (this.selectedId() === s.id) this.form.patchValue({ codeNafLibelle: updated.codeNafLibelle ?? '' });
      this.toast.success(`NAF : ${updated.codeNafLibelle || '(aucun libellé)'}`);
    });
  }

  // ── Nouveau secteur ─────────────────────────────────────────────
  openNew()  { this.newForm.reset({ code: '', label: '' }); this.newIconValue = 'business'; this.showNewModal.set(true); }
  closeNew() { this.showNewModal.set(false); }

  saveNew() {
    if (this.newForm.invalid) return;
    this.saving.set(true);
    const raw = this.newForm.getRawValue();
    this.service.create({ ...raw, icon: this.newIconValue } as Partial<Secteur>).subscribe({
      next: created => {
        this.toast.success('Secteur créé');
        this.load();
        this.closeNew();
        this.saving.set(false);
        setTimeout(() => this.select(created), 400);
      },
      error: () => this.saving.set(false),
    });
  }

}
