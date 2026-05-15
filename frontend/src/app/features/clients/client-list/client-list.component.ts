import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { Subscription, debounceTime } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NotificationStreamService } from '../../../core/services/notification-stream.service';
import { ClientsService } from '../../../core/services/clients.service';
import { AuthService } from '../../../core/services/auth.service';
import { Client } from '../../../core/models/client.model';
import { CreateClientWizardComponent } from './create-client-wizard.component';

type SortKey = 'nom' | 'score' | 'site';
type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatDialogModule,
    MatTooltipModule, MatRippleModule,
  ],
  template: `
    <div class="explorer">

      <!-- ══ TOOLBAR ════════════════════════════════════════ -->
      <div class="toolbar">

        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <mat-icon class="bc-home">folder_shared</mat-icon>
          <mat-icon class="bc-sep">chevron_right</mat-icon>
          <span class="bc-current">{{ auth.isAdmin() ? 'Tous les dossiers' : 'Mes dossiers' }}</span>
          @if (siteFilter()) {
            <mat-icon class="bc-sep">chevron_right</mat-icon>
            <span class="bc-current">{{ siteFilter() === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}</span>
          }
        </div>

        <div class="toolbar__spacer"></div>

        <!-- Search -->
        <div class="tb-search">
          <mat-icon>search</mat-icon>
          <input [formControl]="searchCtrl" placeholder="Rechercher…" />
          @if (searchCtrl.value) {
            <button class="clear-btn" (click)="searchCtrl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>

        <!-- Sort -->
        <div class="tb-sort">
          <button class="sort-btn" [class.active]="sortKey()==='nom'"    (click)="setSort('nom')">Nom    @if(sortKey()==='nom'){<mat-icon>{{ sortDir()==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>}</button>
          <button class="sort-btn" [class.active]="sortKey()==='score'"  (click)="setSort('score')">Score  @if(sortKey()==='score'){<mat-icon>{{ sortDir()==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>}</button>
          <button class="sort-btn" [class.active]="sortKey()==='site'"   (click)="setSort('site')">Site   @if(sortKey()==='site'){<mat-icon>{{ sortDir()==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>}</button>
        </div>

        <!-- View toggle -->
        <div class="view-toggle">
          <button class="vt-btn" [class.vt-active]="viewMode()==='grid'" (click)="viewMode.set('grid')" matTooltip="Vue grille">
            <mat-icon>grid_view</mat-icon>
          </button>
          <button class="vt-btn" [class.vt-active]="viewMode()==='list'" (click)="viewMode.set('list')" matTooltip="Vue liste">
            <mat-icon>view_list</mat-icon>
          </button>
        </div>

        <!-- Nouveau dossier -->
        @if (auth.isAdmin()) {
          <button class="btn-new-folder" (click)="openCreateDialog()" matTooltip="Nouveau dossier">
            <mat-icon>create_new_folder</mat-icon>
            <span>Nouveau</span>
          </button>
        }

      </div>

      <!-- ══ FILTER CHIPS ═══════════════════════════════════ -->
      <div class="filter-bar">
        <button class="fchip" [class.fchip--active]="healthFilter()===''"        (click)="healthFilter.set('')">
          Tous <span class="fchip-count">{{ clients().length }}</span>
        </button>
        <button class="fchip fchip--green"  [class.fchip--active]="healthFilter()==='ok'"      (click)="healthFilter.set('ok')">
          <span class="fdot fdot--green"></span> Transmissible <span class="fchip-count">{{ countByHealth('ok') }}</span>
        </button>
        <button class="fchip fchip--orange" [class.fchip--active]="healthFilter()==='partial'" (click)="healthFilter.set('partial')">
          <span class="fdot fdot--orange"></span> En cours <span class="fchip-count">{{ countByHealth('partial') }}</span>
        </button>
        <button class="fchip fchip--red"    [class.fchip--active]="healthFilter()==='alert'"   (click)="healthFilter.set('alert')">
          <span class="fdot fdot--red"></span> Alerte <span class="fchip-count">{{ countByHealth('alert') }}</span>
        </button>

        @if (auth.isAdmin()) {
          <div class="fchip-sep"></div>
          <button class="fchip" [class.fchip--active]="siteFilter()===''"          (click)="siteFilter.set('')">
            <mat-icon>public</mat-icon> Tous les sites
          </button>
          <button class="fchip" [class.fchip--active]="siteFilter()==='REUNION'"   (click)="siteFilter.set('REUNION')">
            🇷🇪 La Réunion
          </button>
          <button class="fchip" [class.fchip--active]="siteFilter()==='MADAGASCAR'" (click)="siteFilter.set('MADAGASCAR')">
            🇲🇬 Madagascar
          </button>
        }
      </div>

      <!-- ══ GRID VIEW ══════════════════════════════════════ -->
      @if (viewMode() === 'grid') {
        @if (filteredClients().length === 0) {
          <div class="empty">
            <mat-icon>folder_off</mat-icon>
            <p>Aucun dossier trouvé</p>
          </div>
        } @else {
          <div class="file-grid">
            @for (c of filteredClients(); track c.id) {
              <div class="folder-item" matRipple [routerLink]="['/clients', c.id]">

                <!-- Folder icon zone -->
                <div class="folder-icon">
                  <div class="folder-icon__tab"></div>
                  <div class="folder-icon__body">
                    <mat-icon class="folder-icon__mat">folder</mat-icon>
                    <span class="folder-icon__score">{{ c.santePassation }}%</span>
                  </div>
                </div>

                <!-- Name & meta -->
                <div class="folder-meta">
                  <span class="folder-name">{{ c.nom }}</span>
                  <span class="folder-sub" [class]="c.site==='REUNION' ? 'sub--re' : 'sub--mg'">
                    {{ c.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                  </span>
                  @if (c.responsable) {
                    <span class="folder-resp">{{ c.responsable.firstName }} {{ c.responsable.lastName }}</span>
                  }
                </div>

                <!-- Status dot -->
                <span class="folder-status" [class]="statusDotClass(c.santePassation)" [matTooltip]="getStatusLabel(c.santePassation)"></span>

              </div>
            }
          </div>
        }
      }

      <!-- ══ LIST VIEW ══════════════════════════════════════ -->
      @if (viewMode() === 'list') {
        <div class="file-list">
          <!-- Header -->
          <div class="list-header">
            <span class="lh-name">Nom</span>
            <span class="lh-site">Site</span>
            <span class="lh-resp">Responsable</span>
            <span class="lh-score">Santé</span>
            <span class="lh-status">Statut</span>
            <span class="lh-action"></span>
          </div>

          @if (filteredClients().length === 0) {
            <div class="empty">
              <mat-icon>folder_off</mat-icon>
              <p>Aucun dossier trouvé</p>
            </div>
          }

          @for (c of filteredClients(); track c.id) {
            <div class="list-row" matRipple [routerLink]="['/clients', c.id]">

              <!-- Icon + name -->
              <div class="lr-name">
                <div class="lr-icon">
                  <mat-icon>folder</mat-icon>
                </div>
                <span class="lr-label">{{ c.nom }}</span>
              </div>

              <!-- Site -->
              <span class="lr-site" [class]="c.site==='REUNION' ? 'site--re' : 'site--mg'">
                {{ c.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
              </span>

              <!-- Responsable -->
              <div class="lr-resp">
                @if (c.responsable) {
                  <div class="resp-av">{{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}</div>
                  <span>{{ c.responsable.firstName }} {{ c.responsable.lastName }}</span>
                } @else {
                  <span class="resp-none">—</span>
                }
              </div>

              <!-- Score -->
              <div class="lr-score">
                <div class="score-track">
                  <div class="score-fill" [class]="scoreBarClass(c.santePassation)" [style.width.%]="c.santePassation"></div>
                </div>
                <span class="score-pct" [class]="scoreTxtClass(c.santePassation)">{{ c.santePassation }}%</span>
              </div>

              <!-- Status -->
              <span class="lr-status" [class]="statusPillClass(c.santePassation)">{{ getStatusLabel(c.santePassation) }}</span>

              <!-- Arrow -->
              <mat-icon class="lr-arrow">chevron_right</mat-icon>

            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .explorer {
      display: flex; flex-direction: column; gap: 0;
      height: 100%; background: #F4F6FB;
    }

    /* ══ TOOLBAR ══════════════════════════════════════════ */
    .toolbar {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 20px 12px;
      background: #FFFBFE;
      border-bottom: 1px solid #E0E2EC;
      flex-shrink: 0;
    }
    .toolbar__spacer { flex: 1; }

    /* Breadcrumb */
    .breadcrumb { display: flex; align-items: center; gap: 4px; }
    .bc-home { font-size: 18px; width: 18px; height: 18px; color: #44474F; }
    .bc-sep  { font-size: 16px; width: 16px; height: 16px; color: #C8C6CA; }
    .bc-current { font-size: 14px; font-weight: 600; color: #1A1C1E; }

    /* Search */
    .tb-search {
      display: flex; align-items: center; gap: 8px;
      background: #E8EAED; border-radius: 20px; padding: 0 12px; height: 34px; width: 220px;
    }
    .tb-search mat-icon { font-size: 17px; width: 17px; height: 17px; color: #44474F; }
    .tb-search input { flex: 1; border: none; background: transparent; font-size: 13px; color: #1A1C1E; outline: none; font-family: 'Inter', sans-serif; }
    .tb-search input::placeholder { color: #6F7978; }
    .clear-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #6F7978; padding: 0; }
    .clear-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* Sort */
    .tb-sort { display: flex; gap: 2px; background: #E8EAED; border-radius: 20px; padding: 3px; }
    .sort-btn {
      display: inline-flex; align-items: center; gap: 3px;
      border: none; background: none; cursor: pointer;
      font-size: 12px; font-weight: 500; color: #44474F;
      padding: 4px 10px; border-radius: 16px;
      font-family: 'Inter', sans-serif; transition: all .12s;
    }
    .sort-btn mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .sort-btn.active { background: #FFFBFE; color: #1A1C1E; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.15); }

    /* View toggle */
    .view-toggle { display: flex; gap: 2px; }
    .vt-btn {
      width: 34px; height: 34px; border: none; background: transparent;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #6F7978; transition: background .12s;
    }
    .vt-btn:hover  { background: #E8EAED; color: #1A1C1E; }
    .vt-btn.vt-active { background: #DDE3EA; color: #1A1C1E; }
    .vt-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* New folder button */
    .btn-new-folder {
      display: inline-flex; align-items: center; gap: 6px;
      background: #006B57; color: #fff; border: none; border-radius: 20px;
      padding: 0 16px; height: 34px; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: background .12s;
      white-space: nowrap;
    }
    .btn-new-folder:hover { background: #00574A; }
    .btn-new-folder mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ══ FILTER BAR ═══════════════════════════════════════ */
    .filter-bar {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      padding: 10px 20px;
      background: #FFFBFE;
      border-bottom: 1px solid #E8EAED;
      flex-shrink: 0;
    }
    .fchip {
      display: inline-flex; align-items: center; gap: 5px;
      border: 1px solid #C8C6CA; background: transparent;
      border-radius: 8px; padding: 5px 12px;
      font-size: 12.5px; font-weight: 500; color: #44474F;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: all .12s;
    }
    .fchip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .fchip:hover { background: #E8EAED; }
    .fchip--active { background: #E8DEF8 !important; border-color: transparent; color: #21005D; font-weight: 600; }
    .fchip-count { background: #E0E2EC; color: #44474F; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; margin-left: 2px; }
    .fchip--active .fchip-count { background: #CCC2DC; color: #21005D; }
    .fdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .fdot--green  { background: #386A20; }
    .fdot--orange { background: #7B4F00; }
    .fdot--red    { background: #BA1A1A; }
    .fchip-sep { width: 1px; height: 20px; background: #E0E2EC; margin: 0 2px; }

    /* ══ EMPTY ════════════════════════════════════════════ */
    .empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 24px; gap: 12px; color: #6F7978;
    }
    .empty mat-icon { font-size: 52px; width: 52px; height: 52px; }
    .empty p { font-size: 15px; font-weight: 500; margin: 0; }

    /* ══ GRID VIEW ════════════════════════════════════════ */
    .file-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
      gap: 12px;
      padding: 24px;
      overflow-y: auto;
      align-content: start;
    }

    .folder-item {
      display: flex; flex-direction: column; align-items: center;
      padding: 12px 8px;
      border-radius: 16px;
      cursor: pointer;
      position: relative; text-align: center;
      background: transparent;
      border: 2px solid transparent;
      transition: background .12s;
    }
    .folder-item:hover { background: rgba(21,101,192,.06); }
    .folder-item:active { background: rgba(21,101,192,.12); }

    /* Folder icon — style iOS Files agrandi */
    .folder-icon {
      width: 100px; height: 82px;
      position: relative; margin-bottom: 14px;
      filter: drop-shadow(0 3px 6px rgba(21,101,192,.25));
    }
    .folder-icon__tab {
      position: absolute; top: 0; left: 10px;
      width: 36px; height: 14px; border-radius: 6px 6px 0 0;
    }
    .folder-icon__body {
      position: absolute; bottom: 0; left: 0; right: 0; top: 10px;
      border-radius: 10px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .folder-icon__mat { font-size: 56px; width: 56px; height: 56px; opacity: .85; }
    .folder-icon__score {
      position: absolute; bottom: 6px; right: 6px;
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
      background: rgba(255,255,255,.75);
    }

    /* Couleur unique pour tous les dossiers */
    .folder-icon .folder-icon__tab  { background: #1565C0; }
    .folder-icon .folder-icon__body { background: #BBDEFB; }
    .folder-icon .folder-icon__mat  { color: #1565C0; }
    .folder-icon .folder-icon__score { color: #1565C0; }

    .folder-meta { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
    .folder-name { font-size: 13px; font-weight: 600; color: #1A1C1E; line-height: 1.35; word-break: break-word; text-align: center; }
    .folder-sub  { font-size: 11px; font-weight: 500; }
    .sub--re { color: #006B57; }
    .sub--mg { color: #162351; }
    .folder-resp { font-size: 11px; color: #6F7978; }

    .folder-status {
      position: absolute; top: 12px; right: 12px;
      width: 9px; height: 9px; border-radius: 50%;
      border: 2px solid #FFFBFE;
    }
    .fs--high { background: #386A20; }
    .fs--mid  { background: #7B4F00; }
    .fs--low  { background: #BA1A1A; }

    /* ══ LIST VIEW ════════════════════════════════════════ */
    .file-list { display: flex; flex-direction: column; overflow-y: auto; padding: 12px 20px; gap: 0; }

    .list-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr 1.2fr 1fr 40px;
      padding: 6px 14px 8px;
      gap: 12px;
    }
    .list-header span {
      font-size: 11px; font-weight: 700; color: #6F7978;
      text-transform: uppercase; letter-spacing: .6px;
    }

    .list-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr 1.2fr 1fr 40px;
      align-items: center; gap: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer; transition: background .12s;
      position: relative;
    }
    .list-row:hover { background: #FFFBFE; }
    .list-row + .list-row { border-top: 1px solid #F0F2F5; }

    /* List row cells */
    .lr-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .lr-icon {
      width: 32px; height: 28px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .lr-icon::before {
      content: ''; position: absolute; top: 0; left: 4px;
      width: 10px; height: 4px; border-radius: 2px 2px 0 0;
    }
    .lr-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }

    /* Couleur unique pour tous les dossiers (liste) */
    .lr-icon { background: #BBDEFB; }
    .lr-icon::before { background: #1565C0; }
    .lr-icon mat-icon { color: #1565C0; }

    .lr-label { font-size: 14px; font-weight: 600; color: #1A1C1E; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .lr-site { font-size: 12.5px; font-weight: 500; }
    .site--re { color: #006B57; }
    .site--mg { color: #162351; }

    .lr-resp { display: flex; align-items: center; gap: 7px; }
    .resp-av {
      width: 24px; height: 24px; border-radius: 50%;
      background: #DDE3EA; color: #44474F;
      font-size: 9px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .lr-resp span { font-size: 12.5px; color: #44474F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .resp-none { color: #C8C6CA !important; }

    .lr-score { display: flex; align-items: center; gap: 8px; }
    .score-track { flex: 1; height: 5px; background: #E0E2EC; border-radius: 4px; overflow: hidden; min-width: 60px; }
    .score-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
    .sf--high { background: #386A20; }
    .sf--mid  { background: #7B4F00; }
    .sf--low  { background: #BA1A1A; }
    .score-pct { font-size: 12px; font-weight: 700; min-width: 32px; }
    .sp--high { color: #386A20; }
    .sp--mid  { color: #7B4F00; }
    .sp--low  { color: #BA1A1A; }

    .lr-status { font-size: 11.5px; font-weight: 500; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
    .stp--high { background: #C3EFAD; color: #386A20; }
    .stp--mid  { background: #FFDDB0; color: #7B4F00; }
    .stp--low  { background: #FFDAD6; color: #BA1A1A; }

    .lr-arrow { font-size: 18px; width: 18px; height: 18px; color: #C8C6CA; }
  `],
})
export class ClientListComponent implements OnInit, OnDestroy {
  clients      = signal<Client[]>([]);
  searchQuery  = signal('');
  healthFilter = signal('');
  siteFilter   = signal('');
  sortKey      = signal<SortKey>('nom');
  sortDir      = signal<'asc'|'desc'>('asc');
  viewMode     = signal<ViewMode>('grid');

