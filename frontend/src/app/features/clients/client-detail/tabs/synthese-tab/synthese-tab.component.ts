import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { SyntheseService } from '../../../../../core/services/synthese.service';
import { SyntheseCloture } from '../../../../../core/models/client.model';

@Component({
  selector: 'app-synthese-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatExpansionModule, MatSnackBarModule, MatChipsModule,
  ],
  template: `
    <div class="tab-content">
      <div class="tab-header">
        <h3>Analyse Financière & Clôture</h3>
        <button mat-stroked-button color="primary" (click)="showForm = !showForm">
          <mat-icon>add</mat-icon> Nouvel exercice
        </button>
      </div>

      @if (showForm) {
        <form [formGroup]="form" (ngSubmit)="save()" class="synthese-form">
          <mat-form-field appearance="outline">
            <mat-label>Exercice</mat-label>
            <input matInput type="number" formControlName="exercice" />
          </mat-form-field>
          <mat-accordion>
            <mat-expansion-panel expanded>
              <mat-expansion-panel-header><mat-panel-title>Points fiscaux</mat-panel-title></mat-expansion-panel-header>
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Points IS</mat-label>
                  <textarea matInput formControlName="pointsIS" rows="3"></textarea>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Points EBE</mat-label>
                  <textarea matInput formControlName="pointsEBE" rows="3"></textarea>
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-col">
                  <mat-label>Notes de synthèse N-1</mat-label>
                  <textarea matInput formControlName="notesSynthese" rows="4"></textarea>
                </mat-form-field>
              </div>
            </mat-expansion-panel>
            <mat-expansion-panel>
              <mat-expansion-panel-header><mat-panel-title>Business Model</mat-panel-title></mat-expansion-panel-header>
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Business Model</mat-label>
                  <textarea matInput formControlName="businessModel" rows="3"></textarea>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Stratégie de vente</mat-label>
                  <textarea matInput formControlName="strategieVente" rows="3"></textarea>
                </mat-form-field>
              </div>
            </mat-expansion-panel>
          </mat-accordion>
          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">Enregistrer</button>
            <button mat-button type="button" (click)="showForm = false">Annuler</button>
          </div>
        </form>
      }

      <div class="syntheses-list">
        @for (s of syntheses; track s.id) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>Exercice {{ s.exercice }}</mat-panel-title>
              <mat-panel-description>
                @if (s.zonesRisque?.length) {
                  <mat-chip color="warn" selected>⚠ Risques</mat-chip>
                }
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="synthese-detail">
              @if (s.pointsIS) { <p><strong>IS :</strong> {{ s.pointsIS }}</p> }
              @if (s.pointsEBE) { <p><strong>EBE :</strong> {{ s.pointsEBE }}</p> }
              @if (s.notesSynthese) { <p><strong>Synthèse :</strong> {{ s.notesSynthese }}</p> }
              @if (s.zonesExoneration?.length) {
                <p><strong>Exonérations :</strong> {{ s.zonesExoneration?.join(', ') }}</p>
              }
              @if (s.zonesRisque?.length) {
                <p><strong>Risques :</strong> {{ s.zonesRisque?.join(', ') }}</p>
              }
            </div>
            <mat-action-row>
              <button mat-icon-button color="warn" (click)="delete(s)"><mat-icon>delete</mat-icon></button>
            </mat-action-row>
          </mat-expansion-panel>
        }
      </div>
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .synthese-form { margin-bottom: 24px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 0; }
    .full-col { grid-column: 1 / -1; }
    .form-actions { margin-top: 16px; display: flex; gap: 8px; }
    .syntheses-list { display: flex; flex-direction: column; gap: 8px; }
    .synthese-detail p { margin: 4px 0; font-size: 14px; }
  `],
})
export class SyntheseTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  @Input() clientId!: number;
  syntheses: SyntheseCloture[] = [];
  showForm = false;
  form = this.fb.group({
    exercice: [new Date().getFullYear(), Validators.required],
    pointsIS: [''], pointsEBE: [''], notesSynthese: [''],
    businessModel: [''], strategieVente: [''],
  });

  constructor(private service: SyntheseService, private snack: MatSnackBar) {}
  ngOnInit() { this.load(); }
  load() { this.service.getAll(this.clientId).subscribe((d) => (this.syntheses = d)); }

  save() {
    this.service.create(this.clientId, this.form.value).subscribe(() => {
      this.load(); this.showForm = false; this.form.reset({ exercice: new Date().getFullYear() });
      this.snack.open('Synthèse enregistrée', 'OK', { duration: 2000 });
    });
  }

  delete(s: SyntheseCloture) {
    this.service.delete(this.clientId, s.id).subscribe(() => this.load());
  }
}
