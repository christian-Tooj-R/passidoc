import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EspacesService, Espace, EspaceDoc } from '../../core/services/espaces.service';
import { EspacesCreateDialogComponent } from './espaces-create-dialog.component';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatTooltipModule, MatButtonModule, MatRippleModule, MatSnackBarModule, MatDialogModule,
  ],
  template: `
<div class="page">

  <!-- ══ VUE LISTE DES ESPACES ════════════════════════════════ -->
  @if (!espaceOuvert()) {

    <div class="page-header">
      <div class="page-header__left">
        <div class="page-icon"><mat-icon>folder_open</mat-icon></div>
        <div>
          <h1 class="page-title">Mes documents</h1>
          <p class="page-sub">
            {{ espaces().length }} espace{{ espaces().length > 1 ? 's' : '' }}
            · {{ totalDocs() }} document{{ totalDocs() > 1 ? 's' : '' }}
            · {{ fmtSize(totalSize()) }} total
          </p>
        </div>
      </div>
      <button class="btn-new" matRipple (click)="ouvrirCreation()">
        <mat-icon>add</mat-icon>
        Nouvel espace
      </button>
    </div>

    @if (loading()) {
      <div class="spaces-grid">
        @for (i of [1,2,3]; track i) {
          <div class="space-card space-card--skel"></div>
        }
      </div>
    }

    @else if (espaces().length === 0) {
      <div class="empty-state">
        <div class="empty-icon"><mat-icon>folder_open</mat-icon></div>
        <h3>Aucun espace</h3>
        <p>Créez un espace pour organiser et stocker vos documents.</p>
        <button class="btn-new btn-new--lg" matRipple (click)="ouvrirCreation()">
          <mat-icon>add</mat-icon>
          Créer mon premier espace
        </button>
      </div>
    }

    @else {
      <div class="spaces-grid">
        @for (esp of espaces(); track esp.id) {
          <div class="space-card" (click)="ouvrirEspace(esp)">

            <!-- Cover gradient -->
            <div class="space-card__cover" [style.background]="gradient(esp)">
              <div class="sc-initials">{{ initiales(esp.nom) }}</div>
              <span class="sc-name">{{ esp.nom }}</span>

              <!-- Bouton ouvrir overlay -->
              @if (confirmerSuppr() !== esp.id && paletteOuvertId() !== esp.id) {
                <div class="sc-open">
                  <span>Ouvrir</span>
                  <mat-icon>arrow_forward</mat-icon>
                </div>
              }

              <!-- Actions top-right -->
              <div class="sc-actions" (click)="$event.stopPropagation()">
                <button class="sc-action-btn"
                        matTooltip="Changer la couleur"
                        (click)="togglePalette(esp.id)">
                  <mat-icon>palette</mat-icon>
                </button>
                <button class="sc-action-btn sc-action-btn--del"
                        matTooltip="Supprimer l'espace"
                        (click)="demanderSuppression(esp.id)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>

            <!-- Palette couleur -->
            @if (paletteOuvertId() === esp.id) {
              <div class="palette-panel" (click)="$event.stopPropagation()">
                <div class="palette-row">
                  @for (p of PALETTES; track p.val) {
                    <button class="palette-swatch"
                            [class.palette-swatch--active]="gradient(esp) === p.val"
                            [style.background]="p.val"
                            [title]="p.label"
                            (click)="appliquerCouleur(esp, p.val)">
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Confirmation suppression -->
            @else if (confirmerSuppr() === esp.id) {
              <div class="space-confirm" (click)="$event.stopPropagation()">
                <span>Supprimer cet espace et ses {{ esp.documents.length }} document(s) ?</span>
                <div class="space-confirm__btns">
                  <button class="confirm-btn confirm-btn--danger" (click)="supprimerEspace(esp.id)">Supprimer</button>
                  <button class="confirm-btn confirm-btn--cancel" (click)="confirmerSuppr.set(null)">Annuler</button>
                </div>
              </div>
            }

            <!-- Body -->
            <div class="space-card__body">
              <div class="sc-stats">
                <span class="sc-stat-count">{{ esp.documents.length }} doc{{ esp.documents.length > 1 ? 's' : '' }}</span>
                <span class="sc-stat-size">{{ docsSize(esp) }}</span>
              </div>
              <div class="sc-type-dots">
                @if (countType(esp, 'pdf') > 0) {
                  <span class="sc-dot sc-dot--pdf" [title]="'PDF (' + countType(esp, 'pdf') + ')'"></span>
                }
                @if (countType(esp, 'excel') > 0) {
                  <span class="sc-dot sc-dot--excel" [title]="'Excel (' + countType(esp, 'excel') + ')'"></span>
                }
                @if (countType(esp, 'word') > 0) {
                  <span class="sc-dot sc-dot--word" [title]="'Word (' + countType(esp, 'word') + ')'"></span>
                }
                @if (countType(esp, 'image') > 0) {
                  <span class="sc-dot sc-dot--image" [title]="'Images (' + countType(esp, 'image') + ')'"></span>
                }
                @if (countType(esp, 'other') > 0) {
                  <span class="sc-dot sc-dot--other" [title]="'Autres (' + countType(esp, 'other') + ')'"></span>
                }
              </div>
            </div>

          </div>
        }
      </div>
    }
  }

  <!-- ══ VUE ESPACE OUVERT ═════════════════════════════════════ -->
  @if (espaceOuvert()) {

    <!-- Toolbar compacte -->
    <div class="fm-toolbar">
      <button class="back-btn" matRipple (click)="fermerEspace()">
        <mat-icon>arrow_back</mat-icon>
        Mes documents
      </button>
      <div class="fm-toolbar__space">
        <div class="space-view-avatar" [style.background]="gradient(espaceOuvert()!)">
          {{ initiales(espaceOuvert()!.nom) }}
        </div>
        <div class="fm-toolbar__info">
          <span class="fm-space-name">{{ espaceOuvert()!.nom }}</span>
          <span class="fm-space-meta">
            {{ docsEspace().length }} doc{{ docsEspace().length > 1 ? 's' : '' }}
            @if (docsEspace().length > 0) { · {{ fmtSize(docsEspace().reduce((s, d) => s + (d.taille || 0), 0)) }} }
          </span>
        </div>
      </div>
      <div class="fm-toolbar__controls">
        <div class="fm-search">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Rechercher…"
                 [value]="search()"
                 (input)="search.set($any($event.target).value)" />
        </div>
        <div class="fm-view-toggle">
          <button class="fm-view-btn" [class.fm-view-btn--active]="viewMode() === 'list'"
                  matTooltip="Vue liste" (click)="viewMode.set('list')">
            <mat-icon>view_list</mat-icon>
          </button>
          <button class="fm-view-btn" [class.fm-view-btn--active]="viewMode() === 'grid'"
                  matTooltip="Vue grille" (click)="viewMode.set('grid')">
            <mat-icon>grid_view</mat-icon>
          </button>
        </div>
        <label class="btn-new btn-new--sm" matRipple [class.btn-new--loading]="uploading()">
          <mat-icon>{{ uploading() ? 'hourglass_empty' : 'upload_file' }}</mat-icon>
          {{ uploading() ? 'Envoi…' : 'Ajouter' }}
          <input type="file" multiple hidden
                 [disabled]="uploading()"
                 (change)="onFilesSelected($event)" />
        </label>
      </div>
    </div>

    <!-- Drop zone -->
    <div class="drop-zone"
         [class.drop-zone--active]="dragOver()"
         (dragover)="$event.preventDefault(); dragOver.set(true)"
         (dragleave)="dragOver.set(false)"
         (drop)="onDrop($event)">
      <mat-icon>cloud_upload</mat-icon>
      <span>Glissez vos fichiers ici</span>
    </div>

    <!-- Chargement docs -->
    @if (loadingDocs()) {
      @if (viewMode() === 'list') {
        <div class="fm-list">
          <div class="fm-header">
            <span class="fmh-name">Nom</span>
            <span class="fmh-type">Type</span>
            <span class="fmh-size">Taille</span>
            <span class="fmh-date">Date</span>
            <span class="fmh-actions"></span>
          </div>
          @for (i of [1,2,3]; track i) {
            <div class="fm-row fm-row--skel"></div>
          }
        </div>
      } @else {
        <div class="fm-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="fm-card fm-card--skel"></div>
          }
        </div>
      }
    }

    <!-- Vide -->
    @else if (docsEspace().length === 0) {
      <div class="empty-state empty-state--docs">
        <div class="empty-icon empty-icon--sm"><mat-icon>upload_file</mat-icon></div>
        <h3>Espace vide</h3>
        <p>Ajoutez vos premiers documents via le bouton ou par glisser-déposer.</p>
      </div>
    }

    <!-- Aucun résultat de recherche -->
    @else if (docsFiltered().length === 0) {
      <div class="empty-state empty-state--docs">
        <div class="empty-icon empty-icon--sm"><mat-icon>search_off</mat-icon></div>
        <h3>Aucun résultat</h3>
        <p>Aucun document ne correspond à « {{ search() }} ».</p>
      </div>
    }

    <!-- Vue liste -->
    @else if (viewMode() === 'list') {
      <div class="fm-list">
        <div class="fm-header">
          <span class="fmh-name">Nom</span>
          <span class="fmh-type">Type</span>
          <span class="fmh-size">Taille</span>
          <span class="fmh-date">Date</span>
          <span class="fmh-actions"></span>
        </div>
        @for (doc of docsFiltered(); track doc.id) {
          <div class="fm-row">
            <div class="fm-row__icon doc-icon-wrap" [class]="'di-' + ext(doc.nom)">
              <mat-icon>{{ docIcon(doc.nom) }}</mat-icon>
            </div>
            <div class="fm-row__info">
              <span class="doc-name">{{ doc.nom }}</span>
              <span class="doc-meta">{{ fmtSize(doc.taille) }} · {{ fmtDate(doc.createdAt) }}</span>
            </div>
            <div class="fm-row__type">
              <span class="doc-badge" [class]="'badge-' + ext(doc.nom)">{{ typeLabel(doc.nom) }}</span>
            </div>
            <div class="fm-row__size">{{ fmtSize(doc.taille) }}</div>
            <div class="fm-row__date">{{ fmtDate(doc.createdAt) }}</div>
            <div class="fm-row__actions">
              <button class="doc-btn" matTooltip="Télécharger" (click)="downloadDoc(doc)">
                <mat-icon>download</mat-icon>
              </button>
              <button class="doc-btn doc-btn--danger" matTooltip="Supprimer" (click)="supprimerDoc(doc)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        }
      </div>
    }

    <!-- Vue grille -->
    @else {
      <div class="fm-grid">
        @for (doc of docsFiltered(); track doc.id) {
          <div class="fm-card">
            <div class="fm-card__icon doc-icon-wrap doc-icon-wrap--lg" [class]="'di-' + ext(doc.nom)">
              <mat-icon>{{ docIcon(doc.nom) }}</mat-icon>
            </div>
            <span class="fm-card__name">{{ doc.nom }}</span>
            <span class="fm-card__size">{{ fmtSize(doc.taille) }}</span>
            <span class="fm-card__date">{{ fmtDate(doc.createdAt) }}</span>
            <div class="fm-card__overlay">
              <button class="doc-btn" matTooltip="Télécharger" (click)="downloadDoc(doc)">
                <mat-icon>download</mat-icon>
              </button>
              <button class="doc-btn doc-btn--danger" matTooltip="Supprimer" (click)="supprimerDoc(doc)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        }
      </div>
    }
  }

</div>
  `,
  styles: [`.page { padding: 32px 36px; }`],
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit {

  espaces         = signal<Espace[]>([]);
  espaceOuvert    = signal<Espace | null>(null);
  docsEspace      = signal<EspaceDoc[]>([]);
  loading         = signal(true);
  loadingDocs     = signal(false);
  uploading       = signal(false);
  confirmerSuppr  = signal<number | null>(null);
  paletteOuvertId = signal<number | null>(null);
  dragOver        = signal(false);
  search          = signal('');
  viewMode        = signal<'list' | 'grid'>('list');

  docsFiltered = computed(() =>
    this.docsEspace().filter(d => d.nom.toLowerCase().includes(this.search().toLowerCase()))
  );

  totalSize = computed(() =>
    this.espaces().reduce((s, e) => s + e.documents.reduce((ss, d) => ss + (d.taille || 0), 0), 0)
  );

  totalDocs = computed(() =>
    this.espaces().reduce((s, e) => s + e.documents.length, 0)
  );

  readonly PALETTES = [
    { label: 'Océan',   val: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)' },
    { label: 'Violet',  val: 'linear-gradient(135deg, #6A1B9A 0%, #AB47BC 100%)' },
    { label: 'Teal',    val: 'linear-gradient(135deg, #00695C 0%, #26A69A 100%)' },
    { label: 'Ambre',   val: 'linear-gradient(135deg, #E65100 0%, #FFA726 100%)' },
    { label: 'Forêt',   val: 'linear-gradient(135deg, #1B5E20 0%, #66BB6A 100%)' },
    { label: 'Rose',    val: 'linear-gradient(135deg, #880E4F 0%, #EC407A 100%)' },
    { label: 'Rouge',   val: 'linear-gradient(135deg, #B71C1C 0%, #EF5350 100%)' },
    { label: 'Indigo',  val: 'linear-gradient(135deg, #4527A0 0%, #7E57C2 100%)' },
    { label: 'Ardoise', val: 'linear-gradient(135deg, #455A64 0%, #90A4AE 100%)' },
    { label: 'Lime',    val: 'linear-gradient(135deg, #558B2F 0%, #AED581 100%)' },
    { label: 'Corail',  val: 'linear-gradient(135deg, #BF360C 0%, #FF8A65 100%)' },
    { label: 'Marine',  val: 'linear-gradient(135deg, #006064 0%, #26C6DA 100%)' },
  ];

  constructor(
    private svc: EspacesService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() { this.charger(); }

  charger() {
    this.loading.set(true);
    this.svc.getMesEspaces().subscribe({
      next: data => { this.espaces.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  ouvrirCreation() {
    const ref = this.dialog.open(EspacesCreateDialogComponent, {
      width: '440px',
      panelClass: 'aro-create-dialog',
      autoFocus: true,
    });
    ref.afterClosed().subscribe((result: { nom: string; couleur: string } | null) => {
      if (!result) return;
      this.svc.creer(result.nom, result.couleur).subscribe({
        next: e => {
          this.espaces.set([{ ...e, documents: [] }, ...this.espaces()]);
          this.snack.open(`Espace "${e.nom}" créé`, undefined, { duration: 2500 });
        },
        error: () => this.snack.open('Erreur lors de la création', undefined, { duration: 3000 }),
      });
    });
  }

  demanderSuppression(id: number) {
    this.confirmerSuppr.set(id);
    this.paletteOuvertId.set(null);
  }

  supprimerEspace(id: number) {
    this.svc.supprimer(id).subscribe({
      next: () => {
        this.espaces.set(this.espaces().filter(e => e.id !== id));
        this.confirmerSuppr.set(null);
        this.snack.open('Espace supprimé', undefined, { duration: 2500 });
      },
      error: () => this.snack.open('Erreur lors de la suppression', undefined, { duration: 3000 }),
    });
  }

  togglePalette(id: number) {
    this.paletteOuvertId.set(this.paletteOuvertId() === id ? null : id);
    this.confirmerSuppr.set(null);
  }

  appliquerCouleur(esp: Espace, couleur: string) {
    this.svc.changerCouleur(esp.id, couleur).subscribe({
      next: updated => {
        this.espaces.set(this.espaces().map(e => e.id === esp.id ? { ...e, couleur: updated.couleur } : e));
        this.paletteOuvertId.set(null);
      },
      error: () => this.snack.open('Erreur lors du changement de couleur', undefined, { duration: 3000 }),
    });
  }

  ouvrirEspace(espace: Espace) {
    this.paletteOuvertId.set(null);
    this.search.set('');
    this.espaceOuvert.set(espace);
    this.loadingDocs.set(true);
    this.svc.getDocs(espace.id).subscribe({
      next: docs => { this.docsEspace.set(docs); this.loadingDocs.set(false); },
      error: () => { this.loadingDocs.set(false); },
    });
  }

  fermerEspace() {
    this.espaceOuvert.set(null);
    this.docsEspace.set([]);
    this.search.set('');
    this.charger();
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.uploadFiles(Array.from(input.files));
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.uploadFiles(files);
  }

  private uploadFiles(files: File[]) {
    const espace = this.espaceOuvert();
    if (!espace) return;
    this.uploading.set(true);
    let done = 0;
    for (const file of files) {
      this.svc.upload(espace.id, file).subscribe({
        next: doc => {
          this.docsEspace.set([doc, ...this.docsEspace()]);
          done++;
          if (done === files.length) this.uploading.set(false);
        },
        error: () => {
          done++;
          this.snack.open(`Erreur upload : ${file.name}`, undefined, { duration: 3000 });
          if (done === files.length) this.uploading.set(false);
        },
      });
    }
  }

  downloadDoc(doc: EspaceDoc) {
    const espace = this.espaceOuvert();
    if (!espace) return;
    this.svc.download(espace.id, doc.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.nom; a.click();
      URL.revokeObjectURL(url);
    });
  }

  supprimerDoc(doc: EspaceDoc) {
    const espace = this.espaceOuvert();
    if (!espace) return;
    this.svc.supprimerDoc(espace.id, doc.id).subscribe({
      next: () => {
        this.docsEspace.set(this.docsEspace().filter(d => d.id !== doc.id));
        this.snack.open('Document supprimé', undefined, { duration: 2000 });
      },
      error: () => this.snack.open('Erreur lors de la suppression', undefined, { duration: 3000 }),
    });
  }

  gradient(esp: Espace) {
    return esp.couleur || this.PALETTES[esp.id % this.PALETTES.length].val;
  }

  initiales(nom: string) {
    return nom.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  }

  ext(nom: string) { return nom?.split('.').pop()?.toLowerCase() || 'file'; }

  docIcon(nom: string) {
    const e = this.ext(nom);
    if (e === 'pdf') return 'picture_as_pdf';
    if (['xls','xlsx'].includes(e)) return 'table_chart';
    if (['doc','docx'].includes(e)) return 'description';
    if (['jpg','jpeg','png','gif','webp'].includes(e)) return 'image';
    return 'insert_drive_file';
  }

  typeLabel(nom: string) {
    const e = this.ext(nom);
    if (e === 'pdf') return 'PDF';
    if (['xls','xlsx'].includes(e)) return 'Excel';
    if (['doc','docx'].includes(e)) return 'Word';
    if (['jpg','jpeg','png','gif','webp'].includes(e)) return 'Image';
    return e.toUpperCase();
  }

  fmtSize(bytes: number) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  fmtDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  docsSize(esp: Espace): string {
    const total = esp.documents.reduce((s, d) => s + (d.taille || 0), 0);
    return this.fmtSize(total);
  }

  countType(esp: Espace, type: string): number {
    return esp.documents.filter(d => {
      const e = this.ext(d.nom);
      if (type === 'pdf')   return e === 'pdf';
      if (type === 'excel') return ['xls','xlsx'].includes(e);
      if (type === 'word')  return ['doc','docx'].includes(e);
      if (type === 'image') return ['jpg','jpeg','png','gif','webp'].includes(e);
      if (type === 'other') return !['pdf','xls','xlsx','doc','docx','jpg','jpeg','png','gif','webp'].includes(e);
      return false;
    }).length;
  }
}