  searchCtrl = new FormControl('');

  private dialog      = inject(MatDialog);
  private notifStream = inject(NotificationStreamService);
  private sub         = new Subscription();

  filteredClients = computed(() => {
    const s    = this.searchQuery().toLowerCase();
    const h    = this.healthFilter();
    const site = this.siteFilter();
    const k    = this.sortKey();
    const d    = this.sortDir() === 'asc' ? 1 : -1;

    let list = this.clients().filter(c => {
      if (s && !c.nom.toLowerCase().includes(s)) return false;
      if (site && c.site !== site) return false;
      if (h === 'ok'      && c.santePassation < 80)  return false;
      if (h === 'partial' && (c.santePassation < 50 || c.santePassation >= 80)) return false;
      if (h === 'alert'   && c.santePassation >= 50) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (k === 'nom')   return d * a.nom.localeCompare(b.nom);
      if (k === 'score') return d * (a.santePassation - b.santePassation);
      if (k === 'site')  return d * a.site.localeCompare(b.site);
      return 0;
    });
  });

  sortedClients = computed(() => this.clients());

  constructor(private clientsService: ClientsService, public auth: AuthService) {}

  ngOnInit() {
    this.load();
    this.searchCtrl.valueChanges.pipe(debounceTime(200)).subscribe(v => this.searchQuery.set(v ?? ''));
    this.sub.add(
      this.notifStream.newNotif$.pipe(filter(n => n.type === 'CLIENT_ASSIGNED')).subscribe(() => this.load())
    );
  }
  ngOnDestroy() { this.sub.unsubscribe(); }

