import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { SalariesService, Collaborateur, UpdateRHDto, UserRole } from './salaries.service';

const TYPES_CONTRAT = ['CDI', 'CDD', 'Apprentissage', 'Stage', 'Intérimaire', 'Freelance', 'Autre'];

const ROLE_META: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN:            { label: 'Admin',            bg: '#fde8e8', color: '#991b1b' },
  EXPERT_COMPTABLE: { label: 'Expert-comptable', bg: '#dbeafe', color: '#1e40af' },
  COLLABORATEUR:    { label: 'Collaborateur',    bg: '#d1fae5', color: '#065f46' },
};

type TabId = 'personnel' | 'contrat' | 'acces';

@Component({
  selector: 'app-salaries-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatSnackBarModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  template: `
@if (loading()) {
  <div class="page-loading"><div class="spinner"></div><span>Chargement...</span></div>
}

@if (collab()) {
<div class="page">

  <!-- Fil d'Ariane -->
  <nav class="breadcrumb">
    <a routerLink="/salaries" class="bc-link">
      <mat-icon>arrow_back</mat-icon> Collaborateurs
    </a>
    <mat-icon class="bc-sep">chevron_right</mat-icon>
    <span class="bc-current">{{ collab()!.firstName }} {{ collab()!.lastName }}</span>
  </nav>

  <div class="layout">

    <!-- ══ Colonne gauche ══ -->
    <aside class="left-col">

      <div class="avatar"
           [class.avatar--re]="collab()!.site === 'REUNION'"
           [class.avatar--mg]="collab()!.site === 'MADAGASCAR'">
        {{ initials(collab()!) }}
      </div>

      <div class="left-name">{{ collab()!.firstName }} {{ collab()!.lastName }}</div>
      <div class="left-poste">{{ collab()!.poste || 'Poste non renseigné' }}</div>

      <div class="left-badges">
        @if (!collab()!.dateSortie) {
          <span class="badge badge--green">Actif</span>
        } @else {
          <span class="badge badge--grey">Ancien</span>
        }
        @if (collab()!.typeContrat) {
          <span class="badge badge--contract">{{ collab()!.typeContrat }}</span>
        }
      </div>

      <div class="left-divider"></div>

      <ul class="left-info">
        <li>
          <mat-icon>location_on</mat-icon>
          <div>
            <span class="li-label">Site</span>
            <span class="li-val">{{ collab()!.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span>
          </div>
        </li>
        <li>
          <mat-icon>mail_outline</mat-icon>
          <div>
            <span class="li-label">Email</span>
            <span class="li-val li-mono">{{ collab()!.email }}</span>
          </div>
        </li>
        @if (collab()!.telephone) {
          <li>
            <mat-icon>phone</mat-icon>
            <div>
              <span class="li-label">Téléphone</span>
              <span class="li-val">{{ collab()!.telephone }}</span>
            </div>
          </li>
        }
        @if (collab()!.dateEntree) {
          <li>
            <mat-icon>calendar_today</mat-icon>
            <div>
              <span class="li-label">Entrée</span>
              <span class="li-val">{{ collab()!.dateEntree | date:'dd MMM yyyy' }}</span>
            </div>
          </li>
        }
        @if (anciennete()) {
          <li>
            <mat-icon>work_history</mat-icon>
            <div>
              <span class="li-label">Ancienneté</span>
              <span class="li-val">{{ anciennete() }}</span>
            </div>
          </li>
        }
      </ul>

      <div class="left-actions">
        <button mat-stroked-button class="btn-edit" (click)="openEdit()">
          <mat-icon>edit</mat-icon> Modifier
        </button>
        <button mat-icon-button [matMenuTriggerFor]="moreMenu">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #moreMenu="matMenu">
          @if (!collab()!.dateSortie) {
            <button mat-menu-item (click)="archiver()">
              <mat-icon>person_off</mat-icon><span>Marquer comme ancien</span>
            </button>
          } @else {
            <button mat-menu-item (click)="reactiver()">
              <mat-icon>person</mat-icon><span>Réactiver</span>
            </button>
          }
        </mat-menu>
      </div>

    </aside>

    <!-- ══ Zone principale ══ -->
    <div class="main-col">

      <!-- Onglets -->
      <div class="tabs">
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'personnel'"
                (click)="activeTab.set('personnel')">Personnel</button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'contrat'"
                (click)="activeTab.set('contrat')">Contrat</button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'acces'"
                (click)="activeTab.set('acces')">Accès</button>
      </div>

      <!-- Contenu des onglets -->
      <div class="tab-panel">

        @if (activeTab() === 'personnel') {
          <div class="section">
            <h3 class="section-title">Informations personnelles</h3>
            <div class="field-grid">
              <div class="field">
                <span class="f-label">Prénom</span>
                <span class="f-val">{{ collab()!.firstName }}</span>
              </div>
              <div class="field">
                <span class="f-label">Nom</span>
                <span class="f-val">{{ collab()!.lastName }}</span>
              </div>
              <div class="field">
                <span class="f-label">Email</span>
                <span class="f-val mono">{{ collab()!.email }}</span>
              </div>
              <div class="field">
                <span class="f-label">Téléphone</span>
                <span class="f-val">{{ collab()!.telephone || '—' }}</span>
              </div>
              <div class="field">
                <span class="f-label">Site</span>
                <span class="f-val">{{ collab()!.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span>
              </div>
              <div class="field">
                <span class="f-label">Statut</span>
                <span class="f-val">
                  @if (!collab()!.dateSortie) {
                    <span class="badge badge--green">Actif</span>
                  } @else {
                    <span class="badge badge--grey">Ancien</span>
                  }
                </span>
              </div>
            </div>
          </div>
        }

        @if (activeTab() === 'contrat') {
          <div class="section">
            <h3 class="section-title">Informations contractuelles</h3>
            <div class="field-grid">
              <div class="field">
                <span class="f-label">Poste / Fonction</span>
                <span class="f-val">{{ collab()!.poste || '—' }}</span>
              </div>
              <div class="field">
                <span class="f-label">Type de contrat</span>
                <span class="f-val">{{ collab()!.typeContrat || '—' }}</span>
              </div>
              <div class="field">
                <span class="f-label">Date d'entrée</span>
                <span class="f-val">{{ (collab()!.dateEntree | date:'dd MMMM yyyy') || '—' }}</span>
              </div>
              <div class="field">
                <span class="f-label">Date de sortie</span>
                <span class="f-val">{{ (collab()!.dateSortie | date:'dd MMMM yyyy') || 'En poste' }}</span>
              </div>
              <div class="field">
                <span class="f-label">Ancienneté</span>
                <span class="f-val">{{ anciennete() || '—' }}</span>
              </div>
            </div>
          </div>
        }

        @if (activeTab() === 'acces') {
          <div class="section">
            <h3 class="section-title">Compte applicatif</h3>
            <div class="field-grid">
              <div class="field">
                <span class="f-label">Rôle système</span>
                <span class="f-val">
                  <span class="badge"
                        [style.background]="roleMeta(collab()!.role).bg"
                        [style.color]="roleMeta(collab()!.role).color">
                    {{ roleMeta(collab()!.role).label }}
                  </span>
                </span>
              </div>
              <div class="field">
                <span class="f-label">Compte</span>
                <span class="f-val">
                  <span [class]="collab()!.isActive ? 'badge badge--green' : 'badge badge--grey'">
                    {{ collab()!.isActive ? 'Actif' : 'Désactivé' }}
                  </span>
                </span>
              </div>
              <div class="field">
                <span class="f-label">Double authentification</span>
                <span class="f-val">
                  <span [class]="collab()!.isTwoFactorEnabled ? 'badge badge--green' : 'badge badge--grey'">
                    {{ collab()!.isTwoFactorEnabled ? 'Activée' : 'Désactivée' }}
                  </span>
                </span>
              </div>
              <div class="field">
                <span class="f-label">Compte créé le</span>
                <span class="f-val">{{ collab()!.createdAt | date:'dd MMM yyyy' }}</span>
              </div>
            </div>

            <div class="role-change">
              <p class="role-change__title">
                <mat-icon>manage_accounts</mat-icon>
                Modifier le rôle
              </p>
              <div class="role-change__body">
                <div class="role-options">
                  @for (r of roles; track r.value) {
                    <label class="role-opt" [class.role-opt--active]="selectedRole() === r.value">
                      <input type="radio" [value]="r.value" [checked]="selectedRole() === r.value"
                             (change)="selectedRole.set(r.value)" />
                      <span class="role-opt__dot" [style.background]="r.bg" [style.color]="r.color">{{ r.label[0] }}</span>
                      <div>
                        <span class="role-opt__name">{{ r.label }}</span>
                        <span class="role-opt__desc">{{ r.desc }}</span>
                      </div>
                    </label>
                  }
                </div>
                <button mat-flat-button class="btn-role"
                        [disabled]="selectedRole() === collab()!.role || savingRole()"
                        (click)="saveRole()">
                  {{ savingRole() ? 'Enregistrement...' : 'Appliquer ce rôle' }}
                </button>
              </div>
            </div>
          </div>
        }

      </div>
    </div>

  </div>
</div>
}

<!-- Panneau d'édition -->
@if (editVisible()) {
  <div class="overlay" (click)="closeEdit()"></div>
  <div class="edit-panel">
    <div class="edit-panel__header">
      <span>Modifier la fiche</span>
      <button mat-icon-button (click)="closeEdit()"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()" class="edit-panel__body">
      <p class="form-section">Identité</p>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Prénom</mat-label>
          <input matInput formControlName="firstName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="lastName" />
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Site</mat-label>
        <mat-select formControlName="site">
          <mat-option value="REUNION">🇷🇪 La Réunion</mat-option>
          <mat-option value="MADAGASCAR">🇲🇬 Madagascar</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Téléphone</mat-label>
        <input matInput formControlName="telephone" />
      </mat-form-field>
      <p class="form-section">Poste & Contrat</p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Intitulé du poste</mat-label>
        <input matInput formControlName="poste" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Type de contrat</mat-label>
        <mat-select formControlName="typeContrat">
          <mat-option [value]="null">— Non renseigné —</mat-option>
          @for (t of typesContrat; track t) {
            <mat-option [value]="t">{{ t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Date d'entrée</mat-label>
          <input matInput type="date" formControlName="dateEntree" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Date de sortie</mat-label>
          <input matInput type="date" formControlName="dateSortie" />
        </mat-form-field>
      </div>
      <div class="form-actions">
        <button mat-button type="button" (click)="closeEdit()">Annuler</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving()">
          {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </form>
  </div>
}
  `,
  styles: [`
    .page-loading {
      display: flex; align-items: center; gap: 12px;
      padding: 60px 32px; color: #8a99b8;
    }
    .spinner {
      width: 20px; height: 20px; border: 2px solid #dde2f0;
      border-top-color: #162351; border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Page ── */
    .page { padding: 20px 24px; }

    .breadcrumb {
      display: flex; align-items: center; gap: 4px;
      margin-bottom: 20px; font-size: 13px;
    }
    .bc-link {
      display: flex; align-items: center; gap: 4px;
      color: #5a6a8a; text-decoration: none; font-weight: 500;
      padding: 4px 8px; border-radius: 6px; transition: background .15s, color .15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #eef1fa; color: #162351; }
    }
    .bc-sep { font-size: 16px; width: 16px; height: 16px; color: #c0c9de; }
    .bc-current { color: #0f1a35; font-weight: 600; }

    /* ── Layout principal ── */
    .layout { display: flex; align-items: flex-start; gap: 20px; }

    /* ── Colonne gauche ── */
    .left-col {
      width: 240px; flex-shrink: 0;
      background: #eef1fa;
      border: 1px solid #dde2f0;
      border-radius: 10px;
      padding: 24px 20px;
      display: flex; flex-direction: column; align-items: center;
      position: sticky; top: 0;
      box-shadow: 0 2px 10px rgba(22, 35, 81, .07);
    }

    .avatar {
      width: 72px; height: 72px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 700; color: #fff; letter-spacing: .5px;
      background: linear-gradient(135deg, #1a2d6b, #2563eb);
      margin-bottom: 14px; flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(22, 35, 81, .25);
    }
    .avatar--re { background: linear-gradient(135deg, #1a2d6b 0%, #2563eb 100%); }
    .avatar--mg { background: linear-gradient(135deg, #064e3b 0%, #059669 100%); }

    .left-name {
      font-size: 15px; font-weight: 700; color: #0f1a35;
      text-align: center; margin-bottom: 4px;
    }
    .left-poste {
      font-size: 12px; color: #6b7fa3; text-align: center; margin-bottom: 12px;
    }
    .left-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }

    .badge {
      display: inline-flex; align-items: center;
      font-size: 11px; font-weight: 600;
      padding: 3px 9px; border-radius: 6px;
    }
    .badge--green { background: #d1fae5; color: #065f46; }
    .badge--grey  { background: #e4e8f4; color: #4b5a7a; }
    .badge--blue  { background: #dbeafe; color: #1e40af; }

    .left-divider { width: 100%; height: 1px; background: #c8d0e8; margin: 16px 0; }

    .left-info {
      list-style: none; padding: 0; margin: 0;
      width: 100%; display: flex; flex-direction: column; gap: 12px;
    }
    .left-info li {
      display: flex; align-items: flex-start; gap: 10px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #7b93b5; flex-shrink: 0; margin-top: 2px; }
      div { display: flex; flex-direction: column; min-width: 0; }
    }
    .li-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8a99b8; }
    .li-val { font-size: 12px; color: #0f1a35; font-weight: 500; word-break: break-all; }
    .li-mono { font-family: monospace; font-size: 11px; }

    .left-actions {
      display: flex; align-items: center; gap: 6px;
      margin-top: 20px; width: 100%;
    }
    .btn-edit {
      flex: 1; border-radius: 6px !important; font-size: 13px !important;
      color: #162351 !important; border-color: #9aaad4 !important;
      &:hover { background: #fff !important; }
    }

    /* ── Zone principale ── */
    .main-col { flex: 1; min-width: 0; }

    /* Onglets */
    .tabs {
      display: flex; gap: 0;
      background: #f0f3fa;
      border: 1px solid #dde2f0;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      padding: 0 4px;
    }
    .tab-btn {
      padding: 12px 18px; font-size: 13px; font-weight: 500;
      color: #5a6a8a; background: none; border: none;
      cursor: pointer; border-bottom: 2px solid transparent;
      margin-bottom: -1px; border-radius: 6px 6px 0 0;
      transition: color .15s, background .15s;
      &:hover { color: #162351; background: rgba(22,35,81,.05); }
    }
    .tab-btn--active {
      color: #162351; font-weight: 700;
      border-bottom: 2px solid #162351;
      background: #fff;
    }

    /* Panneau d'onglet */
    .tab-panel {
      background: #fff;
      border: 1px solid #dde2f0; border-top: none;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 8px rgba(22, 35, 81, .05);
    }

    .section { padding: 24px; }
    .section-title {
      font-size: 13px; font-weight: 700; color: #162351;
      margin: 0 0 20px;
      padding: 0 0 12px 12px;
      border-bottom: 1px solid #eaecf5;
      border-left: 3px solid #162351;
    }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 32px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .f-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; color: #6b7fa3;
    }
    .f-val { font-size: 14px; color: #0f1a35; }
    .f-val.mono { font-family: monospace; font-size: 13px; }

    .badge--contract { background: #e4e8f4; color: #4b5a7a; }

    /* ── Changement de rôle ── */
    .role-change {
      margin-top: 24px; border-top: 1px solid #eaecf5; padding-top: 20px;
    }
    .role-change__title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; color: #162351;
      text-transform: uppercase; letter-spacing: .05em; margin: 0 0 12px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .role-options { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .role-opt {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 7px; cursor: pointer;
      border: 1.5px solid #e4e8f4; transition: border-color .15s, background .15s;
      input[type="radio"] { display: none; }
    }
    .role-opt:hover { border-color: #9aaad4; background: #f5f7ff; }
    .role-opt--active { border-color: #162351; background: #eef1fa; }
    .role-opt__dot {
      width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
    }
    .role-opt__name { font-size: 13px; font-weight: 600; color: #0f1a35; display: block; }
    .role-opt__desc { font-size: 11px; color: #8a99b8; display: block; margin-top: 1px; }
    .btn-role {
      background: #162351 !important; color: #fff !important;
      border-radius: 6px !important; font-size: 13px !important;
      &:disabled { opacity: .5; }
    }

    /* ── Panneau édition ── */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; }
    .edit-panel {
      position: fixed; right: 0; top: 0; bottom: 0;
      width: min(460px, 100vw); background: #fff;
      box-shadow: -6px 0 32px rgba(22, 35, 81, .12);
      z-index: 1000; display: flex; flex-direction: column;
    }
    .edit-panel__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #162351 0%, #1e3a8a 100%);
      font-size: 15px; font-weight: 600; color: #fff;
      mat-icon-button, button { color: rgba(255,255,255,.8) !important; }
    }
    .edit-panel__body {
      padding: 20px; display: flex; flex-direction: column; gap: 4px;
      flex: 1; overflow-y: auto;
    }
    .form-section {
      margin: 8px 0 4px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .08em; color: #6b7fa3;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }
  `],
})
export class SalariesDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(SalariesService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);
  router        = inject(Router);

  collab       = signal<Collaborateur | null>(null);
  loading      = signal(true);
  editVisible  = signal(false);
  saving       = signal(false);
  savingRole   = signal(false);
  activeTab    = signal<TabId>('personnel');
  selectedRole = signal<UserRole>('COLLABORATEUR');

  readonly typesContrat = TYPES_CONTRAT;
  readonly roles = [
    { value: 'COLLABORATEUR'    as UserRole, label: 'Collaborateur',    desc: 'Accès standard aux dossiers clients',     bg: '#d1fae5', color: '#065f46' },
    { value: 'EXPERT_COMPTABLE' as UserRole, label: 'Expert-comptable', desc: 'Gestion complète des dossiers et équipes', bg: '#dbeafe', color: '#1e40af' },
    { value: 'ADMIN'            as UserRole, label: 'Administrateur',   desc: 'Accès total à la configuration système',  bg: '#fde8e8', color: '#991b1b' },
  ];

  form = this.fb.group({
    firstName:   [''],
    lastName:    [''],
    site:        ['REUNION'],
    telephone:   [null as string | null],
    poste:       [null as string | null],
    typeContrat: [null as string | null],
    dateEntree:  [null as string | null],
    dateSortie:  [null as string | null],
  });

  anciennete = computed(() => {
    const c = this.collab();
    if (!c?.dateEntree) return null;
    const debut = new Date(c.dateEntree);
    const fin   = c.dateSortie ? new Date(c.dateSortie) : new Date();
    const mois  = (fin.getFullYear() - debut.getFullYear()) * 12 + (fin.getMonth() - debut.getMonth());
    if (mois < 1)  return "Moins d'un mois";
    if (mois < 12) return `${mois} mois`;
    const ans = Math.floor(mois / 12);
    const rem = mois % 12;
    return rem > 0 ? `${ans} an${ans > 1 ? 's' : ''} et ${rem} mois` : `${ans} an${ans > 1 ? 's' : ''}`;
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getOne(id).subscribe({
      next: c => {
        this.collab.set(c);
        this.selectedRole.set(c.role);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.router.navigate(['/salaries']); },
    });
  }

  roleMeta(role: string) { return ROLE_META[role] ?? { label: role, bg: '#f1f5f9', color: '#475569' }; }
  initials(c: Collaborateur) { return (c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? ''); }

  openEdit() {
    const c = this.collab();
    if (!c) return;
    this.form.patchValue({
      firstName: c.firstName, lastName: c.lastName, site: c.site,
      telephone: c.telephone, poste: c.poste, typeContrat: c.typeContrat,
      dateEntree: c.dateEntree, dateSortie: c.dateSortie,
    });
    this.editVisible.set(true);
  }

  closeEdit() { this.editVisible.set(false); }

  saveRole() {
    const c = this.collab();
    if (!c) return;
    this.savingRole.set(true);
    this.svc.updateRole(c.id, this.selectedRole()).subscribe({
      next: updated => {
        this.collab.set(updated);
        this.savingRole.set(false);
        this.snack.open('Rôle mis à jour', undefined, { duration: 2500 });
      },
      error: () => this.savingRole.set(false),
    });
  }

  save() {
    const c = this.collab();
    if (!c) return;
    const raw = this.form.getRawValue();
    const dto: UpdateRHDto = {
      firstName:   raw.firstName   || undefined,
      lastName:    raw.lastName    || undefined,
      site:        raw.site as any || undefined,
      telephone:   raw.telephone   ?? null,
      poste:       raw.poste       ?? null,
      typeContrat: raw.typeContrat ?? null,
      dateEntree:  raw.dateEntree  ?? null,
      dateSortie:  raw.dateSortie  ?? null,
    };
    this.saving.set(true);
    this.svc.updateRH(c.id, dto).subscribe({
      next: updated => {
        this.collab.set(updated);
        this.saving.set(false);
        this.closeEdit();
        this.snack.open('Fiche mise à jour', undefined, { duration: 2500 });
      },
      error: () => this.saving.set(false),
    });
  }

  archiver() {
    const c = this.collab();
    if (!c) return;
    const today = new Date().toISOString().split('T')[0];
    this.svc.updateRH(c.id, { dateSortie: today }).subscribe(updated => {
      this.collab.set(updated);
      this.snack.open(`${c.firstName} ${c.lastName} marqué comme ancien`, undefined, { duration: 3000 });
    });
  }

  reactiver() {
    const c = this.collab();
    if (!c) return;
    this.svc.updateRH(c.id, { dateSortie: null }).subscribe(updated => {
      this.collab.set(updated);
      this.snack.open(`${c.firstName} ${c.lastName} réactivé`, undefined, { duration: 3000 });
    });
  }
}
