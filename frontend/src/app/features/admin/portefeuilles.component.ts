import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../core/services/toast.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { UsersService } from '../../core/services/users.service';
import { ClientsService } from '../../core/services/clients.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { Client } from '../../core/models/client.model';

interface CollabCard {
  user: User;
  clients: Client[];
  expanded: boolean;
}

@Component({
  selector: 'app-portefeuilles',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatSelectModule, MatTooltipModule, MatExpansionModule,
  ],
  template: `

    <!-- ══════════════════════════════════════════════════════
         VUE ADMIN
    ══════════════════════════════════════════════════════ -->
    @if (auth.isAdmin()) {
      <div class="page">

        <!-- En-tête -->
        <div class="page-header">
          <div class="page-header__left">
            <div class="page-icon-wrap">
              <mat-icon>folder_shared</mat-icon>
            </div>
            <div>
              <h1>Portefeuilles</h1>
              <p class="page-subtitle">Vue d'ensemble de la répartition des dossiers par collaborateur</p>
            </div>
          </div>
        </div>

        <!-- 4 stat cards globales -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card__icon indigo">
              <mat-icon>folder</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value">{{ allClients.length }}</span>
              <span class="stat-card__label">Total dossiers</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon amber">
              <mat-icon>warning_amber</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value" [class.text-amber]="unassignedCount > 0">{{ unassignedCount }}</span>
              <span class="stat-card__label">Non assignés</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon blue">
              <mat-icon>people</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value">{{ reunionCollabs.length }}</span>
              <span class="stat-card__label">Collaborateurs Réunion actifs</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon" [class]="avgScoreIconClass(globalAvgScore())">
              <mat-icon>trending_up</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value" [class]="avgScoreTextClass(globalAvgScore())">{{ globalAvgScore() }}%</span>
              <span class="stat-card__label">Score moyen global</span>
            </div>
          </div>
        </div>

        <!-- Filtres site -->
        <div class="filters-row">
          <button class="filter-chip" [class.active]="siteFilter === null" (click)="setSiteFilter(null)">
            <mat-icon>layers</mat-icon> Tous ({{ allClients.length }})
          </button>
          <button class="filter-chip" [class.active]="siteFilter === 'REUNION'" (click)="setSiteFilter('REUNION')">
            <span>🇷🇪</span> Réunion ({{ countSite('REUNION') }})
          </button>
          <button class="filter-chip" [class.active]="siteFilter === 'MADAGASCAR'" (click)="setSiteFilter('MADAGASCAR')">
            <span>🇲🇬</span> Madagascar ({{ countSite('MADAGASCAR') }})
          </button>
        </div>

        <!-- Grille des cards collaborateurs -->
        <div class="collab-grid">

          <!-- Card par collaborateur Réunion ayant des dossiers -->
          @for (card of collabCards; track card.user.id) {
            <div class="collab-card">
              <div class="collab-card__header">
                <div class="collab-avatar">
                  {{ card.user.firstName[0] }}{{ card.user.lastName[0] }}
                </div>
                <div class="collab-info">
                  <span class="collab-name">{{ card.user.firstName }} {{ card.user.lastName }}</span>
                  <span class="collab-role">{{ getRoleLabel(card.user.role) }}</span>
                </div>
                <button class="btn-manage" (click)="toggleCard(card.user.id)"
                        [matTooltip]="card.expanded ? 'Réduire' : 'Gérer les dossiers'">
                  <mat-icon>{{ card.expanded ? 'expand_less' : 'tune' }}</mat-icon>
                  <span>{{ card.expanded ? 'Réduire' : 'Gérer' }}</span>
                </button>
              </div>

              <div class="collab-card__metrics">
                <div class="metric">
                  <span class="metric__value">{{ card.clients.length }}</span>
                  <span class="metric__label">Dossiers</span>
                </div>
                <div class="metric">
                  <span class="metric__value" [class]="avgScoreTextClass(collabAvgScore(card.clients))">
                    {{ collabAvgScore(card.clients) }}%
                  </span>
                  <span class="metric__label">Score moy.</span>
                </div>
                <div class="metric">
                  <span class="metric__value" [class.text-red]="collabAlertCount(card.clients) > 0">
                    {{ collabAlertCount(card.clients) }}
                  </span>
                  <span class="metric__label">Alertes</span>
                </div>
                <div class="metric">
                  <span class="metric__value text-green">{{ collabMgCount(card.clients) }}</span>
                  <span class="metric__label">Distrib. MG</span>
                </div>
              </div>

              <!-- Barre de score moyen -->
              <div class="score-bar-wrap">
                <div class="score-bar-track">
                  <div class="score-bar-fill"
                       [class]="getScoreBarClass(collabAvgScore(card.clients))"
                       [style.width.%]="collabAvgScore(card.clients)"></div>
                </div>
              </div>

              <!-- Section expandable : mini-tableau des dossiers -->
              @if (card.expanded) {
                <div class="collab-card__table-wrap">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>Dossier</th>
                        <th>Score</th>
                        <th>Réassigner à</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of card.clients; track c.id) {
                        <tr>
                          <td>
                            <div class="folder-cell">
                              <div class="folder-avatar-sm">{{ getInitials(c.nom) }}</div>
                              <a [routerLink]="['/clients', c.id]" class="folder-link">{{ c.nom }}</a>
                            </div>
                          </td>
                          <td>
                            <span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span>
                          </td>
                          <td>
                            <mat-form-field appearance="outline" class="reassign-field">
                              <mat-select [value]="c.responsable?.id || null"
                                          (selectionChange)="reassign(c, $event.value)">
                                <mat-option [value]="null">— Aucun —</mat-option>
                                @for (u of reunionCollabs; track u.id) {
                                  <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                                }
                              </mat-select>
                            </mat-form-field>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          <!-- Card "Non assignés" -->
          @if (unassignedClients.length > 0) {
            <div class="collab-card collab-card--unassigned">
              <div class="collab-card__header">
                <div class="collab-avatar unassigned">
                  <mat-icon>person_off</mat-icon>
                </div>
                <div class="collab-info">
                  <span class="collab-name">Non assignés</span>
                  <span class="collab-role text-amber">{{ unassignedClients.length }} dossier(s) sans responsable</span>
                </div>
                <button class="btn-manage btn-manage--warn"
                        (click)="unassignedExpanded = !unassignedExpanded"
                        [matTooltip]="unassignedExpanded ? 'Réduire' : 'Assigner ces dossiers'">
                  <mat-icon>{{ unassignedExpanded ? 'expand_less' : 'tune' }}</mat-icon>
                  <span>{{ unassignedExpanded ? 'Réduire' : 'Assigner' }}</span>
                </button>
              </div>

              @if (unassignedExpanded) {
                <div class="collab-card__table-wrap">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>Dossier</th>
                        <th>Site</th>
                        <th>Score</th>
                        <th>Assigner à</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of unassignedClients; track c.id) {
                        <tr>
                          <td>
                            <div class="folder-cell">
                              <div class="folder-avatar-sm">{{ getInitials(c.nom) }}</div>
                              <a [routerLink]="['/clients', c.id]" class="folder-link">{{ c.nom }}</a>
                            </div>
                          </td>
                          <td>
                            <span [class]="c.site === 'REUNION' ? 'badge-re' : 'badge-mg'">
                              {{ c.site === 'REUNION' ? '🇷🇪 Réunion' : '🇲🇬 Madagascar' }}
                            </span>
                          </td>
                          <td>
                            <span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span>
                          </td>
                          <td>
                            <mat-form-field appearance="outline" class="reassign-field">
                              <mat-select [value]="null" (selectionChange)="reassign(c, $event.value)">
                                <mat-option [value]="null">— Choisir —</mat-option>
                                @for (u of reunionCollabs; track u.id) {
                                  <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                                }
                              </mat-select>
                            </mat-form-field>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          @if (collabCards.length === 0 && unassignedClients.length === 0) {
            <div class="empty-page">
              <mat-icon>folder_off</mat-icon>
              <p>Aucun dossier à afficher</p>
            </div>
          }

        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════
         VUE COLLABORATEUR RÉUNION
    ══════════════════════════════════════════════════════ -->
    @if (!auth.isAdmin() && auth.isReunion()) {
      <div class="page">

        <!-- En-tête -->
        <div class="page-header">
          <div class="page-header__left">
            <div class="page-icon-wrap blue">
              <mat-icon>folder_shared</mat-icon>
            </div>
            <div>
              <h1>Mon Portefeuille</h1>
              <p class="page-subtitle">
                {{ currentUserFullName() }} — {{ allClients.length }} dossier(s)
              </p>
            </div>
          </div>
          @if (unassignedMgCount === 0 && allClients.length > 0) {
            <div class="badge-all-distributed">
              <mat-icon>check_circle</mat-icon>
              <span>Tout distribué</span>
            </div>
          }
        </div>

        <!-- 4 stat cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card__icon indigo">
              <mat-icon>folder</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value">{{ allClients.length }}</span>
              <span class="stat-card__label">Dossiers totaux</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon" [class]="avgScoreIconClass(globalAvgScore())">
              <mat-icon>trending_up</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value" [class]="avgScoreTextClass(globalAvgScore())">{{ globalAvgScore() }}%</span>
              <span class="stat-card__label">Score moyen</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon" [class]="unassignedCount > 0 ? 'red' : 'green'">
              <mat-icon>{{ unassignedCount > 0 ? 'warning_amber' : 'check_circle' }}</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value" [class.text-red]="alertClientCount > 0">{{ alertClientCount }}</span>
              <span class="stat-card__label">Dossiers en alerte</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon green">
              <mat-icon>south_america</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value">{{ mgDistributedCount }} / {{ allClients.length }}</span>
              <span class="stat-card__label">Distribués à Madagascar</span>
            </div>
          </div>
        </div>

        <!-- Grille de dossiers -->
        <div class="section-header">
          <h2 class="section-title-h2">
            <mat-icon>grid_view</mat-icon> Mes dossiers
          </h2>
        </div>

        <div class="dossiers-grid">
          @for (c of allClients; track c.id) {
            <div class="dossier-card" [routerLink]="['/clients', c.id]">
              <div class="dossier-card__top">
                <div class="dossier-avatar">{{ getInitials(c.nom) }}</div>
                <div class="dossier-info">
                  <span class="dossier-name">{{ c.nom }}</span>
                  <span class="status-pill" [class]="getStatusClass(c.santePassation)">
                    {{ getStatusLabel(c.santePassation) }}
                  </span>
                </div>
              </div>
              <div class="dossier-score-row">
                <div class="score-bar-track wide">
                  <div class="score-bar-fill"
                       [class]="getScoreBarClass(c.santePassation)"
                       [style.width.%]="c.santePassation"></div>
                </div>
                <span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span>
              </div>
              @if (c.collaborateurMg) {
                <div class="mg-badge">
                  <mat-icon>check</mat-icon>
                  {{ c.collaborateurMg.firstName }} {{ c.collaborateurMg.lastName }}
                </div>
              }
            </div>
          }
          @if (allClients.length === 0) {
            <div class="empty-page">
              <mat-icon>folder_off</mat-icon>
              <p>Aucun dossier dans votre portefeuille</p>
            </div>
          }
        </div>

        <!-- Section distribution Madagascar -->
        <div class="section-header" style="margin-top: 36px;">
          <h2 class="section-title-h2">
            <mat-icon>south_america</mat-icon> Distribution Madagascar
          </h2>
          @if (unassignedMgCount === 0 && allClients.length > 0) {
            <div class="badge-all-distributed">
              <mat-icon>check_circle</mat-icon>
              <span>Tout distribué</span>
            </div>
          } @else {
            <span class="warn-badge">
              <mat-icon>warning_amber</mat-icon>
              {{ unassignedMgCount }} non distribué(s)
            </span>
          }
        </div>

        <div class="table-card">
          <table class="mini-table full-table">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Score</th>
                <th>Collaborateur MG actuel</th>
                <th>Assigner à</th>
              </tr>
            </thead>
            <tbody>
              @for (c of allClients; track c.id) {
                <tr class="table-row">
                  <td>
                    <div class="folder-cell">
                      <div class="folder-avatar-sm">{{ getInitials(c.nom) }}</div>
                      <a [routerLink]="['/clients', c.id]" class="folder-link">{{ c.nom }}</a>
                    </div>
                  </td>
                  <td><span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span></td>
                  <td>
                    @if (c.collaborateurMg) {
                      <div class="user-cell">
                        <div class="user-avatar mg">{{ c.collaborateurMg.firstName[0] }}{{ c.collaborateurMg.lastName[0] }}</div>
                        <span class="text-muted">{{ c.collaborateurMg.firstName }} {{ c.collaborateurMg.lastName }}</span>
                      </div>
                    } @else {
                      <span class="none">Non distribué</span>
                    }
                  </td>
                  <td>
                    <mat-form-field appearance="outline" class="reassign-field">
                      <mat-select [value]="c.collaborateurMg?.id || null"
                                  (selectionChange)="assignMg(c, $event.value)">
                        <mat-option [value]="null">— Aucun —</mat-option>
                        @for (u of mgTeam; track u.id) {
                          <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </td>
                </tr>
              }
              @if (allClients.length === 0) {
                <tr>
                  <td colspan="4" class="empty-state">
                    <mat-icon>folder_off</mat-icon>
                    <span>Aucun dossier</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

      </div>
    }

    <!-- ══════════════════════════════════════════════════════
         VUE COLLABORATEUR MADAGASCAR
    ══════════════════════════════════════════════════════ -->
    @if (!auth.isAdmin() && auth.isMadagascar()) {
      <div class="page">

        <!-- En-tête -->
        <div class="page-header">
          <div class="page-header__left">
            <div class="page-icon-wrap green">
              <mat-icon>folder_shared</mat-icon>
            </div>
            <div>
              <h1>Mon Portefeuille</h1>
              <p class="page-subtitle">{{ currentUserFullName() }} — dossiers qui me sont assignés</p>
            </div>
          </div>
        </div>

        <!-- 2 stat cards -->
        <div class="stats-grid stats-grid--2">
          <div class="stat-card">
            <div class="stat-card__icon green">
              <mat-icon>folder</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value">{{ allClients.length }}</span>
              <span class="stat-card__label">Dossiers assignés</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon" [class]="avgScoreIconClass(globalAvgScore())">
              <mat-icon>trending_up</mat-icon>
            </div>
            <div class="stat-card__body">
              <span class="stat-card__value" [class]="avgScoreTextClass(globalAvgScore())">{{ globalAvgScore() }}%</span>
              <span class="stat-card__label">Score moyen</span>
            </div>
          </div>
        </div>

        <!-- Tableau des dossiers -->
        <div class="table-card">
          <table class="mini-table full-table">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Score</th>
                <th>Statut</th>
                <th>Responsable Réunion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of allClients; track c.id) {
                <tr class="table-row" [routerLink]="['/clients', c.id]">
                  <td>
                    <div class="folder-cell">
                      <div class="folder-avatar-sm">{{ getInitials(c.nom) }}</div>
                      <span class="folder-name">{{ c.nom }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="score-mini-cell">
                      <div class="score-bar-track">
                        <div class="score-bar-fill"
                             [class]="getScoreBarClass(c.santePassation)"
                             [style.width.%]="c.santePassation"></div>
                      </div>
                      <span [class]="scoreClass(c.santePassation)">{{ c.santePassation }}%</span>
                    </div>
                  </td>
                  <td>
                    <span class="status-pill" [class]="getStatusClass(c.santePassation)">
                      {{ getStatusLabel(c.santePassation) }}
                    </span>
                  </td>
                  <td>
                    @if (c.responsable) {
                      <div class="user-cell">
                        <div class="user-avatar re">{{ c.responsable.firstName[0] }}{{ c.responsable.lastName[0] }}</div>
                        <span class="text-muted">{{ c.responsable.firstName }} {{ c.responsable.lastName }}</span>
                      </div>
                    } @else {
                      <span class="none">—</span>
                    }
                  </td>
                  <td class="action-cell">
                    <button mat-icon-button class="btn-open" [routerLink]="['/clients', c.id]" (click)="$event.stopPropagation()">
                      <mat-icon>arrow_forward</mat-icon>
                    </button>
                  </td>
                </tr>
              }
              @if (allClients.length === 0) {
                <tr>
                  <td colspan="5" class="empty-state">
                    <mat-icon>folder_off</mat-icon>
                    <span>Aucun dossier assigné</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

      </div>
    }

  `,
  styles: [`
    /* ─── Layout page ───────────────────────────────── */
    .page { padding: 32px 36px; }

    /* ─── En-tête ───────────────────────────────────── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 28px;
    }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon-wrap {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #eef2ff, #e0e7ff);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .page-icon-wrap mat-icon { color: #4f46e5; font-size: 22px; width: 22px; height: 22px; }
    .page-icon-wrap.blue { background: linear-gradient(135deg, #dbeafe, #bfdbfe); }
    .page-icon-wrap.blue mat-icon { color: #1d4ed8; }
    .page-icon-wrap.green { background: linear-gradient(135deg, #dcfce7, #bbf7d0); }
    .page-icon-wrap.green mat-icon { color: #15803d; }
    h1 { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 4px; letter-spacing: -.5px; }
    .page-subtitle { font-size: 13px; color: #64748b; margin: 0; }

    /* ─── Stats grid ─────────────────────────────────── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .stats-grid--2 { grid-template-columns: repeat(2, 1fr); max-width: 560px; }
    .stat-card {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      padding: 20px;
      display: flex; align-items: center; gap: 16px;
    }
    .stat-card__icon {
      width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .stat-card__icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .stat-card__icon.indigo { background: #eef2ff; }
    .stat-card__icon.indigo mat-icon { color: #4f46e5; }
    .stat-card__icon.amber  { background: #fff7ed; }
    .stat-card__icon.amber  mat-icon { color: #d97706; }
    .stat-card__icon.blue   { background: #dbeafe; }
    .stat-card__icon.blue   mat-icon { color: #1d4ed8; }
    .stat-card__icon.green  { background: #dcfce7; }
    .stat-card__icon.green  mat-icon { color: #15803d; }
    .stat-card__icon.red    { background: #fee2e2; }
    .stat-card__icon.red    mat-icon { color: #dc2626; }
    .stat-card__body { display: flex; flex-direction: column; gap: 2px; }
    .stat-card__value { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; }
    .stat-card__label { font-size: 12px; color: #64748b; font-weight: 500; }

    /* ─── Filtres ────────────────────────────────────── */
    .filters-row { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
    .filter-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 20px;
      border: 1px solid #e2e8f0; background: white;
      font-size: 13px; font-weight: 500; color: #64748b;
      cursor: pointer; transition: all .13s;
    }
    .filter-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .filter-chip:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
    .filter-chip.active { background: #1e293b; color: white; border-color: #1e293b; }

    /* ─── Section header ─────────────────────────────── */
    .section-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 16px;
    }
    .section-title-h2 {
      display: flex; align-items: center; gap: 8px;
      font-size: 16px; font-weight: 700; color: #1e293b; margin: 0;
    }
    .section-title-h2 mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; }

    /* ─── Grille cards collaborateurs ────────────────── */
    .collab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .collab-card {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      overflow: hidden;
      transition: box-shadow .15s;
    }
    .collab-card:hover { box-shadow: 0 4px 16px rgba(79,70,229,.08); }
    .collab-card--unassigned {
      border-color: #fed7aa;
      grid-column: 1 / -1;
    }

    .collab-card__header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 16px 12px;
    }
    .collab-avatar {
      width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      color: #4338ca; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .collab-avatar.unassigned {
      background: #fff7ed;
    }
    .collab-avatar.unassigned mat-icon { color: #d97706; font-size: 20px; }
    .collab-info { flex: 1; min-width: 0; }
    .collab-name { display: block; font-size: 14px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .collab-role { display: block; font-size: 11px; color: #94a3b8; margin-top: 1px; }

    .btn-manage {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border-radius: 8px;
      border: 1px solid #e2e8f0; background: #f8fafc;
      font-size: 12px; font-weight: 600; color: #4f46e5;
      cursor: pointer; transition: all .13s; flex-shrink: 0;
    }
    .btn-manage mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .btn-manage:hover { background: #eef2ff; border-color: #c7d2fe; }
    .btn-manage--warn { color: #d97706; }
    .btn-manage--warn:hover { background: #fff7ed; border-color: #fed7aa; }

    .collab-card__metrics {
      display: grid; grid-template-columns: repeat(4, 1fr);
      padding: 0 16px 12px; gap: 4px;
    }
    .metric { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .metric__value { font-size: 18px; font-weight: 800; color: #1e293b; }
    .metric__label { font-size: 10px; color: #94a3b8; text-align: center; }

    .score-bar-wrap { padding: 0 16px 16px; }
    .score-bar-track { height: 5px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .score-bar-track.wide { flex: 1; min-width: 80px; }
    .score-bar-fill { height: 100%; border-radius: 4px; transition: width .3s; }
    .score-bar-fill.high   { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .score-bar-fill.medium { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-bar-fill.low    { background: linear-gradient(90deg, #f87171, #dc2626); }

    .collab-card__table-wrap {
      border-top: 1px solid #f1f5f9;
      overflow-x: auto;
    }

    /* ─── Mini-table ─────────────────────────────────── */
    .mini-table { width: 100%; border-collapse: collapse; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden; }
    .mini-table thead tr { background: #162351; }
    .mini-table thead th {
      padding: 10px 14px; text-align: left;
      font-size: 13px; font-weight: 600; color: #fff;
      border: none;
    }
    .mini-table tbody tr:nth-child(even) { background: #f8f9fa; }
    .mini-table tbody tr:hover td { background: #e8edf8 !important; }
    .mini-table td { padding: 10px 14px; vertical-align: middle; font-size: 13px; border-bottom: 1px solid #dee2e6; color: #212529; }
    .mini-table tbody tr:last-child td { border-bottom: none; }

    .full-table thead th { padding: 13px 20px; }
    .full-table td { padding: 13px 20px; }

    /* ─── Table card ─────────────────────────────────── */
    .table-card {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      overflow: hidden;
    }
    .table-row { cursor: pointer; transition: background .12s; }
    .table-row:last-child td { border-bottom: none; }
    .table-row:hover { background: #fafbff; }

    /* ─── Dossier grid (vue collab Réunion) ──────────── */
    .dossiers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 14px;
      margin-bottom: 8px;
    }
    .dossier-card {
      background: white; border-radius: 14px;
      border: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      padding: 16px; cursor: pointer;
      transition: box-shadow .15s, transform .12s;
    }
    .dossier-card:hover { box-shadow: 0 4px 16px rgba(79,70,229,.1); transform: translateY(-1px); }
    .dossier-card__top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
    .dossier-avatar {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #dbeafe, #c7d2fe);
      color: #1e40af; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .dossier-info { flex: 1; min-width: 0; }
    .dossier-name { display: block; font-size: 13.5px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .dossier-score-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 8px;
    }
    .mg-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: #15803d; background: #f0fdf4;
      padding: 3px 8px; border-radius: 20px; border: 1px solid #bbf7d0;
    }
    .mg-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* ─── Cellules ───────────────────────────────────── */
    .folder-cell { display: flex; align-items: center; gap: 10px; }
    .folder-avatar-sm {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .folder-link {
      font-size: 13px; font-weight: 600; color: #1e293b;
      text-decoration: none;
    }
    .folder-link:hover { color: #4f46e5; }
    .folder-name { font-size: 13.5px; font-weight: 600; color: #1e293b; }
    .user-cell { display: flex; align-items: center; gap: 8px; }
    .user-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .user-avatar.re { background: linear-gradient(135deg, #dbeafe, #bfdbfe); color: #1d4ed8; }
    .user-avatar.mg { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #15803d; }
    .text-muted { font-size: 13px; color: #64748b; }
    .none { font-size: 13px; color: #cbd5e1; font-style: italic; }

    .score-mini-cell { display: flex; align-items: center; gap: 8px; }
    .score-mini-cell .score-bar-track { width: 70px; }

    /* ─── Badges & pills ─────────────────────────────── */
    .status-pill { font-size: 11.5px; font-weight: 500; padding: 3px 10px; border-radius: 20px; }
    .status-ok      { background: #dcfce7; color: #15803d; }
    .status-partial { background: #fef9c3; color: #a16207; }
    .status-alert   { background: #fee2e2; color: #dc2626; }

    .badge-re { display: inline-flex; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-mg { display: inline-flex; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

    .score-high   { color: #15803d; font-size: 13px; font-weight: 700; }
    .score-medium { color: #a16207; font-size: 13px; font-weight: 700; }
    .score-low    { color: #dc2626; font-size: 13px; font-weight: 700; }

    .text-red   { color: #dc2626 !important; }
    .text-amber { color: #d97706 !important; }
    .text-green { color: #15803d !important; }

    .badge-all-distributed {
      display: inline-flex; align-items: center; gap: 6px;
      background: #f0fdf4; color: #15803d;
      border: 1px solid #bbf7d0;
      padding: 6px 14px; border-radius: 20px;
      font-size: 13px; font-weight: 600;
    }
    .badge-all-distributed mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .warn-badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff7ed; color: #c2410c;
      border: 1px solid #fed7aa;
      padding: 5px 12px; border-radius: 20px;
      font-size: 12.5px; font-weight: 600;
    }
    .warn-badge mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* ─── Champ assignation ──────────────────────────── */
    .reassign-field { width: 190px; }
    ::ng-deep .reassign-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .reassign-field .mat-mdc-text-field-wrapper { padding: 0 8px; }

    /* ─── Action cell ────────────────────────────────── */
    .action-cell { text-align: right; }
    .btn-open { color: #6366f1 !important; }

    /* ─── Empty states ───────────────────────────────── */
    .empty-state {
      text-align: center; padding: 48px !important;
      color: #94a3b8;
    }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
    .empty-page {
      grid-column: 1 / -1;
      text-align: center; padding: 48px;
      color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .empty-page mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .empty-page p { margin: 0; font-size: 14px; }
  `],
})
export class PortefeuillesComponent implements OnInit {
  auth = inject(AuthService);
  private usersService = inject(UsersService);
  private clientsService = inject(ClientsService);
  private toast = inject(ToastService);

