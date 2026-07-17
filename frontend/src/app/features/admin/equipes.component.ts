import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, forkJoin } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { User, ROLE_LABELS } from '../../core/models/user.model';

interface EditForm {
  user: User;
  antenne: string;
  role: string;
  referentId: number | null;
  saving: boolean;
  transferToId: number | null;
}

interface CreateForm {
  firstName: string; lastName: string; email: string; password: string;
  role: string; site: string; antenne: string; referentId: number | null; saving: boolean;
}

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatRippleModule, MatTooltipModule],
  template: `
<div class="page-wrap">
<div class="page" (click)="closeAll()">

  <!-- ══ VUE ADMIN / EXPERT-COMPTABLE ═════════════════════════════════════════ -->
  @if (auth.hasFullVisibility()) {

    <div class="page-header">
      <div>
        <h1 class="page-title">Hiérarchie des équipes</h1>
        <p class="page-sub">
          {{ totalHierarchie }} utilisateur(s) ·
          <span class="stat-ok">{{ assignedCount }} dans une antenne</span>
          @if (totalHierarchie - assignedCount > 0) {
            · <span class="stat-warn">{{ totalHierarchie - assignedCount }} sans antenne</span>
          }
        </p>
      </div>
      <div class="header-actions">
        <div class="legend">
          <span class="badge-role chef-antenne">Chef d'antenne</span>
          <span class="badge-role chef-mission">Chef de mission</span>
          <span class="badge-role collab">Collaborateur</span>
          <span class="badge-role gerant">Gérant</span>
        </div>
        @if (auth.isAdmin()) {
          <button class="btn-create" (click)="$event.stopPropagation(); openCreate()">
            <mat-icon>person_add</mat-icon> Nouveau collaborateur
          </button>
        }
      </div>
    </div>

    <!-- Onglets -->
    <div class="tabs">
      <button class="tab-btn" [class.active]="activeTab()==='hierarchy'" (click)="activeTab.set('hierarchy')">
        <mat-icon>account_tree</mat-icon> Hiérarchie
      </button>
      <button class="tab-btn" [class.active]="activeTab()==='chart'" (click)="activeTab.set('chart')">
        <mat-icon>schema</mat-icon> Organigramme
      </button>
      <button class="tab-btn" [class.active]="activeTab()==='users'" (click)="activeTab.set('users')">
        <mat-icon>manage_accounts</mat-icon> Tous les utilisateurs
        <span class="tab-count">{{ users().length }}</span>
      </button>
    </div>

    <!-- Deux antennes -->
    @if (activeTab() === 'hierarchy') {
    <div class="antennes-grid">
      @for (antenne of ['EST', 'OUEST']; track antenne) {
        <div class="antenne-card">
          <div class="antenne-header">
            <mat-icon>location_on</mat-icon>
            <span class="antenne-label">Antenne {{ antenne }}</span>
            <span class="antenne-count">{{ usersInAntenne(antenne).length }} membres</span>
          </div>

          <!-- Chef d'antenne -->
          <div class="section-row">
            <span class="section-title">Chef d'antenne</span>
            @let ca = chefAntenne(antenne);
            @if (ca) {
              <div class="user-pill user-pill--chef-antenne">
                <div class="avatar chef-antenne sm">{{ initials(ca) }}</div>
                <div>
                  <div class="pill-name">{{ ca.firstName }} {{ ca.lastName }}</div>
                  <div class="pill-email">{{ ca.email }}</div>
                </div>
                <button class="btn-icon" matTooltip="Modifier" (click)="$event.stopPropagation(); openEdit(ca)">
                  <mat-icon>edit</mat-icon>
                </button>
              </div>
            } @else {
              <span class="no-data">Non désigné</span>
            }
          </div>

          <!-- Gérant Madagascar -->
          @let gm = gerantMadagascar(antenne);
          @if (gm) {
            <div class="section-row">
              <span class="section-title">Gérant Madagascar</span>
              <div class="user-pill user-pill--gerant">
                <div class="avatar gerant sm">{{ initials(gm) }}</div>
                <div>
                  <div class="pill-name">{{ gm.firstName }} {{ gm.lastName }}</div>
                </div>
                <button class="btn-icon" matTooltip="Modifier" (click)="$event.stopPropagation(); openEdit(gm)">
                  <mat-icon>edit</mat-icon>
                </button>
              </div>
            </div>
          }

          <!-- Chefs de mission et leurs équipes -->
          @let cms = chefsMission(antenne);
          <div class="section-row">
            <span class="section-title">Chefs de mission ({{ cms.length }})</span>
          </div>

          @for (cm of cms; track cm.id) {
            <div class="mission-block">
              <div class="user-pill user-pill--chef-mission">
                <div class="avatar chef-mission sm">{{ initials(cm) }}</div>
                <div>
                  <div class="pill-name">{{ cm.firstName }} {{ cm.lastName }}</div>
                  <div class="pill-email">{{ collaborateursOf(cm.id).length }} collaborateur(s)</div>
                </div>
                <button class="btn-icon" matTooltip="Modifier" (click)="$event.stopPropagation(); openEdit(cm)">
                  <mat-icon>edit</mat-icon>
                </button>
              </div>

              <div class="collabs-list">
                @for (c of collaborateursOf(cm.id); track c.id) {
                  <div class="collab-row" style="position:relative">
                    <div class="avatar collab xs">{{ initials(c) }}</div>
                    <div class="collab-name">{{ c.firstName }} {{ c.lastName }}</div>
                    <button class="btn-icon-sm" matTooltip="Réassigner" (click)="$event.stopPropagation(); toggleReassign(c.id)">
                      <mat-icon>swap_horiz</mat-icon>
                    </button>
                    @if (reassignUserId() === c.id) {
                      <div class="inline-panel" (click)="$event.stopPropagation()">
                        @for (other of cms; track other.id) {
                          <button class="chip-sm" [class.chip-sm--active]="c.referentId === other.id"
                                  matRipple (click)="setReferentAndClose(c, other.id)">
                            {{ other.firstName }} {{ other.lastName }}
                          </button>
                        }
                        <button class="chip-sm chip-sm--remove" matRipple (click)="setReferentAndClose(c, null)">
                          <mat-icon>link_off</mat-icon> Détacher
                        </button>
                      </div>
                    }
                  </div>
                }
                @if (collaborateursOf(cm.id).length === 0) {
                  <div class="no-collab">Aucun collaborateur rattaché</div>
                }
              </div>
            </div>
          }

          @if (cms.length === 0) {
            <div class="empty-section">
              <mat-icon>person_search</mat-icon>
              <span>Aucun chef de mission dans cette antenne</span>
            </div>
          }
        </div>
      }
    </div>

    } <!-- /hierarchy -->

    <!-- ── Organigramme ──────────────────────────────────────────────────────── -->
    @if (activeTab() === 'chart') {
    <div class="chart-toolbar">
      <span class="chart-hint"><mat-icon>info</mat-icon> Cliquez sur un nœud pour modifier</span>
      <button class="btn-print" (click)="printChart()"><mat-icon>print</mat-icon> Exporter / Imprimer</button>
    </div>
    <div class="chart-wrap">
      <div class="org-scroll" #orgScroll>
        <ul class="org-tree">
          <li>
            <div class="org-node org-node--root">
              <mat-icon>business</mat-icon>
              <span class="org-root-name">AFYM Audit Expertise</span>
              <span class="org-count">{{ users().filter(u => u.isActive).length }} membres</span>
            </div>
            <ul>
              <!-- Bureau Réunion -->
              @if (reunionUsers().length > 0) {
                <li>
                  <div class="org-node org-node--bureau">
                    <mat-icon>location_city</mat-icon>
                    <span class="org-antenne-name">Bureau Réunion</span>
                    <span class="org-count">{{ reunionUsers().length }}</span>
                  </div>
                  <ul>
                    @for (ru of reunionUsers(); track ru.id) {
                      <li>
                        <div class="org-node org-node--reunion-user" (click)="$event.stopPropagation(); openEdit(ru)">
                          <div class="org-avatar" [class]="ru.role === 'ADMIN' ? 'adm' : 'exp'">{{ initials(ru) }}</div>
                          <div>
                            <div class="org-name">{{ ru.firstName }} {{ ru.lastName }}</div>
                            <div class="org-role">{{ roleLabel(ru.role) }}</div>
                          </div>
                        </div>
                      </li>
                    }
                  </ul>
                </li>
              }
              <!-- Antennes Madagascar -->
              @for (antenne of ['EST', 'OUEST']; track antenne) {
                <li>
                  <div class="org-node org-node--antenne">
                    <mat-icon>location_on</mat-icon>
                    <span class="org-antenne-name">Antenne {{ antenne }}</span>
                    <span class="org-count">{{ usersInAntenne(antenne).length }}</span>
                  </div>
                  @let ca = chefAntenne(antenne);
                  @let gm = gerantMadagascar(antenne);
                  @let cms = chefsMission(antenne);
                  <ul>
                    @if (ca) {
                      <li>
                        <div class="org-node org-node--chef-antenne" (click)="$event.stopPropagation(); openEdit(ca)">
                          <div class="org-avatar ca">{{ initials(ca) }}</div>
                          <div>
                            <div class="org-name">{{ ca.firstName }} {{ ca.lastName }}</div>
                            <div class="org-role">Chef d'antenne</div>
                          </div>
                        </div>
                        @if (cms.length > 0) {
                          <ul>
                            @for (cm of cms; track cm.id) {
                              <li>
                                <div class="org-node org-node--chef-mission" (click)="$event.stopPropagation(); openEdit(cm)">
                                  <div class="org-avatar cm">{{ initials(cm) }}</div>
                                  <div>
                                    <div class="org-name">{{ cm.firstName }} {{ cm.lastName }}</div>
                                    <div class="org-role">Chef de mission</div>
                                    @if (taskCount(cm) > 0) {
                                      <span class="org-task-badge">{{ taskCount(cm) }} tâche(s)</span>
                                    }
                                  </div>
                                </div>
                                @let collabs = collaborateursOf(cm.id);
                                @if (collabs.length > 0) {
                                  <ul>
                                    @for (c of collabs; track c.id) {
                                      <li>
                                        <div class="org-node org-node--collab" (click)="$event.stopPropagation(); openEdit(c)">
                                          <div class="org-avatar co">{{ initials(c) }}</div>
                                          <div>
                                            <div class="org-name">{{ c.firstName }} {{ c.lastName }}</div>
                                            <div class="org-role">Collaborateur</div>
                                            @if (taskCount(c) > 0) {
                                              <span class="org-task-badge">{{ taskCount(c) }} tâche(s)</span>
                                            }
                                          </div>
                                        </div>
                                      </li>
                                    }
                                  </ul>
                                }
                              </li>
                            }
                          </ul>
                        }
                      </li>
                    } @else {
                      <li>
                        <div class="org-node org-node--empty">
                          <mat-icon>person_off</mat-icon> Non désigné
                        </div>
                      </li>
                    }
                    @if (gm) {
                      <li>
                        <div class="org-node org-node--gerant" (click)="$event.stopPropagation(); openEdit(gm)">
                          <div class="org-avatar ge">{{ initials(gm) }}</div>
                          <div>
                            <div class="org-name">{{ gm.firstName }} {{ gm.lastName }}</div>
                            <div class="org-role">Gérant Madagascar</div>
                          </div>
                        </div>
                      </li>
                    }
                  </ul>
                </li>
              }
            </ul>
          </li>
        </ul>
      </div>
    </div>
    } <!-- /chart -->

    <!-- Tableau de tous les utilisateurs -->
    @if (activeTab() === 'users') {
    <div class="all-users-section">
      <div class="all-users-header">
        <div class="all-users-title">
          <mat-icon>manage_accounts</mat-icon>
          Tous les utilisateurs
          <span class="all-users-count">{{ filteredUsers().length }}</span>
        </div>
        <div class="all-users-search" (click)="$event.stopPropagation()">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Rechercher…" [value]="searchQuery()"
                 (input)="searchQuery.set($any($event.target).value)" />
          @if (searchQuery()) {
            <button class="btn-clear" (click)="searchQuery.set('')"><mat-icon>close</mat-icon></button>
          }
        </div>
      </div>

      <!-- Filtres -->
      <div class="filter-bar">
        <div class="filter-group">
          <select class="filter-select" [value]="filterRole()" (change)="filterRole.set($any($event.target).value)">
            <option value="">Tous les rôles</option>
            <option value="ADMIN">Administrateur</option>
            <option value="EXPERT_COMPTABLE">Expert-comptable</option>
            <option value="CHEF_ANTENNE">Chef d'antenne</option>
            <option value="CHEF_MISSION">Chef de mission</option>
            <option value="COLLABORATEUR">Collaborateur</option>
            <option value="GERANT_MADAGASCAR">Gérant Madagascar</option>
          </select>
          <select class="filter-select" [value]="filterAntenne()" (change)="filterAntenne.set($any($event.target).value)">
            <option value="">Toutes antennes</option>
            <option value="EST">EST</option>
            <option value="OUEST">OUEST</option>
          </select>
          <select class="filter-select" [value]="filterSite()" (change)="filterSite.set($any($event.target).value)">
            <option value="">Tous sites</option>
            <option value="REUNION">La Réunion</option>
            <option value="MADAGASCAR">Madagascar</option>
          </select>
          @if (activeFiltersCount() > 0) {
            <button class="btn-clear-filters" (click)="clearFilters()">
              <mat-icon>filter_alt_off</mat-icon> Effacer ({{ activeFiltersCount() }})
            </button>
          }
        </div>
        <label class="toggle-inactive">
          <input type="checkbox" [checked]="showInactive()" (change)="showInactive.set($any($event.target).checked)" />
          Afficher inactifs
        </label>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Site</th>
              <th>Rôle actuel</th>
              <th>Antenne</th>
              <th>Superviseur direct</th>
              <th>Charge</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (u of filteredUsers(); track u.id) {
              <tr [class.tr-inactive]="!u.isActive">
                <td>
                  <div class="user-cell">
                    <div class="avatar sm" [class]="avatarClass(u)">{{ initials(u) }}</div>
                    <div>
                      <div class="td-name">
                        {{ u.firstName }} {{ u.lastName }}
                        @if (!u.isActive) { <span class="badge-inactive">Inactif</span> }
                      </div>
                      <div class="td-email">{{ u.email }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="site-badge" [class.site-badge--mg]="u.site === 'MADAGASCAR'">
                    {{ u.site === 'MADAGASCAR' ? '🇲🇬 Madagascar' : '🇷🇪 Réunion' }}
                  </span>
                </td>
                <td>
                  <span class="role-badge" [class]="'role-' + u.role">{{ roleLabel(u.role) }}</span>
                </td>
                <td>
                  @if (u.antenne) {
                    <span class="antenne-badge">{{ u.antenne }}</span>
                  } @else {
                    <span class="td-empty-val">—</span>
                  }
                </td>
                <td>
                  @let sup = superviseurDe(u);
                  @if (sup) {
                    <div class="user-cell">
                      <div class="avatar xs" [class]="avatarClass(sup)">{{ initials(sup) }}</div>
                      <span class="td-name" style="font-size:12px">{{ sup.firstName }} {{ sup.lastName }}</span>
                    </div>
                  } @else {
                    <span class="td-empty-val">—</span>
                  }
                </td>
                <td>
                  @if (taskCount(u) > 0) {
                    <span class="charge-badge" [class.charge-badge--high]="taskCount(u) >= 5">
                      {{ taskCount(u) }} tâche{{ taskCount(u) > 1 ? 's' : '' }}
                    </span>
                  } @else {
                    <span class="td-empty-val">—</span>
                  }
                </td>
                <td>
                  <div class="td-actions">
                    <button class="btn-table-assign" matRipple (click)="$event.stopPropagation(); openEdit(u)"
                            matTooltip="Modifier le rôle / l'antenne">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button class="btn-table-rh" matRipple (click)="$event.stopPropagation(); goToRH(u)"
                            matTooltip="Voir la fiche RH">
                      <mat-icon>badge</mat-icon>
                    </button>
                    @if (auth.isAdmin()) {
                      <button class="btn-table-toggle"
                              [class.btn-table-toggle--active]="u.isActive"
                              matRipple
                              [matTooltip]="u.isActive ? 'Désactiver le compte' : 'Réactiver le compte'"
                              (click)="$event.stopPropagation(); toggleActive(u)">
                        <mat-icon>{{ u.isActive ? 'person_off' : 'person' }}</mat-icon>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
            @if (filteredUsers().length === 0) {
              <tr>
                <td colspan="7" class="td-empty">
                  <mat-icon>search_off</mat-icon>
                  @if (searchQuery()) { Aucun résultat pour "{{ searchQuery() }}" }
                  @else { Aucun utilisateur ne correspond aux filtres sélectionnés }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    } <!-- /users -->

  <!-- ══ VUE CHEF D'ANTENNE ════════════════════════════════════════════════════ -->
  } @else if (auth.isChefAntenne()) {
    <div class="page-header">
      <div>
        <h1 class="page-title">Mon antenne {{ auth.currentUser()?.antenne }}</h1>
        <p class="page-sub">{{ myTeam?.team?.length ?? 0 }} membre(s) dans votre antenne</p>
      </div>
    </div>
    <div class="my-team-grid">
      @for (m of myTeam?.team ?? []; track m.id) {
        <div class="member-card">
          <div class="avatar lg" [class]="avatarClass(m)">{{ initials(m) }}</div>
          <div>
            <div class="cell-name">{{ m.firstName }} {{ m.lastName }}</div>
            <div class="badge-role-sm" [class]="'badge-' + m.role">{{ roleLabel(m.role) }}</div>
            <div class="cell-email">{{ m.email }}</div>
          </div>
        </div>
      }
    </div>

  <!-- ══ VUE CHEF DE MISSION ════════════════════════════════════════════════════ -->
  } @else if (auth.isChefMission()) {
    <div class="page-header">
      <div>
        <h1 class="page-title">Mon équipe</h1>
        <p class="page-sub">{{ myTeam?.team?.length ?? 0 }} collaborateur(s) rattaché(s)</p>
      </div>
    </div>
    @if ((myTeam?.team?.length ?? 0) > 0) {
      <div class="my-team-grid">
        @for (m of myTeam?.team ?? []; track m.id) {
          <div class="member-card">
            <div class="avatar collab lg">{{ initials(m) }}</div>
            <div>
              <div class="cell-name">{{ m.firstName }} {{ m.lastName }}</div>
              <div style="font-size:12px;color:#059669;font-weight:600;margin-top:2px">🇲🇬 Collaborateur Madagascar</div>
              <div class="cell-email">{{ m.email }}</div>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty-team"><mat-icon>people_outline</mat-icon><p>Aucun collaborateur ne vous est rattaché.</p></div>
    }

  <!-- ══ VUE COLLABORATEUR / GÉRANT ════════════════════════════════════════════ -->
  } @else {
    <div class="page-header">
      <div>
        <h1 class="page-title">Mon équipe</h1>
        <p class="page-sub">
          @if (auth.currentUser()?.site === 'REUNION') { Vos collaborateurs Madagascar rattachés }
          @else { Votre superviseur direct }
        </p>
      </div>
    </div>
    @if (auth.currentUser()?.site === 'REUNION') {
      @if ((myTeam?.team?.length ?? 0) > 0) {
        <div class="my-team-grid">
          @for (m of myTeam?.team ?? []; track m.id) {
            <div class="member-card">
              <div class="avatar collab lg">{{ initials(m) }}</div>
              <div>
                <div class="cell-name">{{ m.firstName }} {{ m.lastName }}</div>
                <div style="font-size:12px;color:#6366F1;font-weight:600;margin-top:2px">🇲🇬 Collaborateur Madagascar</div>
                <div class="cell-email">{{ m.email }}</div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-team"><mat-icon>people_outline</mat-icon><p>Aucun collaborateur Madagascar ne vous est rattaché.</p></div>
      }
    } @else {
      @if (myTeam?.referent) {
        <div class="my-team-grid">
          <div class="member-card">
            <div class="avatar chef-mission lg">{{ initials(myTeam!.referent!) }}</div>
            <div>
              <div class="cell-name">{{ myTeam!.referent!.firstName }} {{ myTeam!.referent!.lastName }}</div>
              <div style="font-size:12px;color:#0F766E;font-weight:600;margin-top:2px">{{ roleLabel(myTeam!.referent!.role) }}</div>
              <div class="cell-email">{{ myTeam!.referent!.email }}</div>
            </div>
          </div>
        </div>
      } @else {
        <div class="empty-team"><mat-icon>person_off</mat-icon><p>Vous n'avez pas encore de superviseur assigné.</p></div>
      }
    }
  }
</div>

<!-- ══ PANNEAU D'ASSIGNATION (drawer latéral) ══════════════════════════════ -->
@if (editForm()) {
  <div class="edit-backdrop" (click)="closeAll()"></div>
  <div class="edit-drawer" (click)="$event.stopPropagation()">

    <div class="edit-drawer__header">
      <div class="edit-user-info">
        <div class="avatar lg default">{{ initials(editForm()!.user) }}</div>
        <div>
          <div class="edit-name">{{ editForm()!.user.firstName }} {{ editForm()!.user.lastName }}</div>
          <div class="edit-email">{{ editForm()!.user.email }}</div>
        </div>
      </div>
      <button class="btn-icon" (click)="closeAll()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="edit-drawer__body">
      <p class="form-hint">Définissez le rôle hiérarchique et l'antenne de rattachement de cet utilisateur.</p>

      <!-- Antenne -->
      <div class="form-field">
        <label>Antenne</label>
        <div class="select-wrap">
          <select [(ngModel)]="editForm()!.antenne" (ngModelChange)="onAntenneChange()">
            <option value="">— Aucune (utilisateur Réunion) —</option>
            <option value="EST">🌅 Antenne EST</option>
            <option value="OUEST">🌇 Antenne OUEST</option>
          </select>
          <mat-icon class="select-icon">expand_more</mat-icon>
        </div>
      </div>

      <!-- Rôle hiérarchique -->
      <div class="form-field">
        <label>Rôle hiérarchique</label>
        <div class="select-wrap">
          <select [(ngModel)]="editForm()!.role" (ngModelChange)="onRoleChange()">
            <option value="COLLABORATEUR">Collaborateur Madagascar</option>
            @if (editForm()!.antenne) {
              <option value="CHEF_MISSION">Chef de mission</option>
              <option value="CHEF_ANTENNE">Chef d'antenne</option>
              <option value="GERANT_MADAGASCAR">Gérant Madagascar</option>
            }
          </select>
          <mat-icon class="select-icon">expand_more</mat-icon>
        </div>
        <p class="field-hint">
          @switch (editForm()!.role) {
            @case ('CHEF_ANTENNE')      { Responsable de l'ensemble de l'antenne. Voit toutes les données de son antenne. }
            @case ('CHEF_MISSION')      { Gère une équipe de collaborateurs. Attribue les tâches à ses collaborateurs directs. }
            @case ('GERANT_MADAGASCAR') { Vision globale de l'antenne sans gestion directe d'équipe. }
            @case ('COLLABORATEUR')     { Reçoit et exécute des tâches de son chef de mission. }
          }
        </p>
      </div>

      <!-- Superviseur (Chef de mission → chef d'antenne) -->
      @if (editForm()!.role === 'CHEF_MISSION' && editForm()!.antenne) {
        @let chefsAntenne = chefsAntenneFor(editForm()!.antenne);
        <div class="form-field">
          <label>Chef d'antenne rattaché</label>
          <div class="select-wrap">
            <select [(ngModel)]="editForm()!.referentId">
              <option [ngValue]="null">— Non rattaché —</option>
              @for (ca of chefsAntenne; track ca.id) {
                <option [ngValue]="ca.id">{{ ca.firstName }} {{ ca.lastName }}</option>
              }
            </select>
            <mat-icon class="select-icon">expand_more</mat-icon>
          </div>
          @if (chefsAntenne.length === 0) {
            <p class="field-hint field-hint--warn">Aucun chef d'antenne désigné pour cette antenne. Désignez-en un d'abord.</p>
          }
        </div>
      }

      <!-- Superviseur (Collaborateur → chef de mission) -->
      @if (editForm()!.role === 'COLLABORATEUR' && editForm()!.antenne) {
        @let chefsMiss = chefsMission(editForm()!.antenne);
        <div class="form-field">
          <label>Chef de mission rattaché</label>
          <div class="select-wrap">
            <select [(ngModel)]="editForm()!.referentId">
              <option [ngValue]="null">— Non rattaché —</option>
              @for (cm of chefsMiss; track cm.id) {
                <option [ngValue]="cm.id">{{ cm.firstName }} {{ cm.lastName }}</option>
              }
            </select>
            <mat-icon class="select-icon">expand_more</mat-icon>
          </div>
          @if (chefsMiss.length === 0) {
            <p class="field-hint field-hint--warn">Aucun chef de mission dans cette antenne. Désignez-en un d'abord.</p>
          }
        </div>
      }

      <!-- Aperçu hiérarchique -->
      <div class="hierarchy-preview">
        <div class="hierarchy-title"><mat-icon>account_tree</mat-icon> Position dans la hiérarchie</div>
        <div class="hierarchy-tree">
          <div class="h-node h-node--expert">Expert-comptable</div>
          @if (editForm()!.antenne) {
            <div class="h-branch">
              <div class="h-node h-node--antenne" [class.h-node--active]="editForm()!.role === 'CHEF_ANTENNE'">
                Chef d'antenne {{ editForm()!.antenne }}
                @if (editForm()!.role === 'CHEF_ANTENNE') { <span class="h-you">← vous</span> }
              </div>
              <div class="h-branch">
                <div class="h-node h-node--mission" [class.h-node--active]="editForm()!.role === 'CHEF_MISSION'">
                  Chef de mission
                  @if (editForm()!.role === 'CHEF_MISSION') { <span class="h-you">← vous</span> }
                </div>
                <div class="h-branch">
                  <div class="h-node h-node--collab" [class.h-node--active]="editForm()!.role === 'COLLABORATEUR'">
                    Collaborateur
                    @if (editForm()!.role === 'COLLABORATEUR') { <span class="h-you">← vous</span> }
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Transfert d'équipe (pour Chef de mission avec collaborateurs) -->
      @if (editForm()!.user.role === 'CHEF_MISSION') {
        @let collabsActuels = collaborateursOf(editForm()!.user.id);
        @if (collabsActuels.length > 0) {
          <div class="transfer-section">
            <div class="transfer-title">
              <mat-icon>swap_horiz</mat-icon>
              Transférer l'équipe ({{ collabsActuels.length }} collaborateur(s))
            </div>
            <p class="form-hint">Réassigne tous les collaborateurs vers un autre chef de mission.</p>
            @let otherCMs = chefsMission(editForm()!.antenne).filter(cm => cm.id !== editForm()!.user.id);
            @if (otherCMs.length > 0) {
              <div class="transfer-row">
                <div class="select-wrap" style="flex:1">
                  <select [(ngModel)]="editForm()!.transferToId">
                    <option [ngValue]="null">— Choisir le destinataire —</option>
                    @for (cm of otherCMs; track cm.id) {
                      <option [ngValue]="cm.id">{{ cm.firstName }} {{ cm.lastName }}</option>
                    }
                  </select>
                  <mat-icon class="select-icon">expand_more</mat-icon>
                </div>
                <button class="btn-transfer" [disabled]="!editForm()!.transferToId" (click)="transferTeam()">
                  <mat-icon>group</mat-icon> Transférer
                </button>
              </div>
            } @else {
              <p class="field-hint field-hint--warn">Aucun autre chef de mission dans cette antenne.</p>
            }
          </div>
        }
      }

      <!-- Statut du compte -->
      @if (auth.isAdmin()) {
        <div class="account-status">
          <div class="account-status__label">
            <mat-icon>{{ editForm()!.user.isActive ? 'check_circle' : 'cancel' }}</mat-icon>
            Compte {{ editForm()!.user.isActive ? 'actif' : 'inactif' }}
          </div>
          <button class="btn-toggle-active"
                  [class.btn-toggle-active--off]="editForm()!.user.isActive"
                  (click)="$event.stopPropagation(); toggleActive(editForm()!.user)">
            {{ editForm()!.user.isActive ? 'Désactiver le compte' : 'Réactiver le compte' }}
          </button>
        </div>
      }
    </div>

    <div class="edit-drawer__footer">
      <button class="btn-cancel" (click)="closeAll()">Annuler</button>
      <button class="btn-save" [disabled]="editForm()!.saving" (click)="saveEdit()">
        @if (editForm()!.saving) { <mat-icon class="spin">refresh</mat-icon> Enregistrement… }
        @else { <mat-icon>check</mat-icon> Enregistrer }
      </button>
    </div>
  </div>
}

<!-- ══ PANNEAU DE CRÉATION ══════════════════════════════════════════════════ -->
@if (createForm()) {
  <div class="edit-backdrop" (click)="closeAll()"></div>
  <div class="edit-drawer" (click)="$event.stopPropagation()">
    <div class="edit-drawer__header">
      <div class="edit-user-info">
        <div class="avatar lg default" style="background:#E0E7FF;color:#4338CA">
          <mat-icon>person_add</mat-icon>
        </div>
        <div>
          <div class="edit-name">Nouveau collaborateur</div>
          <div class="edit-email">Remplissez les informations ci-dessous</div>
        </div>
      </div>
      <button class="btn-icon" (click)="closeAll()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="edit-drawer__body">
      <div class="form-row-2">
        <div class="form-field">
          <label>Prénom *</label>
          <input class="text-input" type="text" placeholder="Prénom" [(ngModel)]="createForm()!.firstName" />
        </div>
        <div class="form-field">
          <label>Nom *</label>
          <input class="text-input" type="text" placeholder="Nom" [(ngModel)]="createForm()!.lastName" />
        </div>
      </div>
      <div class="form-field">
        <label>Email *</label>
        <input class="text-input" type="email" placeholder="email@afym.mg" [(ngModel)]="createForm()!.email" />
      </div>
      <div class="form-field">
        <label>Mot de passe provisoire *</label>
        <input class="text-input" type="password" placeholder="Min. 8 caractères" [(ngModel)]="createForm()!.password" />
      </div>
      <div class="form-row-2">
        <div class="form-field">
          <label>Site *</label>
          <div class="select-wrap">
            <select [(ngModel)]="createForm()!.site">
              <option value="REUNION">🇷🇪 La Réunion</option>
              <option value="MADAGASCAR">🇲🇬 Madagascar</option>
            </select>
            <mat-icon class="select-icon">expand_more</mat-icon>
          </div>
        </div>
        <div class="form-field">
          <label>Antenne</label>
          <div class="select-wrap">
            <select [(ngModel)]="createForm()!.antenne">
              <option value="">— Aucune —</option>
              <option value="EST">🌅 EST</option>
              <option value="OUEST">🌇 OUEST</option>
            </select>
            <mat-icon class="select-icon">expand_more</mat-icon>
          </div>
        </div>
      </div>
      <div class="form-field">
        <label>Rôle *</label>
        <div class="select-wrap">
          <select [(ngModel)]="createForm()!.role">
            <option value="COLLABORATEUR">Collaborateur</option>
            <option value="CHEF_MISSION">Chef de mission</option>
            <option value="CHEF_ANTENNE">Chef d'antenne</option>
            <option value="GERANT_MADAGASCAR">Gérant Madagascar</option>
            <option value="EXPERT_COMPTABLE">Expert-comptable</option>
            <option value="ADMIN">Administrateur</option>
          </select>
          <mat-icon class="select-icon">expand_more</mat-icon>
        </div>
      </div>
      @if (createForm()!.role === 'COLLABORATEUR' && createForm()!.antenne) {
        <div class="form-field">
          <label>Chef de mission rattaché</label>
          <div class="select-wrap">
            <select [(ngModel)]="createForm()!.referentId">
              <option [ngValue]="null">— Non rattaché —</option>
              @for (cm of chefsMission(createForm()!.antenne); track cm.id) {
                <option [ngValue]="cm.id">{{ cm.firstName }} {{ cm.lastName }}</option>
              }
            </select>
            <mat-icon class="select-icon">expand_more</mat-icon>
          </div>
        </div>
      }
      @if (createForm()!.role === 'CHEF_MISSION' && createForm()!.antenne) {
        <div class="form-field">
          <label>Chef d'antenne rattaché</label>
          <div class="select-wrap">
            <select [(ngModel)]="createForm()!.referentId">
              <option [ngValue]="null">— Non rattaché —</option>
              @for (ca of chefsAntenneFor(createForm()!.antenne); track ca.id) {
                <option [ngValue]="ca.id">{{ ca.firstName }} {{ ca.lastName }}</option>
              }
            </select>
            <mat-icon class="select-icon">expand_more</mat-icon>
          </div>
        </div>
      }
    </div>

    <div class="edit-drawer__footer">
      <button class="btn-cancel" (click)="closeAll()">Annuler</button>
      <button class="btn-save" [disabled]="createForm()!.saving" (click)="saveCreate()">
        @if (createForm()!.saving) { <mat-icon class="spin">refresh</mat-icon> Création… }
        @else { <mat-icon>person_add</mat-icon> Créer le compte }
      </button>
    </div>
  </div>
}
</div>
  `,
  styles: [`
    .page-wrap { position: relative; display: flex; height: 100%; }
    .page { flex: 1; padding: 28px 32px; overflow-y: auto; min-width: 0; }

    /* ── Header ─────────────────────────────────────────────────── */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-title  { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0; }
    .page-sub    { font-size: 13px; color: #64748B; margin: 4px 0 0; }
    .stat-ok     { color: #059669; font-weight: 600; }
    .stat-warn   { color: #D97706; font-weight: 600; }

    .legend { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .badge-role {
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .04em;
    }
    .badge-role.chef-antenne { background: #EFF6FF; color: #1D4ED8; }
    .badge-role.chef-mission { background: #F0FDF4; color: #166534; }
    .badge-role.collab       { background: #FDF4FF; color: #7E22CE; }
    .badge-role.gerant       { background: #FFF7ED; color: #9A3412; }

    /* ── Onglets ────────────────────────────────────────────────── */
    .tabs {
      display: flex; gap: 4px; margin-bottom: 24px;
      background: #F1F5F9; padding: 4px; border-radius: 12px;
      width: fit-content;
    }
    .tab-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 18px; border: none; background: transparent;
      border-radius: 9px; font-size: 13px; font-weight: 600;
      color: #64748B; cursor: pointer; font-family: inherit; transition: all .15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.active { background: white; color: #1E293B; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      &:not(.active):hover { background: rgba(255,255,255,.6); }
    }
    .tab-count {
      display: inline-flex; align-items: center; justify-content: center;
      background: #162351; color: #93C5FD; font-size: 11px; font-weight: 700;
      min-width: 20px; height: 18px; border-radius: 9px; padding: 0 6px;
    }
    .tab-btn.active .tab-count { background: #162351; }

    /* ── Organigramme ───────────────────────────────────────────── */
    .chart-wrap { overflow-x: auto; padding-bottom: 32px; }
    .org-scroll { display: inline-block; min-width: 100%; text-align: center; padding: 8px 40px 0; }

    ul.org-tree, ul.org-tree ul {
      list-style: none; margin: 0; padding: 0;
    }
    ul.org-tree { display: inline-block; white-space: nowrap; }
    ul.org-tree ul {
      padding-top: 28px; position: relative;
      display: flex; justify-content: center;
    }
    ul.org-tree ul::before {
      content: ''; position: absolute; top: 0; left: 50%;
      border-left: 2px solid #CBD5E1; height: 28px;
    }
    ul.org-tree li {
      display: inline-flex; flex-direction: column; align-items: center;
      vertical-align: top; padding: 28px 10px 0; position: relative;
    }
    ul.org-tree li::before, ul.org-tree li::after {
      content: ''; position: absolute; top: 0; right: 50%;
      border-top: 2px solid #CBD5E1; width: 50%; height: 28px;
    }
    ul.org-tree li::after { right: auto; left: 50%; border-left: 2px solid #CBD5E1; }
    ul.org-tree li:only-child::after, ul.org-tree li:only-child::before { display: none; }
    ul.org-tree li:only-child { padding-top: 0; }
    ul.org-tree li:first-child::before, ul.org-tree li:last-child::after { border: none; }
    ul.org-tree li:last-child::before { border-right: 2px solid #CBD5E1; border-radius: 0 6px 0 0; }
    ul.org-tree li:first-child::after { border-radius: 6px 0 0 0; }

    .org-node {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 12px;
      border: 1.5px solid #E2E8F0; background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,.06); white-space: nowrap; cursor: default;
    }
    .org-node--root {
      background: #162351; color: white; border-color: #162351;
      padding: 14px 24px; border-radius: 14px; gap: 12px;
      mat-icon { color: rgba(255,255,255,.6); font-size: 22px; width: 22px; height: 22px; }
    }
    .org-root-name { font-size: 15px; font-weight: 700; }
    .org-count { font-size: 12px; opacity: .65; padding: 2px 8px; background: rgba(255,255,255,.12); border-radius: 10px; }
    .org-node--antenne {
      background: #1E3A8A; color: white; border-color: #1E3A8A;
      border-radius: 10px; padding: 9px 16px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; opacity: .7; }
    }
    .org-antenne-name { font-size: 13px; font-weight: 700; }
    .org-node--antenne .org-count { font-size: 11px; }
    .org-node--chef-antenne { border-color: #A78BFA; background: #F5F3FF; }
    .org-node--chef-mission { border-color: #6EE7B7; background: #F0FDF4; }
    .org-node--collab       { border-color: #BAE6FD; background: #F0F9FF; }
    .org-node--gerant       { border-color: #FED7AA; background: #FFF7ED; }
    .org-node--empty {
      border-color: #E2E8F0; background: #F8FAFC; color: #94A3B8;
      font-size: 12px; font-style: italic; gap: 5px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .org-avatar {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white;
    }
    .org-avatar.ca { background: #7C3AED; }
    .org-avatar.cm { background: #059669; }
    .org-avatar.co { background: #2563EB; }
    .org-avatar.ge { background: #D97706; }
    .org-name { font-size: 13px; font-weight: 600; color: #1E293B; line-height: 1.2; }
    .org-role { font-size: 11px; color: #64748B; }

    /* ── Antennes grid ───────────────────────────────────────────── */
    .antennes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 20px; margin-bottom: 24px; }

    .antenne-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 16px; }
    .antenne-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 18px; background: #162351; border-radius: 16px 16px 0 0;
      mat-icon { color: #93C5FD; font-size: 18px; width: 18px; height: 18px; }
    }
    .antenne-label { font-size: 14px; font-weight: 700; color: #fff; flex: 1; }
    .antenne-count { font-size: 12px; color: #93C5FD; }

    .section-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 16px; border-bottom: 1px solid #F1F5F9;
    }
    .section-title {
      font-size: 11px; font-weight: 700; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .06em; white-space: nowrap;
    }
    .no-data { font-size: 12px; color: #CBD5E1; font-style: italic; }

    .mission-block { border-bottom: 1px solid #F1F5F9; padding: 10px 16px 12px; }

    .collabs-list { padding: 6px 0 0 20px; display: flex; flex-direction: column; gap: 4px; }
    .collab-row { display: flex; align-items: center; gap: 7px; }
    .collab-name { font-size: 12.5px; color: #475569; font-weight: 500; flex: 1; }
    .no-collab { font-size: 12px; color: #CBD5E1; font-style: italic; padding: 2px 0; }

    /* ── Pills ───────────────────────────────────────────────────── */
    .user-pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 5px 10px 5px 6px; border-radius: 20px; border: 1.5px solid;
    }
    .user-pill--chef-antenne { border-color: #BFDBFE; background: #EFF6FF; }
    .user-pill--chef-mission { border-color: #BBF7D0; background: #F0FDF4; }
    .user-pill--gerant       { border-color: #FED7AA; background: #FFF7ED; }
    .user-pill--unassigned   { border-color: #E2E8F0; background: #F8FAFC; }
    .pill-name  { font-size: 12.5px; font-weight: 700; color: #1E293B; line-height: 1.2; }
    .pill-email { font-size: 11px; color: #94A3B8; }

    /* ── Avatars ─────────────────────────────────────────────────── */
    .avatar {
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; text-transform: uppercase; flex-shrink: 0; border-radius: 8px;
    }
    .avatar.xs { width: 22px; height: 22px; font-size: 8px; border-radius: 6px; }
    .avatar.sm { width: 28px; height: 28px; font-size: 10px; border-radius: 7px; }
    .avatar.lg { width: 46px; height: 46px; font-size: 15px; border-radius: 12px; }
    .avatar.chef-antenne { background: #DBEAFE; color: #1D4ED8; }
    .avatar.chef-mission { background: #DCFCE7; color: #166534; }
    .avatar.collab       { background: #F3E8FF; color: #7E22CE; }
    .avatar.gerant       { background: #FEF3C7; color: #92400E; }
    .avatar.default      { background: #F1F5F9; color: #64748B; }

    /* ── Buttons ─────────────────────────────────────────────────── */
    .btn-icon {
      border: none; background: none; cursor: pointer; padding: 4px;
      display: flex; align-items: center; color: #94A3B8; border-radius: 6px;
      &:hover { color: #475569; background: #F1F5F9; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .btn-icon-sm {
      border: none; background: none; cursor: pointer; padding: 2px;
      display: flex; align-items: center; color: #CBD5E1; border-radius: 4px; flex-shrink: 0;
      &:hover { color: #6366F1; }
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .btn-assign {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border: 1.5px solid #6366F1; border-radius: 16px;
      background: #EEF2FF; color: #4338CA; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; margin-left: auto;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { background: #E0E7FF; }
    }

    /* ── Inline reassign ─────────────────────────────────────────── */
    .inline-panel {
      display: flex; gap: 5px; flex-wrap: wrap; align-items: center;
      padding: 6px 8px; background: #F8FAFC; border: 1px solid #E2E8F0;
      border-radius: 10px; position: absolute; left: 0; top: 100%;
      z-index: 20; box-shadow: 0 4px 12px rgba(0,0,0,.1); min-width: 200px;
    }
    .chip-sm {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px; border: 1.5px solid #E2E8F0; border-radius: 16px;
      background: white; font-size: 11.5px; font-weight: 500; color: #334155;
      cursor: pointer; font-family: inherit; transition: all .1s;
      &:hover { border-color: #A5B4FC; background: #EEF2FF; }
      &--active { border-color: #6366F1; background: #EEF2FF; color: #3730A3; }
      &--remove { border-color: #FECACA; color: #DC2626; background: #FFF5F5;
                  &:hover { background: #FEE2E2; }
                  mat-icon { font-size: 13px; width: 13px; height: 13px; } }
    }

    /* ── Unassigned ──────────────────────────────────────────────── */
    .unassigned-section { margin-top: 4px; padding: 18px 0; border-top: 2px dashed #FDE68A; }
    .unassigned-header {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: #92400E; font-weight: 600; margin-bottom: 12px;
      mat-icon { color: #D97706; font-size: 17px; width: 17px; height: 17px; }
    }
    .unassigned-chips { display: flex; gap: 10px; flex-wrap: wrap; }

    /* ── Empty ───────────────────────────────────────────────────── */
    .empty-section {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px; font-size: 12.5px; color: #CBD5E1; font-style: italic;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* ── My team (non-admin) ─────────────────────────────────────── */
    .my-team-grid { display: flex; flex-wrap: wrap; gap: 14px; }
    .member-card {
      display: flex; align-items: center; gap: 14px;
      background: white; border: 1px solid #E2E8F0; border-radius: 12px;
      padding: 18px 22px; min-width: 260px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
    }
    .cell-name  { font-size: 14px; font-weight: 700; color: #1E293B; }
    .cell-email { font-size: 11.5px; color: #94A3B8; margin-top: 2px; }
    .badge-role-sm {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      margin-top: 3px; display: inline-block;
    }
    .badge-CHEF_ANTENNE      { background: #DBEAFE; color: #1D4ED8; }
    .badge-CHEF_MISSION      { background: #DCFCE7; color: #166534; }
    .badge-COLLABORATEUR     { background: #F3E8FF; color: #7E22CE; }
    .badge-GERANT_MADAGASCAR { background: #FEF3C7; color: #92400E; }
    .empty-team {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 32px; text-align: center; color: #94A3B8;
      mat-icon { font-size: 44px; width: 44px; height: 44px; margin-bottom: 14px; opacity: .4; }
      p { font-size: 14px; color: #64748B; font-weight: 500; margin: 0; }
    }

    /* ── Tableau tous utilisateurs ──────────────────────────────── */
    .all-users-section { margin-top: 8px; }
    .all-users-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px; gap: 12px; flex-wrap: wrap;
    }
    .all-users-title {
      display: flex; align-items: center; gap: 7px;
      font-size: 14px; font-weight: 700; color: #1E293B;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748B; }
    }
    .all-users-search {
      display: flex; align-items: center; gap: 6px;
      border: 1.5px solid #E2E8F0; border-radius: 8px;
      padding: 7px 10px; background: white; min-width: 220px;
      &:focus-within { border-color: #6366F1; }
      mat-icon { color: #94A3B8; font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; }
      input { border: none; outline: none; font-size: 13px; font-family: inherit; color: #0F172A; background: transparent; flex: 1; }
    }
    .btn-clear {
      border: none; background: none; cursor: pointer; padding: 1px; display: flex; align-items: center; color: #94A3B8;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .table-wrap { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table thead tr { background: #162351; }
    .table thead th {
      padding: 10px 14px; text-align: left; font-size: 12px;
      font-weight: 600; color: rgba(255,255,255,.85); white-space: nowrap;
    }
    .table tbody tr {
      border-bottom: 1px solid #F1F5F9; background: white; transition: background .1s;
      &:last-child { border-bottom: none; }
      &:hover td { background: #F8FAFC; }
    }
    .tr-inactive td { opacity: .5; }
    .table tbody td { padding: 10px 14px; vertical-align: middle; }
    .user-cell { display: flex; align-items: center; gap: 8px; }
    .td-name  { font-size: 13px; font-weight: 600; color: #1E293B; }
    .td-email { font-size: 11.5px; color: #94A3B8; }
    .td-empty-val { color: #CBD5E1; font-size: 13px; }
    .td-empty {
      text-align: center; padding: 32px !important; color: #94A3B8;
      mat-icon { display: block; font-size: 28px; width: 28px; height: 28px; margin: 0 auto 6px; opacity: .4; }
    }
    .site-badge {
      display: inline-block; font-size: 11.5px; font-weight: 500;
      padding: 3px 8px; border-radius: 6px; background: #EFF6FF; color: #1D4ED8;
    }
    .site-badge--mg { background: #F0FDF4; color: #166534; }
    .role-badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: .03em;
    }
    .role-ADMIN             { background: #F3E8FF; color: #6B21A8; }
    .role-EXPERT_COMPTABLE  { background: #DBEAFE; color: #1D4ED8; }
    .role-CHEF_ANTENNE      { background: #EFF6FF; color: #1E40AF; }
    .role-CHEF_MISSION      { background: #F0FDF4; color: #166534; }
    .role-COLLABORATEUR     { background: #F5F3FF; color: #7C3AED; }
    .role-GERANT_MADAGASCAR { background: #FFF7ED; color: #9A3412; }
    .antenne-badge {
      display: inline-block; font-size: 11.5px; font-weight: 700;
      padding: 3px 10px; border-radius: 20px; background: #162351; color: #93C5FD; letter-spacing: .05em;
    }
    .btn-table-assign {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border: 1.5px solid #E2E8F0; border-radius: 7px;
      background: white; color: #475569; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all .12s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { border-color: #6366F1; color: #4338CA; background: #EEF2FF; }
    }

    /* ══ DRAWER D'ASSIGNATION ════════════════════════════════════════ */
    .edit-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 100;
      backdrop-filter: blur(1px);
    }
    .edit-drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: 380px;
      background: white; z-index: 101;
      box-shadow: -4px 0 24px rgba(0,0,0,.12);
      display: flex; flex-direction: column;
      animation: slideIn .2s ease;
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    .edit-drawer__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 20px 16px; border-bottom: 1px solid #F1F5F9;
    }
    .edit-user-info { display: flex; align-items: center; gap: 12px; }
    .edit-name  { font-size: 15px; font-weight: 700; color: #0F172A; }
    .edit-email { font-size: 12px; color: #94A3B8; margin-top: 1px; }

    .edit-drawer__body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }

    .form-hint { font-size: 13px; color: #64748B; line-height: 1.5; margin: 0; }

    .form-field { display: flex; flex-direction: column; gap: 5px; }
    label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .06em; }
    .select-wrap { position: relative; }
    select {
      width: 100%; appearance: none; -webkit-appearance: none;
      border: 1.5px solid #E2E8F0; border-radius: 8px;
      padding: 9px 36px 9px 12px; font-size: 13.5px; color: #0F172A;
      background: white; font-family: inherit; cursor: pointer; outline: none;
      transition: border-color .13s;
      &:focus { border-color: #6366F1; }
    }
    .select-icon {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      font-size: 18px; width: 18px; height: 18px; color: #94A3B8; pointer-events: none;
    }
    .field-hint { font-size: 12px; color: #94A3B8; line-height: 1.4; margin: 2px 0 0; }
    .field-hint--warn { color: #D97706; }

    /* ── Hierarchy preview ───────────────────────────────────────── */
    .hierarchy-preview {
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px;
    }
    .hierarchy-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .hierarchy-tree { display: flex; flex-direction: column; gap: 0; }
    .h-node {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;
      border: 1.5px solid transparent; margin-bottom: 2px;
    }
    .h-node--expert  { background: #F0F9FF; color: #0369A1; border-color: #BAE6FD; }
    .h-node--antenne { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
    .h-node--mission { background: #F0FDF4; color: #166534; border-color: #BBF7D0; }
    .h-node--collab  { background: #FDF4FF; color: #7E22CE; border-color: #E9D5FF; }
    .h-node--active  { font-weight: 800; box-shadow: 0 0 0 2px currentColor; }
    .h-branch { padding-left: 18px; border-left: 2px dashed #E2E8F0; margin-left: 8px; padding-top: 4px; }
    .h-you { font-size: 11px; font-weight: 500; opacity: .8; }

    .edit-drawer__footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 16px 20px; border-top: 1px solid #F1F5F9;
    }
    .btn-cancel {
      padding: 9px 18px; border: 1.5px solid #E2E8F0; border-radius: 8px;
      background: white; color: #64748B; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      &:hover { background: #F8FAFC; }
    }
    .btn-save {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 20px; border: none; border-radius: 8px;
      background: #162351; color: white; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover:not(:disabled) { background: #1e3170; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin .8s linear infinite; }

    /* ── Header actions ──────────────────────────────────────────── */
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .btn-create {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border: none; border-radius: 8px;
      background: #162351; color: white; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #1e3170; }
    }

    /* ── Org chart toolbar ───────────────────────────────────────── */
    .chart-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .btn-print {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border: 1px solid #CBD5E1; border-radius: 8px;
      background: white; color: #334155; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #F8FAFC; border-color: #94A3B8; }
    }
    .chart-hint { font-size: 12px; color: #94A3B8; }

    /* ── Org nodes overrides ─────────────────────────────────────── */
    .org-node--bureau > .org-node-content {
      background: #EFF6FF; border: 2px solid #BFDBFE;
      .org-label { color: #1D4ED8; font-weight: 800; }
    }
    .org-node--reunion-user > .org-node-content {
      background: #F0FDF4; border: 1px solid #BBF7D0;
      cursor: pointer;
      &:hover { background: #DCFCE7; }
    }
    .org-avatar.adm { background: #EDE9FE; color: #6D28D9; }
    .org-avatar.exp { background: #FEF3C7; color: #92400E; }
    .org-task-badge {
      display: inline-block; margin-top: 4px;
      padding: 1px 7px; border-radius: 10px;
      background: #FEF9C3; color: #854D0E;
      font-size: 10px; font-weight: 700; letter-spacing: .03em;
    }

    /* ── Users tab header ────────────────────────────────────────── */
    .all-users-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 28px; height: 22px; padding: 0 8px;
      background: #E2E8F0; color: #475569; border-radius: 20px;
      font-size: 12px; font-weight: 700;
    }

    /* ── Filter bar ──────────────────────────────────────────────── */
    .filter-bar {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 12px 16px; background: #F8FAFC; border-radius: 10px;
      margin-bottom: 16px; border: 1px solid #E2E8F0;
    }
    .filter-group { display: flex; align-items: center; gap: 6px; }
    .filter-select {
      padding: 5px 10px; border: 1px solid #CBD5E1; border-radius: 7px;
      background: white; color: #334155; font-size: 12px; font-family: inherit;
      cursor: pointer;
      &:focus { outline: none; border-color: #162351; }
    }
    .toggle-inactive {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #64748B; cursor: pointer;
      input[type=checkbox] { cursor: pointer; }
    }
    .btn-clear-filters {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border: 1px solid #FCA5A5; border-radius: 7px;
      background: #FEF2F2; color: #DC2626; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { background: #FEE2E2; }
    }

    /* ── Table badges & actions ──────────────────────────────────── */
    .badge-inactive {
      display: inline-block; padding: 2px 8px; border-radius: 20px;
      background: #F1F5F9; color: #94A3B8;
      font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    }
    .charge-badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      background: #F0FDF4; color: #16A34A;
      font-size: 11px; font-weight: 700;
      &.charge-badge--high { background: #FEF9C3; color: #D97706; }
    }
    .td-actions { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
    .btn-table-rh {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: 1px solid #E0E7FF; border-radius: 6px;
      background: #EEF2FF; color: #4338CA; cursor: pointer;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #E0E7FF; }
    }
    .btn-table-toggle {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: 1px solid #FCA5A5; border-radius: 6px;
      background: #FEF2F2; color: #DC2626; cursor: pointer;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #FEE2E2; }
      &.btn-table-toggle--on { border-color: #BBF7D0; background: #F0FDF4; color: #16A34A; &:hover { background: #DCFCE7; } }
    }

    /* ── Edit drawer: transfer section ──────────────────────────── */
    .transfer-section { margin-top: 16px; padding: 14px; background: #FFF7ED; border-radius: 10px; border: 1px solid #FED7AA; }
    .transfer-title { font-size: 12px; font-weight: 700; color: #92400E; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .05em; }
    .transfer-row { display: flex; align-items: center; gap: 8px; }
    .btn-transfer {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border: none; border-radius: 8px;
      background: #EA580C; color: white; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #C2410C; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }

    /* ── Edit drawer: account status section ─────────────────────── */
    .account-status { margin-top: 16px; padding: 14px; background: #F8FAFC; border-radius: 10px; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .account-status__label { font-size: 13px; color: #64748B; }
    .btn-toggle-active {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border: 1px solid #BBF7D0; border-radius: 8px;
      background: #F0FDF4; color: #15803D; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #DCFCE7; }
      &.btn-toggle-active--off { border-color: #FCA5A5; background: #FEF2F2; color: #DC2626; &:hover { background: #FEE2E2; } }
    }

    /* ── Create drawer: form helpers ─────────────────────────────── */
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  `],
})
export class EquipesComponent implements OnInit, OnDestroy {
  @ViewChild('orgScroll') orgScrollRef!: ElementRef<HTMLElement>;

