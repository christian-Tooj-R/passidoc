import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ClientsService } from '../../../core/services/clients.service';
import { ExerciceService } from '../../../core/services/exercice.service';
import { Client, Exercice } from '../../../core/models/client.model';
import { FicheIdentiteTabComponent } from './tabs/fiche-identite-tab/fiche-identite-tab.component';
import { FluxMensuelTabComponent } from './tabs/flux-mensuel-tab/flux-mensuel-tab.component';
import { FournisseursTabComponent } from './tabs/fournisseurs-tab/fournisseurs-tab.component';
import { SyntheseTabComponent } from './tabs/synthese-tab/synthese-tab.component';
import { DocumentsTabComponent } from './tabs/documents-tab/documents-tab.component';
import { AnalyseStrategiqueTabComponent } from './tabs/analyse-strategique-tab/analyse-strategique-tab.component';
import { MissionsTabComponent } from './tabs/missions-tab/missions-tab.component';
import { ObjectifsTabComponent } from './tabs/objectifs-tab/objectifs-tab.component';
import { ControleInterneTabComponent } from './tabs/controle-interne-tab/controle-interne-tab.component';

import { HistoriqueTabComponent } from './tabs/historique-tab/historique-tab.component';
import { AdnTabComponent } from './tabs/adn-tab/adn-tab.component';
import { DossierTravailTabComponent } from './tabs/dossier-travail-tab/dossier-travail-tab.component';

type TabId =
  | 'fiche' | 'adn' | 'pilotage' | 'fournisseurs' | 'synthese'
  | 'strategie' | 'missions' | 'controle' | 'objectifs'
  | 'documents' | 'historique' | 'dossier-travail';

