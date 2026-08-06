import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { DocumentsService } from '../../../../../core/services/documents.service';
import { ClientDocument, TypeFlux } from '../../../../../core/models/client.model';
import { LocalDatePipe } from '../../../../../core/pipes/local-date.pipe';
import { DataTableComponent, ColDirective, ColumnDef } from '../../../../../shared/data-table/data-table.component';

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

interface TypeDocDef {
  value: string;
  label: string;
  periodicite: 'monthly' | 'quarterly' | 'annual' | 'none';
}

const TYPE_DOC_OPTIONS: TypeDocDef[] = [
  { value: '',                  label: '— Non classé —',       periodicite: 'none'      },
  { value: 'FACTURE_ACHAT',     label: 'Facture achat (401)',   periodicite: 'monthly'   },
  { value: 'FACTURE_VENTE',     label: 'Facture vente (411)',   periodicite: 'monthly'   },
  { value: 'RELEVE_BANCAIRE',   label: 'Relevé bancaire',       periodicite: 'monthly'   },
  { value: 'TVA_MENSUELLE',     label: 'TVA Mensuelle',         periodicite: 'monthly'   },
  { value: 'TVA_TRIMESTRIELLE', label: 'TVA Trimestrielle',     periodicite: 'quarterly' },
  { value: 'TVA_ANNUELLE',      label: 'TVA Annuelle (DCA12)',  periodicite: 'annual'    },
  { value: 'PAIE',              label: 'Paie (SILAE)',          periodicite: 'monthly'   },
  { value: 'RAPPORT_VENTE',     label: 'Rapport de vente',      periodicite: 'monthly'   },
  { value: 'RECETTE_AMENITIZ',  label: 'Recette Amenitiz',      periodicite: 'monthly'   },
  { value: 'PIECES_COMPTABLES', label: 'Pièces comptables',     periodicite: 'monthly'   },
  { value: 'AUTRE',             label: 'Autre',                 periodicite: 'none'      },
];

const TRIMESTRE_LABELS = [
  { label: 'T1 (Janv–Mars)',   mois: 3  },
  { label: 'T2 (Avr–Juin)',    mois: 6  },
  { label: 'T3 (Juil–Sept)',   mois: 9  },
  { label: 'T4 (Oct–Déc)',     mois: 12 },
];

