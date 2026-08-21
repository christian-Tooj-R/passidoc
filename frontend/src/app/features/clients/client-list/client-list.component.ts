import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription, debounceTime } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NotificationStreamService } from '../../../core/services/notification-stream.service';
import { ClientsService } from '../../../core/services/clients.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { Client } from '../../../core/models/client.model';
import { CreateClientWizardComponent } from './create-client-wizard.component';

type SortKey = 'nom' | 'score' | 'site' | 'date';
interface CollabOption { id: number; label: string; }
type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatDialogModule,
    MatTooltipModule, MatRippleModule, MatSnackBarModule, MatProgressBarModule,
  ],
  template: `
    <div class="explorer">

      <!-- ══ TOOLBAR ════════════════════════════════════════ -->
      <div class="toolbar">

        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <mat-icon class="bc-home">folder_shared</mat-icon>
          <mat-icon class="bc-sep">chevron_right</mat-icon>
          <span class="bc-current">Tous les dossiers</span>
          @if (siteFilter()) {
            <mat-icon class="bc-sep">chevron_right</mat-icon>
            <span class="bc-current">{{ siteFilter() === 'REUNION' ? (tenantSvc.poleFlag1() + ' ' + tenantSvc.poleLabel1()) : (tenantSvc.poleFlag2() + ' ' + tenantSvc.poleLabel2()) }}</span>
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
        @if (auth.canCreateDossier()) {
          <button class="btn-new-folder" (click)="openCreateDialog()" matTooltip="Nouveau dossier">
            <mat-icon>create_new_folder</mat-icon>
            <span>Nouveau</span>
          </button>
        }

      </div>

      <!-- ══ FILTER BAR ══════════════════════════════════════ -->
      <div class="filter-bar">

        <!-- Complétude -->
        <button class="fchip" [class.fchip--active]="healthFilter()===''"        (click)="healthFilter.set('')">
          Tous <span class="fchip-count">{{ clients().length }}</span>
        </button>
        <button class="fchip fchip--green"  [class.fchip--active]="healthFilter()==='ok'"      (click)="healthFilter.set('ok')">
          <span class="fdot fdot--green"></span> Complet <span class="fchip-count">{{ countByHealth('ok') }}</span>
        </button>
        <button class="fchip fchip--orange" [class.fchip--active]="healthFilter()==='partial'" (click)="healthFilter.set('partial')">
          <span class="fdot fdot--orange"></span> En cours <span class="fchip-count">{{ countByHealth('partial') }}</span>
        </button>
        <button class="fchip fchip--red"    [class.fchip--active]="healthFilter()==='alert'"   (click)="healthFilter.set('alert')">
          <span class="fdot fdot--red"></span> Incomplet <span class="fchip-count">{{ countByHealth('alert') }}</span>
        </button>

        <div class="fchip-sep"></div>

        <!-- Mes dossiers -->
        <button class="fchip fchip--me" [class.fchip--active]="mesDossiers()" (click)="toggleMesDossiers()">
          <mat-icon>person</mat-icon> Mes dossiers
        </button>

        <div class="toolbar__spacer"></div>

        <!-- Résumé filtres actifs -->
        @if (activeFilterCount() > 0 && !showFilterPanel()) {
          <div class="filter-active-summary">
            @if (collabFilter()) {
              <span class="fas-chip">
                <mat-icon>person</mat-icon>{{ collabFilterLabel() }}
                <button (click)="setCollabFilter(null)"><mat-icon>close</mat-icon></button>
              </span>
            }
            @if (siteFilter()) {
              <span class="fas-chip">
                {{ siteFilter() === 'REUNION' ? tenantSvc.poleFlag1() : tenantSvc.poleFlag2() }} {{ siteFilter() === 'REUNION' ? tenantSvc.poleLabel1() : tenantSvc.poleLabel2() }}
                <button (click)="siteFilter.set('')"><mat-icon>close</mat-icon></button>
              </span>
            }
          </div>
        }

        <!-- Bouton Filtrer -->
        <button class="btn-filter" [class.btn-filter--active]="showFilterPanel()" (click)="showFilterPanel.set(!showFilterPanel())">
          <mat-icon>tune</mat-icon>
          Filtrer
          @if (activeFilterCount() > 0) {
            <span class="btn-filter__badge">{{ activeFilterCount() }}</span>
          }
        </button>

      </div>

      <!-- ══ FILTER PANEL ══════════════════════════════════════ -->
      @if (showFilterPanel()) {
        <div class="filter-panel">

          <!-- Intervenants / Fonction -->
          <div class="fp-group">
            <label class="fp-label">Intervenants / Fonction</label>
            <div class="fp-interv">
              <div class="iv-filter">
                <mat-icon class="iv-icon">group</mat-icon>
                @if (collabFilter()) {
                  <span class="iv-chip">
                    {{ collabFilterLabel() }}
                    <button class="iv-chip-x" (click)="setCollabFilter(null)"><mat-icon>close</mat-icon></button>
                  </span>
                } @else {
                  <select class="iv-select"
                    (change)="setCollabFilter(+$any($event.target).value || null); $any($event.target).value = ''">
                    <option value="">— Sélectionner un intervenant —</option>
                    @for (u of uniqueCollabs(); track u.id) {
                      <option [value]="u.id">{{ u.label }}</option>
                    }
                  </select>
                }
              </div>
            </div>
          </div>

          <!-- Site -->
          <div class="fp-group">
            <label class="fp-label">Site</label>
            <div class="fp-site-chips">
              <button class="fchip" [class.fchip--active]="siteFilter()===''"          (click)="siteFilter.set('')">
                <mat-icon>public</mat-icon> Tous
              </button>
              <button class="fchip" [class.fchip--active]="siteFilter()==='REUNION'"   (click)="siteFilter.set('REUNION')">
                {{ tenantSvc.poleFlag1() }} {{ tenantSvc.poleLabel1() }}
              </button>
              <button class="fchip" [class.fchip--active]="siteFilter()==='MADAGASCAR'" (click)="siteFilter.set('MADAGASCAR')">
                {{ tenantSvc.poleFlag2() }} {{ tenantSvc.poleLabel2() }}
              </button>
            </div>
          </div>

          <!-- Réinitialiser -->
          @if (activeFilterCount() > 0) {
            <button class="fp-reset" (click)="resetFilters()">
              <mat-icon>restart_alt</mat-icon> Réinitialiser les filtres
            </button>
          }

        </div>
      }

      <!-- ══ LOADING ═══════════════════════════════════════ -->
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" class="list-loading-bar"></mat-progress-bar>
        <div class="sk-grid">
          @for (_ of [1,2,3,4,5,6,7,8]; track $index) {
            <div class="sk-folder"></div>
          }
        </div>
      }

      <!-- ══ GRID VIEW ══════════════════════════════════════ -->
      @if (!loading() && viewMode() === 'grid') {
        @if (filteredClients().length === 0) {
          <div class="empty">
            <mat-icon>folder_off</mat-icon>
            <p>Aucun dossier trouvé</p>
          </div>
        } @else {
          <div class="file-grid">
            @for (c of filteredClients(); track c.id) {
              <div class="folder-item" matRipple
                   [routerLink]="confirmDeleteId() === c.id ? null : ['/clients', c.id]">

                <!-- Cover : fond clair + barre d'accent + emoji -->
                <div class="folder-cover" [style.background]="getSectorConfig(c.secteurActivite).bg">
                  <div class="folder-cover__bar" [style.background]="getSectorConfig(c.secteurActivite).accent"></div>
                  <span class="folder-cover__emoji">{{ getSectorConfig(c.secteurActivite).emoji }}</span>
                  <span [class]="statusDotClass(score(c))" [matTooltip]="getStatusLabel(score(c))"></span>
                  @if (!canEdit(c)) {
                    <span class="folder-readonly-badge" matTooltip="Lecture seule — vous n'êtes pas assigné à ce dossier">
                      <mat-icon>lock_outline</mat-icon>
                    </span>
                  }
                  @if (canDelete(c) && confirmDeleteId() !== c.id) {
                    <button class="folder-del-btn" matTooltip="Supprimer le dossier"
                            (click)="initDelete(c.id, $event)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  }
                </div>

                <!-- Confirmation suppression -->
                @if (confirmDeleteId() === c.id) {
                  <div class="folder-confirm" (click)="$event.stopPropagation()">
                    <mat-icon class="fc-icon">warning_amber</mat-icon>
                    <span class="fc-text">Supprimer <strong>{{ c.nom }}</strong> ?</span>
                    <p class="fc-sub">Cette action est irréversible.</p>
                    <div class="fc-btns">
                      <button class="fc-btn fc-btn--cancel" (click)="cancelDelete($event)">Annuler</button>
                      <button class="fc-btn fc-btn--danger" [disabled]="deleting()"
                              (click)="executeDelete(c.id, $event)">
                        {{ deleting() ? '…' : 'Supprimer' }}
                      </button>
                    </div>
                  </div>
                }

                <!-- Body -->
                <div class="folder-body">
                  <span class="folder-name">{{ c.nom }}</span>
                  <div class="folder-sub-row">
                    <span class="folder-site" [class]="c.site==='REUNION' ? 'sub--re' : 'sub--mg'">
                      {{ c.site === 'REUNION' ? (tenantSvc.poleFlag1() + ' ' + tenantSvc.poleLabel1()) : (tenantSvc.poleFlag2() + ' ' + tenantSvc.poleLabel2()) }}
                    </span>
                    @if (c.secteurActivite) {
                      <span class="folder-sec-sep">·</span>
                      <span class="folder-sec-label" [style.color]="getSectorConfig(c.secteurActivite).accent">
                        {{ getSectorConfig(c.secteurActivite).shortLabel }}
                      </span>
                    }
                  </div>
                  <div class="folder-prog-row">
                    <span class="fp-tag">ADN</span>
                    <div class="fp-track">
                      <div class="fp-fill" [style.width.%]="score(c)" [style.background]="ringColor(score(c))"></div>
                    </div>
                    <span class="fp-pct" [style.color]="ringColor(score(c))">{{ score(c) }}%</span>
                  </div>
                  <div class="folder-prog-row">
                    <span class="fp-tag fp-tag--pilot">Pilotage</span>
                    <div class="fp-track">
                      <div class="fp-fill" [style.width.%]="scorePilotage(c)" [style.background]="ringColor(scorePilotage(c))"></div>
                    </div>
                    <span class="fp-pct" [style.color]="ringColor(scorePilotage(c))">{{ scorePilotage(c) }}%</span>
                  </div>
                  <!-- Intervenants -->
                  <div class="folder-interv">
                    @if (c.directeur) {
                      <span class="fi-av fi-av--dir" [title]="'Directeur : ' + c.directeur.firstName + ' ' + c.directeur.lastName">
                        {{ c.directeur.firstName[0] }}{{ c.directeur.lastName[0] }}
                      </span>
                    }
                    @if (c.responsable) {
                      <span class="fi-av fi-av--run" [title]="'Collab. RUN : ' + c.responsable.firstName + ' ' + c.responsable.lastName">
                        {{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}
                      </span>
                    }
                    @if (c.collaborateurMg) {
                      <span class="fi-av fi-av--mg" [title]="'Collab. MADA : ' + c.collaborateurMg.firstName + ' ' + c.collaborateurMg.lastName">
                        {{ c.collaborateurMg.firstName[0] }}{{ c.collaborateurMg.lastName[0] }}
                      </span>
                    }
                    @if (!c.directeur && !c.responsable && !c.collaborateurMg) {
                      <span class="fi-none">Non assigné</span>
                    }
                  </div>
                </div>

              </div>
            }
          </div>
        }
      }

      <!-- ══ LIST VIEW ══════════════════════════════════════ -->
      @if (!loading() && viewMode() === 'list') {
        <div class="file-list">
          <!-- Header -->
          <div class="list-header">
            <span class="lh-name">Nom</span>
            <span class="lh-site">Site</span>
            <span class="lh-resp">Intervenants</span>
            <span class="lh-score">Complétude</span><!-- ADN + Pilotage -->
            <span class="lh-status">Statut</span>
            <span class="lh-action"></span>
          </div>

          @if (!loading() && filteredClients().length === 0) {
            <div class="empty">
              <mat-icon>folder_off</mat-icon>
              <p>Aucun dossier trouvé</p>
            </div>
          }

          @for (c of filteredClients(); track c.id) {
            <div class="list-row" matRipple
                 [routerLink]="confirmDeleteId() === c.id ? null : ['/clients', c.id]"
                 [class.list-row--confirming]="confirmDeleteId() === c.id">

              <!-- Icon + name -->
              <div class="lr-name">
                <div class="lr-icon" [style.background]="getSectorConfig(c.secteurActivite).bg">
                  <mat-icon [style.color]="getSectorConfig(c.secteurActivite).accent">
                    {{ getSectorConfig(c.secteurActivite).icon }}
                  </mat-icon>
                </div>
                <span class="lr-label">{{ c.nom }}</span>
                @if (!canEdit(c)) {
                  <mat-icon class="lr-lock" matTooltip="Lecture seule — vous n'êtes pas assigné à ce dossier">lock_outline</mat-icon>
                }
              </div>

              <!-- Site -->
              <span class="lr-site" [class]="c.site==='REUNION' ? 'site--re' : 'site--mg'">
                {{ c.site === 'REUNION' ? (tenantSvc.poleFlag1() + ' ' + tenantSvc.poleLabel1()) : (tenantSvc.poleFlag2() + ' ' + tenantSvc.poleLabel2()) }}
              </span>

              <!-- Intervenants -->
              <div class="lr-resp">
                @if (c.directeur) {
                  <span class="fi-av fi-av--dir" [title]="'Directeur : ' + c.directeur.firstName + ' ' + c.directeur.lastName">
                    {{ c.directeur.firstName[0] }}{{ c.directeur.lastName[0] }}
                  </span>
                }
                @if (c.responsable) {
                  <span class="fi-av fi-av--run" [title]="'Collab. RUN : ' + c.responsable.firstName + ' ' + c.responsable.lastName">
                    {{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}
                  </span>
                }
                @if (c.collaborateurMg) {
                  <span class="fi-av fi-av--mg" [title]="'Collab. MADA : ' + c.collaborateurMg.firstName + ' ' + c.collaborateurMg.lastName">
                    {{ c.collaborateurMg.firstName[0] }}{{ c.collaborateurMg.lastName[0] }}
                  </span>
                }
                @if (!c.directeur && !c.responsable && !c.collaborateurMg) {
                  <span class="resp-none">—</span>
                }
              </div>

              <!-- Score -->
              <div class="lr-score">
                <div class="lr-score-row">
                  <span class="lsr-tag">ADN</span>
                  <div class="score-track">
                    <div class="score-fill" [style.width.%]="score(c)" [style.background]="ringColor(score(c))"></div>
                  </div>
                  <span class="score-pct" [style.color]="ringColor(score(c))">{{ score(c) }}%</span>
                </div>
                <div class="lr-score-row">
                  <span class="lsr-tag lsr-tag--pilot">Pilotage</span>
                  <div class="score-track">
                    <div class="score-fill" [style.width.%]="scorePilotage(c)" [style.background]="ringColor(scorePilotage(c))"></div>
                  </div>
                  <span class="score-pct" [style.color]="ringColor(scorePilotage(c))">{{ scorePilotage(c) }}%</span>
                </div>
              </div>

              <!-- Status -->
              <span class="lr-status" [class]="statusPillClass(score(c))">{{ getStatusLabel(score(c)) }}</span>

              <!-- Supprimer (créateur ou admin) -->
              @if (canDelete(c)) {
                @if (confirmDeleteId() === c.id) {
                  <div class="lr-confirm" (click)="$event.stopPropagation()">
                    <button class="lrc-btn lrc-btn--cancel" (click)="cancelDelete($event)">Annuler</button>
                    <button class="lrc-btn lrc-btn--danger" [disabled]="deleting()"
                            (click)="executeDelete(c.id, $event)">
                      {{ deleting() ? '…' : 'Supprimer' }}
                    </button>
                  </div>
                } @else {
                  <button class="lr-del-btn" matTooltip="Supprimer le dossier"
                          (click)="initDelete(c.id, $event)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                }
              }

              <!-- Arrow -->
              @if (confirmDeleteId() !== c.id) {
                <mat-icon class="lr-arrow">chevron_right</mat-icon>
              }

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
    .fchip--me.fchip--active { background: #E3F2FD !important; border-color: #1565C0; color: #1565C0; }
    /* Filtre intervenants */
    .iv-filter {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid #C8C6CA; border-radius: 8px; padding: 4px 10px;
      background: transparent; transition: border-color .12s;
    }
    .iv-filter:focus-within { border-color: #6366f1; }
    .iv-icon { font-size: 14px; width: 14px; height: 14px; color: #44474F; }
    .iv-chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: #EEF2FF; color: #3730A3; font-size: 12px; font-weight: 600;
      padding: 1px 4px 1px 8px; border-radius: 6px;
    }
    .iv-chip-x {
      background: none; border: none; cursor: pointer; padding: 0;
      display: flex; align-items: center; color: #6366f1;
    }
    .iv-chip-x mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .iv-select, .iv-fonc {
      border: none; background: transparent; outline: none;
      font-size: 12.5px; font-weight: 500; color: #44474F;
      font-family: 'Inter', sans-serif; cursor: pointer;
    }
    .iv-fonc {
      border-left: 1px solid #E0E2EC; padding-left: 8px; margin-left: 2px;
    }

    /* Bouton Filtrer */
    .btn-filter {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid #C8C6CA; background: transparent;
      border-radius: 8px; padding: 5px 12px;
      font-size: 12.5px; font-weight: 600; color: #44474F;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: all .12s;
      white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .btn-filter:hover { background: #E8EAED; }
    .btn-filter--active { background: #E8DEF8; border-color: #6B4EFF; color: #21005D; }
    .btn-filter__badge {
      background: #6B4EFF; color: #fff; font-size: 10px; font-weight: 700;
      min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }

    /* Résumé filtres actifs */
    .filter-active-summary { display: flex; align-items: center; gap: 6px; }
    .fas-chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: #EEF2FF; color: #3730A3; font-size: 11.5px; font-weight: 600;
      padding: 2px 4px 2px 8px; border-radius: 6px;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      button { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; color: #6366f1; }
    }

    /* ══ FILTER PANEL ══════════════════════════════════════ */
    .filter-panel {
      display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;
      padding: 14px 20px 14px;
      background: #F8F9FF;
      border-bottom: 1px solid #C7CAFF;
      flex-shrink: 0;
      animation: fp-slide-in .15s ease;
    }
    @keyframes fp-slide-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fp-group { display: flex; flex-direction: column; gap: 7px; }
    .fp-label {
      font-size: 10px; font-weight: 700; color: #6366f1;
      text-transform: uppercase; letter-spacing: .7px;
    }
    .fp-interv { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .fp-interv .iv-filter {
      background: #fff; border-color: #C7CAFF; min-width: 220px;
    }
    .fp-interv .iv-fonc {
      border: 1px solid #C7CAFF; border-radius: 7px; padding: 5px 8px;
      background: #fff; font-size: 12.5px; outline: none; cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .fp-site-chips { display: flex; align-items: center; gap: 6px; }
    .fp-reset {
      align-self: flex-end; margin-left: auto;
      display: inline-flex; align-items: center; gap: 5px;
      border: none; background: transparent; color: #B91C1C;
      font-size: 12px; font-weight: 600; cursor: pointer;
      font-family: 'Inter', sans-serif; padding: 4px 8px; border-radius: 7px;
      transition: background .12s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #FEE2E2; }
    }

    /* Avatars intervenants */
    .folder-interv { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
    .fi-av {
      width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
      font-size: 8.5px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      cursor: default; text-transform: uppercase;
    }
    .fi-av--dir { background: #EDE9FE; color: #5B21B6; }
    .fi-av--run { background: #C8F8EE; color: #006B57; }
    .fi-av--mg  { background: #DDE3EA; color: #162351; }
    .fi-none { font-size: 10px; color: #C8C6CA; font-style: italic; }
    /* Barre de complétude sur les folder cards */
    .folder-completude { width: 100%; margin-top: 6px; }
    .fc-track { height: 3px; background: #E8EAED; border-radius: 2px; overflow: hidden; }
    .fc-fill { height: 100%; border-radius: 2px; transition: width .3s; }
    .fc--high { background: #386A20; }
    .fc--mid  { background: #7B4F00; }
    .fc--low  { background: #BA1A1A; }

    /* ══ EMPTY ════════════════════════════════════════════ */
    .empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 24px; gap: 12px; color: #6F7978;
    }
    .empty mat-icon { font-size: 52px; width: 52px; height: 52px; }
    .empty p { font-size: 15px; font-weight: 500; margin: 0; }

    /* ══ SKELETON LOADING ════════════════════════════════ */
    .list-loading-bar { margin-bottom: 16px; }
    .sk-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 10px;
      padding: 16px 20px;
    }
    .sk-folder {
      height: 158px; border-radius: 14px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: sk-shimmer 1.4s infinite;
    }
    @keyframes sk-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    :host-context([data-theme="dark"]) .sk-folder,
    :host-context(.dark-theme) .sk-folder {
      background: linear-gradient(90deg, #2a2d3a 25%, #333748 50%, #2a2d3a 75%);
      background-size: 200% 100%;
    }

    /* ══ GRID VIEW ════════════════════════════════════════ */
    .file-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 10px;
      padding: 16px 20px 24px;
      overflow-y: auto;
      align-content: start;
    }

    .folder-item {
      display: flex; flex-direction: column;
      background: #fff;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,.08);
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      overflow: hidden;
      cursor: pointer;
      position: relative;
      transition: box-shadow .15s, transform .15s;
    }
    .folder-item:hover { box-shadow: 0 6px 20px rgba(0,0,0,.11); transform: translateY(-2px); }
    .folder-item:active { transform: translateY(0); box-shadow: 0 1px 4px rgba(0,0,0,.05); }

    /* Cover fond clair */
    .folder-cover {
      width: 100%; height: 90px;
      display: flex; align-items: center; justify-content: center;
      position: relative; flex-shrink: 0; overflow: hidden;
    }
    /* Barre d'accent colorée en haut */
    .folder-cover__bar {
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
    }
    .folder-cover__emoji {
      font-size: 2.5rem; line-height: 1;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,.10));
      user-select: none;
    }
    /* Status dot */
    .folder-dot {
      position: absolute; top: 10px; right: 10px;
      width: 8px; height: 8px; border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,.9);
    }
    .fd--high { background: #4CAF50; }
    .fd--mid  { background: #F59E0B; }
    .fd--low  { background: #EF4444; }
    /* Badge lecture seule (cadenas) */
    .folder-readonly-badge {
      position: absolute; top: 8px; right: 8px;
      width: 22px; height: 22px; border-radius: 6px;
      background: rgba(255,255,255,.75); color: #9CA3AF;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    /* Bouton supprimer sur la cover */
    .folder-del-btn {
      position: absolute; top: 8px; left: 8px;
      width: 26px; height: 26px; border: none; border-radius: 7px;
      background: rgba(0,0,0,.12); color: #374151; cursor: pointer;
      display: none; align-items: center; justify-content: center;
      transition: background .12s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: rgba(185,28,28,.15); color: #B91C1C; }
    }
    .folder-item:hover .folder-del-btn { display: flex; }

    /* Body de la carte */
    .folder-body {
      display: flex; flex-direction: column; gap: 3px;
      padding: 9px 12px 11px;
    }
    .folder-name {
      font-size: 13px; font-weight: 700; color: #1A1C1E; line-height: 1.35;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .folder-sub-row { display: flex; align-items: center; gap: 4px; overflow: hidden; margin-top: 1px; }
    .folder-site { font-size: 11px; font-weight: 500; white-space: nowrap; }
    .sub--re { color: #006B57; }
    .sub--mg { color: #1E3A5F; }
    .folder-sec-sep { font-size: 10px; color: #C4C9D4; flex-shrink: 0; }
    .folder-sec-label { font-size: 11px; font-weight: 500; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Progress bars */
    .folder-prog-row { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
    .fp-tag {
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
      color: #6366f1; background: #EEF2FF; border-radius: 3px;
      padding: 1px 4px; flex-shrink: 0; min-width: 26px; text-align: center;
    }
    .fp-tag--pilot { color: #059669; background: #D1FAE5; }
    .fp-track { flex: 1; height: 4px; background: #EEF0F4; border-radius: 3px; overflow: hidden; }
    .fp-fill { height: 100%; border-radius: 3px; transition: width .4s ease; }
    .fp-pct { font-size: 11px; font-weight: 700; min-width: 28px; text-align: right; color: #64748B; }

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

    /* List icon — sector color applied via [style] binding */
    .lr-icon::before { display: none; }

    .lr-label { font-size: 14px; font-weight: 600; color: #1A1C1E; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lr-lock { font-size: 14px; width: 14px; height: 14px; color: #9CA3AF; flex-shrink: 0; }

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

    .lr-score { display: flex; flex-direction: column; gap: 5px; }
    .lr-score-row { display: flex; align-items: center; gap: 6px; }
    .lsr-tag {
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
      color: #6366f1; background: #EEF2FF; border-radius: 3px;
      padding: 1px 4px; flex-shrink: 0; min-width: 30px; text-align: center;
    }
    .lsr-tag--pilot { color: #059669; background: #D1FAE5; }
    .score-track { flex: 1; height: 4px; background: #E0E2EC; border-radius: 4px; overflow: hidden; min-width: 50px; }
    .score-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
    .sf--high { background: #386A20; }
    .sf--mid  { background: #7B4F00; }
    .sf--low  { background: #BA1A1A; }
    .score-pct { font-size: 11px; font-weight: 700; min-width: 28px; }
    .sp--high { color: #386A20; }
    .sp--mid  { color: #7B4F00; }
    .sp--low  { color: #BA1A1A; }

    .lr-status { font-size: 11.5px; font-weight: 500; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
    .stp--high { background: #C3EFAD; color: #386A20; }
    .stp--mid  { background: #FFDDB0; color: #7B4F00; }
    .stp--low  { background: #FFDAD6; color: #BA1A1A; }

    .lr-arrow { font-size: 18px; width: 18px; height: 18px; color: #C8C6CA; }

    /* ── Suppression grille ────────────────────────────────────── */
    .folder-del-btn {
      position: absolute; top: 8px; right: 8px; z-index: 2;
      width: 28px; height: 28px; border: none; border-radius: 8px;
      background: rgba(220,38,38,.09); color: #DC2626; cursor: pointer;
      display: none; align-items: center; justify-content: center;
      transition: background .15s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
      &:hover { background: rgba(220,38,38,.18); }
    }
    .folder-item:hover .folder-del-btn { display: flex; }

    .folder-confirm {
      position: absolute; inset: 0; border-radius: inherit; z-index: 3;
      background: rgba(255,255,255,.97);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 8px; padding: 16px; text-align: center;
      backdrop-filter: blur(4px);
    }
    .fc-icon { font-size: 28px; width: 28px; height: 28px; color: #F59E0B; }
    .fc-text { font-size: 13px; font-weight: 600; color: #1E293B; line-height: 1.4;
               strong { color: #0F172A; } }
    .fc-sub  { font-size: 11px; color: #94A3B8; margin: 0; }
    .fc-btns { display: flex; gap: 8px; margin-top: 2px; }
    .fc-btn  { padding: 7px 16px; border-radius: 8px; border: none; cursor: pointer;
               font-size: 12.5px; font-weight: 600; font-family: inherit;
               transition: background .12s;
               &--cancel { background: #F1F5F9; color: #64748B; &:hover { background: #E2E8F0; } }
               &--danger { background: #DC2626; color: white; &:hover { background: #B91C1C; }
                           &:disabled { opacity: .6; cursor: not-allowed; } } }

    /* ── Suppression liste ─────────────────────────────────────── */
    .lr-del-btn {
      width: 30px; height: 30px; border: none; border-radius: 8px; flex-shrink: 0;
      background: rgba(220,38,38,.08); color: #EF4444; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .15s, background .15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: rgba(220,38,38,.16); }
    }
    .list-row:hover .lr-del-btn { opacity: 1; }
    .list-row--confirming { background: #FFF5F5 !important; }

    .lr-confirm {
      display: flex; align-items: center; gap: 7px; flex-shrink: 0;
    }
    .lrc-btn { padding: 5px 13px; border-radius: 7px; border: none; cursor: pointer;
               font-size: 12px; font-weight: 600; font-family: inherit; white-space: nowrap;
               transition: background .12s;
               &--cancel { background: #F1F5F9; color: #64748B; &:hover { background: #E2E8F0; } }
               &--danger { background: #DC2626; color: white; &:hover { background: #B91C1C; }
                           &:disabled { opacity: .6; cursor: not-allowed; } } }
  `],
})
export class ClientListComponent implements OnInit, OnDestroy {
  clients         = signal<Client[]>([]);
  loading         = signal(true);
  searchQuery     = signal('');
  healthFilter    = signal('');
  siteFilter      = signal('');
  mesDossiers     = signal(false);
  collabFilter    = signal<number | null>(null);
  fonctionFilter  = signal<string>('');
  sortKey         = signal<SortKey>('date');
  sortDir         = signal<'asc'|'desc'>('asc');
  viewMode        = signal<ViewMode>('grid');
  confirmDeleteId = signal<number | null>(null);
  deleting        = signal(false);
  showFilterPanel = signal(false);

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.collabFilter()) count++;
    if (this.siteFilter()) count++;
    return count;
  });

  searchCtrl = new FormControl('');

  private dialog      = inject(MatDialog);
  private notifStream = inject(NotificationStreamService);
  private sub         = new Subscription();
  tenantSvc           = inject(TenantService);

  uniqueCollabs = computed<CollabOption[]>(() => {
    const seen = new Set<number>();
    const out: CollabOption[] = [];
    for (const c of this.clients()) {
      for (const u of [c.directeur, c.responsable, c.collaborateurMg]) {
        if (u && !seen.has(u.id)) {
          seen.add(u.id);
          out.push({ id: u.id, label: `${u.firstName} ${u.lastName}` });
        }
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  });

  collabFilterLabel = computed(() => {
    const id = this.collabFilter();
    return id ? (this.uniqueCollabs().find(u => u.id === id)?.label ?? '') : '';
  });

  filteredClients = computed(() => {
    const s      = this.searchQuery().toLowerCase();
    const h      = this.healthFilter();
    const site   = this.siteFilter();
    const mes    = this.mesDossiers();
    const collab = this.collabFilter();
    const meId   = this.auth.currentUser()?.id;
    const k      = this.sortKey();
    const d      = this.sortDir() === 'asc' ? 1 : -1;

    let list = this.clients().filter(c => {
      const score = c.completude || c.santePassation;
      if (s && !c.nom.toLowerCase().includes(s)) return false;
      if (site && c.site !== site) return false;
      if (h === 'ok'      && score < 80)                    return false;
      if (h === 'partial' && (score < 50 || score >= 80))   return false;
      if (h === 'alert'   && score >= 50)                   return false;
      if (mes && meId && c.responsable?.id !== meId && c.collaborateurMg?.id !== meId && c.directeur?.id !== meId) return false;
      if (collab) {
        const fonc = this.fonctionFilter();
        if (fonc === 'DIRECTEUR'   && c.directeur?.id     !== collab) return false;
        if (fonc === 'COLLAB_RUN'  && c.responsable?.id   !== collab) return false;
        if (fonc === 'COLLAB_MADA' && c.collaborateurMg?.id !== collab) return false;
        if (!fonc && c.directeur?.id !== collab && c.responsable?.id !== collab && c.collaborateurMg?.id !== collab) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const sa = a.completude || a.santePassation;
      const sb = b.completude || b.santePassation;
      if (k === 'nom')   return d * a.nom.localeCompare(b.nom);
      if (k === 'score') return d * (sa - sb);
      if (k === 'site')  return d * a.site.localeCompare(b.site);
      if (k === 'date')  return d * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return 0;
    });
  });

  sortedClients = computed(() => this.clients());

  private snack = inject(MatSnackBar);

  constructor(private clientsService: ClientsService, public auth: AuthService) {}

  ngOnInit() {
    this.load();
    this.searchCtrl.valueChanges.pipe(debounceTime(200)).subscribe(v => this.searchQuery.set(v ?? ''));
    this.sub.add(
      this.notifStream.newNotif$.pipe(filter(n => n.type === 'CLIENT_ASSIGNED')).subscribe(() => this.load())
    );
  }
  ngOnDestroy() { this.sub.unsubscribe(); }

  load() {
    this.loading.set(true);
    this.clientsService.getAll().subscribe({
      next: data => { this.clients.set(data); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  canEdit(c: Client): boolean {
    if (this.auth.isAdmin() || this.auth.isExpert()) return true;
    const meId = this.auth.currentUser()?.id;
    if (!meId) return false;
    return c.directeur?.id === meId || c.responsable?.id === meId || c.collaborateurMg?.id === meId;
  }

  canDelete(c: Client): boolean {
    if (this.auth.isAdmin()) return true;
    const meId = this.auth.currentUser()?.id;
    if (!meId) return false;
    return c.createdById === meId || c.responsable?.id === meId;
  }

  initDelete(id: number, e: Event) {
    e.stopPropagation();
    e.preventDefault();
    this.confirmDeleteId.set(id);
  }

  cancelDelete(e: Event) {
    e.stopPropagation();
    this.confirmDeleteId.set(null);
  }

  executeDelete(id: number, e: Event) {
    e.stopPropagation();
    this.deleting.set(true);
    this.clientsService.delete(id).subscribe({
      next: () => {
        this.clients.set(this.clients().filter(c => c.id !== id));
        this.confirmDeleteId.set(null);
        this.deleting.set(false);
        this.snack.open('Dossier supprimé', undefined, { duration: 2500 });
      },
      error: () => {
        this.deleting.set(false);
        this.snack.open('Erreur lors de la suppression', undefined, { duration: 3000 });
      },
    });
  }

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

  score(c: Client)          { return c.completude || c.santePassation; }
  scorePilotage(c: Client)  { return c.completudePilotage ?? 0; }

  getSectorConfig(secteur?: string): { bg: string; accent: string; icon: string; label: string; imgSrc: string; emoji: string; shortLabel: string } {
    const m: Record<string, { bg: string; accent: string; icon: string; label: string; imgSrc: string; emoji: string; shortLabel: string }> = {
      RESTAURATION:        { bg: '#FFF7F2', accent: '#D0440A', icon: 'restaurant',        label: 'Hôtellerie-Restauration', imgSrc: 'sectors/restauration.svg', emoji: '🍽️', shortLabel: 'Restauration' },
      BTP:                 { bg: '#FFFBF0', accent: '#C46200', icon: 'construction',       label: 'BTP',                     imgSrc: 'sectors/btp.svg',          emoji: '🏗️', shortLabel: 'BTP' },
      ASSOCIATION:         { bg: '#F2FCF5', accent: '#1A7A3E', icon: 'volunteer_activism', label: 'Association',             imgSrc: 'sectors/association.svg',  emoji: '🤝', shortLabel: 'Association' },
      HOLDING:             { bg: '#F0F6FF', accent: '#1255A0', icon: 'account_balance',    label: 'Holding & Groupes',       imgSrc: 'sectors/holding.svg',      emoji: '🏢', shortLabel: 'Holding' },
      PROFESSION_LIBERALE: { bg: '#FAF2FF', accent: '#6B21A8', icon: 'work',              label: 'Profession Libérale',     imgSrc: 'sectors/prof_lib.svg',     emoji: '⚖️', shortLabel: 'Prof. Libérale' },
      SCI:                 { bg: '#FFF2F2', accent: '#B91C1C', icon: 'home_work',          label: 'SCI',                     imgSrc: 'sectors/sci.svg',          emoji: '🏠', shortLabel: 'SCI' },
    };
    return m[secteur!] ?? { bg: '#F8F9FB', accent: '#475569', icon: 'folder', label: 'Autre', imgSrc: 'sectors/default.svg', emoji: '📁', shortLabel: 'Autre' };
  }

  getScoreLevel(s: number): string { return s >= 80 ? 'high' : s >= 50 ? 'mid' : 'low'; }
  ringColor(s: number): string  { return `hsl(${Math.round(s * 1.2)}, 70%, 42%)`; }
  ringOffset(s: number): number { return 125.7 * (1 - s / 100); }

  countByHealth(h: string) {
    if (h === 'ok')      return this.clients().filter(c => this.score(c) >= 80).length;
    if (h === 'partial') return this.clients().filter(c => this.score(c) >= 50 && this.score(c) < 80).length;
    return this.clients().filter(c => this.score(c) < 50).length;
  }

  folderColorClass(s: number) { return s >= 80 ? 'fc--high' : s >= 50 ? 'fc--mid' : 'fc--low'; }
  statusDotClass(s: number)   { return s >= 80 ? 'folder-dot fd--high' : s >= 50 ? 'folder-dot fd--mid' : 'folder-dot fd--low'; }
  scoreBarClass(s: number)    { return s >= 80 ? 'score-fill sf--high' : s >= 50 ? 'score-fill sf--mid' : 'score-fill sf--low'; }
  scoreTxtClass(s: number)    { return s >= 80 ? 'score-pct sp--high' : s >= 50 ? 'score-pct sp--mid' : 'score-pct sp--low'; }
  statusPillClass(s: number)  { return s >= 80 ? 'lr-status stp--high' : s >= 50 ? 'lr-status stp--mid' : 'lr-status stp--low'; }
  getStatusLabel(s: number)   { return s >= 80 ? 'Complet' : s >= 50 ? 'En cours' : 'Incomplet'; }
  getInitials(nom: string)    { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

  toggleMesDossiers() {
    this.mesDossiers.update(v => !v);
    if (!this.mesDossiers()) this.collabFilter.set(null);
  }
  setCollabFilter(id: number | null) {
    this.collabFilter.set(id);
    if (id !== null) this.mesDossiers.set(false);
  }

  resetFilters() {
    this.collabFilter.set(null);
    this.fonctionFilter.set('');
    this.siteFilter.set('');
    this.healthFilter.set('');
    this.mesDossiers.set(false);
  }
}
