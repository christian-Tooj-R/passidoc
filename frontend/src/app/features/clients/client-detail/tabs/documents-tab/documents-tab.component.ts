import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../../../core/services/toast.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DocumentsService } from '../../../../../core/services/documents.service';
import { ClientDocument } from '../../../../../core/models/client.model';
import { LocalDatePipe } from '../../../../../core/pipes/local-date.pipe';

@Component({
  selector: 'app-documents-tab',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule, LocalDatePipe],
  template: `
    <div class="tab-content">
      <div class="tab-header">
        <h3>Documents</h3>
        <label class="upload-btn mat-flat-button">
          <mat-icon>upload</mat-icon> Uploader un fichier
          <input type="file" hidden (change)="upload($event)" />
        </label>
      </div>

      @if (uploading) {
        <mat-progress-bar mode="indeterminate" />
      }

      <table mat-table [dataSource]="documents" class="full-width">
        <ng-container matColumnDef="nom">
          <th mat-header-cell *matHeaderCellDef>Fichier</th>
          <td mat-cell *matCellDef="let d">
            <mat-icon class="file-icon">insert_drive_file</mat-icon>
            {{ d.nom }}
          </td>
        </ng-container>
        <ng-container matColumnDef="taille">
          <th mat-header-cell *matHeaderCellDef>Taille</th>
          <td mat-cell *matCellDef="let d">{{ formatSize(d.taille) }}</td>
        </ng-container>
        <ng-container matColumnDef="uploadePar">
          <th mat-header-cell *matHeaderCellDef>Uploadé par</th>
          <td mat-cell *matCellDef="let d">
            {{ d.uploadePar?.firstName }} {{ d.uploadePar?.lastName }}
          </td>
        </ng-container>
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let d">{{ d.createdAt | localDate:'dd/MM/yyyy' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let d">
            <button mat-icon-button color="primary" (click)="download(d)" matTooltip="Télécharger">
              <mat-icon>download</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="delete(d)" matTooltip="Supprimer">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>

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
    .tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .upload-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: #2563eb; color: white; padding: 8px 16px;
      border-radius: 4px; cursor: pointer; font-size: 14px;
    }
    .full-width { width: 100%; }
    .file-icon { vertical-align: middle; font-size: 18px; color: #64748b; }
    .empty-state { text-align: center; padding: 48px; color: #94a3b8; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `],
})
export class DocumentsTabComponent implements OnInit {
  @Input() clientId!: number;
  documents: ClientDocument[] = [];
  columns = ['nom', 'taille', 'uploadePar', 'date', 'actions'];
  uploading = false;

  private toast = inject(ToastService);
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
    this.service.delete(this.clientId, doc.id).subscribe(() => {
      this.load();
      this.toast.success('Document supprimé');
    });
  }

  formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }
}
