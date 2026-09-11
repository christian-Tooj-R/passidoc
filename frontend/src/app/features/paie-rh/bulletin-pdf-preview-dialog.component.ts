import { Component, ElementRef, Inject, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface BulletinPdfPreviewData {
  /** PDF déjà téléchargé (via le même endpoint que "Télécharger le PDF", `responseType: 'blob'`) —
   *  ce dialogue ne fait AUCUN appel réseau lui-même, il se contente d'afficher le blob reçu. */
  blob: Blob;
  /** Titre affiché dans l'en-tête du dialogue (ex: "Bulletin — Août 2026"). */
  titre: string;
}

/**
 * "Visualiser" un bulletin de salaire déjà généré : affiche le PDF dans un `<iframe>` via
 * une URL blob (SANS déclencher de téléchargement, à la différence du bouton "Télécharger
 * le PDF" existant, conservé partout où il l'était déjà) + un bouton "Imprimer" qui imprime
 * le contenu de l'iframe. Voir Doc/MODULE_PAIE_RH_NOTES.md, section "Visualiser + Imprimer".
 */
@Component({
  selector: 'app-bulletin-pdf-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<div class="bpp-wrap">
  <div class="bpp-header">
    <mat-icon>visibility</mat-icon>
    <h2>{{ data.titre }}</h2>
    <div class="bpp-spacer"></div>
    <button
      mat-flat-button color="primary"
      matTooltip="Imprimer ce bulletin"
      aria-label="Imprimer ce bulletin"
      [disabled]="!loaded()"
      (click)="imprimer()"
    >
      <mat-icon>print</mat-icon> Imprimer
    </button>
    <button mat-icon-button matTooltip="Fermer" aria-label="Fermer la prévisualisation" (click)="fermer()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <div class="bpp-body">
    @if (!loaded()) {
      <div class="bpp-loading"><div class="spinner"></div><span>Chargement du PDF…</span></div>
    }
    <iframe
      #pdfFrame
      class="bpp-iframe"
      [class.bpp-iframe--loaded]="loaded()"
      [src]="pdfUrl"
      title="Aperçu du bulletin de salaire"
      (load)="onLoaded()"
    ></iframe>
  </div>
</div>
  `,
  styles: [`
    .bpp-wrap { display: flex; flex-direction: column; height: 100%; background: #fff; }
    .bpp-header {
      display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #E2E8F0;
      mat-icon:first-child { color: #7C3AED; }
      h2 { font-size: 15px; font-weight: 700; color: #1E293B; margin: 0; }
    }
    .bpp-spacer { flex: 1; }
    .bpp-body { position: relative; flex: 1; min-height: 0; background: #F1F5F9; }
    .bpp-iframe { width: 100%; height: 100%; border: none; opacity: 0; transition: opacity .15s ease; }
    .bpp-iframe--loaded { opacity: 1; }
    .bpp-loading {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      gap: 8px; color: #64748B; font-size: 13px;
    }
    .spinner { width: 18px; height: 18px; border: 2px solid #E2E8F0; border-top-color: #7C3AED; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class BulletinPdfPreviewDialogComponent {
  @ViewChild('pdfFrame') pdfFrame?: ElementRef<HTMLIFrameElement>;

  private objectUrl: string;
  pdfUrl: SafeResourceUrl;
  loaded = signal(false);

  constructor(
    private dialogRef: MatDialogRef<BulletinPdfPreviewDialogComponent>,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: BulletinPdfPreviewData,
  ) {
    this.objectUrl = URL.createObjectURL(data.blob);
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
  }

  onLoaded() {
    this.loaded.set(true);
  }

  imprimer() {
    const win = this.pdfFrame?.nativeElement.contentWindow;
    if (!win) return;
    try {
      win.focus();
      win.print();
    } catch {
      // best-effort : certains navigateurs restreignent print() sur un contenu cross-origin —
      // sans objet ici (blob same-origin), gardé par sécurité pour ne jamais planter le dialogue.
    }
  }

  fermer() {
    this.dialogRef.close();
  }

  ngOnDestroy() {
    URL.revokeObjectURL(this.objectUrl);
  }
}
