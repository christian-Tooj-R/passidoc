import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { DocumentsService } from '../../../../../core/services/documents.service';
import { ClientDocument } from '../../../../../core/models/client.model';
import { LocalDatePipe } from '../../../../../core/pipes/local-date.pipe';
import { DataTableComponent, ColDirective, ColumnDef } from '../../../../../shared/data-table/data-table.component';

@Component({
  selector: 'app-documents-tab',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressBarModule,
    LocalDatePipe, DataTableComponent, ColDirective],
  template: `
    <div class="tab-content">
      <div class="tab-header">
        <h3>Documents</h3>
        <label class="upload-btn">
          <mat-icon>upload</mat-icon> Uploader un fichier
          <input type="file" hidden (change)="upload($event)" />
        </label>
      </div>

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
          <p>Aucun document. Uploadez votre premier fichier.</p>
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
    .file-cell { display: flex; align-items: center; gap: 8px; }
    .file-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; flex-shrink: 0; }
    .empty-state { text-align: center; padding: 48px; color: #94a3b8; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
    app-data-table { display: block; margin-top: 8px; }
  `],
})
export class DocumentsTabComponent implements OnInit {
  @Input() clientId!: number;
  documents: ClientDocument[] = [];
  uploading = false;

  readonly colonnes: ColumnDef[] = [
    { key: 'nom',        label: 'Fichier' },
    { key: 'taille',     label: 'Taille' },
    { key: 'uploadePar', label: 'Uploadé par' },
    { key: 'date',       label: 'Date' },
    { key: 'actions',    label: '' },
  ];

  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  constructor(private service: DocumentsService) {}
  ngOnInit() { this.load(); }
  load() { this.service.getAll(this.clientId).subscribe((d) => (this.documents = d)); }

  upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.service.upload(this.clientId, file).subscribe({
      next: () => { this.load(); this.uploading = false; this.toast.success('Fichier uploadé'); },
      error: () => { this.uploading = false; this.toast.error('Erreur upload'); },
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
