import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.model';
import { FicheIdentiteTabComponent } from './tabs/fiche-identite-tab/fiche-identite-tab.component';
import { FluxMensuelTabComponent } from './tabs/flux-mensuel-tab/flux-mensuel-tab.component';
import { FournisseursTabComponent } from './tabs/fournisseurs-tab/fournisseurs-tab.component';
import { SyntheseTabComponent } from './tabs/synthese-tab/synthese-tab.component';
import { DocumentsTabComponent } from './tabs/documents-tab/documents-tab.component';
import { AnalyseStrategiqueTabComponent } from './tabs/analyse-strategique-tab/analyse-strategique-tab.component';
import { MissionsTabComponent } from './tabs/missions-tab/missions-tab.component';
import { ObjectifsTabComponent } from './tabs/objectifs-tab/objectifs-tab.component';
import { ControleInterneTabComponent } from './tabs/controle-interne-tab/controle-interne-tab.component';
import { AiAssistantTabComponent } from './tabs/ai-assistant-tab/ai-assistant-tab.component';
import { TachesTabComponent } from './tabs/taches-tab/taches-tab.component';
import { HistoriqueTabComponent } from './tabs/historique-tab/historique-tab.component';
import { AdnTabComponent } from './tabs/adn-tab/adn-tab.component';

type TabId =
  | 'fiche' | 'adn' | 'pilotage' | 'fournisseurs' | 'synthese'
  | 'strategie' | 'missions' | 'controle' | 'objectifs'
  | 'documents' | 'taches' | 'ia' | 'historique';

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
    AiAssistantTabComponent, TachesTabComponent, HistoriqueTabComponent,
    AdnTabComponent,
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
                @case ('strategie')    { <app-analyse-strategique-tab [clientId]="client.id" /> }
                @case ('missions')     { <app-missions-tab            [clientId]="client.id" /> }
                @case ('controle')     { <app-controle-interne-tab    [clientId]="client.id" /> }
                @case ('objectifs')    { <app-objectifs-tab           [clientId]="client.id" /> }
                @case ('documents')    { <app-documents-tab           [clientId]="client.id" /> }
                @case ('taches')       { <app-taches-tab              [clientId]="client.id" /> }
                @case ('ia')           { <app-ai-assistant-tab        [clientId]="client.id" /> }
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
      height: 100%; overflow: hidden;
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
  `],
})
export class ClientDetailComponent implements OnInit {
  @ViewChild('logoInput') logoInput!: ElementRef<HTMLInputElement>;

  client: Client | null = null;
  loading = signal(true);
  activeTab = signal<TabId>('fiche');

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
        { id: 'strategie', icon: 'grid_view',   label: 'Stratégie' },
        { id: 'missions',  icon: 'assignment',  label: 'Missions' },
        { id: 'controle',  icon: 'shield',      label: 'Contrôle Interne' },
        { id: 'objectifs', icon: 'flag',        label: 'Objectifs' },
      ],
    },
    {
      label: 'Ressources',
      icon: 'inventory_2',
      tabs: [
        { id: 'documents',  icon: 'attach_file', label: 'Documents' },
        { id: 'taches',     icon: 'task_alt',    label: 'Tâches' },
        { id: 'historique', icon: 'history',     label: 'Historique' },
      ],
    },
    {
      label: 'Intelligence',
      icon: 'auto_awesome',
      tabs: [
        { id: 'ia', icon: 'smart_toy', label: 'Assistant IA' },
      ],
    },
  ];

  constructor(private route: ActivatedRoute, private clientsService: ClientsService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const start = Date.now();
    this.clientsService.getOne(id).subscribe(c => {
      this.client = c;
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 800 - elapsed);
      setTimeout(() => this.loading.set(false), remaining);
    });
  }

  onTypesChanged(types: any[]) {
    if (this.client) this.client = { ...this.client, typesFluxActifs: types };
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
}
