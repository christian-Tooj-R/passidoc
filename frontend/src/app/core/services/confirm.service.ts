import { Injectable, inject, Component } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="cd-wrap">
      <div class="cd-icon">
        <mat-icon>delete_outline</mat-icon>
      </div>
      <h3 class="cd-title">{{ data.title ?? 'Confirmer la suppression' }}</h3>
      <p class="cd-msg">{{ data.message ?? 'Cette action est irréversible. Voulez-vous vraiment supprimer cet élément ?' }}</p>
      <div class="cd-actions">
        <button class="cd-btn-cancel" (click)="ref.close(false)">Annuler</button>
        <button class="cd-btn-confirm" (click)="ref.close(true)">
          <mat-icon>delete</mat-icon> Supprimer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cd-wrap {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 28px 28px 22px; width: 360px;
    }
    .cd-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #fee2e2, #fecaca);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(239,68,68,.20);
    }
    .cd-icon mat-icon { color: #dc2626; font-size: 26px; width: 26px; height: 26px; }
    .cd-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    .cd-msg { font-size: 13.5px; color: #6b7280; line-height: 1.6; margin: 0 0 24px; }
    .cd-actions { display: flex; gap: 10px; width: 100%; }
    .cd-btn-cancel {
      flex: 1; padding: 9px; border-radius: 9px; border: 1.5px solid #e5e7eb;
      background: white; font-size: 13.5px; font-weight: 600; color: #374151;
      cursor: pointer; transition: background .12s;
    }
    .cd-btn-cancel:hover { background: #f9fafb; }
    .cd-btn-confirm {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
      padding: 9px; border-radius: 9px; border: none;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white; font-size: 13.5px; font-weight: 600; cursor: pointer;
      box-shadow: 0 2px 8px rgba(220,38,38,.30);
      transition: transform .12s, box-shadow .12s;
    }
    .cd-btn-confirm:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(220,38,38,.40); }
    .cd-btn-confirm mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class ConfirmDialogComponent {
  ref = inject(MatDialogRef<ConfirmDialogComponent>);
  data: { title?: string; message?: string } = inject(MAT_DIALOG_DATA);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  confirm(title?: string, message?: string): Observable<boolean> {
    return this.dialog.open(ConfirmDialogComponent, {
      data: { title, message },
      width: '400px',
      maxWidth: '96vw',
      panelClass: 'confirm-dialog-panel',
    }).afterClosed() as Observable<boolean>;
  }
}