@Component({
  selector: 'app-documents-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressBarModule, MatSelectModule, MatFormFieldModule, MatInputModule,
    LocalDatePipe, DataTableComponent, ColDirective],
  template: `
    <div class="tab-content">
      <div class="tab-header">
        <h3>Documents</h3>
        <label class="upload-btn">
          <mat-icon>upload</mat-icon> Importer un fichier
          <input type="file" hidden (change)="onFileSelected($event)" />
        </label>
      </div>

      @if (pendingFile()) {
        <div class="meta-panel">

          <div class="meta-panel__file">
            <mat-icon>insert_drive_file</mat-icon>
            <span class="meta-panel__filename">{{ pendingFile()!.name }}</span>
          </div>

          <!-- Ligne 1 : type toujours visible, pleine largeur -->
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="meta-type-ff">
            <mat-label>Type de document</mat-label>
            <mat-select [(ngModel)]="metaTypeDoc" name="typeDoc">
              @for (opt of typeDocOptions; track opt.value) {
                <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Ligne 2 : période → mois + année (mensuel), trimestre + année (trimestriel), année seule (annuel) -->
          @if (periodeModeOf(metaTypeDoc) === 'monthly') {
            <div class="meta-period-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="meta-mois-ff">
                <mat-label>Mois</mat-label>
                <mat-select [(ngModel)]="metaMois" name="mois">
                  @for (m of moisLabels; track $index) {
                    <mat-option [value]="$index + 1">{{ m }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="meta-annee-ff">
                <mat-label>Année</mat-label>
                <input matInput type="number" [(ngModel)]="metaAnnee" name="annee"
                       [min]="2020" [max]="2030" />
              </mat-form-field>
            </div>
          }

          @if (periodeModeOf(metaTypeDoc) === 'quarterly') {
            <div class="meta-period-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="meta-mois-ff">
                <mat-label>Trimestre</mat-label>
                <mat-select [(ngModel)]="metaMois" name="trimestre">
                  @for (t of trimestreLabels; track t.mois) {
                    <mat-option [value]="t.mois">{{ t.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="meta-annee-ff">
                <mat-label>Année</mat-label>
                <input matInput type="number" [(ngModel)]="metaAnnee" name="annee"
                       [min]="2020" [max]="2030" />
              </mat-form-field>
            </div>
          }

          @if (periodeModeOf(metaTypeDoc) === 'annual') {
            <div class="meta-period-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="meta-annee-only-ff">
                <mat-label>Année</mat-label>
                <input matInput type="number" [(ngModel)]="metaAnnee" name="annee"
                       [min]="2020" [max]="2030" />
              </mat-form-field>
            </div>
          }

          <div class="meta-panel__actions">
            <button mat-stroked-button (click)="cancelUpload()">
              <mat-icon>close</mat-icon> Annuler
            </button>
            <button mat-flat-button color="primary" (click)="confirmUpload()" [disabled]="uploading">
              @if (uploading) {
                <mat-icon>hourglass_empty</mat-icon> En cours…
              } @else {
                <mat-icon>cloud_upload</mat-icon> Importer
              }
            </button>
          </div>

        </div>
      }

      @if (uploading) {
        <mat-progress-bar mode="indeterminate" />
      }

      <app-data-table [columns]="colonnes" [data]="documents" [pageSize]="0">

        <ng-template appCol="nom" let-d>
          <div class="file-cell">
            <mat-icon class="file-icon">insert_drive_file</mat-icon>
            <span>{{ d.nom }}</span>
          </div>
        </ng-template>

        <ng-template appCol="type" let-d>
          @if (d.typeDoc === 'FACTURE_ACHAT') {
            <span class="doc-badge doc-badge--achat">Achat</span>
          } @else if (d.typeDoc === 'FACTURE_VENTE') {
            <span class="doc-badge doc-badge--vente">Vente</span>
          } @else if (d.typeDoc === 'AUTRE') {
            <span class="doc-badge doc-badge--autre">Autre</span>
          } @else {
            <span class="doc-badge doc-badge--nc">—</span>
          }
          @if (d.periodeMois && d.periodeAnnee) {
            <span class="doc-period">{{ moisLabels[d.periodeMois - 1] }} {{ d.periodeAnnee }}</span>
          }
        </ng-template>

        <ng-template appCol="taille" let-d>
          {{ formatSize(d.taille) }}
        </ng-template>

        <ng-template appCol="uploadePar" let-d>
          {{ d.uploadePar?.firstName }} {{ d.uploadePar?.lastName }}
        </ng-template>

        <ng-template appCol="date" let-d>
          {{ d.createdAt | localDate:'dd/MM/yyyy' }}
        </ng-template>

        <ng-template appCol="actions" let-d>
          <button mat-icon-button color="primary" (click)="download(d)" matTooltip="Télécharger">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="delete(d)" matTooltip="Supprimer">
            <mat-icon>delete</mat-icon>
          </button>
        </ng-template>

      </app-data-table>

      @if (documents.length === 0 && !uploading) {
        <div class="empty-state">
          <mat-icon>cloud_upload</mat-icon>
          <p>Aucun document. Importez votre premier fichier.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .tab-content { padding: 24px; }
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h3 { margin: 0; font-size: 15px; font-weight: 600; color: #1e293b; }

    .upload-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: #1565C0; color: white; padding: 8px 20px;
      border-radius: 20px; cursor: pointer; font-size: 13px; font-weight: 600;
      transition: background .15s;
    }
    .upload-btn:hover { background: #0D47A1; }

    /* --- Panneau de qualification --- */
    .meta-panel {
      background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 12px;
      padding: 16px 20px; margin-bottom: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .meta-panel__file {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600; color: #1e40af;
    }
    .meta-panel__file mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .meta-panel__filename {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 500px;
    }

    .meta-type-ff { width: 100%; }

    .meta-period-row { display: flex; gap: 12px; }
    .meta-mois-ff      { flex: 2; min-width: 180px; }
    .meta-annee-ff     { flex: 1; min-width: 120px; }
    .meta-annee-only-ff { width: 160px; }

    .meta-panel__actions {
      display: flex; gap: 8px; justify-content: flex-end;
    }

    /* --- Badges type dans le tableau --- */
    .doc-badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600;
    }
    .doc-badge--achat { background: #fef3c7; color: #92400e; }
    .doc-badge--vente { background: #dcfce7; color: #166534; }
    .doc-badge--autre { background: #f1f5f9; color: #475569; }
    .doc-badge--nc    { color: #94a3b8; }
    .doc-period { margin-left: 6px; font-size: 11px; color: #64748b; }

    .file-cell { display: flex; align-items: center; gap: 8px; }
    .file-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; flex-shrink: 0; }
    .empty-state { text-align: center; padding: 48px; color: #94a3b8; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
    app-data-table { display: block; margin-top: 8px; }
  `],
})
export class DocumentsTabComponent implements OnInit {
  @Input() clientId!: number;

