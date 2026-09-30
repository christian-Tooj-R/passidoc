import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-conges-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
<div class="page">

  <div class="page-header">
    <div class="page-header__left">
      <h2>Circuit de validation des congés</h2>
      <p class="page-header__sub">
        Définissez qui peut approuver ou refuser les demandes de congés des collaborateurs.
      </p>
    </div>
  </div>

  @if (loading()) {
    <div class="loading-state"><mat-icon class="spin">refresh</mat-icon> Chargement…</div>
  } @else {
    <div class="option-card" [class.option-card--active]="parReferent()">
      <label class="option-toggle">
        <input type="checkbox" [(ngModel)]="parReferentModel" />
        <span class="option-toggle__track"><span class="option-toggle__thumb"></span></span>
      </label>
      <div class="option-body">
        <span class="option-title">Autoriser le référent direct à valider les congés de son équipe</span>
        <p class="option-desc">
          @if (parReferentModel) {
            Chaque responsable (chef de mission, chef d'antenne…) peut approuver ou refuser
            les demandes des collaborateurs qu'il supervise directement, en plus de l'ADMIN
            qui garde toujours la main sur toutes les demandes.
          } @else {
            Seul le compte ADMIN peut approuver ou refuser une demande de congé — c'est le
            réglage actuel.
          }
        </p>
      </div>
    </div>

    <div class="info-box">
      <mat-icon>info</mat-icon>
      <span>
        Le "référent direct" d'un collaborateur est déjà défini dans l'onglet Équipes
        (chef de mission pour un collaborateur, chef d'antenne pour un chef de mission).
        Aucune configuration supplémentaire n'est nécessaire ici — ce réglage active ou
        désactive simplement leur droit de validation.
      </span>
    </div>

    <button class="btn-save" [disabled]="saving() || parReferentModel === parReferent()" (click)="save()">
      <mat-icon>{{ saving() ? 'hourglass_empty' : 'save' }}</mat-icon>
      {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
    </button>
  }

</div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 720px; }
    .page-header { margin-bottom: 24px; }
    .page-header h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
    .page-header__sub { font-size: 13px; color: #64748b; margin: 0; }

    .loading-state { display:flex; align-items:center; gap:8px; color:#94a3b8; padding: 20px 0; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .option-card {
      display: flex; gap: 16px; align-items: flex-start;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px;
      padding: 18px 20px; margin-bottom: 16px; transition: border-color .15s;
    }
    .option-card--active { border-color: #6366f1; background: #f5f5ff; }

    .option-toggle { position: relative; flex-shrink: 0; cursor: pointer; margin-top: 2px; }
    .option-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
    .option-toggle__track {
      display: block; width: 42px; height: 24px; border-radius: 12px;
      background: #e2e8f0; transition: background .2s; position: relative;
    }
    .option-toggle__thumb {
      position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;
      border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25);
      transition: transform .2s;
    }
    .option-toggle input:checked + .option-toggle__track { background: #6366f1; }
    .option-toggle input:checked + .option-toggle__track .option-toggle__thumb { transform: translateX(18px); }

    .option-body { display: flex; flex-direction: column; gap: 6px; }
    .option-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .option-desc { font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.5; }

    .info-box {
      display: flex; gap: 10px; align-items: flex-start;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
      padding: 12px 14px; font-size: 12.5px; color: #1e40af; line-height: 1.5; margin-bottom: 20px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    }

    .btn-save {
      display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 20px;
      background: #6366f1; color: #fff; border: none; border-radius: 9px;
      font-size: 13px; font-weight: 700; cursor: pointer; transition: background .15s;
    }
    .btn-save:hover:not(:disabled) { background: #4f46e5; }
    .btn-save:disabled { opacity: .5; cursor: not-allowed; }
    .btn-save mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class CongesConfigComponent implements OnInit {
  private tenantSvc = inject(TenantService);
  private snack     = inject(MatSnackBar);

  loading = signal(true);
  saving  = signal(false);
  parReferent = signal(false);
  parReferentModel = false;

  ngOnInit() {
    this.tenantSvc.loadConfig().subscribe(config => {
      this.parReferent.set(!!config?.congesValidationParReferent);
      this.parReferentModel = this.parReferent();
      this.loading.set(false);
    });
  }

  save() {
    this.saving.set(true);
    this.tenantSvc.updateConfig({ congesValidationParReferent: this.parReferentModel }).subscribe({
      next: () => {
        this.parReferent.set(this.parReferentModel);
        this.saving.set(false);
        this.snack.open('Circuit de validation mis à jour', undefined, { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Erreur lors de l\'enregistrement', undefined, { duration: 4000 });
      },
    });
  }
}
