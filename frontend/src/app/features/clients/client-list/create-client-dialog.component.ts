import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormControl } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { PappersService, PappersResult } from '../../../core/services/pappers.service';

@Component({
  selector: 'app-create-client-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatAutocompleteModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="dialog-header__icon"><mat-icon>folder_shared</mat-icon></div>
        <div>
          <h2>Nouveau dossier client</h2>
          <p>Recherchez l'entreprise pour pré-remplir la fiche</p>
        </div>
      </div>

      <div class="dialog-body">

        <!-- Recherche Pappers -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>Rechercher par nom ou SIREN</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="searchCtrl"
                 [matAutocomplete]="auto"
                 placeholder="Ex: Boulangerie Martin ou 123456789" />
          @if (searching) {
            <mat-spinner matSuffix diameter="18"></mat-spinner>
          }
          <mat-autocomplete #auto="matAutocomplete" [displayWith]="displayFn"
                            (optionSelected)="onSelect($event.option.value)">
            @for (r of results; track r.siren) {
              <mat-option [value]="r">
                <div class="option-row">
                  <span class="option-name">{{ r.nomEntreprise }}</span>
                  <span class="option-meta">{{ r.siren }} · {{ r.formeJuridique }}</span>
                  <span class="option-addr">{{ r.adresse }}</span>
                </div>
              </mat-option>
            }
            @if (!searching && (searchCtrl.value?.length ?? 0) >= 2 && results.length === 0) {
              <mat-option disabled>Aucun résultat</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <!-- Aperçu de l'entreprise sélectionnée -->
        @if (selected) {
          <div class="preview-card">
            <div class="preview-header">
              <mat-icon>verified</mat-icon>
              <span>Entreprise trouvée</span>
            </div>
            <div class="preview-grid">
              <div class="preview-item">
                <label>Raison sociale</label>
                <span>{{ selected.nomEntreprise }}</span>
              </div>
              <div class="preview-item">
                <label>SIREN</label>
                <span>{{ selected.siren }}</span>
              </div>
              <div class="preview-item">
                <label>Forme juridique</label>
                <span>{{ selected.formeJuridique || '—' }}</span>
              </div>
              <div class="preview-item">
                <label>Adresse</label>
                <span>{{ selected.adresse || '—' }}</span>
              </div>
              @if (selected.dirigeants.length > 0) {
                <div class="preview-item full-span">
                  <label>Dirigeant(s)</label>
                  <span>{{ selected.dirigeants.map(d => d.prenom + ' ' + d.nom + ' (' + d.qualite + ')').join(' · ') }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Saisie manuelle si pas de résultat -->
        @if (!selected) {
          <mat-form-field appearance="outline" class="full">
            <mat-label>Nom du dossier (si introuvable)</mat-label>
            <mat-icon matPrefix>business</mat-icon>
            <input matInput [formControl]="nomManuelCtrl" placeholder="Saisie manuelle" />
          </mat-form-field>
        }

        <!-- Site -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>Site de rattachement</mat-label>
          <mat-icon matPrefix>location_on</mat-icon>
          <mat-select [formControl]="siteCtrl">
            <mat-option value="REUNION">🇷🇪 &nbsp;La Réunion</mat-option>
            <mat-option value="MADAGASCAR">🇲🇬 &nbsp;Madagascar</mat-option>
          </mat-select>
          @if (siteCtrl.touched && siteCtrl.hasError('required')) {
            <mat-error>Le site est requis</mat-error>
          }
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="cancel()">Annuler</button>
        <button mat-flat-button class="btn-create" [disabled]="!canSubmit()" (click)="confirm()">
          <mat-icon>add</mat-icon> Créer le dossier
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog { width: 520px; max-width: 100%; }

    .dialog-header { display: flex; align-items: center; gap: 16px; padding: 28px 28px 20px; border-bottom: 1px solid #f1f5f9; }
    .dialog-header__icon { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #1e40af, #3730a3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .dialog-header__icon mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .dialog-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .dialog-header p { font-size: 13px; color: #64748b; margin: 0; }

    .dialog-body { padding: 20px 28px; display: flex; flex-direction: column; gap: 8px; }
    .full { width: 100%; }

    .option-row { display: flex; flex-direction: column; gap: 1px; padding: 4px 0; }
    .option-name { font-size: 14px; font-weight: 600; color: #0f172a; }
    .option-meta { font-size: 11px; color: #6366f1; font-weight: 500; }
    .option-addr { font-size: 12px; color: #94a3b8; }

    .preview-card {
      background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 12px; padding: 16px; margin-bottom: 4px;
    }
    .preview-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #15803d; margin-bottom: 12px; }
    .preview-header mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .preview-item { display: flex; flex-direction: column; gap: 2px; }
    .preview-item.full-span { grid-column: 1 / -1; }
    .preview-item label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .preview-item span { font-size: 13px; color: #1e293b; font-weight: 500; }

    .dialog-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 16px 28px 24px; border-top: 1px solid #f1f5f9; }
    .btn-create { border-radius: 10px !important; font-weight: 600; background: linear-gradient(135deg, #1e40af, #3730a3) !important; display: flex; align-items: center; gap: 4px; }
    .btn-create mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class CreateClientDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<CreateClientDialogComponent>);
  private pappers = inject(PappersService);

  searchCtrl = new FormControl('');
  nomManuelCtrl = new FormControl('');
  siteCtrl = new FormControl('', Validators.required);

  results: PappersResult[] = [];
  selected: PappersResult | null = null;
  searching = false;

  ngOnInit() {
    this.searchCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!q || typeof q !== 'string' || q.trim().length < 2) {
          this.results = [];
          return of([]);
        }
        this.searching = true;
        return this.pappers.search(q.trim()).pipe(catchError(() => of([])));
      }),
    ).subscribe((res) => {
      this.searching = false;
      this.results = res;
    });
  }

  displayFn(r: PappersResult | string): string {
    if (!r) return '';
    if (typeof r === 'string') return r;
    return r.nomEntreprise;
  }

  onSelect(r: PappersResult) {
    this.selected = r;
    this.results = [];
  }

  clearSelection() {
    this.selected = null;
    this.searchCtrl.setValue('');
  }

  canSubmit(): boolean {
    if (!this.siteCtrl.value) return false;
    return !!(this.selected || this.nomManuelCtrl.value?.trim());
  }

  confirm() {
    if (!this.canSubmit()) return;
    this.dialogRef.close({
      nom: this.selected ? this.selected.nomEntreprise : this.nomManuelCtrl.value?.trim(),
      site: this.siteCtrl.value,
      ficheData: this.selected ? {
        raisonSociale: this.selected.nomEntreprise,
        siren: this.selected.siren,
        siret: this.selected.siret,
        formeJuridique: this.selected.formeJuridique,
        adresse: this.selected.adresse,
        gerants: this.selected.dirigeants.map(d => ({
          nom: `${d.prenom} ${d.nom}`.trim(),
          qualite: d.qualite,
        })),
      } : null,
    });
  }

  cancel() { this.dialogRef.close(null); }
}
