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
import { MatTooltipModule } from '@angular/material/tooltip';
import { SalariesService, Collaborateur, UpdateRHDto } from './salaries.service';
import { CongesAbsencesService, SoldeConge, TYPE_CONGE_LABELS, TYPE_CONGE_COLORS } from '../../core/services/conges-absences.service';
import { OnlyNumbersDirective } from '../../shared/directives/only-numbers.directive';
import { SalariesCongesComponent } from './salaries-conges.component';

const TYPES_CONTRAT = ['CDI', 'CDD', 'Apprentissage', 'Stage', 'Intérimaire', 'Freelance', 'Autre'];
const STATUTS_PRO   = [
  { v: 'CADRE',         l: 'Cadre' },
  { v: 'NON_CADRE',     l: 'Non-cadre' },
  { v: 'EMPLOYE',       l: 'Employé' },
  { v: 'AGENT_MAITRISE',l: 'Agent de maîtrise' },
];
const MODES_PAIEMENT = ['VIREMENT', 'ESPECES', 'CHEQUE'];
const DEVISES        = ['EUR', 'MGA', 'USD'];

type Section = 'profil' | 'conges' | 'documents';

type ProfilTab = 'identite' | 'pro' | 'admin' | 'paie' | 'acces';
@Component({
  selector: 'app-salaries-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatSnackBarModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTooltipModule, OnlyNumbersDirective, SalariesCongesComponent,
  ],
  template: `
@if (loading()) {
  <div class="page-loading"><div class="spinner"></div><span>Chargement...</span></div>
}

@if (collab()) {
<div class="emp-layout">

  <!-- ══ Header salarié ══ -->
  <div class="emp-header">
    <div class="emp-header__identity">
      <div class="emp-avatar" [class.emp-avatar--re]="collab()!.site==='REUNION'" [class.emp-avatar--mg]="collab()!.site==='MADAGASCAR'">
        {{ initials(collab()!) }}
      </div>
      <div class="emp-header__info">
        <div class="emp-name">{{ collab()!.firstName }} {{ collab()!.lastName }}</div>
        <div class="emp-poste">{{ collab()!.poste || 'Poste non renseigné' }}</div>
        <div class="emp-badges">
          @if (!collab()!.dateSortie) {
            <span class="badge badge--green">Actif</span>
          } @else {
            <span class="badge badge--grey">Ancien</span>
          }
          @if (collab()!.typeContrat) {
            <span class="badge badge--blue">{{ collab()!.typeContrat }}</span>
          }
          <span class="badge badge--site">{{ collab()!.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span>
        </div>
      </div>
    </div>

    <!-- Soldes rapides dans le header -->
    <div class="emp-header__soldes">
      @for (s of soldesPrincipaux(); track s.typeConge) {
        <div class="solde-chip">
          <span class="solde-chip__label">{{ typeLabel(s.typeConge) }}</span>
          <span class="solde-chip__val" [class.solde-chip__val--low]="s.solde <= 2">{{ s.solde | number:'1.1-1' }}j</span>
        </div>
      }
    </div>

    <!-- Actions -->
    <div class="emp-header__actions">
      <button mat-stroked-button class="btn-edit" (click)="openEdit()">
        <mat-icon>edit</mat-icon> Modifier
      </button>
      <button mat-icon-button [matMenuTriggerFor]="moreMenu" matTooltip="Plus d'actions">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #moreMenu="matMenu">
        @if (!collab()!.dateSortie) {
          <button mat-menu-item (click)="archiver()"><mat-icon>person_off</mat-icon><span>Marquer comme ancien</span></button>
        } @else {
          <button mat-menu-item (click)="reactiver()"><mat-icon>person</mat-icon><span>Réactiver</span></button>
        }
        <button mat-menu-item (click)="router.navigate(['/rh/salaries'])"><mat-icon>arrow_back</mat-icon><span>Retour liste</span></button>
      </mat-menu>
    </div>
  </div>

  <!-- ══ Barre d'onglets ══ -->
  <div class="tab-bar">
    <button class="tab-item" [class.active]="section()==='profil'" (click)="section.set('profil')">
      <mat-icon>person</mat-icon>
      <span>Fiche salarié</span>
    </button>
    <button class="tab-item" [class.active]="section()==='conges'" (click)="loadConges(); section.set('conges')">
      <mat-icon>beach_access</mat-icon>
      <span>Congés & Absences</span>
      @if (enAttenteCount() > 0) {
        <span class="tab-badge">{{ enAttenteCount() }}</span>
      }
    </button>
    <button class="tab-item" [class.active]="section()==='documents'" (click)="section.set('documents')">
      <mat-icon>folder_open</mat-icon>
      <span>Documents</span>
    </button>
  </div>

  <!-- ══ Contenu principal ══ -->
  <main class="emp-main">

    <!-- ═══ SECTION PROFIL ═══ -->
    @if (section() === 'profil') {
    <div class="content-area">

      <div class="profil-wrapper">

      <!-- Barre d'onglets interne -->
      <div class="profil-tabs">
        <button class="ptab" [class.active]="profilTab()==='identite'" (click)="profilTab.set('identite')">
          <mat-icon>badge</mat-icon><span>Identité</span>
        </button>
        <button class="ptab" [class.active]="profilTab()==='pro'" (click)="profilTab.set('pro')">
          <mat-icon>work</mat-icon><span>Professionnel</span>
        </button>
        <button class="ptab" [class.active]="profilTab()==='admin'" (click)="profilTab.set('admin')">
          <mat-icon>assignment_ind</mat-icon><span>Administratif</span>
        </button>
        <button class="ptab" [class.active]="profilTab()==='paie'" (click)="profilTab.set('paie')">
          <mat-icon>account_balance_wallet</mat-icon><span>Paie</span>
        </button>
        <button class="ptab" [class.active]="profilTab()==='acces'" (click)="profilTab.set('acces')">
          <mat-icon>manage_accounts</mat-icon><span>Accès</span>
        </button>
      </div>

      <!-- Contenu des onglets -->
      <div class="ptab-content">

        <!-- ── Identité ── -->
        @if (profilTab() === 'identite') {
        <div class="tab-pane">
          <div class="section-title"><mat-icon>badge</mat-icon> Informations personnelles</div>
          <div class="field-grid">
            <div class="field"><span class="f-label">Prénom</span><span class="f-val">{{ collab()!.firstName }}</span></div>
            <div class="field"><span class="f-label">Nom</span><span class="f-val">{{ collab()!.lastName }}</span></div>
            <div class="field"><span class="f-label">Date de naissance</span><span class="f-val">{{ (collab()!.dateNaissance | date:'dd MMMM yyyy') || '—' }}</span></div>
            <div class="field"><span class="f-label">Lieu de naissance</span><span class="f-val">{{ collab()!.lieuNaissance || '—' }}</span></div>
            <div class="field"><span class="f-label">Sexe</span><span class="f-val">{{ sexeLabel(collab()!.sexe) }}</span></div>
            <div class="field"><span class="f-label">Nationalité</span><span class="f-val">{{ collab()!.nationalite || '—' }}</span></div>
            <div class="field"><span class="f-label">Situation matrimoniale</span><span class="f-val">{{ collab()!.situationMatrimoniale || '—' }}</span></div>
            <div class="field"><span class="f-label">Enfants à charge</span><span class="f-val">{{ collab()!.nbEnfantsCharge ?? '—' }}</span></div>
          </div>

          <div class="section-title mt"><mat-icon>contact_mail</mat-icon> Coordonnées</div>
          <div class="field-grid">
            <div class="field span-2"><span class="f-label">Adresse</span><span class="f-val">{{ collab()!.adresse || '—' }}</span></div>
            <div class="field"><span class="f-label">Code postal</span><span class="f-val">{{ collab()!.codePostal || '—' }}</span></div>
            <div class="field"><span class="f-label">Ville</span><span class="f-val">{{ collab()!.ville || '—' }}</span></div>
            <div class="field"><span class="f-label">Pays</span><span class="f-val">{{ collab()!.pays || '—' }}</span></div>
            <div class="field"><span class="f-label">Téléphone</span><span class="f-val">{{ collab()!.telephone || '—' }}</span></div>
            <div class="field span-2"><span class="f-label">Email</span><span class="f-val mono">{{ collab()!.email }}</span></div>
          </div>
        </div>
        }

        <!-- ── Professionnel ── -->
        @if (profilTab() === 'pro') {
        <div class="tab-pane">
          <div class="section-title"><mat-icon>work</mat-icon> Informations professionnelles</div>
          <div class="field-grid">
            <div class="field"><span class="f-label">Poste / Fonction</span><span class="f-val">{{ collab()!.poste || '—' }}</span></div>
            <div class="field"><span class="f-label">Département / Service</span><span class="f-val">{{ collab()!.departement || '—' }}</span></div>
            <div class="field"><span class="f-label">Site</span><span class="f-val">{{ collab()!.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span></div>
            <div class="field"><span class="f-label">Statut</span><span class="f-val">{{ statutLabel(collab()!.statut) }}</span></div>
            <div class="field"><span class="f-label">Type de contrat</span><span class="f-val">{{ collab()!.typeContrat || '—' }}</span></div>
            <div class="field"><span class="f-label">Temps de travail</span><span class="f-val">{{ tempsTravailLabel(collab()!.tempsTravail) }}{{ collab()!.heuresHebdo ? ' · ' + collab()!.heuresHebdo + 'h/sem' : '' }}</span></div>
            <div class="field"><span class="f-label">Date d'embauche</span><span class="f-val">{{ (collab()!.dateEntree | date:'dd MMMM yyyy') || '—' }}</span></div>
            <div class="field"><span class="f-label">Date de fin de contrat</span><span class="f-val">{{ (collab()!.dateFinContrat | date:'dd MMMM yyyy') || (collab()!.dateSortie ? (collab()!.dateSortie | date:'dd MMMM yyyy') : 'En poste') }}</span></div>
            @if (anciennete()) {
              <div class="field span-2">
                <span class="f-label">Ancienneté</span>
                <span class="f-val">{{ anciennete() }}</span>
              </div>
            }
          </div>
        </div>
        }

        <!-- ── Administratif ── -->
        @if (profilTab() === 'admin') {
        <div class="tab-pane">
          <div class="section-title"><mat-icon>assignment_ind</mat-icon> Identification administrative</div>
          <div class="field-grid">
            <div class="field"><span class="f-label">Matricule interne</span><span class="f-val mono">{{ collab()!.matricule || '—' }}</span></div>
            <div class="field"><span class="f-label">N° CIN / Carte d'identité</span><span class="f-val mono">{{ collab()!.numeroCIN || '—' }}</span></div>
            <div class="field"><span class="f-label">N° immatriculation sociale</span><span class="f-val mono">{{ collab()!.numeroSS || '—' }}</span></div>
            <div class="field"><span class="f-label">N° fiscal</span><span class="f-val mono">{{ collab()!.numeroFiscal || '—' }}</span></div>
          </div>
        </div>
        }

        <!-- ── Paie ── -->
        @if (profilTab() === 'paie') {
        <div class="tab-pane">
          <div class="section-title sensitive-header">
            <mat-icon>account_balance_wallet</mat-icon> Informations de paie
            <span class="sensitive-tag">Confidentiel</span>
          </div>
          <div class="field-grid">
            <div class="field"><span class="f-label">Salaire de base</span><span class="f-val">{{ collab()!.salaireBase ? (collab()!.salaireBase | number:'1.2-2') + ' ' + (collab()!.devise || 'EUR') : '—' }}</span></div>
            <div class="field"><span class="f-label">Mode de paiement</span><span class="f-val">{{ collab()!.modePaiement || '—' }}</span></div>
            <div class="field"><span class="f-label">Banque</span><span class="f-val">{{ collab()!.banque || '—' }}</span></div>
            <div class="field"><span class="f-label">IBAN / RIB</span><span class="f-val mono">{{ maskIban(collab()!.iban) }}</span></div>
          </div>
        </div>
        }

        <!-- ── Accès système ── -->
        @if (profilTab() === 'acces') {
        <div class="tab-pane">
          <div class="section-title"><mat-icon>manage_accounts</mat-icon> Accès système</div>
          <div class="field-grid">
            <div class="field">
              <span class="f-label">Rôle</span>
              <span class="f-val">
                <span class="role-badge"
                      [style.background]="roleBg(collab()!.role)"
                      [style.color]="roleColor(collab()!.role)">
                  {{ roleLabel(collab()!.role) }}
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
              <span class="f-label">Membre depuis</span>
              <span class="f-val">{{ collab()!.createdAt | date:'dd MMM yyyy' }}</span>
            </div>
          </div>

          <!-- Changement de rôle -->
          <div class="role-change">
            <p class="role-change__title"><mat-icon>swap_horiz</mat-icon> Modifier le rôle</p>
            <div class="role-options">
              @for (r of roles; track r.value) {
                <label class="role-opt" [class.active]="selectedRole() === r.value">
                  <input type="radio" [value]="r.value" [checked]="selectedRole()===r.value" (change)="selectedRole.set(r.value)" />
                  <span class="role-opt__dot" [style.background]="r.bg" [style.color]="r.color">{{ r.label[0] }}</span>
                  <div>
                    <span class="role-opt__name">{{ r.label }}</span>
                    <span class="role-opt__desc">{{ r.desc }}</span>
                  </div>
                </label>
              }
            </div>
            <button mat-flat-button class="btn-role"
                    [disabled]="selectedRole()===collab()!.role || savingRole()"
                    (click)="saveRole()">
              {{ savingRole() ? 'Enregistrement...' : 'Appliquer ce rôle' }}
            </button>
          </div>
        </div>
        }

      </div>
    </div>

    </div>
    }

    <!-- ═══ SECTION CONGÉS ═══ -->
    @if (section() === 'conges') {
    <div class="content-area">
      <app-salaries-conges [userId]="collab()!.id" [userName]="collab()!.firstName + ' ' + collab()!.lastName" />
    </div>
    }

    <!-- ═══ SECTION DOCUMENTS ═══ -->
    @if (section() === 'documents') {
    <div class="content-area">
      <div class="empty-section">
        <mat-icon>folder_open</mat-icon>
        <p>Module documents — à venir</p>
      </div>
    </div>
    }

  </main>
</div>
}

<!-- ═══ DRAWER MODIFICATION ═══ -->
@if (editVisible()) {
  <div class="overlay" (click)="closeEdit()"></div>
  <div class="edit-drawer">
    <div class="edit-drawer__header">
      <span>Modifier — {{ collab()!.firstName }} {{ collab()!.lastName }}</span>
      <button mat-icon-button (click)="closeEdit()"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()" class="edit-drawer__body">

      <p class="form-section">Identité</p>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Prénom</mat-label><input matInput formControlName="firstName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Nom</mat-label><input matInput formControlName="lastName" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Date de naissance</mat-label><input matInput type="date" formControlName="dateNaissance" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Lieu de naissance</mat-label><input matInput formControlName="lieuNaissance" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Sexe</mat-label>
          <mat-select formControlName="sexe">
            <mat-option [value]="null">—</mat-option>
            <mat-option value="M">Masculin</mat-option>
            <mat-option value="F">Féminin</mat-option>
            <mat-option value="Autre">Autre</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Nationalité</mat-label><input matInput formControlName="nationalite" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Situation matrimoniale</mat-label>
          <mat-select formControlName="situationMatrimoniale">
            <mat-option [value]="null">—</mat-option>
            <mat-option value="Célibataire">Célibataire</mat-option>
            <mat-option value="Marié(e)">Marié(e)</mat-option>
            <mat-option value="Pacsé(e)">Pacsé(e)</mat-option>
            <mat-option value="Divorcé(e)">Divorcé(e)</mat-option>
            <mat-option value="Veuf/Veuve">Veuf / Veuve</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Enfants à charge</mat-label><input matInput type="number" formControlName="nbEnfantsCharge" /></mat-form-field>
      </div>

      <p class="form-section">Coordonnées</p>
      <mat-form-field appearance="outline" class="full"><mat-label>Adresse</mat-label><input matInput formControlName="adresse" /></mat-form-field>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="codePostal" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="ville" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Pays</mat-label><input matInput formControlName="pays" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Téléphone</mat-label><input matInput formControlName="telephone" /></mat-form-field>
      </div>

      <p class="form-section">Informations professionnelles</p>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Poste / Fonction</mat-label><input matInput formControlName="poste" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Département / Service</mat-label><input matInput formControlName="departement" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Site</mat-label>
          <mat-select formControlName="site">
            <mat-option value="REUNION">🇷🇪 La Réunion</mat-option>
            <mat-option value="MADAGASCAR">🇲🇬 Madagascar</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Statut</mat-label>
          <mat-select formControlName="statut">
            <mat-option [value]="null">—</mat-option>
            @for (s of statutsPro; track s.v) { <mat-option [value]="s.v">{{ s.l }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Type de contrat</mat-label>
          <mat-select formControlName="typeContrat">
            <mat-option [value]="null">—</mat-option>
            @for (t of typesContrat; track t) { <mat-option [value]="t">{{ t }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Temps de travail</mat-label>
          <mat-select formControlName="tempsTravail">
            <mat-option [value]="null">—</mat-option>
            <mat-option value="PLEIN">Temps plein</mat-option>
            <mat-option value="PARTIEL">Temps partiel</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Heures / semaine</mat-label><input matInput type="number" formControlName="heuresHebdo" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Date d'embauche</mat-label><input matInput type="date" formControlName="dateEntree" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Date de fin de contrat</mat-label><input matInput type="date" formControlName="dateFinContrat" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Date de sortie</mat-label><input matInput type="date" formControlName="dateSortie" /></mat-form-field>
      </div>

      <p class="form-section">Identification administrative</p>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Matricule interne</mat-label><input matInput formControlName="matricule" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>N° CIN</mat-label><input matInput formControlName="numeroCIN" /></mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>N° immatriculation sociale</mat-label><input matInput formControlName="numeroSS" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>N° fiscal</mat-label><input matInput formControlName="numeroFiscal" /></mat-form-field>
      </div>

      <p class="form-section">Informations de paie</p>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Salaire de base</mat-label><input matInput type="number" formControlName="salaireBase" /></mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Devise</mat-label>
          <mat-select formControlName="devise">
            @for (d of devises; track d) { <mat-option [value]="d">{{ d }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Mode de paiement</mat-label>
          <mat-select formControlName="modePaiement">
            <mat-option [value]="null">—</mat-option>
            <mat-option value="VIREMENT">Virement bancaire</mat-option>
            <mat-option value="ESPECES">Espèces</mat-option>
            <mat-option value="CHEQUE">Chèque</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Banque</mat-label><input matInput formControlName="banque" /></mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="full"><mat-label>IBAN / RIB</mat-label><input matInput formControlName="iban" /></mat-form-field>

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
    :host { display: block; height: 100%; }

    .page-loading { display: flex; align-items: center; gap: 12px; padding: 60px 32px; color: #8a99b8; }
    .spinner { width: 20px; height: 20px; border: 2px solid #dde2f0; border-top-color: #162351; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ══ Layout ══ */
    .emp-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: calc(100vh - 64px);
    }

    /* ══ Header salarié ══ */
    .emp-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 28px 16px;
      background: #fff;
      border-bottom: 1px solid #e4e8f4;
      flex-wrap: wrap;
    }

    .emp-header__identity {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
      min-width: 0;
    }

    .emp-avatar {
      width: 52px; height: 52px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: #fff;
      background: linear-gradient(135deg, #1a2d6b, #2563eb);
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(22, 35, 81, .2);
    }
    .emp-avatar--re { background: linear-gradient(135deg, #1a2d6b, #2563eb); }
    .emp-avatar--mg { background: linear-gradient(135deg, #064e3b, #059669); }

    .emp-header__info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .emp-name { font-size: 16px; font-weight: 700; color: #0f1a35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .emp-poste { font-size: 12px; color: #6b7fa3; }
    .emp-badges { display: flex; flex-wrap: wrap; gap: 4px; }

    .badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 5px; }
    .badge--green  { background: #d1fae5; color: #065f46; }
    .badge--grey   { background: #e4e8f4; color: #4b5a7a; }
    .badge--blue   { background: #dbeafe; color: #1e40af; }
    .badge--site   { background: #f1f5f9; color: #475569; font-size: 11px; }

    /* Soldes chips dans le header */
    .emp-header__soldes {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .solde-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #f8f9fe;
      border: 1px solid #e4e8f4;
      border-radius: 8px;
      padding: 6px 12px;
      min-width: 60px;
    }
    .solde-chip__label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8a99b8; }
    .solde-chip__val { font-size: 15px; font-weight: 700; color: #162351; }
    .solde-chip__val--low { color: #ef4444; }

    /* Actions header */
    .emp-header__actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
    .btn-edit { border-radius: 6px !important; font-size: 12px !important; color: #162351 !important; border-color: #c0cbe8 !important; }

    /* ══ Barre d'onglets ══ */
    .tab-bar {
      display: flex;
      align-items: stretch;
      background: #fff;
      border-bottom: 2px solid #e4e8f4;
      padding: 0 28px;
      gap: 0;
    }

    .tab-item {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 13px 18px;
      font-size: 13px;
      font-weight: 500;
      color: #5a6a8a;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      transition: color .15s, border-color .15s;
      white-space: nowrap;
      position: relative;

      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .tab-item:hover { color: #162351; background: #f5f7fd; }
    .tab-item.active {
      color: #162351;
      font-weight: 700;
      border-bottom-color: #162351;

      mat-icon { color: #162351; }
    }

    .tab-badge {
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      min-width: 17px;
      height: 17px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    /* ══ Zone principale ══ */
    .emp-main {
      flex: 1;
      padding: 24px 28px;
      overflow-y: auto;
      background: #f5f7fc;
    }

    /* Content */
    .content-area { display: flex; flex-direction: column; gap: 16px; }

    /* Cards */
    .card {
      background: #fff; border: 1px solid #e4e8f4; border-radius: 10px;
      box-shadow: 0 1px 4px rgba(22,35,81,.05);
    }
    .card--sensitive { border-color: #fca5a5; background: #fff8f8; }
    .card-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 20px; border-bottom: 1px solid #f0f3fa;
      font-size: 13px; font-weight: 700; color: #162351;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #4a6fa5; }
    }
    .sensitive-tag { margin-left: auto; font-size: 10px; font-weight: 600; color: #dc2626; background: #fee2e2; padding: 2px 7px; border-radius: 4px; }

    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; padding: 16px 20px; }
    .span-2 { grid-column: span 2; }
    .field { display: flex; flex-direction: column; gap: 3px; }
    .f-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #8a99b8; }
    .f-val { font-size: 13px; color: #0f1a35; font-weight: 500; }
    .f-val.mono { font-family: monospace; font-size: 12px; }
    .mono { font-family: monospace; font-size: 12px; }

    /* Rôle */
    .role-badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 5px; }
    .role-change { padding: 16px 20px; border-top: 1px solid #f0f3fa; }
    .role-change__title { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #162351; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 12px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .role-options { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
    .role-opt { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 7px; cursor: pointer; border: 1.5px solid #e4e8f4; transition: border-color .15s; input { display: none; } }
    .role-opt:hover { border-color: #9aaad4; }
    .role-opt.active { border-color: #162351; background: #eef1fa; }
    .role-opt__dot { width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .role-opt__name { font-size: 12px; font-weight: 600; color: #0f1a35; display: block; }
    .role-opt__desc { font-size: 10px; color: #8a99b8; display: block; }
    .btn-role { background: #162351 !important; color: #fff !important; border-radius: 6px !important; font-size: 12px !important; &:disabled { opacity: .4; } }

    /* Empty */
    .empty-section { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; gap: 12px; color: #94a3b8;
      mat-icon { font-size: 48px; width: 48px; height: 48px; }
      p { font-size: 14px; }
    }

    /* ══ Drawer édition ══ */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; }
    .edit-drawer {
      position: fixed; right: 0; top: 0; bottom: 0; width: min(520px, 100vw);
      background: #fff; box-shadow: -6px 0 32px rgba(22,35,81,.14);
      z-index: 1000; display: flex; flex-direction: column;
    }
    .edit-drawer__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #162351, #1e3a8a);
      font-size: 14px; font-weight: 600; color: #fff;
      button { color: rgba(255,255,255,.8) !important; }
    }
    .edit-drawer__body { padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; flex: 1; overflow-y: auto; }
    .form-section { margin: 12px 0 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #4a6fa5; border-bottom: 1px solid #e8ecf8; padding-bottom: 6px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .full { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee; }
    /* ══════════════════════════════════
       PROFIL — wrapper + onglets
    ══════════════════════════════════ */
    .profil-wrapper {
      background: #fff;
      border: 1px solid #e4e8f4;
      border-radius: 12px;
      box-shadow: 0 1px 6px rgba(22,35,81,.06);
      overflow: hidden;
    }

    /* Barre d'onglets interne */
    .profil-tabs {
      display: flex;
      align-items: stretch;
      border-bottom: 2px solid #eef0f8;
      background: #fafbfe;
      padding: 0 4px;
      gap: 0;
      overflow-x: auto;
    }

    .ptab {
      display: flex; align-items: center; gap: 6px;
      padding: 12px 16px;
      font-size: 12.5px; font-weight: 500; color: #6b7fa3;
      background: none; border: none; border-bottom: 2px solid transparent;
      margin-bottom: -2px; cursor: pointer;
      transition: color .15s, border-color .15s, background .15s;
      white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .ptab:hover { color: #162351; background: #f0f3fb; }
    .ptab.active {
      color: #162351; font-weight: 700;
      border-bottom-color: #162351;
      background: #fff;
      mat-icon { color: #2563eb; }
    }

    /* Contenu du panneau */
    .ptab-content { padding: 24px; }

    .tab-pane { display: flex; flex-direction: column; gap: 0; }

    /* Titres de section à l'intérieur d'un onglet */
    .section-title {
      display: flex; align-items: center; gap: 7px;
      font-size: 12px; font-weight: 700; color: #162351;
      text-transform: uppercase; letter-spacing: .05em;
      margin-bottom: 16px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #4a6fa5; }
    }
    .section-title.mt { margin-top: 28px; }
    .section-title.sensitive-header { color: #b91c1c; mat-icon { color: #b91c1c; } }

    /* Grille de champs */
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; }
    .span-2 { grid-column: span 2; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .f-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #8a99b8; }
    .f-val { font-size: 13px; color: #0f1a35; font-weight: 500; }
    .f-val.mono, .mono { font-family: monospace; font-size: 12px; }

    /* Sensitive tag */
    .sensitive-tag { margin-left: auto; font-size: 10px; font-weight: 600; color: #dc2626; background: #fee2e2; padding: 2px 7px; border-radius: 4px; }

    /* Rôle */
    .role-badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 5px; }

    .role-change { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f3fa; }
    .role-change__title {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; color: #162351;
      text-transform: uppercase; letter-spacing: .05em; margin: 0 0 12px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .role-options { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
    .role-opt {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px; border-radius: 7px; cursor: pointer;
      border: 1.5px solid #e4e8f4; transition: border-color .15s;
      input { display: none; }
    }
    .role-opt:hover { border-color: #9aaad4; }
    .role-opt.active { border-color: #162351; background: #eef1fa; }
    .role-opt__dot { width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .role-opt__name { font-size: 12px; font-weight: 600; color: #0f1a35; display: block; }
    .role-opt__desc { font-size: 10px; color: #8a99b8; display: block; }
    .btn-role { background: #162351 !important; color: #fff !important; border-radius: 6px !important; font-size: 12px !important; &:disabled { opacity: .4; } }

    /* Empty */
    .empty-section {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 24px; gap: 12px; color: #94a3b8;
      mat-icon { font-size: 48px; width: 48px; height: 48px; }
      p { font-size: 14px; }
    }
  `],
})
export class SalariesDetailComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private svc    = inject(SalariesService);
  private cSvc   = inject(CongesAbsencesService);
  private snack  = inject(MatSnackBar);
  private fb     = inject(FormBuilder);
  router         = inject(Router);

  profilTab    = signal<ProfilTab>('identite');
  collab       = signal<Collaborateur | null>(null);
  loading      = signal(true);
  editVisible  = signal(false);
  saving       = signal(false);
  savingRole   = signal(false);
  section      = signal<Section>('profil');
  selectedRole = signal<any>('COLLABORATEUR');
  soldes       = signal<SoldeConge[]>([]);
  anneeConges  = signal(new Date().getFullYear());

  readonly typesContrat = TYPES_CONTRAT;
  readonly statutsPro   = STATUTS_PRO;
  readonly devises      = DEVISES;
  readonly roles = [
    { value: 'COLLABORATEUR',    label: 'Collaborateur',    desc: 'Accès standard',    bg: '#d1fae5', color: '#065f46' },
    { value: 'EXPERT_COMPTABLE', label: 'Expert-comptable', desc: 'Gestion complète',  bg: '#dbeafe', color: '#1e40af' },
    { value: 'ADMIN',            label: 'Administrateur',   desc: 'Accès total',       bg: '#fde8e8', color: '#991b1b' },
  ];

  form = this.fb.group({
    firstName: [''], lastName: [''],
    dateNaissance: [null as string|null], lieuNaissance: [null as string|null],
    sexe: [null as string|null], nationalite: [null as string|null],
    situationMatrimoniale: [null as string|null], nbEnfantsCharge: [null as number|null],
    adresse: [null as string|null], codePostal: [null as string|null],
    ville: [null as string|null], pays: [null as string|null], telephone: [null as string|null],
    site: ['REUNION'], poste: [null as string|null], departement: [null as string|null],
    typeContrat: [null as string|null], dateEntree: [null as string|null],
    dateFinContrat: [null as string|null], dateSortie: [null as string|null],
    statut: [null as string|null], tempsTravail: [null as string|null], heuresHebdo: [null as number|null],
    matricule: [null as string|null], numeroCIN: [null as string|null],
    numeroSS: [null as string|null], numeroFiscal: [null as string|null],
    salaireBase: [null as number|null], modePaiement: [null as string|null],
    banque: [null as string|null], iban: [null as string|null], devise: ['EUR'],
  });

  soldesPrincipaux = computed(() =>
    this.soldes().filter(s => ['CONGES_PAYES', 'RTT', 'MALADIE'].includes(s.typeConge) && s.joursAcquis > 0)
  );

  enAttenteCount = computed(() => 0);

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
    return rem > 0 ? `${ans} an${ans>1?'s':''} et ${rem} mois` : `${ans} an${ans>1?'s':''}`;
  });

  sectionLabel() {
    return { profil: 'Fiche salarié', conges: 'Congés & Absences', documents: 'Documents' }[this.section()];
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getOne(id).subscribe({
      next: c => { this.collab.set(c); this.selectedRole.set(c.role); this.loading.set(false); this.loadConges(); },
      error: () => { this.loading.set(false); this.router.navigate(['/rh/salaries']); },
    });
  }

  loadConges() {
    const c = this.collab();
    if (!c) return;
    this.cSvc.getSoldes(c.id, this.anneeConges()).subscribe(s => this.soldes.set(s));
  }

  openEdit() {
    const c = this.collab(); if (!c) return;
    this.form.patchValue({ ...c } as any);
    this.editVisible.set(true);
  }

  closeEdit() { this.editVisible.set(false); }

  save() {
    const c = this.collab(); if (!c) return;
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.svc.updateRH(c.id, raw as any).subscribe({
      next: updated => { this.collab.set(updated); this.saving.set(false); this.closeEdit(); this.snack.open('Fiche mise à jour', undefined, { duration: 2500 }); },
      error: () => this.saving.set(false),
    });
  }

  saveRole() {
    const c = this.collab(); if (!c) return;
    this.savingRole.set(true);
    this.svc.updateRole(c.id, this.selectedRole()).subscribe({
      next: updated => { this.collab.set(updated); this.savingRole.set(false); this.snack.open('Rôle mis à jour', undefined, { duration: 2500 }); },
      error: () => this.savingRole.set(false),
    });
  }

  archiver() {
    const c = this.collab(); if (!c) return;
    this.svc.updateRH(c.id, { dateSortie: new Date().toISOString().split('T')[0] }).subscribe(updated => {
      this.collab.set(updated);
      this.snack.open(`${c.firstName} ${c.lastName} marqué comme ancien`, undefined, { duration: 3000 });
    });
  }

  reactiver() {
    const c = this.collab(); if (!c) return;
    this.svc.updateRH(c.id, { dateSortie: null }).subscribe(updated => {
      this.collab.set(updated);
      this.snack.open(`${c.firstName} ${c.lastName} réactivé`, undefined, { duration: 3000 });
    });
  }

  initials(c: Collaborateur) { return (c.firstName?.[0]??'') + (c.lastName?.[0]??''); }
  typeLabel(t: string) { return (TYPE_CONGE_LABELS as Record<string, string>)[t] ?? t; }
  sexeLabel(v: string|null) { return v === 'M' ? 'Masculin' : v === 'F' ? 'Féminin' : v || '—'; }
  statutLabel(v: string|null) { return STATUTS_PRO.find(s => s.v === v)?.l ?? v ?? '—'; }
  tempsTravailLabel(v: string|null) { return v === 'PLEIN' ? 'Temps plein' : v === 'PARTIEL' ? 'Temps partiel' : '—'; }
  maskIban(v: string|null) { if (!v) return '—'; return v.slice(0,4) + ' **** **** ' + v.slice(-4); }
  roleBg(r: string) { return { ADMIN:'#fde8e8', EXPERT_COMPTABLE:'#dbeafe', COLLABORATEUR:'#d1fae5' }[r]??'#f1f5f9'; }
  roleColor(r: string) { return { ADMIN:'#991b1b', EXPERT_COMPTABLE:'#1e40af', COLLABORATEUR:'#065f46' }[r]??'#475569'; }
  roleLabel(r: string) { return { ADMIN:'Admin', EXPERT_COMPTABLE:'Expert-comptable', COLLABORATEUR:'Collaborateur' }[r]??r; }
}