  allUsers: User[] = [];
  mgTeam: User[] = [];
  allClients: Client[] = [];
  siteFilter: string | null = null;
  unassignedExpanded = false;
  expandedCardIds = new Set<number>();

  // ── Getters calculés ────────────────────────────────────────────────────

  get reunionCollabs(): User[] {
    return this.allUsers.filter(
      u => u.site === 'REUNION' && u.isActive &&
           (u.role === 'COLLABORATEUR' || u.role === 'EXPERT_COMPTABLE'),
    );
  }

  get filteredClients(): Client[] {
    if (!this.siteFilter) return this.allClients;
    return this.allClients.filter(c => c.site === this.siteFilter);
  }

  get unassignedClients(): Client[] {
    return this.filteredClients.filter(c => !c.responsable);
  }

  get unassignedCount(): number {
    return this.allClients.filter(c => !c.responsable).length;
  }

  get unassignedMgCount(): number {
    return this.allClients.filter(c => !c.collaborateurMg).length;
  }

  get alertClientCount(): number {
    return this.allClients.filter(c => c.santePassation < 50).length;
  }

  get mgDistributedCount(): number {
    return this.allClients.filter(c => !!c.collaborateurMg).length;
  }

  /** Une card par collaborateur Réunion ayant au moins 1 dossier dans filteredClients */
  get collabCards(): CollabCard[] {
    return this.reunionCollabs
      .map(user => ({
        user,
        clients: this.filteredClients.filter(c => c.responsable?.id === user.id),
        expanded: this.expandedCardIds.has(user.id),
      }))
      .filter(card => card.clients.length > 0);
  }

