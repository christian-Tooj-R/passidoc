import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../../../core/services/toast.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FicheIdentiteService } from '../../../../../core/services/fiche-identite.service';
import { FiscalReferenceService, FiscalRef } from '../../../../../core/services/fiscal-reference.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { ClientSite, TypeFlux } from '../../../../../core/models/client.model';

const ALL_TYPES: { key: TypeFlux; label: string; icon: string; hint: string }[] = [
  { key: 'RELEVE_BANCAIRE',   label: 'Relevés bancaires',    icon: 'account_balance', hint: 'Mensuel' },
  { key: 'TVA_MENSUELLE',     label: 'TVA Mensuelle',        icon: 'receipt',         hint: 'Chaque mois' },
  { key: 'TVA_TRIMESTRIELLE', label: 'TVA Trimestrielle',    icon: 'receipt_long',    hint: 'Mar · Juin · Sep · Déc' },
  { key: 'TVA_ANNUELLE',      label: 'TVA Annuelle (DCA12)', icon: 'description',     hint: 'Décembre uniquement' },
  { key: 'PAIE',              label: 'Paie (SILAE)',         icon: 'people',          hint: 'Mensuel' },
  { key: 'RAPPORT_VENTE',     label: 'Rapport de vente',     icon: 'point_of_sale',   hint: 'Mensuel' },
  { key: 'RECETTE_AMENITIZ',  label: 'Recette Amenitiz',     icon: 'hotel',           hint: 'Hôtellerie — mensuel' },
  { key: 'PIECES_COMPTABLES', label: 'Pièces comptables',    icon: 'folder_open',     hint: 'Mensuel' },
];