interface TabGroup {
  label: string;
  icon: string;
  tabs: { id: TabId; icon: string; label: string }[];
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  animations: [
    trigger('tabFade', [
      transition('* <=> *', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('220ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('detailEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(48px)' }),
        animate('600ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatTooltipModule,
    FicheIdentiteTabComponent, FluxMensuelTabComponent,
    FournisseursTabComponent, SyntheseTabComponent, DocumentsTabComponent,
    AnalyseStrategiqueTabComponent, MissionsTabComponent,
    ObjectifsTabComponent, ControleInterneTabComponent,
    HistoriqueTabComponent,
    AdnTabComponent, DossierTravailTabComponent,
  ],
  template: `
    @if (loading()) {
      <div class="skeleton-wrap">
        <!-- Topbar skeleton -->
        <div class="sk-topbar">
          <div class="sk-bar sk-bar--back"></div>
          <div class="sk-bar sk-bar--title"></div>
          <div class="sk-spacer"></div>
          <div class="sk-bar sk-bar--chip"></div>
          <div class="sk-bar sk-bar--btn"></div>
        </div>
        <div class="sk-layout">
          <!-- Sidebar skeleton -->
          <div class="sk-sidebar">
            <div class="sk-avatar"></div>
            <div class="sk-bar sk-bar--name"></div>
            <div class="sk-bar sk-bar--tag"></div>
            <div class="sk-bar sk-bar--score"></div>
            <div class="sk-divider"></div>
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="sk-nav-item" [class.sk-nav-item--label]="i === 1 || i === 4 || i === 7"></div>
            }
          </div>
          <!-- Content skeleton -->
          <div class="sk-content">
            <div class="sk-content-header">
              <div class="sk-icon-box"></div>
              <div class="sk-lines">
                <div class="sk-bar sk-bar--group"></div>
                <div class="sk-bar sk-bar--section"></div>
              </div>
            </div>
            <div class="sk-body">
              <div class="sk-block sk-block--lg"></div>
              <div class="sk-block-row">
                <div class="sk-block sk-block--sm"></div>
                <div class="sk-block sk-block--sm"></div>
                <div class="sk-block sk-block--sm"></div>
              </div>
              <div class="sk-block sk-block--md"></div>
              <div class="sk-block sk-block--lg"></div>
            </div>
          </div>
        </div>
      </div>
    }

    @if (client) {
      <div class="detail" @detailEnter>

        <!-- ══ TOP BAR ═════════════════════════════════ -->
        <div class="topbar">
          <div class="topbar__left">
            <a routerLink="/clients" class="bc-back">
              <mat-icon>arrow_back</mat-icon>
              Dossiers
            </a>
            <mat-icon class="bc-sep">chevron_right</mat-icon>
            <span class="bc-current">{{ client.nom }}</span>
          </div>
          <div class="topbar__right">
            <span class="score-chip score-chip--{{ getScoreChipClass(client.santePassation) }}">
              <mat-icon class="score-chip__icon">{{ getScoreChipClass(client.santePassation) === 'ok' ? 'check_circle' : getScoreChipClass(client.santePassation) === 'partial' ? 'warning' : 'error' }}</mat-icon>
              {{ client.santePassation }}% — {{ getScoreStatus(client.santePassation) }}
            </span>
            <button class="btn-pdf" (click)="exportPdf()">
              <mat-icon>picture_as_pdf</mat-icon>
              Note de passation
            </button>
          </div>
        </div>

        <!-- ══ BANNIÈRE EXERCICE ══════════════════════════ -->
        @if (exerciceCourant()) {
          <div class="exercice-banner" [class.exercice-banner--cloture]="exerciceCourant()!.statut === 'CLOTURE'">
            <div class="eb-left">
              <mat-icon class="eb-icon">event_note</mat-icon>
              <div class="eb-info">
                <span class="eb-label">Exercice en cours</span>
                <span class="eb-period">
                  {{ exerciceCourant()!.annee }}
                  <span class="eb-dates">
                    · {{ exerciceCourant()!.dateOuverture | date:'dd/MM/yyyy' }}
                    → {{ exerciceCourant()!.dateCloture | date:'dd/MM/yyyy' }}
                  </span>
                </span>
              </div>
              <span class="eb-statut" [class.eb-statut--cloture]="exerciceCourant()!.statut === 'CLOTURE'">
                <mat-icon>{{ exerciceCourant()!.statut === 'OUVERT' ? 'lock_open' : 'lock' }}</mat-icon>
                {{ exerciceCourant()!.statut === 'OUVERT' ? 'Ouvert' : 'Clôturé' }}
              </span>
            </div>
            <div class="eb-right">
              @if (exercices().length > 1) {
                <select class="eb-select" (change)="onExerciceChange($any($event.target).value)">
                  @for (ex of exercices(); track ex.id) {
                    <option [value]="ex.id" [selected]="ex.id === exerciceCourant()!.id">
                      Exercice {{ ex.annee }} — {{ ex.statut === 'OUVERT' ? 'En cours' : 'Clôturé' }}
                    </option>
                  }
                </select>
              }
              @if (exerciceCourant()!.statut === 'OUVERT') {
                <button class="eb-btn-cloture" (click)="cloturerExercice()" [disabled]="cloturant()">
                  <mat-icon>lock</mat-icon>
                  {{ cloturant() ? 'Clôture...' : "Clôturer l'exercice" }}
                </button>
              }
            </div>
          </div>
        }

        <!-- ══ LAYOUT ═══════════════════════════════════ -->
        <div class="layout">

          <!-- ── Sidebar ─────────────────────────────── -->
          <aside class="sidebar">

            <!-- Profile -->
            <div class="profile">
              <div class="profile__bg"></div>
              <div class="profile__avatar" (click)="triggerLogoUpload()" matTooltip="Changer le logo">
                @if (client.logoUrl) {
                  <img [src]="client.logoUrl" [alt]="client.nom" class="profile__logo" />
                } @else {
                  <span class="profile__initials">{{ getInitials(client.nom) }}</span>
                }
                <div class="profile__overlay"><mat-icon>photo_camera</mat-icon></div>
              </div>
              <input #logoInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="onLogoChange($event)" />
              <h2 class="profile__name">{{ client.nom }}</h2>
              <span class="profile__site" [class]="client.site === 'REUNION' ? 'site--re' : 'site--mg'">
                {{ client.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
              </span>

              <!-- Score -->
              <div class="profile__score-label">
                <span>Santé de passation</span>
                <span class="score-pct score-pct--{{ getScorePctClass(client.santePassation) }}">{{ client.santePassation }}%</span>
              </div>
              <div class="score-track">
                <div class="score-fill score-fill--{{ getScoreBarClass(client.santePassation) }}" [style.width.%]="client.santePassation"></div>
              </div>
            </div>

            <div class="sidebar__divider"></div>

            <!-- Navigation -->
            <nav class="sidenav">
              @for (group of TAB_GROUPS; track group.label) {
                <div class="sidenav__group">
                  <span class="sidenav__label">
                    <span class="sidenav__label-dot" [style.background]="groupStyle(group.label).color"></span>
                    {{ group.label }}
                  </span>
                  @for (tab of group.tabs; track tab.id) {
                    <button
                      class="sidenav__item"
                      [class.active]="activeTab() === tab.id"
                      [style.background]="activeTab() === tab.id ? groupStyle(group.label).bg : ''"
                      [style.color]="activeTab() === tab.id ? groupStyle(group.label).color : ''"
                      (click)="activeTab.set(tab.id)">
                      <span class="sidenav__indicator" [style.background]="activeTab() === tab.id ? groupStyle(group.label).color : 'transparent'"></span>
                      <mat-icon [style.color]="activeTab() === tab.id ? groupStyle(group.label).color : null">{{ tab.icon }}</mat-icon>
                      <span>{{ tab.label }}</span>
                    </button>
                  }
                </div>
              }
            </nav>

          </aside>

          <!-- ── Content ──────────────────────────────── -->
          <div class="content">

            <!-- ── Hero cards ─────────────────────────── -->
            <div class="hero">

              <!-- Card 1 : illustration secteur -->
              <div class="hero-card hc-sector" [style.background]="getSectorConfig(client.secteurActivite).bg">
                <img class="hc-sector__img"
                     [src]="getSectorConfig(client.secteurActivite).imgSrc"
                     [alt]="getSectorConfig(client.secteurActivite).label"
                     onerror="this.style.display='none'" />
                <div class="hc-sector__body">
                  <span class="hc-sector__name">{{ client.nom }}</span>
                  <span class="hc-sector__pill" [style.background]="getSectorConfig(client.secteurActivite).accent + '22'"
                        [style.color]="getSectorConfig(client.secteurActivite).accent">
                    <mat-icon>{{ getSectorConfig(client.secteurActivite).icon }}</mat-icon>
                    {{ getSectorConfig(client.secteurActivite).label }}
                  </span>
                </div>
              </div>

              <!-- Card 2 : ADN complétude -->
              <div class="hero-card hc-adn">
                <div class="hc-adn__ring-wrap">
                  <svg viewBox="0 0 80 80" width="76" height="76">
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#E8EAED" stroke-width="7"/>
                    <circle cx="40" cy="40" r="30" fill="none"
                            [attr.stroke]="ringColor(client.completude)"
                            stroke-width="7" stroke-linecap="round"
                            stroke-dasharray="188.5"
                            [attr.stroke-dashoffset]="188.5 * (1 - client.completude / 100)"
                            transform="rotate(-90 40 40)"/>
                  </svg>
                  <div class="hc-adn__pct" [style.color]="ringColor(client.completude)">{{ client.completude }}%</div>
                </div>
                <div class="hc-adn__info">
                  <span class="hc-adn__title">ADN Complétude</span>
                  <span class="hc-adn__status" [style.color]="ringColor(client.completude)">{{ getScoreStatus(client.completude) }}</span>
                  <button class="hc-adn__btn" (click)="activeTab.set('adn')">
                    <mat-icon>edit_note</mat-icon> Compléter
                  </button>
                </div>
              </div>

              <!-- Card 3 : infos clés -->
              <div class="hero-card hc-info">
                <div class="hc-info__site" [class.site--re]="client.site === 'REUNION'" [class.site--mg]="client.site !== 'REUNION'">
                  {{ client.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
                </div>
                @if (client.responsable) {
                  <div class="hc-info__row">
                    <div class="hc-info__ico-wrap hc-info__ico-wrap--blue">
                      <mat-icon>person</mat-icon>
                    </div>
                    <div class="hc-info__text">
                      <span class="hc-info__lbl">Expert-comptable</span>
                      <span class="hc-info__val">{{ client.responsable.firstName }} {{ client.responsable.lastName }}</span>
                    </div>
                  </div>
                }
                @if (client.collaborateurMg) {
                  <div class="hc-info__row">
                    <div class="hc-info__ico-wrap hc-info__ico-wrap--teal">
                      <mat-icon>supervisor_account</mat-icon>
                    </div>
                    <div class="hc-info__text">
                      <span class="hc-info__lbl">Collaborateur</span>
                      <span class="hc-info__val">{{ client.collaborateurMg.firstName }} {{ client.collaborateurMg.lastName }}</span>
                    </div>
                  </div>
                }
                <div class="hc-info__row">
                  <div class="hc-info__ico-wrap hc-info__ico-wrap--grey">
                    <mat-icon>calendar_today</mat-icon>
                  </div>
                  <div class="hc-info__text">
                    <span class="hc-info__lbl">Créé le</span>
                    <span class="hc-info__val">{{ client.createdAt | date:'dd/MM/yyyy' }}</span>
                  </div>
                </div>
                @if (client.ficheIdentite?.siren) {
                  <div class="hc-info__row">
                    <div class="hc-info__ico-wrap hc-info__ico-wrap--grey">
                      <mat-icon>fingerprint</mat-icon>
                    </div>
                    <div class="hc-info__text">
                      <span class="hc-info__lbl">SIREN</span>
                      <span class="hc-info__val">{{ client.ficheIdentite!.siren }}</span>
                    </div>
                  </div>
                }
              </div>

            </div>

            <!-- Content header -->
            <div class="content__header">
              <div class="ch-icon" [style.background]="activeGroupStyle().bg">
                <mat-icon [style.color]="activeGroupStyle().color">{{ activeTabMeta()?.icon }}</mat-icon>
              </div>
              <div class="ch-text">
                <div class="ch-group" [style.color]="activeGroupStyle().color">{{ activeGroup()?.label }}</div>
                <h3>{{ activeTabMeta()?.label }}</h3>
              </div>
            </div>

            <!-- Animated content body -->
            <div class="content__body" [@tabFade]="activeTab()">
              @switch (activeTab()) {
                @case ('fiche')        { <app-fiche-identite-tab [clientId]="client.id" [site]="client.site" [typesFluxActifs]="client.typesFluxActifs" (typesChanged)="onTypesChanged($event)" /> }
                @case ('adn')          { <app-adn-tab [clientId]="client.id" [secteurInitial]="client.secteurActivite" /> }
                @case ('pilotage')     { <app-flux-mensuel-tab   [clientId]="client.id" [typesFluxActifs]="client.typesFluxActifs" /> }
                @case ('fournisseurs') { <app-fournisseurs-tab        [clientId]="client.id" /> }
                @case ('synthese')     { <app-synthese-tab            [clientId]="client.id" [site]="client.site" /> }
                @case ('strategie')    { <app-analyse-strategique-tab [clientId]="client.id" [exerciceId]="exerciceCourant()?.id ?? 0" [readonly]="exerciceCourant()?.statut === 'CLOTURE'" /> }
                @case ('missions')     { <app-missions-tab            [clientId]="client.id" /> }
                @case ('controle')     { <app-controle-interne-tab    [clientId]="client.id" [exerciceId]="exerciceCourant()?.id ?? 0" [readonly]="exerciceCourant()?.statut === 'CLOTURE'" /> }
                @case ('objectifs')       { <app-objectifs-tab           [clientId]="client.id" [exerciceId]="exerciceCourant()?.id ?? 0" [readonly]="exerciceCourant()?.statut === 'CLOTURE'" /> }
                @case ('dossier-travail') { <app-dossier-travail-tab   [clientId]="client.id" [exerciceId]="exerciceCourant()?.id ?? 0" [readonly]="exerciceCourant()?.statut === 'CLOTURE'" /> }
                @case ('documents')    { <app-documents-tab           [clientId]="client.id" /> }
@case ('historique')   { <app-historique-tab          [clientId]="client.id" /> }
              }
            </div>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Host + wrapper ──────────────────────────────── */
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    .detail {
      display: flex; flex-direction: column;
      height: 100vh; overflow: hidden;
    }

    /* ── Top bar ─────────────────────────────────────── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; height: 54px;
      background: #FFFBFE;
      border-bottom: 1px solid #E0E2EC;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      flex-shrink: 0; z-index: 10;
    }
    .topbar__left { display: flex; align-items: center; gap: 4px; }
    .bc-back {
      display: flex; align-items: center; gap: 2px;
      color: #1565C0; text-decoration: none;
      font-size: 13.5px; font-weight: 500;
      padding: 6px 10px 6px 6px; border-radius: 20px;
      transition: background .15s, transform .1s;
    }
    .bc-back:hover { background: #E8F0FE; }
    .bc-back:active { transform: scale(.96); }
    .bc-back mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .bc-sep { color: #C4C7CF; font-size: 18px; width: 18px; height: 18px; }
    .bc-current { font-size: 14px; font-weight: 600; color: #1A1C1E; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .topbar__right { display: flex; align-items: center; gap: 10px; }

    /* Score chip */
    .score-chip {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600;
      padding: 5px 12px 5px 8px; border-radius: 20px;
      transition: transform .15s;
    }
    .score-chip:hover { transform: scale(1.04); }
    .score-chip__icon { font-size: 15px; width: 15px; height: 15px; }
    .score-chip--ok      { background: #D7F5EC; color: #006B57; }
    .score-chip--partial { background: #FFF3CD; color: #B45309; }
    .score-chip--alert   { background: #FFDAD6; color: #BA1A1A; }

    /* PDF button */
    .btn-pdf {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 18px; background: #1565C0; color: white;
      border: none; border-radius: 20px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      box-shadow: 0 2px 8px rgba(21,101,192,.35);
      transition: background .15s, box-shadow .15s, transform .1s;
    }
    .btn-pdf:hover { background: #1976D2; box-shadow: 0 4px 14px rgba(21,101,192,.45); }
    .btn-pdf:active { transform: scale(.97); }
    .btn-pdf mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Layout ──────────────────────────────────────── */
    .layout { display: flex; flex: 1; overflow: hidden; }

    /* ══ SIDEBAR ═════════════════════════════════════════ */
    .sidebar {
      width: 248px; min-width: 248px;
      background: #FFFBFE;
      border-right: 1px solid #E0E2EC;
      display: flex; flex-direction: column;
      overflow-y: auto; flex-shrink: 0;
    }

    /* ── Profile area ────────────────────────────────── */
    .profile {
      position: relative;
      padding: 28px 16px 20px;
      display: flex; flex-direction: column; align-items: center; text-align: center;
      overflow: hidden;
    }
    .profile__bg {
      position: absolute; top: 0; left: 0; right: 0; height: 72px;
      background: linear-gradient(180deg, #E8F0FE 0%, rgba(232,240,254,0) 100%);
    }

    .profile__avatar {
      position: relative; z-index: 1;
      width: 80px; height: 80px; border-radius: 22px;
      background: linear-gradient(135deg, #1565C0 0%, #42A5F5 100%);
      color: white;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; overflow: hidden; flex-shrink: 0;
      margin-bottom: 14px;
      box-shadow: 0 4px 16px rgba(21,101,192,.30), 0 1px 4px rgba(0,0,0,.12);
      transition: transform .2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow .2s;
    }
    .profile__avatar:hover {
      transform: scale(1.06);
      box-shadow: 0 8px 24px rgba(21,101,192,.40), 0 2px 6px rgba(0,0,0,.14);
    }
    .profile__initials { font-size: 24px; font-weight: 800; letter-spacing: -1px; }
    .profile__logo { width: 100%; height: 100%; object-fit: cover; }
    .profile__overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,.38);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .18s;
    }
    .profile__avatar:hover .profile__overlay { opacity: 1; }
    .profile__overlay mat-icon { color: white; font-size: 22px; width: 22px; height: 22px; }

    .profile__name {
      font-size: 14.5px; font-weight: 700; color: #1A1C1E;
      margin: 0 0 8px; line-height: 1.25; width: 100%;
    }
    .profile__site {
      font-size: 11.5px; font-weight: 600;
      padding: 3px 12px; border-radius: 20px; margin-bottom: 18px;
    }
    .profile__site.site--re { background: #E8F0FE; color: #1565C0; }
    .profile__site.site--mg { background: #D7F5EC; color: #006B57; }

    .profile__score-label {
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; color: #89909A; font-weight: 500; margin-bottom: 6px;
    }
    .score-track {
      width: 100%; height: 7px;
      background: #E8EAED; border-radius: 6px; overflow: hidden;
    }
    .score-fill {
      height: 100%; border-radius: 6px;
      transform-origin: left;
      animation: growBar .9s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    @keyframes growBar {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    .score-fill--high   { background: linear-gradient(90deg, #4ade80, #22c55e); }
    .score-fill--medium { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-fill--low    { background: linear-gradient(90deg, #f87171, #dc2626); }

    .score-pct { font-size: 12px; font-weight: 700; }
    .score-pct--ok      { color: #006B57; }
    .score-pct--partial { color: #B45309; }
    .score-pct--alert   { color: #BA1A1A; }

    .sidebar__divider { height: 1px; background: #E0E2EC; margin: 4px 16px 4px; flex-shrink: 0; }

    /* ── Sidenav ─────────────────────────────────────── */
    .sidenav { padding: 6px 8px 24px; flex: 1; }
    .sidenav__group { margin-bottom: 6px; }

    .sidenav__label {
      display: flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 700; color: #89909A;
      text-transform: uppercase; letter-spacing: .9px;
      padding: 10px 12px 5px;
    }
    .sidenav__label-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
      transition: background .3s;
    }

    .sidenav__item {
      width: 100%; display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; position: relative; overflow: hidden;
      background: none; border: none; border-radius: 28px;
      font-size: 13.5px; font-weight: 500; color: #44474F;
      cursor: pointer; text-align: left;
      transition: background .15s, color .15s, transform .1s;
      margin-bottom: 1px;
    }
    .sidenav__item:hover { background: #F0F1F5; color: #1A1C1E; }
    .sidenav__item:active { transform: scale(.98); }
    .sidenav__item.active { font-weight: 600; }
    .sidenav__item mat-icon {
      font-size: 18px; width: 18px; height: 18px;
      color: #89909A; flex-shrink: 0;
      transition: color .15s;
    }
    .sidenav__item.active mat-icon { /* color set via inline style */ }
    .sidenav__item:hover mat-icon { color: #44474F; }

    .sidenav__indicator {
      position: absolute; left: 4px; top: 50%; transform: translateY(-50%);
      width: 3px; height: 18px; border-radius: 2px;
      transition: background .2s, height .2s;
    }
    .sidenav__item.active .sidenav__indicator { height: 22px; }

    /* ══ CONTENT ═════════════════════════════════════════ */
    .content {
      flex: 1; display: flex; flex-direction: column;
      overflow: hidden; min-width: 0; background: #F4F6FB;
    }

    .content__header {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 24px;
      background: #FFFBFE; border-bottom: 1px solid #E0E2EC;
      flex-shrink: 0;
    }
    .ch-icon {
      width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background .25s;
    }
    .ch-icon mat-icon {
      font-size: 22px; width: 22px; height: 22px;
      transition: color .25s;
    }
    .ch-text { display: flex; flex-direction: column; gap: 1px; }
    .ch-group {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .9px;
      transition: color .25s;
    }
    .ch-text h3 { font-size: 15px; font-weight: 700; color: #1A1C1E; margin: 0; }

    .content__body {
      flex: 1; overflow-y: auto;
      padding: 0;
    }
    .content__body > * {
      display: block;
      width: 100%;
    }

    /* ══ HERO SECTION ═══════════════════════════════════ */
    .hero {
      display: flex; gap: 14px;
      padding: 14px 16px;
      flex-shrink: 0;
      background: #F4F6FB;
      border-bottom: 1px solid #E0E2EC;
    }
    .hero-card {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 1px 6px rgba(0,0,0,.08), 0 3px 12px rgba(0,0,0,.04);
      transition: box-shadow .2s, transform .2s;
    }
    .hero-card:hover {
      box-shadow: 0 4px 18px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.06);
      transform: translateY(-2px);
    }

    /* Card 1 — Sector illustration */
    .hc-sector {
      flex: 1.2;
      position: relative;
      display: flex; flex-direction: column;
      min-height: 158px;
    }
    .hc-sector__img {
      position: absolute; top: 0; right: 0;
      height: 100%; width: 60%;
      object-fit: contain;
      padding: 12px 16px 12px 0;
      opacity: .92;
    }
    .hc-sector__body {
      position: relative; z-index: 1;
      padding: 18px 20px; margin-top: auto;
      display: flex; flex-direction: column; gap: 8px;
    }
    .hc-sector__name {
      font-size: 15px; font-weight: 700; color: #1A1C1E;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 180px;
    }
    .hc-sector__pill {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11.5px; font-weight: 600;
      padding: 4px 10px 4px 8px; border-radius: 20px;
      width: fit-content;
    }
    .hc-sector__pill mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Card 2 — ADN ring */
    .hc-adn {
      flex: 1;
      background: #FFFBFE;
      display: flex; align-items: center; justify-content: center; gap: 18px;
      padding: 16px 20px;
    }
    .hc-adn__ring-wrap {
      position: relative; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .hc-adn__pct {
      position: absolute;
      font-size: 15px; font-weight: 800;
      letter-spacing: -.5px;
    }
    .hc-adn__info {
      display: flex; flex-direction: column; gap: 4px;
    }
    .hc-adn__title {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .8px; color: #89909A;
    }
    .hc-adn__status {
      font-size: 16px; font-weight: 700;
    }
    .hc-adn__btn {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 6px; padding: 5px 12px 5px 8px;
      background: #E8F0FE; color: #1565C0;
      border: none; border-radius: 20px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background .15s, transform .1s;
      width: fit-content;
    }
    .hc-adn__btn:hover { background: #D0E4FF; }
    .hc-adn__btn:active { transform: scale(.97); }
    .hc-adn__btn mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* Card 3 — Infos clés */
    .hc-info {
      flex: 1;
      background: #FFFBFE;
      display: flex; flex-direction: column; gap: 10px;
      padding: 16px 18px;
    }
    .hc-info__site {
      font-size: 12.5px; font-weight: 700;
      padding: 4px 12px; border-radius: 20px;
      width: fit-content; margin-bottom: 2px;
    }
    .hc-info__site.site--re { background: #E8F0FE; color: #1565C0; }
    .hc-info__site.site--mg { background: #D7F5EC; color: #006B57; }
    .hc-info__row {
      display: flex; align-items: center; gap: 10px;
    }
    .hc-info__ico-wrap {
      width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .hc-info__ico-wrap mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .hc-info__ico-wrap--blue { background: #E8F0FE; }
    .hc-info__ico-wrap--blue mat-icon { color: #1565C0; }
    .hc-info__ico-wrap--teal { background: #D7F5EC; }
    .hc-info__ico-wrap--teal mat-icon { color: #006B57; }
    .hc-info__ico-wrap--grey { background: #F0F1F5; }
    .hc-info__ico-wrap--grey mat-icon { color: #89909A; }
    .hc-info__text { display: flex; flex-direction: column; }
    .hc-info__lbl { font-size: 10px; font-weight: 600; color: #89909A; text-transform: uppercase; letter-spacing: .6px; }
    .hc-info__val { font-size: 13px; font-weight: 600; color: #1A1C1E; }

    /* ══ SKELETON LOADER ═════════════════════════════════ */
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position: 600px 0; }
    }
    .sk-pulse {
      background: linear-gradient(90deg, #E8EAED 25%, #F4F6FB 50%, #E8EAED 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 6px;
    }
    .skeleton-wrap {
      display: flex; flex-direction: column;
      width: 100%; height: 100vh; overflow: hidden;
      background: #F4F6FB;
    }
    .sk-topbar {
      height: 54px; flex-shrink: 0;
      background: #FFFBFE; border-bottom: 1px solid #E0E2EC;
      display: flex; align-items: center; gap: 10px; padding: 0 20px;
    }
    .sk-layout { display: flex; flex: 1; overflow: hidden; }
    .sk-sidebar {
      width: 248px; min-width: 248px;
      background: #FFFBFE; border-right: 1px solid #E0E2EC;
      padding: 28px 16px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .sk-content {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
    }
    .sk-content-header {
      height: 72px; flex-shrink: 0;
      background: #FFFBFE; border-bottom: 1px solid #E0E2EC;
      display: flex; align-items: center; gap: 14px; padding: 0 24px;
    }
    .sk-body {
      flex: 1; padding: 24px;
      display: flex; flex-direction: column; gap: 20px;
    }
    .sk-block-row { display: flex; gap: 16px; }

    /* Shimmer elements */
    .sk-avatar {
      width: 80px; height: 80px; border-radius: 22px;
      background: linear-gradient(90deg, #E8EAED 25%, #F4F6FB 50%, #E8EAED 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      flex-shrink: 0;
    }
    .sk-icon-box {
      width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0;
      background: linear-gradient(90deg, #E8EAED 25%, #F4F6FB 50%, #E8EAED 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
    }
    .sk-lines { display: flex; flex-direction: column; gap: 6px; }
    .sk-divider { width: 100%; height: 1px; background: #E0E2EC; margin: 4px 0; }
    .sk-spacer { flex: 1; }

    .sk-bar {
      border-radius: 6px;
      background: linear-gradient(90deg, #E8EAED 25%, #F4F6FB 50%, #E8EAED 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
    }
    .sk-bar--back   { width: 80px;  height: 26px; border-radius: 20px; }
    .sk-bar--title  { width: 140px; height: 14px; }
    .sk-bar--chip   { width: 110px; height: 28px; border-radius: 20px; }
    .sk-bar--btn    { width: 130px; height: 34px; border-radius: 20px; }
    .sk-bar--name   { width: 120px; height: 13px; }
    .sk-bar--tag    { width: 80px;  height: 22px; border-radius: 20px; }
    .sk-bar--score  { width: 100%;  height: 7px;  border-radius: 6px; }
    .sk-bar--group  { width: 70px;  height: 9px; }
    .sk-bar--section{ width: 140px; height: 14px; }

    .sk-nav-item {
      width: 100%; height: 34px; border-radius: 28px;
      background: linear-gradient(90deg, #E8EAED 25%, #F4F6FB 50%, #E8EAED 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
    }
    .sk-nav-item--label {
      height: 10px; width: 60%; border-radius: 4px;
      margin-top: 4px;
    }

    .sk-block {
      border-radius: 14px;
      background: linear-gradient(90deg, #E8EAED 25%, #F4F6FB 50%, #E8EAED 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
    }
    .sk-block--lg { height: 120px; }
    .sk-block--md { height: 80px; }
    .sk-block--sm { flex: 1; height: 80px; }

    /* ══ BANNIÈRE EXERCICE ═════════════════════════════════ */
    .exercice-banner {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 20px;
      background: linear-gradient(90deg, #E8F5E9 0%, #F1F8E9 100%);
      border-bottom: 1px solid #A5D6A7;
      flex-shrink: 0;
    }
    .exercice-banner--cloture {
      background: linear-gradient(90deg, #F5F5F5 0%, #FAFAFA 100%);
      border-bottom-color: #E0E2EC;
    }
    .eb-left { display: flex; align-items: center; gap: 12px; }
    .eb-icon { color: #2E7D32; font-size: 20px; width: 20px; height: 20px; }
    .exercice-banner--cloture .eb-icon { color: #89909A; }
    .eb-info { display: flex; flex-direction: column; line-height: 1.3; }
    .eb-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #2E7D32; }
    .exercice-banner--cloture .eb-label { color: #89909A; }
    .eb-period { font-size: 14px; font-weight: 700; color: #1A1C1E; }
    .eb-dates { font-size: 12px; font-weight: 400; color: #74777F; }
    .eb-statut {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px 3px 6px; border-radius: 20px;
      background: #C8E6C9; color: #1B5E20;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .eb-statut--cloture { background: #E0E2EC; color: #44474F; }
    .eb-right { display: flex; align-items: center; gap: 10px; }
    .eb-select {
      border: 1px solid #C4C7CF; border-radius: 8px; padding: 6px 10px;
      font-size: 12px; background: #fff; cursor: pointer; outline: none;
      &:focus { border-color: #2E7D32; }
    }
    .eb-btn-cloture {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 14px; background: #fff; color: #B71C1C;
      border: 1px solid #EF9A9A; border-radius: 20px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background .15s, border-color .15s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #FFEBEE; border-color: #F44336; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
  `],
})
export class ClientDetailComponent implements OnInit {
  @ViewChild('logoInput') logoInput!: ElementRef<HTMLInputElement>;

  client: Client | null = null;
  loading = signal(true);
  activeTab = signal<TabId>('fiche');

  exercices       = signal<Exercice[]>([]);
  exerciceCourant = signal<Exercice | null>(null);
  cloturant       = signal(false);


  readonly TAB_GROUPS: TabGroup[] = [
    {
      label: 'Dossier',
      icon: 'folder',
      tabs: [
        { id: 'fiche', icon: 'badge', label: 'Fiche Identité' },
        { id: 'adn', icon: 'fingerprint', label: 'ADN Entreprise' },
      ],
    },
    {
      label: 'Comptabilité',
      icon: 'calculate',
      tabs: [
        { id: 'pilotage',     icon: 'bar_chart',       label: 'Pilotage' },
        { id: 'fournisseurs', icon: 'local_shipping',  label: 'Fournisseurs' },
        { id: 'synthese',     icon: 'analytics',       label: 'Synthèse' },
      ],
    },
    {
      label: 'Analyse',
      icon: 'query_stats',
      tabs: [
        { id: 'strategie',        icon: 'grid_view',    label: 'Stratégie' },
        { id: 'missions',         icon: 'assignment',   label: 'Missions' },
        { id: 'controle',         icon: 'shield',       label: 'Contrôle Interne' },
        { id: 'objectifs',        icon: 'flag',         label: 'Objectifs' },
        { id: 'dossier-travail',  icon: 'work_history', label: 'Dossier de travail' },
      ],
    },
    {
      label: 'Ressources',
      icon: 'inventory_2',
      tabs: [
        { id: 'documents',  icon: 'attach_file', label: 'Documents' },
        { id: 'historique', icon: 'history',     label: 'Historique' },
      ],
    },
  ];

  constructor(
    private route: ActivatedRoute,
    private clientsService: ClientsService,
    private exerciceService: ExerciceService,
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const start = Date.now();
    this.clientsService.getOne(id).subscribe(c => {
      this.client = c;
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 800 - elapsed);
      setTimeout(() => this.loading.set(false), remaining);
    });
    this.exerciceService.list(id).subscribe(list => {
      this.exercices.set(list);
      const courant = list.find(e => e.statut === 'OUVERT') ?? list[0] ?? null;
      this.exerciceCourant.set(courant);
    });
  }

  onTypesChanged(types: any[]) {
    if (this.client) this.client = { ...this.client, typesFluxActifs: types };
  }

  onExerciceChange(idStr: string) {
    const id = Number(idStr);
    const ex = this.exercices().find(e => e.id === id) ?? null;
    this.exerciceCourant.set(ex);
  }

  cloturerExercice() {
    const ex = this.exerciceCourant();
    if (!ex || !this.client) return;
    if (!confirm(`Clôturer l'exercice ${ex.annee} ? Un nouvel exercice sera créé automatiquement.`)) return;
    this.cloturant.set(true);
    this.exerciceService.cloturer(this.client.id, ex.id).subscribe({
      next: ({ closed, next }) => {
        this.exercices.update(list =>
          [...list.map(e => e.id === closed.id ? closed : e), next],
        );
        this.exerciceCourant.set(next);
        this.cloturant.set(false);
      },
      error: () => this.cloturant.set(false),
    });
  }


  activeTabMeta() {
    for (const g of this.TAB_GROUPS) {
      const t = g.tabs.find(t => t.id === this.activeTab());
      if (t) return t;
    }
    return null;
  }

  exportPdf() {
    if (!this.client) return;
    this.clientsService.exportPdf(this.client.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note-passation-${this.client!.nom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  triggerLogoUpload() {
    this.logoInput?.nativeElement.click();
  }

  onLogoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.client) return;
    this.clientsService.uploadLogo(this.client.id, file).subscribe(updated => {
      this.client = { ...this.client!, logoUrl: updated.logoUrl };
    });
  }

  private readonly GROUP_STYLE_MAP: Record<string, { color: string; bg: string }> = {
    'Dossier':      { color: '#1565C0', bg: '#E8F0FE' },
    'Comptabilité': { color: '#5E35B1', bg: '#EDE7F6' },
    'Analyse':      { color: '#6A1B9A', bg: '#F3E5F5' },
    'Ressources':   { color: '#00695C', bg: '#E0F2F1' },
    'Intelligence': { color: '#E65100', bg: '#FBE9E7' },
  };

  groupStyle(label: string) { return this.GROUP_STYLE_MAP[label] ?? { color: '#1565C0', bg: '#E8F0FE' }; }

  activeGroup() {
    return this.TAB_GROUPS.find(g => g.tabs.some(t => t.id === this.activeTab())) ?? null;
  }

  activeGroupStyle() {
    const g = this.activeGroup();
    return g ? this.groupStyle(g.label) : { color: '#1565C0', bg: '#E8F0FE' };
  }

  getInitials(nom: string) { return nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  getScoreStatus(s: number) { return s >= 80 ? 'Transmissible' : s >= 50 ? 'Partiel' : 'Alerte'; }
  getScoreBarClass(s: number) { return s >= 80 ? 'high' : s >= 50 ? 'medium' : 'low'; }
  getScoreChipClass(s: number) { return s >= 80 ? 'ok' : s >= 50 ? 'partial' : 'alert'; }
  getScorePctClass(s: number) { return s >= 80 ? 'ok' : s >= 50 ? 'partial' : 'alert'; }

  ringColor(s: number): string { return s >= 80 ? '#4CAF50' : s >= 50 ? '#FF9800' : '#F44336'; }

  getSectorConfig(secteur?: string): { bg: string; accent: string; icon: string; label: string; imgSrc: string } {
    const m: Record<string, { bg: string; accent: string; icon: string; label: string; imgSrc: string }> = {
      RESTAURATION:        { bg: 'linear-gradient(135deg,#FFF3E0 0%,#FFCC80 100%)', accent: '#E65100', icon: 'restaurant',        label: 'Restauration',   imgSrc: 'sectors/restauration.svg' },
      BTP:                 { bg: 'linear-gradient(135deg,#FFFDE7 0%,#FFE082 100%)', accent: '#F57F17', icon: 'construction',       label: 'BTP',            imgSrc: 'sectors/btp.svg' },
      ASSOCIATION:         { bg: 'linear-gradient(135deg,#E8F5E9 0%,#A5D6A7 100%)', accent: '#2E7D32', icon: 'volunteer_activism', label: 'Association',    imgSrc: 'sectors/association.svg' },
      HOLDING:             { bg: 'linear-gradient(135deg,#E3F2FD 0%,#90CAF9 100%)', accent: '#1565C0', icon: 'account_balance',    label: 'Holding',        imgSrc: 'sectors/holding.svg' },
      PROFESSION_LIBERALE: { bg: 'linear-gradient(135deg,#F3E5F5 0%,#CE93D8 100%)', accent: '#6A1B9A', icon: 'work',              label: 'Prof. Libérale', imgSrc: 'sectors/profession_liberale.svg' },
      SCI:                 { bg: 'linear-gradient(135deg,#FBE9E7 0%,#FFAB91 100%)', accent: '#BF360C', icon: 'home_work',          label: 'SCI',            imgSrc: 'sectors/sci.svg' },
    };
    return m[secteur!] ?? { bg: 'linear-gradient(135deg,#ECEFF1 0%,#CFD8DC 100%)', accent: '#455A64', icon: 'folder', label: 'Autre', imgSrc: 'sectors/default.svg' };
  }
}