  load() { this.clientsService.getAll().subscribe(data => this.clients.set(data)); }

  setSort(k: SortKey) {
    if (this.sortKey() === k) this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    else { this.sortKey.set(k); this.sortDir.set('asc'); }
  }

  openCreateDialog() {
    const ref = this.dialog.open(CreateClientWizardComponent, {
      panelClass: ['rounded-dialog', 'no-pad-dialog'],
      maxWidth: '700px',
      width: '700px',
      height: '90vh',
      maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(client => {
      if (client?.id) this.load();
    });
  }

  countByHealth(h: string) {
    if (h === 'ok')      return this.clients().filter(c => c.santePassation >= 80).length;
    if (h === 'partial') return this.clients().filter(c => c.santePassation >= 50 && c.santePassation < 80).length;
    return this.clients().filter(c => c.santePassation < 50).length;
  }

  folderColorClass(s: number) { return s >= 80 ? 'fc--high' : s >= 50 ? 'fc--mid' : 'fc--low'; }
  statusDotClass(s: number)   { return s >= 80 ? 'folder-status fs--high' : s >= 50 ? 'folder-status fs--mid' : 'folder-status fs--low'; }
  scoreBarClass(s: number)    { return s >= 80 ? 'score-fill sf--high' : s >= 50 ? 'score-fill sf--mid' : 'score-fill sf--low'; }
  scoreTxtClass(s: number)    { return s >= 80 ? 'score-pct sp--high' : s >= 50 ? 'score-pct sp--mid' : 'score-pct sp--low'; }
  statusPillClass(s: number)  { return s >= 80 ? 'lr-status stp--high' : s >= 50 ? 'lr-status stp--mid' : 'lr-status stp--low'; }
  getStatusLabel(s: number)   { return s >= 80 ? 'Transmissible' : s >= 50 ? 'En cours' : 'Alerte'; }
  getInitials(nom: string)    { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
}
