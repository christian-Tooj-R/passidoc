import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../../../../core/services/toast.service';
import { MissionsService, Mission } from '../../../../../core/services/missions.service';

@Component({
  selector: 'app-missions-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule,
  ],
  template: `
    <div class="tab">
      <div class="tab-header">
        <h2>Missions</h2>
        <button mat-flat-button color="primary" (click)="showForm = !showForm">
          <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
          {{ showForm ? 'Annuler' : 'Ajouter une mission' }}
        </button>
      </div>

      @if (showForm) {
        <div class="add-panel">
          <div class="add-panel-title">
            <mat-icon>assignment_add</mat-icon>
            Nouvelle mission
          </div>
          <form [formGroup]="form" (ngSubmit)="submit()" class="add-grid">
            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select formControlName="type">
                <mat-option value="REALISEE">✅ Réalisée</mat-option>
                <mat-option value="REFUSEE">❌ Refusée</mat-option>
                <mat-option value="DETECTEE">🔍 Détectée</mat-option>
                <mat-option value="IA">🤖 Détectée par IA</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="span-2">
              <mat-label>Titre de la mission</mat-label>
              <input matInput formControlName="titre" placeholder="Ex : Mise en place d'une holding..." />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Honoraires HT (€)</mat-label>
              <input matInput type="number" formControlName="honoraires" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Année</mat-label>
              <input matInput type="number" formControlName="annee" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="span-full">
              <mat-label>Description / Présentation</mat-label>
              <textarea matInput rows="2" formControlName="description"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline" class="span-full">
              <mat-label>Arguments</mat-label>
              <textarea matInput rows="2" formControlName="arguments"></textarea>
            </mat-form-field>
            @if (form.get('type')?.value === 'REFUSEE') {
              <mat-form-field appearance="outline" class="span-full">
                <mat-label>Raison du refus</mat-label>
                <textarea matInput rows="2" formControlName="raisonRefus"></textarea>
              </mat-form-field>
            }
            <div class="form-actions span-full">
              <button mat-flat-button class="btn-submit" type="submit" [disabled]="form.invalid">
                <mat-icon>save</mat-icon> Enregistrer
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Groupes par type -->
      @for (group of missionGroups; track group.type) {
        @if (getMissions(group.type).length > 0) {
          <div class="mission-group">
            <div class="group-header">
              <span class="group-icon">{{ group.icon }}</span>
              <span class="group-label">{{ group.label }}</span>
              <span class="group-count">{{ getMissions(group.type).length }}</span>
            </div>
            <div class="missions-list">
              @for (m of getMissions(group.type); track m.id) {
                <div class="mission-card" [class]="'mission-card--' + m.type.toLowerCase()">
                  <div class="mission-card__header">
                    <span class="mission-title">{{ m.titre }}</span>
                    <div class="mission-meta">
                      @if (m.honoraires) {
                        <span class="mission-honoraires">{{ m.honoraires | number }} € HT</span>
                      }
                      @if (m.annee) {
                        <span class="mission-year">{{ m.annee }}</span>
                      }
                      <button mat-icon-button class="btn-delete" (click)="delete(m.id!)">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                  @if (m.description) {
                    <p class="mission-desc">{{ m.description }}</p>
                  }
                  @if (m.arguments) {
                    <div class="mission-args">
                      <mat-icon>lightbulb</mat-icon>
                      <span>{{ m.arguments }}</span>
                    </div>
                  }
                  @if (m.raisonRefus) {
                    <div class="mission-refus">
                      <mat-icon>info</mat-icon>
                      <span>Refus : {{ m.raisonRefus }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      }

      @if (missions.length === 0 && !showForm) {
        <div class="empty-state">
          <mat-icon>assignment</mat-icon>
          <p>Aucune mission enregistrée</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; }

    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
    .tab-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }

    /* ── Formulaire d'ajout ─────────────────────────── */
    .add-panel {
      background: #F8F9FE; border: 1px solid #E0E2EC;
      border-radius: 16px; padding: 20px 24px 24px;
      margin-bottom: 28px;
    }
    .add-panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 700; color: #1A1C1E;
      margin-bottom: 20px;
    }
    .add-panel-title mat-icon { color: #1565C0; font-size: 20px; }
    .add-grid {
      display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 0 16px; align-items: start;
    }
    .add-grid mat-form-field { width: 100%; }
    .span-2 { grid-column: span 2; }
    .span-full { grid-column: 1 / -1; }
    .form-actions { display: flex; justify-content: flex-end; padding-top: 4px; }
    .btn-submit {
      background: #1565C0 !important; color: white !important;
      border-radius: 20px !important; padding: 0 24px !important;
    }
    .btn-submit:disabled { background: #E0E2EC !important; color: #89909A !important; }

    /* ── Groupes ────────────────────────────────────── */
    .mission-group { margin-bottom: 32px; }
    .group-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 14px; padding-bottom: 10px;
      border-bottom: 2px solid #f1f5f9;
    }
    .group-icon { font-size: 18px; }
    .group-label { font-size: 14px; font-weight: 700; color: #1e293b; flex: 1; }
    .group-count {
      background: #e2e8f0; color: #475569;
      font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 20px;
    }
    .missions-list { display: flex; flex-direction: column; gap: 12px; }

    /* ── Cards ──────────────────────────────────────── */
    .mission-card {
      border-radius: 12px; padding: 16px 18px;
      border: 1px solid rgba(0,0,0,0.07);
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
      transition: box-shadow .15s;
    }
    .mission-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,.08); }
    .mission-card--realisee { background: #f0fdf4; border-left: 4px solid #22c55e; }
    .mission-card--refusee  { background: #fff7ed; border-left: 4px solid #f97316; }
    .mission-card--detectee { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .mission-card--ia       { background: #f5f3ff; border-left: 4px solid #8b5cf6; }

    .mission-card__header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; margin-bottom: 4px;
    }
    .mission-title { font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.4; }
    .mission-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .mission-honoraires {
      font-size: 12px; font-weight: 700; color: #15803d;
      background: #dcfce7; padding: 3px 10px; border-radius: 20px;
    }
    .mission-year {
      font-size: 12px; font-weight: 500; color: #64748b;
      background: #f1f5f9; padding: 3px 10px; border-radius: 20px;
    }
    .btn-delete { color: #cbd5e1 !important; width: 30px !important; height: 30px !important; }
    .btn-delete:hover { color: #dc2626 !important; }
    .btn-delete mat-icon { font-size: 18px !important; width: 18px !important; height: 18px !important; }

    .mission-desc {
      font-size: 13px; color: #64748b; margin: 10px 0 0; line-height: 1.6;
    }
    .mission-args {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 12.5px; color: #4f46e5; margin-top: 10px;
      background: rgba(99,102,241,.06); padding: 8px 10px; border-radius: 8px;
    }
    .mission-args mat-icon { font-size: 15px; width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }
    .mission-refus {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 12.5px; color: #ea580c; margin-top: 10px;
      background: rgba(249,115,22,.06); padding: 8px 10px; border-radius: 8px;
    }
    .mission-refus mat-icon { font-size: 15px; width: 15px; height: 15px; flex-shrink: 0; }

    /* ── Empty ──────────────────────────────────────── */
    .empty-state {
      text-align: center; padding: 56px 24px; color: #94a3b8;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `],
})
export class MissionsTabComponent implements OnInit {
  @Input() clientId!: number;
  private fb = inject(FormBuilder);
  private service = inject(MissionsService);
  private toast = inject(ToastService);

