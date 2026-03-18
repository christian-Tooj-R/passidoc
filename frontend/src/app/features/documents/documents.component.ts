import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime } from 'rxjs/operators';
import { ClientsService } from '../../core/services/clients.service';
import { DocumentsService } from '../../core/services/documents.service';
import { AuthService } from '../../core/services/auth.service';
import { Client, ClientDocument } from '../../core/models/client.model';

interface ClientSpace {
  client: Client;
  docs: ClientDocument[];
  loading: boolean;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="docs-page">

      <!-- ── Header ──────────────────────────────── -->
      <div class="docs-header">
        <div>
          <h1>Mes documents</h1>
          <p>Gérez et importez les documents de vos dossiers clients</p>
        </div>
        <label class="btn-upload">
          <mat-icon>upload_file</mat-icon>
          Importer un document
          <input type="file" multiple hidden (change)="onFileSelected($event)" />
        </label>
      </div>

      <!-- ── Search bar ──────────────────────────── -->
      <div class="search-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input class="search-input" [formControl]="searchCtrl" placeholder="Rechercher dans les documents..." />
        <span class="search-count">{{ totalDocs }} documents</span>
      </div>

      <!-- ── Loading ─────────────────────────────── -->
      @if (loading()) {
        <div class="loading-row">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="doc-skeleton"></div>
          }
        </div>
      }

      <!-- ── Espaces (par client) ─────────────────── -->
      @if (!loading() && spaces().length > 0) {
        <div class="spaces-section">
          <div class="spaces-header">
            <span class="spaces-label">Mes espaces</span>
            <span class="spaces-sub">Documents organisés par dossier client</span>
          </div>

          <div class="spaces-grid">
            @for (space of filteredSpaces(); track space.client.id) {
              <div class="space-card">
                <div class="space-card__head">
                  <div class="space-avatar">{{ getInitials(space.client.nom) }}</div>
                  <div class="space-info">
                    <div class="space-name">{{ space.client.nom }}</div>
                    <div class="space-site">
                      <span class="site-dot" [class.dot-mg]="space.client.site === 'MADAGASCAR'"></span>
                      {{ space.client.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
                    </div>
                  </div>
                  <span class="space-count">{{ space.docs.length }}</span>
                </div>

                @if (space.loading) {
                  <div class="space-loading">Chargement…</div>
                } @else if (space.docs.length === 0) {
                  <div class="space-empty">
                    <mat-icon>folder_open</mat-icon>
                    Aucun document
                  </div>
                } @else {
                  <div class="space-docs">
                    @for (doc of space.docs.slice(0, 4); track doc.id) {
                      <div class="doc-row" (click)="download(space.client.id, doc)">
                        <span class="doc-icon" [class]="'doc-' + getExt(doc.nom)">
                          <mat-icon>{{ getDocIcon(doc.nom) }}</mat-icon>
                        </span>
                        <span class="doc-name">{{ doc.nom }}</span>
                        <span class="doc-size">{{ formatDate(doc.createdAt) }}</span>
                      </div>
                    }
                    @if (space.docs.length > 4) {
                      <a [routerLink]="['/clients', space.client.id]" [queryParams]="{tab:'documents'}" class="space-more">
                        Voir tous les documents ({{ space.docs.length }}) →
                      </a>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      @if (!loading() && spaces().length === 0) {
        <div class="empty-state">
          <div class="empty-icon"><mat-icon>folder_open</mat-icon></div>
          <h3>Aucun document</h3>
          <p>Les documents importés pour vos dossiers clients apparaîtront ici.</p>
        </div>
      }

    </div>
  `,
  styles: [`
    .docs-page { max-width: 1280px; padding-bottom: 40px; }

    /* Header */
    .docs-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      margin-bottom: 24px;
    }
    .docs-header h1 { font-size: 22px; font-weight: 700; color: #162351; letter-spacing: -.4px; }
    .docs-header p  { font-size: 13.5px; color: #6B7899; margin-top: 4px; }

    .btn-upload {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 10px 24px;
      background: #F43F5E;
      color: #fff;
      border-radius: 20px;
      font-size: 13.5px; font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(244,63,94,.3);
      font-family: 'Inter', sans-serif;
      transition: filter .15s, transform .15s;
    }
    .btn-upload:hover { filter: brightness(1.05); transform: translateY(-1px); }
    .btn-upload mat-icon { font-size: 17px; width: 17px; height: 17px; }

    /* Search */
    .search-bar {
      display: flex; align-items: center; gap: 10px;
      background: #E8EAED;
      border: none;
      border-radius: 28px;
      padding: 10px 20px;
      margin-bottom: 24px;
    }
    .search-icon { font-size: 18px; width: 18px; height: 18px; color: #9BA6C2; }
    .search-input {
      flex: 1; border: none; outline: none;
      font-size: 13.5px; color: #162351;
      font-family: 'Inter', sans-serif;
      background: transparent;
    }
    .search-input::placeholder { color: #9BA6C2; }
    .search-count {
      font-size: 12px; color: #9BA6C2; font-weight: 500;
      white-space: nowrap;
    }

    /* Loading skeletons */
    .loading-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .doc-skeleton {
      height: 180px; border-radius: 12px;
      background: linear-gradient(90deg, #F0F2F8 25%, #E4E7F0 50%, #F0F2F8 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Spaces section */
    .spaces-section { }
    .spaces-header { margin-bottom: 16px; }
    .spaces-label { font-size: 16px; font-weight: 700; color: #162351; display: block; }
    .spaces-sub   { font-size: 12.5px; color: #9BA6C2; margin-top: 3px; display: block; }

    .spaces-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }

    /* Space card */
    .space-card {
      background: #FFFBFE;
      border-radius: 16px;
      border: none;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,.20), 0 2px 4px 1px rgba(0,0,0,.10);
      transition: box-shadow .2s, transform .2s;
    }
    .space-card:hover {
      box-shadow: 0 1px 2px rgba(0,0,0,.20), 0 4px 8px 2px rgba(0,0,0,.10);
      transform: translateY(-2px);
    }

    .space-card__head {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid #F0F2F8;
    }
    .space-avatar {
      width: 36px; height: 36px; flex-shrink: 0; border-radius: 9px;
      background: linear-gradient(135deg, #E6FBF7, #D1FAF2);
      color: #0E9E83; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .space-info { flex: 1; min-width: 0; }
    .space-name { font-size: 13px; font-weight: 600; color: #162351; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .space-site { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #9BA6C2; margin-top: 2px; }
    .site-dot { width: 5px; height: 5px; border-radius: 50%; background: #19D9B4; }
    .site-dot.dot-mg { background: #53DA85; }
    .space-count {
      font-size: 11px; font-weight: 700;
      background: #F0F2F8; color: #6B7899;
      padding: 2px 8px; border-radius: 20px;
      flex-shrink: 0;
    }

    /* Docs list */
    .space-loading, .space-empty {
      display: flex; align-items: center; gap: 6px; justify-content: center;
      padding: 20px 16px;
      font-size: 12.5px; color: #9BA6C2;
    }
    .space-empty mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .space-docs { padding: 6px 0 4px; }

    .doc-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 16px; cursor: pointer;
      transition: background .12s;
    }
    .doc-row:hover { background: #F8F9FC; }

    .doc-icon {
      width: 28px; height: 28px; flex-shrink: 0; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      background: #F0F2F8;
    }
    .doc-icon mat-icon { font-size: 14px; width: 14px; height: 14px; color: #6B7899; }
    .doc-pdf mat-icon  { color: #DC2626; }
    .doc-xls mat-icon, .doc-xlsx mat-icon { color: #16A34A; }
    .doc-doc mat-icon, .doc-docx mat-icon { color: #1D4ED8; }

    .doc-name { flex: 1; font-size: 12.5px; color: #2D3A5E; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .doc-size { font-size: 11px; color: #9BA6C2; white-space: nowrap; flex-shrink: 0; }

    .space-more {
      display: block;
      padding: 8px 16px 10px;
      font-size: 12px; font-weight: 600; color: #0E9E83;
      text-decoration: none;
      transition: color .12s;
      border-top: 1px solid #F0F2F8;
      margin-top: 4px;
    }
    .space-more:hover { color: #19D9B4; }

    /* Empty state */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 24px; gap: 12px; text-align: center;
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: 16px;
      background: linear-gradient(135deg, #F43F5E, #EC4899);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(244,63,94,.25);
    }
    .empty-icon mat-icon { font-size: 30px; width: 30px; height: 30px; color: #fff; }
    .empty-state h3 { font-size: 16px; font-weight: 600; color: #162351; }
    .empty-state p  { font-size: 13px; color: #6B7899; max-width: 300px; }
  `],
})
export class DocumentsComponent implements OnInit {
  loading  = signal(true);
  spaces   = signal<ClientSpace[]>([]);
  searchCtrl = new FormControl('');

  constructor(
    private clientsService: ClientsService,
    private docsService: DocumentsService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.clientsService.getAll().subscribe(clients => {
      const sp = clients.map(c => ({ client: c, docs: [], loading: true }));
      this.spaces.set(sp);
      this.loading.set(false);

      // Load docs for each client
      sp.forEach((space, i) => {
        this.docsService.getAll(space.client.id).subscribe({
          next: docs => {
            const updated = [...this.spaces()];
            updated[i] = { ...updated[i], docs, loading: false };
            this.spaces.set(updated);
          },
          error: () => {
            const updated = [...this.spaces()];
            updated[i] = { ...updated[i], loading: false };
            this.spaces.set(updated);
          },
        });
      });
    });

    this.searchCtrl.valueChanges.pipe(debounceTime(200)).subscribe();
  }

  filteredSpaces() {
    const q = (this.searchCtrl.value || '').toLowerCase();
    if (!q) return this.spaces();
    return this.spaces().filter(s =>
      s.client.nom.toLowerCase().includes(q) ||
      s.docs.some(d => d.nom.toLowerCase().includes(q))
    );
  }

  get totalDocs() {
    return this.spaces().reduce((acc, s) => acc + s.docs.length, 0);
  }

  getInitials(nom: string) {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getExt(nom: string) {
    return nom?.split('.').pop()?.toLowerCase() || 'file';
  }

  getDocIcon(nom: string) {
    const ext = this.getExt(nom);
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['xls','xlsx'].includes(ext)) return 'table_chart';
    if (['doc','docx'].includes(ext)) return 'description';
    if (['jpg','jpeg','png','gif'].includes(ext)) return 'image';
    return 'insert_drive_file';
  }

  formatDate(date: string | Date | undefined) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  download(clientId: number, doc: ClientDocument) {
    this.docsService.download(clientId, doc.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nom;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  onFileSelected(event: Event) {
    // Upload requires a client — redirect to first client or show a picker
    console.log('File selected — nécessite un dossier client cible');
  }
}
