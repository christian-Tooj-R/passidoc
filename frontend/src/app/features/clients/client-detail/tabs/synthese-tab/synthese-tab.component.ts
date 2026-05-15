import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { SyntheseService } from '../../../../../core/services/synthese.service';
import { FiscalReferenceService } from '../../../../../core/services/fiscal-reference.service';
import { SyntheseCloture, ClientSite } from '../../../../../core/models/client.model';

@Component({
  selector: 'app-synthese-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatExpansionModule,
    MatChipsModule, MatAutocompleteModule,
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
          <mat-form-field appearance="outline" style="width:160px">
            <mat-label>Exercice</mat-label>
            <input matInput type="number" formControlName="exercice" />
          </mat-form-field>

          <mat-accordion multi>

            <!-- Performances financières -->
            <mat-expansion-panel expanded>
              <mat-expansion-panel-header>
                <mat-panel-title><mat-icon style="font-size:18px;width:18px;height:18px;margin-right:6px;color:#6366f1">show_chart</mat-icon>Performances financières</mat-panel-title>
              </mat-expansion-panel-header>
              <div class="kpi-grid">
                <div class="kpi-field">
                  <label>CA (€)</label>
                  <mat-form-field appearance="outline"><input matInput type="number" formControlName="ca" placeholder="486 201" /></mat-form-field>
                </div>
                <div class="kpi-field">
                  <label>CA N-1 (€)</label>
                  <mat-form-field appearance="outline"><input matInput type="number" formControlName="caPrecedent" /></mat-form-field>
                </div>
                <div class="kpi-field">
                  <label>EBE (€)</label>
                  <mat-form-field appearance="outline"><input matInput type="number" formControlName="ebe" /></mat-form-field>
                </div>
                <div class="kpi-field">
                  <label>Résultat net (€)</label>
                  <mat-form-field appearance="outline"><input matInput type="number" formControlName="resultatNet" /></mat-form-field>
                </div>
                <div class="kpi-field">
                  <label>Flux de trésorerie (€)</label>
                  <mat-form-field appearance="outline"><input matInput type="number" formControlName="fluxTresorerie" /></mat-form-field>
                </div>
              </div>
              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Commentaire financier</mat-label>
                <textarea matInput formControlName="commentaireFinancier" rows="3" placeholder="Ex : CA en progression de 6%, EBE en forte hausse suite aux départs de salariés..."></textarea>
              </mat-form-field>
            </mat-expansion-panel>

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

            <mat-expansion-panel expanded>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon style="font-size:18px;width:18px;height:18px;margin-right:6px">account_balance</mat-icon>
                  Spécificités fiscales de l'exercice
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="chips-section">
                <!-- Zones d'exonération -->
                <div class="chips-group">
                  <label class="chips-label">
                    <mat-icon class="icon-success">check_circle</mat-icon>
                    Zones d'exonération appliquées
                  </label>
                  <mat-form-field appearance="outline" class="full-col">
                    <mat-chip-grid #exoGrid>
                      @for (z of selectedExo; track z) {
                        <mat-chip-row (removed)="removeExo(z)" class="chip-success">
                          {{ z }}
                          <button matChipRemove><mat-icon>cancel</mat-icon></button>
                        </mat-chip-row>
                      }
                      <input placeholder="Ajouter une zone..."
                             [matChipInputFor]="exoGrid"
                             [matChipInputSeparatorKeyCodes]="separatorKeys"
                             (matChipInputTokenEnd)="addExo($event)"
                             [matAutocomplete]="exoAuto" />
                    </mat-chip-grid>
                    <mat-autocomplete #exoAuto (optionSelected)="selectExo($event)">
                      @for (opt of filteredExoOptions(); track opt) {
                        <mat-option [value]="opt">{{ opt }}</mat-option>
                      }
                    </mat-autocomplete>
                  </mat-form-field>
                </div>

                <!-- Zones à risque -->
                <div class="chips-group">
                  <label class="chips-label">
                    <mat-icon class="icon-warn">warning</mat-icon>
                    Points de vigilance identifiés
                  </label>
                  <mat-form-field appearance="outline" class="full-col">
                    <mat-chip-grid #riskGrid>
                      @for (z of selectedRisque; track z) {
                        <mat-chip-row (removed)="removeRisque(z)" class="chip-warn">
                          {{ z }}
                          <button matChipRemove><mat-icon>cancel</mat-icon></button>
                        </mat-chip-row>
                      }
                      <input placeholder="Ajouter un risque..."
                             [matChipInputFor]="riskGrid"
                             [matChipInputSeparatorKeyCodes]="separatorKeys"
                             (matChipInputTokenEnd)="addRisque($event)"
                             [matAutocomplete]="riskAuto" />
                    </mat-chip-grid>
                    <mat-autocomplete #riskAuto (optionSelected)="selectRisque($event)">
                      @for (opt of filteredRisqueOptions(); track opt) {
                        <mat-option [value]="opt">{{ opt }}</mat-option>
                      }
                    </mat-autocomplete>
                  </mat-form-field>
                </div>
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
                <mat-form-field appearance="outline" class="full-col">
                  <mat-label>Canaux de distribution</mat-label>
                  <textarea matInput formControlName="canauxDistribution" rows="2" placeholder="Ex : Vente directe en boutique, commandes événementielles, livraison..."></textarea>
                </mat-form-field>
              </div>
            </mat-expansion-panel>
          </mat-accordion>

          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">Enregistrer</button>
            <button mat-button type="button" (click)="resetForm()">Annuler</button>
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
                  <mat-chip color="warn" selected>⚠ {{ s.zonesRisque!.length }} risque(s)</mat-chip>
                }
                @if (s.zonesExoneration?.length) {
                  <mat-chip color="primary" selected style="margin-left:4px">✓ {{ s.zonesExoneration!.length }} exo.</mat-chip>
                }
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="synthese-detail">
              @if (s.pointsIS) { <p><strong>IS :</strong> {{ s.pointsIS }}</p> }
              @if (s.pointsEBE) { <p><strong>EBE :</strong> {{ s.pointsEBE }}</p> }
              @if (s.notesSynthese) { <p><strong>Synthèse :</strong> {{ s.notesSynthese }}</p> }
              @if (s.zonesExoneration?.length) {
                <div class="detail-chips">
                  <strong>Exonérations :</strong>
                  <mat-chip-set>
                    @for (z of s.zonesExoneration; track z) {
                      <mat-chip class="chip-success">{{ z }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>
              }
              @if (s.zonesRisque?.length) {
                <div class="detail-chips">
                  <strong>Risques :</strong>
                  <mat-chip-set>
                    @for (z of s.zonesRisque; track z) {
                      <mat-chip class="chip-warn">{{ z }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>
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
    .form-actions { margin-top: 20px; display: flex; gap: 12px; }
    .syntheses-list { display: flex; flex-direction: column; gap: 12px; }
    .synthese-detail p { margin: 8px 0; font-size: 14px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 16px; }
    .kpi-field label { display: block; font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 4px; }
    .kpi-field mat-form-field { width: 100%; }

    .chips-section { display: flex; flex-direction: column; gap: 20px; padding: 16px 0; }
    .chips-group { display: flex; flex-direction: column; gap: 12px; }
    .chips-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #374151; }
    .icon-success { color: #16a34a; font-size: 18px; width: 18px; height: 18px; }
    .icon-warn    { color: #d97706; font-size: 18px; width: 18px; height: 18px; }

    .chip-success { --mdc-chip-label-text-color: #166534; background: #dcfce7 !important; font-size: 12px; }
    .chip-warn    { --mdc-chip-label-text-color: #92400e; background: #fef3c7 !important; font-size: 12px; }

    .detail-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 6px 0; font-size: 14px; }
  `],
})
export class SyntheseTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private fiscalRefService = inject(FiscalReferenceService);
  private confirm = inject(ConfirmService);

  @Input() clientId!: number;
  @Input() site: ClientSite = 'REUNION';

  syntheses: SyntheseCloture[] = [];
  showForm = false;
  separatorKeys = [ENTER, COMMA];

  selectedExo: string[] = [];
  selectedRisque: string[] = [];
  allExoOptions: string[] = [];
  allRisqueOptions: string[] = [];

  filteredExoOptions = computed(() => this.allExoOptions.filter(o => !this.selectedExo.includes(o)));
  filteredRisqueOptions = computed(() => this.allRisqueOptions.filter(o => !this.selectedRisque.includes(o)));

  form = this.fb.group({
    exercice:             [new Date().getFullYear(), Validators.required],
    ca:                   [null as number | null],
    caPrecedent:          [null as number | null],
    ebe:                  [null as number | null],
    resultatNet:          [null as number | null],
    fluxTresorerie:       [null as number | null],
    commentaireFinancier: [''],
    pointsIS:             [''],
    pointsEBE:            [''],
    notesSynthese:        [''],
    businessModel:        [''],
    strategieVente:       [''],
    canauxDistribution:   [''],
  });

  private toast = inject(ToastService);
  constructor(private service: SyntheseService) {}

  ngOnInit() {
    this.load();
    this.fiscalRefService.get().then(data => {
      const ref = data[this.site];
      this.allExoOptions = ref.zonesExoneration;
      this.allRisqueOptions = ref.zonesRisque;
    });
  }

  load() { this.service.getAll(this.clientId).subscribe((d) => (this.syntheses = d)); }

  addExo(event: MatChipInputEvent) {
    const v = (event.value || '').trim();
    if (v && !this.selectedExo.includes(v)) this.selectedExo.push(v);
    event.chipInput.clear();
  }
  removeExo(z: string) { this.selectedExo = this.selectedExo.filter(s => s !== z); }
  selectExo(event: MatAutocompleteSelectedEvent) {
    const v = event.option.value;
    if (!this.selectedExo.includes(v)) this.selectedExo.push(v);
    event.option.deselect();
  }

  addRisque(event: MatChipInputEvent) {
    const v = (event.value || '').trim();
    if (v && !this.selectedRisque.includes(v)) this.selectedRisque.push(v);
    event.chipInput.clear();
  }
  removeRisque(z: string) { this.selectedRisque = this.selectedRisque.filter(s => s !== z); }
  selectRisque(event: MatAutocompleteSelectedEvent) {
    const v = event.option.value;
    if (!this.selectedRisque.includes(v)) this.selectedRisque.push(v);
    event.option.deselect();
  }

  save() {
    this.service.create(this.clientId, {
      ...this.form.value,
      zonesExoneration: this.selectedExo,
      zonesRisque: this.selectedRisque,
    }).subscribe(() => {
      this.load();
      this.resetForm();
      this.toast.success('Synthèse enregistrée');
    });
  }

  resetForm() {
    this.showForm = false;
    this.form.reset({ exercice: new Date().getFullYear() });
    this.selectedExo = [];
    this.selectedRisque = [];
  }

  delete(s: SyntheseCloture) {
    this.confirm.confirm('Supprimer cet exercice ?').subscribe(ok => {
      if (!ok) return;
      this.service.delete(this.clientId, s.id).subscribe(() => this.load());
    });
  }
}