  missions: Mission[] = [];
  showForm = false;

  form = this.fb.group({
    type: ['DETECTEE', Validators.required],
    titre: ['', Validators.required],
    description: [''],
    honoraires: [null as number | null],
    arguments: [''],
    raisonRefus: [''],
    annee: [new Date().getFullYear()],
  });

  missionGroups = [
    { type: 'REALISEE', label: 'Missions réalisées & acceptées', icon: '✅' },
    { type: 'REFUSEE', label: 'Missions proposées & refusées', icon: '❌' },
    { type: 'DETECTEE', label: 'Missions détectées non proposées', icon: '🔍' },
    { type: 'IA', label: 'Missions détectées par l\'IA', icon: '🤖' },
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.service.getAll(this.clientId).subscribe(data => this.missions = data);
  }

  getMissions(type: string) {
    return this.missions.filter(m => m.type === type);
  }

  submit() {
    if (this.form.invalid) return;
    this.service.create(this.clientId, this.form.value as any).subscribe(() => {
      this.toast.success('Mission ajoutée');
      this.form.reset({ type: 'DETECTEE', annee: new Date().getFullYear() });
      this.showForm = false;
      this.load();
    });
  }

  delete(id: number) {
    this.service.delete(this.clientId, id).subscribe(() => {
      this.toast.success('Mission supprimée');
      this.load();
    });
  }
}