  private usersService = inject(UsersService);
  private toast        = inject(ToastService);
  private router       = inject(Router);
  auth = inject(AuthService);
  private notifStream  = inject(NotificationStreamService);
  private sub = new Subscription();

  users  = signal<User[]>([]);
  myTeam: { referent: User | null; team: User[] } | null = null;

  activeTab      = signal<'hierarchy' | 'chart' | 'users'>('hierarchy');
  reassignUserId = signal<number | null>(null);
  editForm       = signal<EditForm | null>(null);
  createForm     = signal<CreateForm | null>(null);
  searchQuery    = signal('');
  filterRole     = signal('');
  filterAntenne  = signal('');
  filterSite     = signal('');
  showInactive   = signal(false);
  taskCounts     = signal<Record<number, number>>({});

  get totalHierarchie(): number {
    return this.users().filter(u => u.isActive).length;
  }
  get assignedCount(): number {
    return this.users().filter(u => u.isActive && !!u.antenne).length;
  }
  get totalMg(): number { return this.totalHierarchie; }

  filteredUsers = computed(() => {
    const q       = this.searchQuery().toLowerCase().trim();
    const role    = this.filterRole();
    const antenne = this.filterAntenne();
    const site    = this.filterSite();
    const showIn  = this.showInactive();
    let list = [...this.users()];
    if (!showIn) list = list.filter(u => u.isActive);
    if (role)    list = list.filter(u => u.role === role);
    if (antenne) list = list.filter(u => u.antenne === antenne);
    if (site)    list = list.filter(u => u.site === site);
    list.sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
    if (!q) return list;
    return list.filter(u =>
      `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase().includes(q)
    );
  });

  activeFiltersCount = computed(() =>
    [this.filterRole(), this.filterAntenne(), this.filterSite()].filter(Boolean).length
  );

  reunionUsers = computed(() =>
    this.users().filter(u => u.isActive && (u.role === 'ADMIN' || u.role === 'EXPERT_COMPTABLE'))
  );

  usersInAntenne(antenne: string): User[] {
    return this.users().filter(u => u.antenne === antenne && u.isActive);
  }
  chefAntenne(antenne: string): User | undefined {
    return this.users().find(u => u.role === 'CHEF_ANTENNE' && u.antenne === antenne && u.isActive);
  }
  gerantMadagascar(antenne: string): User | undefined {
    return this.users().find(u => u.role === 'GERANT_MADAGASCAR' && u.antenne === antenne && u.isActive);
  }
  chefsMission(antenne: string): User[] {
    return this.users().filter(u => u.role === 'CHEF_MISSION' && u.antenne === antenne && u.isActive);
  }
  collaborateursOf(chefMissionId: number): User[] {
    return this.users().filter(u => u.role === 'COLLABORATEUR' && u.referentId === chefMissionId && u.isActive);
  }
  usersWithoutAntenne(): User[] {
    return this.users().filter(u => u.isActive && !u.antenne);
  }

  superviseurDe(u: User): User | undefined {
    if (!u.referentId) return undefined;
    return this.users().find(s => s.id === u.referentId);
  }
  chefsAntenneFor(antenne: string): User[] {
    return this.users().filter(u => u.role === 'CHEF_ANTENNE' && u.antenne === antenne && u.isActive);
  }

  openCreate() {
    this.editForm.set(null);
    this.createForm.set({
      firstName: '', lastName: '', email: '', password: '',
      role: 'COLLABORATEUR', site: 'MADAGASCAR', antenne: '', referentId: null, saving: false,
    });
  }

  saveCreate() {
    const f = this.createForm();
    if (!f) return;
    if (!f.firstName || !f.lastName || !f.email || !f.password) {
      this.toast.error('Tous les champs obligatoires doivent être remplis'); return;
    }
    f.saving = true; this.createForm.set({ ...f });
    this.usersService.create({
      firstName: f.firstName, lastName: f.lastName, email: f.email,
      password: f.password, role: f.role, site: f.site,
      antenne: f.antenne || null, referentId: f.referentId,
    }).subscribe({
      next: () => {
        this.toast.success(`${f.firstName} ${f.lastName} créé(e)`);
        this.createForm.set(null); this.load();
      },
      error: (err) => {
        f.saving = false; this.createForm.set({ ...f });
        this.toast.error(err?.error?.message ?? 'Erreur lors de la création');
      },
    });
  }

  toggleActive(user: User) {
    const next = !user.isActive;
    this.usersService.update(user.id, { isActive: next }).subscribe({
      next: () => {
        this.toast.success(next ? `${user.firstName} réactivé(e)` : `${user.firstName} désactivé(e)`);
        this.load();
      },
      error: () => this.toast.error('Erreur lors de la mise à jour'),
    });
  }

  transferTeam() {
    const f = this.editForm();
    if (!f || !f.transferToId) return;
    const collabs = this.collaborateursOf(f.user.id);
    if (!collabs.length) { this.toast.error('Aucun collaborateur à transférer'); return; }
    const calls = collabs.map(c => this.usersService.update(c.id, { referentId: f.transferToId }));
    forkJoin(calls).subscribe({
      next: () => {
        this.toast.success(`${collabs.length} collaborateur(s) transféré(s)`);
        this.editForm.set(null); this.load();
      },
      error: () => this.toast.error('Erreur lors du transfert'),
    });
  }

  goToRH(user: User) { this.router.navigate(['/rh/salaries', user.id]); }

  printChart() {
    const el = this.orgScrollRef?.nativeElement;
    if (!el) return;

    const orgHtml = el.outerHTML
      .replace(/\s_nghost-[^\s"=]+(?:="[^"]*")?/g, '')
      .replace(/\s_ngcontent-[^\s"=]+(?:="[^"]*")?/g, '');

    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const win = window.open('', '_blank', 'width=1400,height=900');
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Organigramme AFYM Audit Expertise</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
  <style>
    *, *::before, *::after {
      box-sizing: border-box; margin: 0; padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; background: #fff; color: #1e293b;
      padding: 24px 16px;
      display: flex; flex-direction: column; align-items: center;
    }
    h1   { font-size: 20px; font-weight: 800; margin-bottom: 4px; text-align: center; }
    .sub { font-size: 12px; color: #64748b; margin-bottom: 36px; text-align: center; }

    /* Material Icons */
    mat-icon {
      font-family: 'Material Icons';
      font-weight: normal; font-style: normal; font-size: 18px; line-height: 1;
      display: inline-block; white-space: nowrap; text-transform: none;
      letter-spacing: normal; word-wrap: normal; direction: ltr;
      vertical-align: middle; flex-shrink: 0;
    }

    /* ── Arbre org : CSS exact du composant ─────────────────── */
    .org-scroll { display: inline-block; min-width: 100%; text-align: center; padding: 8px 40px 0; }

    ul.org-tree, ul.org-tree ul { list-style: none; margin: 0; padding: 0; }
    ul.org-tree { display: inline-block; white-space: nowrap; }
    ul.org-tree ul {
      padding-top: 28px; position: relative;
      display: flex; justify-content: center;
    }
    ul.org-tree ul::before {
      content: ''; position: absolute; top: 0; left: 50%;
      border-left: 2px solid #CBD5E1; height: 28px;
    }
    ul.org-tree li {
      display: inline-flex; flex-direction: column; align-items: center;
      vertical-align: top; padding: 28px 10px 0; position: relative;
    }
    ul.org-tree li::before, ul.org-tree li::after {
      content: ''; position: absolute; top: 0; right: 50%;
      border-top: 2px solid #CBD5E1; width: 50%; height: 28px;
    }
    ul.org-tree li::after { right: auto; left: 50%; border-left: 2px solid #CBD5E1; }
    ul.org-tree li:only-child::after, ul.org-tree li:only-child::before { display: none; }
    ul.org-tree li:only-child { padding-top: 0; }
    ul.org-tree li:first-child::before, ul.org-tree li:last-child::after { border: none; }
    ul.org-tree li:last-child::before { border-right: 2px solid #CBD5E1; border-radius: 0 6px 0 0; }
    ul.org-tree li:first-child::after { border-radius: 6px 0 0 0; }

    /* ── Nœuds ────────────────────────────────────────────────── */
    .org-node {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 12px;
      border: 1.5px solid #E2E8F0; background: white !important;
      box-shadow: 0 1px 4px rgba(0,0,0,.06); white-space: nowrap;
    }
    .org-node--root {
      background: #162351 !important; color: white !important;
      border-color: #162351 !important; padding: 14px 24px; border-radius: 14px; gap: 12px;
    }
    .org-node--root mat-icon { color: rgba(255,255,255,.6); font-size: 22px; }
    .org-node--antenne {
      background: #1E3A8A !important; color: white !important;
      border-color: #1E3A8A !important; border-radius: 10px; padding: 9px 16px;
    }
    .org-node--bureau       { background: #EFF6FF !important; border-color: #93C5FD !important; }
    .org-node--chef-antenne { background: #F5F3FF !important; border-color: #A78BFA !important; }
    .org-node--chef-mission { background: #F0FDF4 !important; border-color: #6EE7B7 !important; }
    .org-node--collab       { background: #F0F9FF !important; border-color: #BAE6FD !important; }
    .org-node--gerant       { background: #FFF7ED !important; border-color: #FED7AA !important; }
    .org-node--reunion-user { background: #F0FDF4 !important; border-color: #86EFAC !important; }
    .org-node--empty        { background: #F8FAFC !important; border-color: #E2E8F0 !important; color: #94A3B8 !important; }

    /* ── Avatars ─────────────────────────────────────────────── */
    .org-avatar {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white !important;
      background: #94A3B8 !important;
    }
    .org-avatar.ca  { background: #7C3AED !important; }
    .org-avatar.cm  { background: #059669 !important; }
    .org-avatar.co  { background: #2563EB !important; }
    .org-avatar.ge  { background: #D97706 !important; }
    .org-avatar.adm { background: #7C3AED !important; }
    .org-avatar.exp { background: #D97706 !important; }

    .org-root-name    { font-size: 15px; font-weight: 700; }
    .org-antenne-name { font-size: 13px; font-weight: 700; }
    .org-count {
      font-size: 12px; opacity: .65; padding: 2px 8px;
      background: rgba(255,255,255,.18) !important; border-radius: 10px;
    }
    .org-name { font-size: 13px; font-weight: 600; color: #1E293B; line-height: 1.2; }
    .org-role { font-size: 11px; color: #64748B; }
    .org-task-badge {
      display: inline-block; padding: 1px 6px; border-radius: 10px;
      background: #FEF9C3 !important; color: #854D0E !important;
      font-size: 9px; font-weight: 700; margin-top: 2px;
    }

    @media print {
      @page { size: A3 landscape; margin: 10mm; }
      body { padding: 8px; }
    }
  </style>
</head>
<body>
  <h1>Organigramme — AFYM Audit Expertise</h1>
  <p class="sub">Édité le ${today}</p>
  ${orgHtml}
  <script>
    document.fonts.ready.then(() => { window.print(); });
  <\/script>
</body>
</html>`);
    win.document.close();
  }

  taskCount(u: User): number { return this.taskCounts()[u.id] ?? 0; }

  clearFilters() { this.filterRole.set(''); this.filterAntenne.set(''); this.filterSite.set(''); }

  openEdit(user: User) {
    this.reassignUserId.set(null);
    this.createForm.set(null);
    this.editForm.set({
      user,
      antenne:      user.antenne ?? '',
      role:         user.role,
      referentId:   user.referentId ?? null,
      saving:       false,
      transferToId: null,
    });
  }

  onAntenneChange() {
    const f = this.editForm();
    if (!f) return;
    if (!f.antenne) {
      f.role = 'COLLABORATEUR';
      f.referentId = null;
    }
    this.editForm.set({ ...f });
  }

  onRoleChange() {
    const f = this.editForm();
    if (!f) return;
    if (f.role !== 'CHEF_MISSION') f.referentId = null;
    this.editForm.set({ ...f });
  }

  saveEdit() {
    const f = this.editForm();
    if (!f) return;
    f.saving = true;
    this.editForm.set({ ...f });

    this.usersService.update(f.user.id, {
      role:       f.role,
      antenne:    f.antenne || null,
      referentId: f.referentId,
    }).subscribe({
      next: () => {
        this.toast.success(`${f.user.firstName} ${f.user.lastName} mis à jour`);
        this.editForm.set(null);
        this.load();
      },
      error: () => {
        f.saving = false;
        this.editForm.set({ ...f });
        this.toast.error('Erreur lors de la mise à jour');
      },
    });
  }

  toggleReassign(userId: number) {
    this.reassignUserId.set(this.reassignUserId() === userId ? null : userId);
  }

  closeAll() {
    this.reassignUserId.set(null);
    this.editForm.set(null);
    this.createForm.set(null);
  }

  ngOnInit() {
    this.load();
    this.sub.add(
      this.notifStream.newNotif$.pipe(filter(n => n.type === 'TEAM_ASSIGNED')).subscribe(() => this.load())
    );
  }
  ngOnDestroy() { this.sub.unsubscribe(); }

  private load() {
    if (this.auth.hasFullVisibility() || this.auth.isChefAntenne()) {
      this.usersService.getAll().subscribe(u => this.users.set(u));
      this.usersService.getTaskCounts().subscribe(counts => {
        const map: Record<number, number> = {};
        counts.forEach(c => map[c.userId] = c.count);
        this.taskCounts.set(map);
      });
    } else {
      this.usersService.getMyTeam().subscribe(t => this.myTeam = t);
    }
  }

  initials(u: User): string {
    return (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
  }
  roleLabel(role: string): string {
    return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
  }
  avatarClass(u: User): string {
    const map: Record<string, string> = {
      CHEF_ANTENNE: 'chef-antenne', CHEF_MISSION: 'chef-mission',
      COLLABORATEUR: 'collab', GERANT_MADAGASCAR: 'gerant',
    };
    return map[u.role] ?? 'default';
  }

  setReferent(user: User, referentId: number | null) {
    this.usersService.setReferent(user.id, referentId).subscribe(updated => {
      user.referentId = updated.referentId;
      this.toast.success('Équipe mise à jour');
    });
  }
  setReferentAndClose(user: User, referentId: number | null) {
    this.setReferent(user, referentId);
    this.reassignUserId.set(null);
  }
}