@Component({
  selector: 'app-fiche-identite-tab',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatExpansionModule,
    MatChipsModule, MatTooltipModule, MatCheckboxModule,
  ],
  template: `
    <div class="tab-content">
      <form [formGroup]="form" (ngSubmit)="save()">
        <mat-accordion multi>
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

          @if (fiscalRef) {
            <mat-expansion-panel expanded>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>account_balance</mat-icon>&nbsp;Spécificités fiscales
                  <span class="site-badge" [class]="site === 'REUNION' ? 'badge-re' : 'badge-mg'">
                    {{ site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
                  </span>
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="fiscal-section">
                <div class="fiscal-group">
                  <div class="fiscal-group-title">
                    <mat-icon class="icon-success">check_circle</mat-icon>
                    Zones d'exonération applicables
                  </div>
                  <mat-chip-set>
                    @for (z of fiscalRef.zonesExoneration; track z) {
                      <mat-chip [matTooltip]="z" class="chip-success">{{ z }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>

                <div class="fiscal-group">
                  <div class="fiscal-group-title">
                    <mat-icon class="icon-warn">warning</mat-icon>
                    Points de vigilance fiscale
                  </div>
                  <mat-chip-set>
                    @for (z of fiscalRef.zonesRisque; track z) {
                      <mat-chip [matTooltip]="z" class="chip-warn">{{ z }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>

                <div class="fiscal-group">
                  <div class="fiscal-group-title">
                    <mat-icon class="icon-info">gavel</mat-icon>
                    Réglementations applicables
                  </div>
                  <mat-chip-set>
                    @for (r of fiscalRef.reglementations; track r) {
                      <mat-chip [matTooltip]="r" class="chip-info">{{ r }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>
              </div>
            </mat-expansion-panel>
          }
          <!-- Présence digitale & marché -->
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>store</mat-icon>&nbsp;Présence digitale & marché</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Concurrents dans le quartier</mat-label>
                <mat-icon matPrefix>place</mat-icon>
                <input matInput type="number" formControlName="nbConcurrentsQuartier" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Concurrents dans la commune</mat-label>
                <mat-icon matPrefix>location_city</mat-icon>
                <input matInput type="number" formControlName="nbConcurrentsCommune" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Site web</mat-label>
                <mat-icon matPrefix>language</mat-icon>
                <input matInput formControlName="siteWeb" placeholder="https://..." />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Réseaux sociaux (un par ligne)</mat-label>
                <mat-icon matPrefix>share</mat-icon>
                <textarea matInput rows="2" [value]="reseauxText" (input)="updateReseaux($event)" placeholder="Facebook&#10;Instagram&#10;TikTok"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Évolution du secteur</mat-label>
                <textarea matInput rows="3" formControlName="evolutionSecteur" placeholder="Tendances, données sectorielles, évolution du marché local..."></textarea>
              </mat-form-field>
            </div>
          </mat-expansion-panel>

          <!-- Documents mensuels attendus -->
          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title><mat-icon>inbox</mat-icon>&nbsp;Documents mensuels attendus</mat-panel-title>
            </mat-expansion-panel-header>
            <div class="flux-types-section">
              <p class="flux-hint">Cochez les documents que ce client doit fournir chaque mois.</p>
              <div class="flux-types-grid">
                @for (t of allTypes; track t.key) {
                  <div class="flux-type-item" [class.flux-type-active]="isTypeActif(t.key)"
                       (click)="toggleType(t.key)">
                    <mat-icon class="flux-type-icon">{{ t.icon }}</mat-icon>
                    <div class="flux-type-body">
                      <span class="flux-type-label">{{ t.label }}</span>
                      <span class="flux-type-hint">{{ t.hint }}</span>
                    </div>
                    <mat-checkbox [checked]="isTypeActif(t.key)"
                                  (click)="$event.stopPropagation()"
                                  (change)="toggleType(t.key)" color="primary" />
                  </div>
                }
              </div>
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

    .site-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; margin-left: 8px; }
    .badge-re { background: #dbeafe; color: #1d4ed8; }
    .badge-mg { background: #dcfce7; color: #15803d; }

    .fiscal-section { display: flex; flex-direction: column; gap: 20px; padding: 16px 0; }
    .fiscal-group-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px;
    }
    .icon-success { color: #16a34a; font-size: 18px; width: 18px; height: 18px; }
    .icon-warn    { color: #d97706; font-size: 18px; width: 18px; height: 18px; }
    .icon-info    { color: #2563eb; font-size: 18px; width: 18px; height: 18px; }

    .flux-hint { font-size: 12px; color: #94a3b8; margin: 0 0 14px; padding: 16px 0 0; }
    .flux-types-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;
      padding-bottom: 8px;
    }
    .flux-type-item {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-radius: 12px;
      border: 1.5px solid #e2e8f0; background: #f8fafc;
      cursor: pointer; transition: all .15s;
    }
    .flux-type-item:hover { border-color: #c7d2fe; background: #f5f3ff; }
    .flux-type-active { border-color: #6366f1 !important; background: #eef2ff !important; }
    .flux-type-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; flex-shrink: 0; }
    .flux-type-body { display: flex; flex-direction: column; gap: 1px; flex: 1; }
    .flux-type-label { font-size: 13px; font-weight: 500; color: #1e293b; }
    .flux-type-hint  { font-size: 11px; color: #94a3b8; }

    mat-chip-set { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip-success { --mdc-chip-label-text-color: #166534; background: #dcfce7 !important; font-size: 12px; }
    .chip-warn    { --mdc-chip-label-text-color: #92400e; background: #fef3c7 !important; font-size: 12px; }
    .chip-info    { --mdc-chip-label-text-color: #1e40af; background: #dbeafe !important; font-size: 12px; }
  `],
})
export class FicheIdentiteTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private fiscalRefService = inject(FiscalReferenceService);

  @Input() clientId!: number;
  @Input() site: ClientSite = 'REUNION';
  @Output() typesChanged = new EventEmitter<TypeFlux[]>();

  @Input() set typesFluxActifs(val: TypeFlux[] | undefined) {
    this.selectedTypes = val?.length ? [...val] : ALL_TYPES.map(t => t.key);
  }

  fiscalRef: FiscalRef | null = null;
  selectedTypes: TypeFlux[] = ALL_TYPES.map(t => t.key);
  readonly allTypes = ALL_TYPES;

  form = this.fb.group({
    raisonSociale: [''], siren: [''], siret: [''],
    formeJuridique: [''], adresse: [''], activite: [''],
    surfaceCommerciale: [null as number | null],
    emailContact: [''], telephoneContact: [''],
    nbConcurrentsQuartier: [null as number | null],
    nbConcurrentsCommune: [null as number | null],
    siteWeb: [''],
    evolutionSecteur: [''],
  });
  reseauxText = '';
  saving = false;

  private toast = inject(ToastService);

  constructor(
    private service: FicheIdentiteService,
    private clientsService: ClientsService,
  ) {}

  ngOnInit() {
    this.service.get(this.clientId).subscribe((fiche) => {
      this.form.patchValue(fiche as any);
      this.reseauxText = ((fiche as any).reseauxSociaux || []).join('\n');
    });
    this.fiscalRefService.get().then(data => { this.fiscalRef = data[this.site]; });
  }

  updateReseaux(event: Event) {
    this.reseauxText = (event.target as HTMLTextAreaElement).value;
  }

  isTypeActif(key: TypeFlux): boolean { return this.selectedTypes.includes(key); }

  toggleType(key: TypeFlux) {
    if (this.isTypeActif(key)) {
      if (this.selectedTypes.length === 1) return; // au moins 1 toujours coché
      this.selectedTypes = this.selectedTypes.filter(k => k !== key);
    } else {
      this.selectedTypes = [...this.selectedTypes, key];
    }
    this.clientsService.update(this.clientId, { typesFluxActifs: this.selectedTypes }).subscribe(() => {
      this.typesChanged.emit(this.selectedTypes);
    });
  }

  save() {
    this.saving = true;
    const toArray = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
    const payload = { ...this.form.value, reseauxSociaux: toArray(this.reseauxText) };
    this.service.update(this.clientId, payload as any).subscribe({
      next: () => { this.saving = false; this.toast.success('Fiche enregistrée'); },
      error: () => { this.saving = false; this.toast.error('Erreur lors de la sauvegarde'); },
    });
  }
}
