import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { debounceTime } from 'rxjs/operators';
import { ClientsService } from '../../core/services/clients.service';
import { DocumentsService } from '../../core/services/documents.service';
import { Client, ClientDocument } from '../../core/models/client.model';

interface ClientSpace {
  client: Client;
  docs: ClientDocument[];
  loading: boolean;
}

interface RecentDoc {
  clientId: number;
  clientNom: string;
  doc: ClientDocument;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, FormsModule,
    MatIconModule, MatTooltipModule, MatButtonModule, MatRippleModule,
  ],
  template: `
    <div class="page">

      <!-- ══ PAGE HEADER ════════════════════════════════ -->
      <div class="page-header">
        <div class="page-header__left">
          <div class="page-icon">
            <mat-icon>folder_open</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Mes documents</h1>
            <p class="page-sub">
              @if (loading()) { Chargement… }
              @else { {{ totalDocs }} document{{ totalDocs > 1 ? 's' : '' }} · {{ spaces().length }} dossier{{ spaces().length > 1 ? 's' : '' }} }
            </p>
          </div>
        </div>
        <label class="btn-add" matRipple>
          <mat-icon>add</mat-icon>
          Ajouter un document
          <input type="file" multiple hidden (change)="onFileSelected($event)" />
        </label>
      </div>

      <!-- ══ SEARCH + FILTER ════════════════════════════ -->
      <div class="toolbar">
        <div class="search-field">
          <mat-icon class="search-icon">search</mat-icon>
          <input class="search-input" [formControl]="searchCtrl"
                 placeholder="Rechercher dans mes documents..." />
          @if (searchCtrl.value) {
            <button class="search-clear" (click)="searchCtrl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
        <div class="filter-field">
          <mat-icon class="filter-icon">filter_list</mat-icon>
          <select class="filter-select" [(ngModel)]="selectedClientId">
            <option value="">Tous les espaces</option>
            @for (s of spaces(); track s.client.id) {
              <option [value]="s.client.id">{{ s.client.nom }}</option>
            }
          </select>
          <mat-icon class="filter-arrow">expand_more</mat-icon>
        </div>
      </div>

      <!-- ══ STATS STRIP ════════════════════════════════ -->
      @if (!loading()) {
        <div class="stats-strip">
          @for (stat of getStats(); track stat.label) {
            <div class="stat-chip">
              <mat-icon [style.color]="stat.color">{{ stat.icon }}</mat-icon>
              <span class="stat-count" [style.color]="stat.color">{{ stat.count }}</span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
          }
        </div>
      }

      <!-- ══ DOCUMENTS RÉCENTS ══════════════════════════ -->
      @if (loading()) {
        <section class="section">
          <div class="section-title">Documents récents</div>
          <div class="recents-scroll">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="recent-skeleton"></div>
            }
          </div>
        </section>
      }

      @if (!loading() && recentDocs().length > 0) {
        <section class="section">
          <div class="section-head">
            <div class="section-title">Documents récents</div>
            <span class="section-badge">{{ recentDocs().length }}</span>
          </div>
          <div class="recents-scroll">
            @for (item of recentDocs(); track item.doc.id) {
              <div class="recent-card" matRipple (click)="download(item.clientId, item.doc)">
                <!-- Thumbnail -->
                <div class="recent-thumb" [class]="'thumb-' + getExt(item.doc.nom)">
                  <div class="recent-thumb__bg"></div>
                  <mat-icon class="recent-thumb__icon">{{ getDocIcon(item.doc.nom) }}</mat-icon>
                  <div class="recent-thumb__lines">
                    <span></span><span></span><span></span><span></span>
                  </div>
                  <div class="recent-thumb__overlay">
                    <mat-icon>download</mat-icon>
                  </div>
                </div>
                <!-- Info -->
                <div class="recent-info">
                  <span class="recent-badge" [class]="'badge-' + getExt(item.doc.nom)">
                    {{ getTypeLabel(item.doc.nom) }}
                  </span>
                  <p class="recent-name">{{ item.doc.nom }}</p>
                  <div class="recent-meta">
                    <mat-icon>person_outline</mat-icon>
                    <span>{{ item.clientNom }}</span>
                  </div>
                  <div class="recent-date">{{ formatDate(item.doc.createdAt) }}</div>
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- ══ MES ESPACES ════════════════════════════════ -->
      @if (!loading()) {
        <section class="section">
          <div class="section-head">
            <div class="section-title">Mes espaces</div>
            <span class="section-sub">{{ filteredSpaces().length }} espace{{ filteredSpaces().length > 1 ? 's' : '' }}</span>
          </div>

          @if (filteredSpaces().length > 0) {
            <div class="spaces-grid">
              @for (space of filteredSpaces(); track space.client.id) {
                <div class="space-card">
                  <!-- Card header with gradient -->
                  <div class="space-card__head" [style.background]="getSpaceGradient(space.client.id)">
                    <div class="space-avatar">{{ getInitials(space.client.nom) }}</div>
                    <div class="space-meta">
                      <div class="space-name">{{ space.client.nom }}</div>
                      <div class="space-site">
                        <span class="site-dot" [class.dot-mg]="space.client.site === 'MADAGASCAR'"></span>
                        {{ space.client.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
                      </div>
                    </div>
                    <div class="space-actions">
                      <span class="space-count">{{ space.docs.length }}</span>
                      <a [routerLink]="['/clients', space.client.id]"
                         class="space-open" matTooltip="Ouvrir le dossier"
                         (click)="$event.stopPropagation()">
                        <mat-icon>open_in_new</mat-icon>
                      </a>
                    </div>
                  </div>

                  <!-- Docs list -->
                  @if (space.loading) {
                    <div class="space-body">
                      @for (i of [1,2,3]; track i) {
                        <div class="doc-skel"></div>
                      }
                    </div>
                  } @else if (space.docs.length === 0) {
                    <div class="space-empty">
                      <mat-icon>upload_file</mat-icon>
                      <span>Aucun document dans cet espace</span>
                    </div>
                  } @else {
                    <div class="space-body">
                      @for (doc of space.docs.slice(0, 5); track doc.id) {
                        <div class="doc-row" matRipple (click)="download(space.client.id, doc)">
                          <div class="doc-icon-wrap" [class]="'di-' + getExt(doc.nom)">
                            <mat-icon>{{ getDocIcon(doc.nom) }}</mat-icon>
                          </div>
                          <span class="doc-name">{{ doc.nom }}</span>
                          <span class="doc-size">{{ formatSize(doc.taille) }}</span>
                          <span class="doc-date">{{ formatDate(doc.createdAt) }}</span>
                        </div>
                      }
                    </div>
                    <a [routerLink]="['/clients', space.client.id]"
                       [queryParams]="{tab:'documents'}"
                       class="space-more">
                      <span>Voir tous les documents</span>
                      <mat-icon>arrow_forward</mat-icon>
                    </a>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <div class="empty-icon"><mat-icon>folder_open</mat-icon></div>
              <h3>Aucun résultat</h3>
              <p>Aucun document ne correspond à votre recherche.</p>
            </div>
          }
        </section>
      }

    </div>
  `,
  styles: [`
    /* ══ PAGE LAYOUT ════════════════════════════════════ */
    .page { padding: 0 0 56px; max-width: 1280px; }

    /* ── Page header ─────────────────────────────────── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
    }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon {
      width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
      background: linear-gradient(135deg, #1565C0 0%, #42A5F5 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(21,101,192,.30);
    }
    .page-icon mat-icon { font-size: 26px; width: 26px; height: 26px; color: white; }
    .page-title { font-size: 24px; font-weight: 800; color: #0F172A; margin: 0; letter-spacing: -.5px; }
    .page-sub   { font-size: 13px; color: #64748B; margin: 3px 0 0; }

    /* Add button */
    .btn-add {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 26px;
      background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
      color: white; border-radius: 28px;
      font-size: 13.5px; font-weight: 700; cursor: pointer;
      white-space: nowrap; flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(34,197,94,.35);
      font-family: inherit;
      transition: transform .15s, box-shadow .15s;
    }
    .btn-add:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(34,197,94,.45);
    }
    .btn-add mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* ── Toolbar ─────────────────────────────────────── */
    .toolbar {
      display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
    }

    /* Search */
    .search-field {
      flex: 1; min-width: 240px;
      display: flex; align-items: center; gap: 10px;
      background: white;
      border: 1.5px solid #E2E8F0; border-radius: 14px;
      padding: 12px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      transition: border-color .15s, box-shadow .15s;
    }
    .search-field:focus-within {
      border-color: #1565C0;
      box-shadow: 0 0 0 3px rgba(21,101,192,.10);
    }
    .search-icon  { font-size: 18px; width: 18px; height: 18px; color: #94A3B8; flex-shrink: 0; }
    .search-input {
      flex: 1; border: none; outline: none;
      font-size: 14px; color: #0F172A; background: transparent;
      font-family: inherit;
    }
    .search-input::placeholder { color: #94A3B8; }
    .search-clear {
      width: 22px; height: 22px; border: none; background: #F1F5F9;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: #64748B;
    }
    .search-clear mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Filter */
    .filter-field {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1.5px solid #E2E8F0; border-radius: 14px;
      padding: 12px 16px; min-width: 210px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      cursor: pointer;
      transition: border-color .15s;
    }
    .filter-field:focus-within { border-color: #1565C0; }
    .filter-icon  { font-size: 18px; width: 18px; height: 18px; color: #94A3B8; flex-shrink: 0; }
    .filter-arrow { font-size: 18px; width: 18px; height: 18px; color: #94A3B8; flex-shrink: 0; }
    .filter-select {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13.5px; font-weight: 500; color: #334155;
      font-family: inherit; cursor: pointer;
      -webkit-appearance: none; appearance: none;
    }

    /* ── Stats strip ─────────────────────────────────── */
    .stats-strip {
      display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap;
    }
    .stat-chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: white; border: 1px solid #E2E8F0;
      border-radius: 20px; padding: 6px 14px 6px 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }
    .stat-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .stat-count { font-size: 13px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #64748B; }

    /* ── Sections ─────────────────────────────────────── */
    .section { margin-bottom: 36px; }
    .section-head {
      display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
    }
    .section-title {
      font-size: 16px; font-weight: 700; color: #0F172A;
    }
    .section-badge {
      background: #1565C0; color: white;
      font-size: 11px; font-weight: 700;
      padding: 2px 9px; border-radius: 20px;
    }
    .section-sub { font-size: 12.5px; color: #94A3B8; }

    /* ══ DOCUMENTS RÉCENTS ════════════════════════════ */
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .recents-scroll {
      display: flex; gap: 16px;
      overflow-x: auto; padding-bottom: 10px;
      scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent;
    }
    .recents-scroll::-webkit-scrollbar { height: 5px; }
    .recents-scroll::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }

    .recent-skeleton {
      width: 172px; height: 220px; flex-shrink: 0; border-radius: 16px;
      background: linear-gradient(90deg, #F1F5F9 25%, #E8EDF4 50%, #F1F5F9 75%);
      background-size: 400% 100%; animation: shimmer 1.5s infinite;
    }

    /* Recent card */
    .recent-card {
      width: 172px; flex-shrink: 0; border-radius: 16px;
      overflow: hidden; cursor: pointer; background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04);
      transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
      position: relative;
    }
    .recent-card:hover {
      transform: translateY(-5px) scale(1.015);
      box-shadow: 0 12px 32px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.04);
    }

    /* Thumbnail */
    .recent-thumb {
      height: 126px; position: relative; overflow: hidden;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px;
    }
    .recent-thumb__bg {
      position: absolute; inset: 0; opacity: .12;
      background: repeating-linear-gradient(
        -45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%
      );
      background-size: 10px 10px;
    }
    .recent-thumb__icon {
      font-size: 40px; width: 40px; height: 40px;
      position: relative; z-index: 1; opacity: .85;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,.15));
    }
    .recent-thumb__lines {
      display: flex; flex-direction: column; gap: 5px;
      width: 65%; position: relative; z-index: 1;
    }
    .recent-thumb__lines span {
      height: 5px; border-radius: 3px;
      background: rgba(255,255,255,.55);
    }
    .recent-thumb__lines span:nth-child(1) { width: 100%; }
    .recent-thumb__lines span:nth-child(2) { width: 78%; }
    .recent-thumb__lines span:nth-child(3) { width: 55%; }
    .recent-thumb__lines span:nth-child(4) { width: 40%; }
    .recent-thumb__overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,.32);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .18s; z-index: 2;
    }
    .recent-thumb__overlay mat-icon { font-size: 30px; width: 30px; height: 30px; color: white; }
    .recent-card:hover .recent-thumb__overlay { opacity: 1; }

    /* Thumb color themes */
    .thumb-pdf  { background: linear-gradient(155deg, #FFF1F2, #FECDD3); color: #DC2626; }
    .thumb-pdf .recent-thumb__icon { color: #DC2626; }
    .thumb-xlsx,.thumb-xls { background: linear-gradient(155deg, #F0FDF4, #BBF7D0); color: #16A34A; }
    .thumb-xlsx .recent-thumb__icon,.thumb-xls .recent-thumb__icon { color: #16A34A; }
    .thumb-docx,.thumb-doc { background: linear-gradient(155deg, #EFF6FF, #BFDBFE); color: #1D4ED8; }
    .thumb-docx .recent-thumb__icon,.thumb-doc .recent-thumb__icon { color: #1D4ED8; }
    .thumb-jpg,.thumb-jpeg,.thumb-png { background: linear-gradient(155deg, #FAF5FF, #E9D5FF); color: #7C3AED; }
    .thumb-jpg .recent-thumb__icon,.thumb-jpeg .recent-thumb__icon,.thumb-png .recent-thumb__icon { color: #7C3AED; }
    .thumb-file { background: linear-gradient(155deg, #F8FAFC, #E2E8F0); color: #475569; }
    .thumb-file .recent-thumb__icon { color: #475569; }

    /* Card info area */
    .recent-info { padding: 12px 14px 14px; }
    .recent-badge {
      display: inline-block;
      font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px;
      padding: 2px 8px; border-radius: 20px; margin-bottom: 7px;
    }
    .badge-pdf  { background: #FEE2E2; color: #DC2626; }
    .badge-xlsx,.badge-xls { background: #DCFCE7; color: #16A34A; }
    .badge-docx,.badge-doc { background: #DBEAFE; color: #1D4ED8; }
    .badge-jpg,.badge-jpeg,.badge-png { background: #F3E8FF; color: #7C3AED; }
    .badge-file { background: #F1F5F9; color: #475569; }

    .recent-name {
      font-size: 12px; font-weight: 600; color: #1E293B;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin: 0 0 6px; line-height: 1.3;
    }
    .recent-meta {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #94A3B8; margin-bottom: 3px;
    }
    .recent-meta mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .recent-date { font-size: 11px; color: #CBD5E1; }

    /* ══ SPACES GRID ═════════════════════════════════ */
    .spaces-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    /* Space card */
    .space-card {
      background: white; border-radius: 20px; overflow: hidden;
      box-shadow: 0 2px 6px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04);
      transition: box-shadow .2s, transform .2s;
    }
    .space-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04);
      transform: translateY(-3px);
    }

    /* Card header with gradient */
    .space-card__head {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 18px;
    }
    .space-avatar {
      width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px;
      background: rgba(255,255,255,.35); backdrop-filter: blur(4px);
      border: 1.5px solid rgba(255,255,255,.6);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: white;
      text-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .space-meta { flex: 1; min-width: 0; }
    .space-name {
      font-size: 13.5px; font-weight: 700; color: white;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      text-shadow: 0 1px 3px rgba(0,0,0,.15);
    }
    .space-site {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: rgba(255,255,255,.8); margin-top: 2px;
    }
    .site-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: rgba(255,255,255,.8); flex-shrink: 0;
    }
    .site-dot.dot-mg { background: #86EFAC; }

    .space-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .space-count {
      font-size: 12px; font-weight: 700;
      background: rgba(255,255,255,.25); color: white;
      padding: 3px 10px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,.3);
    }
    .space-open {
      width: 30px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,.18); color: rgba(255,255,255,.9);
      transition: background .15s;
    }
    .space-open:hover { background: rgba(255,255,255,.35); }
    .space-open mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* Docs body */
    .space-body { padding: 6px 0; }

    .doc-skel {
      height: 14px; margin: 10px 18px; border-radius: 7px;
      background: linear-gradient(90deg, #F1F5F9 25%, #E8EDF4 50%, #F1F5F9 75%);
      background-size: 400% 100%; animation: shimmer 1.5s infinite;
    }

    .space-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 28px 16px; color: #94A3B8;
    }
    .space-empty mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: .5; }
    .space-empty span { font-size: 12.5px; text-align: center; }

    /* Doc rows */
    .doc-row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 18px; cursor: pointer;
      transition: background .12s;
    }
    .doc-row:hover { background: #F8FAFC; }

    .doc-icon-wrap {
      width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .doc-icon-wrap mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .di-pdf  { background: #FEE2E2; }
    .di-pdf mat-icon  { color: #DC2626; }
    .di-xlsx,.di-xls { background: #DCFCE7; }
    .di-xlsx mat-icon,.di-xls mat-icon { color: #16A34A; }
    .di-docx,.di-doc { background: #DBEAFE; }
    .di-docx mat-icon,.di-doc mat-icon { color: #1D4ED8; }
    .di-jpg,.di-jpeg,.di-png { background: #F3E8FF; }
    .di-jpg mat-icon,.di-jpeg mat-icon,.di-png mat-icon { color: #7C3AED; }
    .di-file { background: #F1F5F9; }
    .di-file mat-icon { color: #64748B; }

    .doc-name {
      flex: 1; font-size: 12.5px; font-weight: 500; color: #334155;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .doc-size { font-size: 11px; color: #94A3B8; white-space: nowrap; flex-shrink: 0; }
    .doc-date { font-size: 11px; color: #CBD5E1; white-space: nowrap; flex-shrink: 0; }

    /* More link */
    .space-more {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 18px;
      font-size: 12.5px; font-weight: 600; color: #1565C0;
      text-decoration: none;
      border-top: 1px solid #F1F5F9;
      transition: background .12s, color .12s;
    }
    .space-more:hover { background: #EFF6FF; color: #1E40AF; }
    .space-more mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Empty state ─────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 72px 24px; gap: 14px; text-align: center;
    }
    .empty-icon {
      width: 72px; height: 72px; border-radius: 22px;
      background: linear-gradient(135deg, #1565C0, #42A5F5);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 20px rgba(21,101,192,.30);
    }
    .empty-icon mat-icon { font-size: 34px; width: 34px; height: 34px; color: white; }
    .empty-state h3 { font-size: 17px; font-weight: 700; color: #0F172A; margin: 0; }
    .empty-state p  { font-size: 13.5px; color: #64748B; max-width: 300px; margin: 0; }
  `],
})
export class DocumentsComponent implements OnInit {
  loading    = signal(true);
  spaces     = signal<ClientSpace[]>([]);
  searchCtrl = new FormControl('');
  selectedClientId: number | string = '';