  toggleCard(userId: number) {
    if (this.expandedCardIds.has(userId)) {
      this.expandedCardIds.delete(userId);
    } else {
      this.expandedCardIds.add(userId);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    this.clientsService.getAll().subscribe(c => { this.allClients = c; });

    if (this.auth.isAdmin()) {
      this.usersService.getAll().subscribe(u => { this.allUsers = u; });
    } else if (this.auth.isReunion()) {
      this.usersService.getAssignable().subscribe(u => {
        this.mgTeam = u.filter(u => u.site === 'MADAGASCAR');
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  setSiteFilter(filter: string | null) {
    this.siteFilter = filter;
  }

  reassign(client: Client, responsableId: number | null) {
    if (!responsableId) return;
    this.clientsService.assign(client.id, responsableId).subscribe(updated => {
      client.responsable = updated.responsable;
      this.toast.success('Dossier réassigné');
    });
  }

  assignMg(client: Client, collaborateurMgId: number | null) {
    this.clientsService.assignMg(client.id, collaborateurMgId).subscribe(updated => {
      client.collaborateurMg = updated.collaborateurMg;
      this.toast.success(collaborateurMgId ? 'Dossier distribué' : 'Distribution retirée');
    });
  }

  // ── Helpers d'affichage ──────────────────────────────────────────────────

  currentUserFullName(): string {
    const u = this.auth.currentUser();
    return u ? `${u.firstName} ${u.lastName}` : '';
  }

  countSite(site: string): number {
    return this.allClients.filter(c => c.site === site).length;
  }

  globalAvgScore(): number {
    const list = this.allClients;
    if (!list.length) return 0;
    return Math.round(list.reduce((a, c) => a + c.santePassation, 0) / list.length);
  }

  collabAvgScore(clients: Client[]): number {
    if (!clients.length) return 0;
    return Math.round(clients.reduce((a, c) => a + c.santePassation, 0) / clients.length);
  }

  collabAlertCount(clients: Client[]): number {
    return clients.filter(c => c.santePassation < 50).length;
  }

  collabMgCount(clients: Client[]): number {
    return clients.filter(c => !!c.collaborateurMg).length;
  }

  getRoleLabel(role: string): string {
    if (role === 'EXPERT_COMPTABLE') return 'Expert-comptable';
    if (role === 'COLLABORATEUR')    return 'Collaborateur';
    if (role === 'ADMIN')            return 'Administrateur';
    return role;
  }

  getInitials(nom: string): string {
    return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  scoreClass(score: number): string {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }

  getScoreBarClass(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getStatusClass(score: number): string {
    if (score >= 80) return 'status-pill status-ok';
    if (score >= 50) return 'status-pill status-partial';
    return 'status-pill status-alert';
  }

  getStatusLabel(score: number): string {
    if (score >= 80) return 'Transmissible';
    if (score >= 50) return 'En cours';
    return 'Alerte';
  }

  avgScoreIconClass(score: number): string {
    if (score >= 80) return 'green';
    if (score >= 50) return 'amber';
    return 'red';
  }

  avgScoreTextClass(score: number): string {
    if (score >= 80) return 'text-green';
    if (score >= 50) return 'text-amber';
    return 'text-red';
  }
}
