import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { FournisseursService } from '../../../../../core/services/fournisseurs.service';
import { Fournisseur } from '../../../../../core/models/client.model';

const CATEGORIES = [
  'Banque', 'Assurance', 'Expertise comptable', 'Juridique',
  'Informatique', 'Logistique', 'Marketing', 'RH', 'Autre',
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  'Banque':              { bg: '#dbeafe', color: '#1d4ed8' },
  'Assurance':          { bg: '#ede9fe', color: '#6d28d9' },
  'Expertise comptable':{ bg: '#dcfce7', color: '#15803d' },
  'Juridique':          { bg: '#fef3c7', color: '#92400e' },
  'Informatique':       { bg: '#e0f2fe', color: '#0369a1' },
  'Logistique':         { bg: '#fce7f3', color: '#9d174d' },
  'Marketing':          { bg: '#ffedd5', color: '#9a3412' },
  'RH':                 { bg: '#f0fdf4', color: '#166534' },
  'Autre':              { bg: '#f1f5f9', color: '#475569' },
};

@Component({
  selector: 'app-fournisseurs-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatTooltipModule,
  ],
  template: `
    <div class="tab-content">

      <!-- Header -->
      <div class="section-header">
        <div class="header-left">
          <h3>Annuaire fournisseurs</h3>
          <span class="count-badge">{{ fournisseurs.length }}</span>
        </div>
        <button mat-flat-button class="btn-add" (click)="showForm.set(!showForm())">
          <mat-icon>{{ showForm() ? 'close' : 'add' }}</mat-icon>
          {{ showForm() ? 'Annuler' : 'Ajouter' }}
        </button>
      </div>

      <!-- Formulaire d'ajout -->
      @if (showForm()) {
        <div class="add-panel">
          <div class="add-panel-title">
            <mat-icon>business</mat-icon>
            Nouveau fournisseur
          </div>
          <form [formGroup]="form" (ngSubmit)="add()" class="add-form">
            <mat-form-field appearance="outline" class="field-nom">
              <mat-label>Nom *</mat-label>
              <mat-icon matPrefix>business</mat-icon>
              <input matInput formControlName="nom" placeholder="Nom de la société" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="field-email">
              <mat-label>Email *</mat-label>
              <mat-icon matPrefix>email</mat-icon>
              <input matInput formControlName="email" type="email" placeholder="contact@société.fr" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="field-tel">
              <mat-label>Téléphone</mat-label>
              <mat-icon matPrefix>phone</mat-icon>
              <input matInput formControlName="telephone" placeholder="+262 6 xx xx xx xx" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="field-cat">
              <mat-label>Catégorie</mat-label>
              <mat-icon matPrefix>label</mat-icon>
              <mat-select formControlName="categorie">
                @for (cat of categories; track cat) {
                  <mat-option [value]="cat">{{ cat }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-flat-button class="btn-submit" type="submit" [disabled]="form.invalid">
              <mat-icon>check</mat-icon> Enregistrer
            </button>
          </form>
        </div>
      }

      <!-- Liste vide -->
      @if (fournisseurs.length === 0 && !showForm()) {
        <div class="empty-state">
          <div class="empty-icon">
            <mat-icon>storefront</mat-icon>
          </div>
          <p class="empty-title">Aucun fournisseur</p>
          <p class="empty-sub">Ajoutez vos prestataires et partenaires</p>
          <button mat-flat-button class="btn-add" (click)="showForm.set(true)">
            <mat-icon>add</mat-icon> Ajouter un fournisseur
          </button>
        </div>
      }

      <!-- Grille de cards -->
      @if (fournisseurs.length > 0) {
        <div class="cards-grid">
          @for (f of fournisseurs; track f.id) {
            <div class="fournisseur-card">
              <!-- Avatar + nom -->
              <div class="card-top">
                <div class="avatar">{{ initials(f.nom) }}</div>
                <div class="card-identity">
                  <span class="card-nom">{{ f.nom }}</span>
                  @if (f.categorie) {
                    <span class="cat-badge"
                      [style.background]="catStyle(f.categorie).bg"
                      [style.color]="catStyle(f.categorie).color">
                      {{ f.categorie }}
                    </span>
                  }
                </div>
                <button mat-icon-button class="btn-delete" color="warn"
                  (click)="delete(f)" matTooltip="Supprimer">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>

              <!-- Coordonnées -->
              <div class="card-contacts">
                <a class="contact-line" [href]="'mailto:' + f.email" matTooltip="Envoyer un email">
                  <mat-icon>email</mat-icon>
                  <span>{{ f.email }}</span>
                </a>
                @if (f.telephone) {
                  <a class="contact-line" [href]="'tel:' + f.telephone" matTooltip="Appeler">
                    <mat-icon>phone</mat-icon>
                    <span>{{ f.telephone }}</span>
                  </a>
                } @else {
                  <span class="contact-line muted">
                    <mat-icon>phone_disabled</mat-icon>
                    <span>Pas de téléphone</span>
                  </span>
                }
              </div>
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }

    /* Header */
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0; }
    .count-badge {
      background: #e0e7ff; color: #4338ca;
      font-size: 12px; font-weight: 700;
      padding: 2px 8px; border-radius: 12px;
    }

    .btn-add {
      background: #4f46e5; color: white;
      border-radius: 10px; font-size: 13px; font-weight: 600;
      height: 36px; padding: 0 16px;
      display: flex; align-items: center; gap: 6px;
    }
    .btn-add mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* Panneau ajout */
    .add-panel {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 14px; padding: 20px;
      margin-bottom: 24px;
    }
    .add-panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 700; color: #334155;
      margin-bottom: 16px;
    }
    .add-panel-title mat-icon { color: #6366f1; font-size: 20px; }

    .add-form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr auto;
      gap: 12px; align-items: start;
    }
    @media (max-width: 1100px) {
      .add-form { grid-template-columns: 1fr 1fr; }
    }
    .add-form mat-form-field { width: 100%; }

    .btn-submit {
      background: #22c55e; color: white;
      border-radius: 10px; height: 56px; min-width: 120px;
      font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 6px;
      margin-top: 0;
    }
    .btn-submit mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .btn-submit:disabled { background: #e2e8f0; color: #94a3b8; }

    /* État vide */
    .empty-state {
      text-align: center; padding: 60px 24px;
      background: #f8fafc; border-radius: 14px;
      border: 2px dashed #e2e8f0;
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: #e0e7ff; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 16px;
    }
    .empty-icon mat-icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .empty-title { font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
    .empty-sub { font-size: 13px; color: #64748b; margin: 0 0 20px; }

    /* Grille cards */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .fournisseur-card {
      background: white; border: 1px solid #e8ecf0;
      border-radius: 14px; padding: 16px;
      transition: box-shadow .2s, transform .15s;
    }
    .fournisseur-card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      transform: translateY(-1px);
    }

    .card-top {
      display: flex; align-items: flex-start; gap: 12px;
      margin-bottom: 12px;
    }
    .avatar {
      width: 40px; height: 40px; border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: white; font-weight: 700; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .card-identity {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 4px;
    }
    .card-nom {
      font-size: 14px; font-weight: 700; color: #1e293b;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cat-badge {
      display: inline-block; padding: 2px 8px; border-radius: 8px;
      font-size: 11px; font-weight: 600; width: fit-content;
    }
    .btn-delete {
      width: 32px; height: 32px; flex-shrink: 0;
      opacity: 0; transition: opacity .15s;
    }
    .fournisseur-card:hover .btn-delete { opacity: 1; }

    .card-contacts { display: flex; flex-direction: column; gap: 6px; }
    .contact-line {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #64748b;
      text-decoration: none; border-radius: 6px;
      padding: 4px 6px; margin: -4px -6px;
      transition: background .15s;
    }
    a.contact-line:hover { background: #f1f5f9; color: #4f46e5; }
    a.contact-line:hover mat-icon { color: #4f46e5; }
    .contact-line mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; flex-shrink: 0; }
    .contact-line span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .contact-line.muted { cursor: default; font-style: italic; }
    .contact-line.muted mat-icon { color: #cbd5e1; }
  `],
})
export class FournisseursTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  @Input() clientId!: number;
  fournisseurs: Fournisseur[] = [];
  showForm = signal(false);
  categories = CATEGORIES;

  form = this.fb.group({
    nom:       ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    telephone: [''],
    categorie: [''],
  });

  constructor(private service: FournisseursService) {}

  ngOnInit() { this.load(); }
  load() { this.service.getAll(this.clientId).subscribe((d) => (this.fournisseurs = d)); }

  add() {
    this.service.create(this.clientId, this.form.value).subscribe(() => {
      this.load();
      this.form.reset();
      this.showForm.set(false);
      this.toast.success('Fournisseur ajouté');
    });
  }

  delete(f: Fournisseur) {
    this.confirm.confirm(`Supprimer ${f.nom} ?`).subscribe(ok => {
      if (!ok) return;
      this.service.delete(this.clientId, f.id).subscribe(() => {
        this.load();
        this.toast.info(`${f.nom} supprimé`);
      });
    });
  }

  initials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  catStyle(categorie: string) {
    return CATEGORY_COLORS[categorie] ?? CATEGORY_COLORS['Autre'];
  }
}