  private readonly SPACE_GRADIENTS = [
    'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
    'linear-gradient(135deg, #6A1B9A 0%, #AB47BC 100%)',
    'linear-gradient(135deg, #00695C 0%, #26A69A 100%)',
    'linear-gradient(135deg, #E65100 0%, #FFA726 100%)',
    'linear-gradient(135deg, #1B5E20 0%, #66BB6A 100%)',
    'linear-gradient(135deg, #880E4F 0%, #EC407A 100%)',
    'linear-gradient(135deg, #0D47A1 0%, #29B6F6 100%)',
    'linear-gradient(135deg, #4A148C 0%, #9C27B0 100%)',
  ];

  constructor(
    private clientsService: ClientsService,
    private docsService: DocumentsService,
  ) {}

  ngOnInit() {
    this.clientsService.getAll().subscribe(clients => {
      const sp: ClientSpace[] = clients.map(c => ({ client: c, docs: [], loading: true }));
      this.spaces.set(sp);
      this.loading.set(false);

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

  recentDocs(): RecentDoc[] {
    const all: RecentDoc[] = [];
    for (const space of this.spaces()) {
      for (const doc of space.docs) {
        all.push({ clientId: space.client.id, clientNom: space.client.nom, doc });
      }
    }
    return all
      .sort((a, b) => new Date(b.doc.createdAt ?? 0).getTime() - new Date(a.doc.createdAt ?? 0).getTime())
      .slice(0, 8);
  }

  filteredSpaces(): ClientSpace[] {
    let result = this.spaces();
    if (this.selectedClientId) {
      result = result.filter(s => s.client.id === Number(this.selectedClientId));
    }
    const q = (this.searchCtrl.value || '').toLowerCase();
    if (q) {
      result = result.filter(s =>
        s.client.nom.toLowerCase().includes(q) ||
        s.docs.some(d => d.nom.toLowerCase().includes(q))
      );
    }
    return result;
  }

  get totalDocs() {
    return this.spaces().reduce((acc, s) => acc + s.docs.length, 0);
  }

  getStats() {
    const all = this.spaces().flatMap(s => s.docs);
    const count = (exts: string[]) => all.filter(d => exts.includes(this.getExt(d.nom))).length;
    return [
      { label: 'PDF',     count: count(['pdf']),             icon: 'picture_as_pdf', color: '#DC2626' },
      { label: 'Excel',   count: count(['xls','xlsx']),       icon: 'table_chart',    color: '#16A34A' },
      { label: 'Word',    count: count(['doc','docx']),        icon: 'description',    color: '#1D4ED8' },
      { label: 'Images',  count: count(['jpg','jpeg','png']),  icon: 'image',          color: '#7C3AED' },
      { label: 'Autres',  count: all.length - count(['pdf','xls','xlsx','doc','docx','jpg','jpeg','png']),
        icon: 'insert_drive_file', color: '#64748B' },
    ].filter(s => s.count > 0);
  }

  getSpaceGradient(clientId: number) {
    return this.SPACE_GRADIENTS[clientId % this.SPACE_GRADIENTS.length];
  }

  getInitials(nom: string) {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getExt(nom: string) {
    return (nom?.split('.').pop()?.toLowerCase() || 'file');
  }

  getDocIcon(nom: string) {
    const ext = this.getExt(nom);
    if (ext === 'pdf')                    return 'picture_as_pdf';
    if (['xls','xlsx'].includes(ext))     return 'table_chart';
    if (['doc','docx'].includes(ext))     return 'description';
    if (['jpg','jpeg','png'].includes(ext)) return 'image';
    return 'insert_drive_file';
  }

  getTypeLabel(nom: string) {
    const ext = this.getExt(nom);
    if (ext === 'pdf')                return 'PDF';
    if (['xls','xlsx'].includes(ext)) return 'Excel';
    if (['doc','docx'].includes(ext)) return 'Word';
    if (['jpg','jpeg','png'].includes(ext)) return 'Image';
    return ext.toUpperCase();
  }

  formatDate(date: string | Date | undefined) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  formatSize(bytes: number | undefined) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  download(clientId: number, doc: ClientDocument) {
    this.docsService.download(clientId, doc.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.nom; a.click();
      URL.revokeObjectURL(url);
    });
  }

  onFileSelected(_event: Event) {
    console.log('Sélecteur de dossier à implémenter');
  }
}