  @Input() set typesFluxActifs(val: TypeFlux[] | undefined) {
    // Toujours Non classé + types actifs de la fiche identité + Factures (balance) + Autre
    const actifs = val ?? [];
    this.typeDocOptions = [
      { value: '', label: '— Non classé —', periodicite: 'none' },
      ...TYPE_DOC_OPTIONS.filter(o =>
        o.value === 'FACTURE_ACHAT' ||
        o.value === 'FACTURE_VENTE' ||
        actifs.includes(o.value as TypeFlux)
      ).filter(o => o.value !== '' && o.value !== 'AUTRE'),
      { value: 'AUTRE', label: 'Autre', periodicite: 'none' },
    ];
  }

  documents: ClientDocument[] = [];
  uploading = false;

  pendingFile = signal<File | null>(null);
  metaTypeDoc = '';
  metaMois: number | null = null;
  metaAnnee = new Date().getFullYear();

  readonly moisLabels = MOIS_LABELS;
  typeDocOptions: TypeDocDef[] = TYPE_DOC_OPTIONS; // remplacé par le setter
  readonly trimestreLabels = TRIMESTRE_LABELS;

  periodeModeOf(typeDoc: string): 'monthly' | 'quarterly' | 'annual' | 'none' {
    return TYPE_DOC_OPTIONS.find(o => o.value === typeDoc)?.periodicite ?? 'none';
  }

  readonly colonnes: ColumnDef[] = [
    { key: 'nom',        label: 'Fichier' },
    { key: 'type',       label: 'Type / Période' },
    { key: 'taille',     label: 'Taille' },
    { key: 'uploadePar', label: 'Importé par' },
    { key: 'date',       label: 'Date' },
    { key: 'actions',    label: '' },
  ];

  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  constructor(private service: DocumentsService) {}
  ngOnInit() { this.load(); }
  load() { this.service.getAll(this.clientId).subscribe((d) => (this.documents = d)); }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    this.metaTypeDoc = '';
    this.metaMois    = null;
    this.metaAnnee   = new Date().getFullYear();
    this.pendingFile.set(file);
  }

  cancelUpload() { this.pendingFile.set(null); }

  confirmUpload() {
    const file = this.pendingFile();
    if (!file) return;
    const meta: { typeDoc?: string; periodeMois?: number; periodeAnnee?: number } = {};
    if (this.metaTypeDoc) meta.typeDoc = this.metaTypeDoc;
    const mode = this.periodeModeOf(this.metaTypeDoc);
    if (mode === 'monthly' || mode === 'quarterly') {
      if (this.metaMois !== null) {
        meta.periodeMois  = this.metaMois;
        meta.periodeAnnee = this.metaAnnee;
      }
    } else if (mode === 'annual') {
      meta.periodeAnnee = this.metaAnnee;
    }
    this.uploading = true;
    this.pendingFile.set(null);
    this.service.upload(this.clientId, file, meta).subscribe({
      next:  () => { this.load(); this.uploading = false; this.toast.success('Fichier importé'); },
      error: () => { this.uploading = false; this.toast.error('Erreur lors de l\'import'); },
    });
  }

  download(doc: ClientDocument) {
    this.service.download(this.clientId, doc.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.nom; a.click();
      URL.revokeObjectURL(url);
    });
  }

  delete(doc: ClientDocument) {
    this.confirm.confirm(`Supprimer "${doc.nom}" ?`).subscribe(ok => {
      if (!ok) return;
      this.service.delete(this.clientId, doc.id).subscribe(() => {
        this.load();
        this.toast.success('Document supprimé');
      });
    });
  }

  formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }
}
