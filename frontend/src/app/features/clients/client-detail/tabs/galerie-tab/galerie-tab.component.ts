import { Component, Input, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClientsService } from '../../../../../core/services/clients.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-galerie-tab',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="gal-page">
      <!-- Header avec compteur + bouton upload -->
      <div class="gal-header">
        <div class="gal-title">
          <mat-icon>photo_library</mat-icon>
          <h2>Galerie photos</h2>
          @if (photos().length > 0) {
            <span class="gal-count">{{ photos().length }} photo{{ photos().length > 1 ? 's' : '' }}</span>
          }
        </div>
      </div>

      <!-- Input fichier toujours dans le DOM -->
      <input #fileInput type="file" accept="image/*" multiple hidden (change)="onFilesSelected($event)" />

      <!-- Grille — photos + case + en fin de liste (ou seule case si vide) -->
      <div class="gal-grid">
        @for (url of photos(); track url; let i = $index) {
          <div class="gal-item" (click)="openLightbox(i)">
            <img [src]="photoSrc(url)" alt="Photo" loading="lazy" />
            <div class="gal-item-overlay">
              @if (!readonly) {
                <button class="gal-del-btn" (click)="deletePhoto(url, $event)" matTooltip="Supprimer">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              }
            </div>
          </div>
        }
        <!-- Case + en dernier (ou seul si vide) -->
        @if (!readonly) {
          <div class="gal-add-tile" (click)="fileInput.click()" [class.gal-add-tile--loading]="uploading()">
            @if (uploading()) {
              <mat-icon class="gal-add-spin">hourglass_empty</mat-icon>
            } @else {
              <mat-icon>add</mat-icon>
            }
          </div>
        }
      </div>

      <!-- Lightbox -->
      @if (lightboxIndex() !== null) {
        <div class="gal-lightbox" (click)="closeLightbox()" tabindex="0">
          <div class="gal-lb-backdrop"></div>
          <button class="gal-lb-close" (click)="closeLightbox()"><mat-icon>close</mat-icon></button>
          <div class="gal-lb-counter">{{ lightboxIndex()! + 1 }} / {{ photos().length }}</div>
          <button class="gal-lb-nav gal-lb-prev" (click)="lbNav(-1, $event)" [disabled]="lightboxIndex() === 0">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <img class="gal-lb-img" [src]="photoSrc(photos()[lightboxIndex()!])" (click)="$event.stopPropagation()" />
          <button class="gal-lb-nav gal-lb-next" (click)="lbNav(1, $event)" [disabled]="lightboxIndex() === photos().length - 1">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <!-- Bande de miniatures -->
          <div class="gal-lb-strip" (click)="$event.stopPropagation()">
            @for (url of photos(); track url; let i = $index) {
              <img class="gal-lb-thumb" [class.active]="lightboxIndex() === i" [src]="photoSrc(url)" (click)="lightboxIndex.set(i)" />
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .gal-page { padding: 28px 32px; max-width: 1200px; }

    .gal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .gal-title { display: flex; align-items: center; gap: 10px; }
    .gal-title h2 { margin: 0; font-size: 20px; font-weight: 700; color: #1e293b; }
    .gal-title mat-icon { color: #6366f1; font-size: 24px; width: 24px; height: 24px; }
    .gal-count { background: #eef2ff; color: #6366f1; border-radius: 20px; padding: 2px 12px; font-size: 13px; font-weight: 700; }
    /* Case + ajout dans la grille */
    .gal-add-tile {
      aspect-ratio: 1; border-radius: 4px; background: #f1f5f9;
      border: 2px dashed #cbd5e1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .2s;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #94a3b8; transition: color .2s; }
      &:hover { background: #e8f4fd; border-color: #6366f1; mat-icon { color: #6366f1; } }
      &.gal-add-tile--loading { cursor: wait; opacity: .6; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .gal-add-spin { animation: spin 1s linear infinite; }

    .gal-empty { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 0; color: #94a3b8; }
    .gal-empty mat-icon { font-size: 64px; width: 64px; height: 64px; opacity: .2; }
    .gal-empty p { font-size: 16px; margin: 0; }

    .gal-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; max-width: 780px; }
    .gal-item { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 3px; cursor: pointer; background: #f1f5f9; }
    .gal-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .2s; }
    .gal-item:hover img { transform: scale(1.04); }
    .gal-item-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0); transition: background .2s; display: flex; align-items: flex-end; justify-content: flex-end; padding: 8px; }
    .gal-item:hover .gal-item-overlay { background: rgba(0,0,0,.35); }
    .gal-del-btn { opacity: 0; background: rgba(220,38,38,.9); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: opacity .15s; }
    .gal-del-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .gal-item:hover .gal-del-btn { opacity: 1; }

    /* Lightbox */
    .gal-lightbox { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; }
    .gal-lb-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.94); }
    .gal-lb-close { position: absolute; top: 20px; right: 20px; z-index: 2; background: rgba(255,255,255,.12); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; }
    .gal-lb-counter { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,.7); font-size: 13px; z-index: 2; }
    .gal-lb-img { max-width: calc(100vw - 160px); max-height: calc(100vh - 140px); object-fit: contain; z-index: 1; border-radius: 6px; box-shadow: 0 24px 80px rgba(0,0,0,.6); }
    .gal-lb-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; background: rgba(255,255,255,.15); border: none; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: background .15s; }
    .gal-lb-nav:hover:not([disabled]) { background: rgba(255,255,255,.3); }
    .gal-lb-nav[disabled] { opacity: .3; cursor: default; }
    .gal-lb-nav mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .gal-lb-prev { left: 24px; }
    .gal-lb-next { right: 24px; }
    .gal-lb-strip { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 2; display: flex; gap: 6px; padding: 8px; background: rgba(0,0,0,.5); border-radius: 12px; max-width: 80vw; overflow-x: auto; }
    .gal-lb-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; cursor: pointer; opacity: .55; border: 2px solid transparent; transition: all .15s; }
    .gal-lb-thumb.active { opacity: 1; border-color: white; }
    .gal-lb-thumb:hover { opacity: .85; }
  `],
})
export default class GalerieTabComponent implements OnInit {
  @Input() clientId!: number;
  @Input() readonly = false;

  private clientsService = inject(ClientsService);
  private toast = inject(ToastService);

  photos = signal<string[]>([]);
  loading = signal(true);
  uploading = signal(false);
  lightboxIndex = signal<number | null>(null);

  photoSrc(url: string): string {
    if (!url) return '';
    if (url.startsWith('local://')) {
      return `http://localhost:3000/uploads/${url.slice('local://'.length).replace(/\//g, '_')}`;
    }
    if (url.startsWith('http://localhost:3000')) {
      return url;
    }
    // URL MinIO ou autre → passer par le proxy
    return `http://localhost:3000/api/clients/${this.clientId}/fiche/photos/stream?url=${encodeURIComponent(url)}`;
  }

  openLightbox(index: number) { this.lightboxIndex.set(index); }
  closeLightbox() { this.lightboxIndex.set(null); }

  lbNav(delta: number, event: Event) {
    event.stopPropagation();
    const current = this.lightboxIndex();
    if (current === null) return;
    const next = current + delta;
    if (next >= 0 && next < this.photos().length) this.lightboxIndex.set(next);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.lightboxIndex() === null) return;
    if (event.key === 'Escape') this.closeLightbox();
    else if (event.key === 'ArrowLeft') {
      const cur = this.lightboxIndex()!;
      if (cur > 0) this.lightboxIndex.set(cur - 1);
    }
    else if (event.key === 'ArrowRight') {
      const cur = this.lightboxIndex()!;
      if (cur < this.photos().length - 1) this.lightboxIndex.set(cur + 1);
    }
  }

  ngOnInit() {
    this.clientsService.getOne(this.clientId).subscribe({
      next: (client: any) => {
        this.photos.set(client.ficheIdentite?.photos ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilesSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;
    Array.from(files).forEach(file => this.uploadOnePhoto(file));
    (event.target as HTMLInputElement).value = '';
  }

  private uploadOnePhoto(file: File) {
    this.uploading.set(true);
    this.clientsService.uploadFichePhoto(this.clientId, file).subscribe({
      next: (client: any) => {
        this.photos.set(client.ficheIdentite?.photos ?? []);
        this.uploading.set(false);
      },
      error: () => {
        this.uploading.set(false);
        this.toast.error('Erreur lors de l\'upload de la photo');
      },
    });
  }

  deletePhoto(url: string, event: Event) {
    event.stopPropagation();
    this.clientsService.deleteFichePhoto(this.clientId, url).subscribe({
      next: (client: any) => this.photos.set(client.ficheIdentite?.photos ?? []),
      error: () => this.toast.error('Erreur lors de la suppression de la photo'),
    });
  }
}
