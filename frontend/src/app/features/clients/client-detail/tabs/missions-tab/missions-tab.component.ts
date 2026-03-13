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
        <div class="add-form">
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select formControlName="type">
                  <mat-option value="REALISEE">✅ Réalisée</mat-option>
                  <mat-option value="REFUSEE">❌ Refusée</mat-option>
                  <mat-option value="DETECTEE">🔍 Détectée</mat-option>
                  <mat-option value="IA">🤖 Détectée par IA</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>Titre de la mission</mat-label>
                <input matInput formControlName="titre" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Honoraires HT (€)</mat-label>
                <input matInput type="number" formControlName="honoraires" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Année</mat-label>
                <input matInput type="number" formControlName="annee" />
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description / Présentation</mat-label>
              <textarea matInput rows="2" formControlName="description"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Arguments</mat-label>
              <textarea matInput rows="2" formControlName="arguments"></textarea>
            </mat-form-field>
            @if (form.get('type')?.value === 'REFUSEE') {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Raison du refus</mat-label>
                <textarea matInput rows="2" formControlName="raisonRefus"></textarea>
              </mat-form-field>
            }
            <div class="form-actions">
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
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
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .tab-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
    .add-form {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 12px; padding: 20px; margin-bottom: 24px;
    }
    .form-row { display: flex; gap: 12px; margin-bottom: 8px; }
    .form-row mat-form-field { flex: 1; }
    .flex-2 { flex: 2 !important; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

    .mission-group { margin-bottom: 24px; }
    .group-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .group-icon { font-size: 18px; }
    .group-label { font-size: 14px; font-weight: 700; color: #1e293b; }
    .group-count {
      background: #e2e8f0; color: #64748b;
      font-size: 11px; font-weight: 700;
      padding: 2px 8px; border-radius: 20px;
    }
    .missions-list { display: flex; flex-direction: column; gap: 10px; }

    .mission-card {
      border-radius: 10px; padding: 14px 16px;
      border: 1px solid rgba(0,0,0,0.07);
    }
    .mission-card--realisee { background: #f0fdf4; border-left: 3px solid #22c55e; }
    .mission-card--refusee { background: #fff7ed; border-left: 3px solid #f97316; }
    .mission-card--detectee { background: #eff6ff; border-left: 3px solid #3b82f6; }
    .mission-card--ia { background: #f5f3ff; border-left: 3px solid #8b5cf6; }

    .mission-card__header { display: flex; justify-content: space-between; align-items: center; }
    .mission-title { font-size: 14px; font-weight: 600; color: #1e293b; }
    .mission-meta { display: flex; align-items: center; gap: 8px; }
    .mission-honoraires { font-size: 13px; font-weight: 600; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 20px; }
    .mission-year { font-size: 12px; color: #94a3b8; }
    .btn-delete { color: #dc2626 !important; width: 28px !important; height: 28px !important; }
    .btn-delete mat-icon { font-size: 16px !important; }

    .mission-desc { font-size: 13px; color: #64748b; margin: 8px 0 0; line-height: 1.5; }
    .mission-args {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 12px; color: #6366f1; margin-top: 8px;
    }
    .mission-args mat-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; }
    .mission-refus {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 12px; color: #f97316; margin-top: 8px;
    }
    .mission-refus mat-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; }

    .empty-state {
      text-align: center; padding: 48px; color: #94a3b8;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; }
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
