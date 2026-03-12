import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { FicheIdentiteService } from '../../../../../core/services/fiche-identite.service';

@Component({
  selector: 'app-fiche-identite-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatSnackBarModule, MatExpansionModule,
  ],
  template: `
    <div class="tab-content">
      <form [formGroup]="form" (ngSubmit)="save()">
        <mat-accordion>
          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>business</mat-icon>&nbsp;Identité légale</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Raison sociale</mat-label>
                <input matInput formControlName="raisonSociale" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Forme juridique</mat-label>
                <input matInput formControlName="formeJuridique" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>SIREN</mat-label>
                <input matInput formControlName="siren" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>SIRET</mat-label>
                <input matInput formControlName="siret" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Adresse</mat-label>
                <input matInput formControlName="adresse" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Activité</mat-label>
                <input matInput formControlName="activite" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Surface commerciale (m²)</mat-label>
                <input matInput type="number" formControlName="surfaceCommerciale" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Email de contact</mat-label>
                <mat-icon matPrefix>email</mat-icon>
                <input matInput type="email" formControlName="emailContact" placeholder="contact@entreprise.re" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Téléphone de contact</mat-label>
                <mat-icon matPrefix>phone</mat-icon>
                <input matInput formControlName="telephoneContact" placeholder="0262 XX XX XX" />
              </mat-form-field>
            </div>
          </mat-expansion-panel>
        </mat-accordion>

        <div class="tab-content__actions">
          <button mat-flat-button color="primary" type="submit" [disabled]="saving">
            <mat-icon>save</mat-icon> {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 0; }
    .full-col { grid-column: 1 / -1; }
    .tab-content__actions { margin-top: 24px; display: flex; justify-content: flex-end; }
  `],
})
export class FicheIdentiteTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  @Input() clientId!: number;
  form = this.fb.group({
    raisonSociale: [''], siren: [''], siret: [''],
    formeJuridique: [''], adresse: [''], activite: [''],
    surfaceCommerciale: [null as number | null],
    emailContact: [''], telephoneContact: [''],
  });
  saving = false;

  constructor(private service: FicheIdentiteService, private snack: MatSnackBar) {}

  ngOnInit() {
    this.service.get(this.clientId).subscribe((fiche) => this.form.patchValue(fiche as any));
  }

  save() {
    this.saving = true;
    this.service.update(this.clientId, this.form.value as any).subscribe({
      next: () => { this.saving = false; this.snack.open('Fiche enregistrée', 'OK', { duration: 3000 }); },
      error: () => { this.saving = false; this.snack.open('Erreur lors de la sauvegarde', 'OK', { duration: 3000 }); },
    });
  }
}
