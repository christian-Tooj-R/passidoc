import {
  Component, inject, signal, computed,
  ViewChild, ElementRef, AfterViewChecked, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HelpService, HelpMessage } from '../../core/services/help.service';

interface Module {
  icon: string;
  color: string;
  bg: string;
  title: string;
  route?: string;
  desc: string;
  tags: string[];
  tips: string[];
}

const MODULES: Module[] = [
  {
    icon: 'dashboard', color: '#0D9488', bg: '#F0FDFA',
    title: 'Tableau de bord', route: '/dashboard',
    desc: 'Vue d\'ensemble de l\'activité du cabinet : santé des dossiers, tâches prioritaires, alertes flux.',
    tags: ['aperçu', 'dashboard', 'accueil'],
    tips: ['Vérifiez les alertes flux mensuels chaque lundi matin.', 'Le score de santé global reflète l\'état de tous vos dossiers.'],
  },
  {
    icon: 'folder_open', color: '#1A73E8', bg: '#EFF6FF',
    title: 'Dossiers clients', route: '/clients',
    desc: 'Accédez à tous vos dossiers clients. Filtrez par secteur, site ou recherchez par nom.',
    tags: ['dossiers', 'clients', 'portefeuille'],
    tips: ['Cliquez sur une card pour ouvrir le dossier complet.', 'Le filtre secteur permet de comparer des dossiers similaires.'],
  },
  {
    icon: 'badge', color: '#059669', bg: '#ECFDF5',
    title: 'Fiche Identité', desc: 'Informations légales du client : SIREN, gérants, salariés, capital, adresse, honoraires.',
    tags: ['identité', 'siren', 'gérant', 'salarié'],
    tips: ['Renseignez le % de parts de chaque gérant pour l\'analyse de gouvernance.', 'Les salariés sont distincts des gérants.'],
  },
  {
    icon: 'psychology', color: '#7C3AED', bg: '#FAF5FF',
    title: 'ADN Entreprise', desc: 'Portrait complet du client : mission, vision, valeurs, enjeux RH, canaux d\'acquisition, concurrents, projets.',
    tags: ['adn', 'mission', 'vision', 'valeurs', 'portrait'],
    tips: ['La section "Caillou dans la chaussure" révèle souvent les vraies priorités du dirigeant.', 'Le niveau numérique guide les missions de transformation digitale.'],
  },
  {
    icon: 'analytics', color: '#D97706', bg: '#FFFBEB',
    title: 'Analyse Stratégique', desc: 'SWOT complet (Forces / Faiblesses / Opportunités / Menaces) et Business Model Canvas.',
    tags: ['swot', 'stratégie', 'forces', 'faiblesses', 'bmc'],
    tips: ['Utilisez le SWOT lors des réunions annuelles de bilan.', 'Le BMC se complète en lien avec les missions détectées.'],
  },
  {
    icon: 'trending_up', color: '#0891B2', bg: '#ECFEFF',
    title: 'Synthèses de Clôture', desc: 'Performances financières annuelles : CA, EBE, résultat net, commentaires et points IS/EBE.',
    tags: ['synthèse', 'clôture', 'ca', 'ebe', 'résultat', 'financier'],
    tips: ['Comparez toujours le CA N-1 pour montrer la progression au client.', 'Les commentaires financiers sont exportables en rapport.'],
  },
  {
    icon: 'receipt_long', color: '#DC2626', bg: '#FFF1F2',
    title: 'Flux Mensuels', desc: 'Suivi de la transmission des documents comptables mois par mois. Alertes pour les retards.',
    tags: ['flux', 'documents', 'mensuel', 'retard', 'manquant'],
    tips: ['Un flux MANQUANT depuis plus de 30 jours dégrade le score de santé.', 'Ajoutez un commentaire pour indiquer la raison d\'un retard.'],
  },
  {
    icon: 'task_alt', color: '#16A34A', bg: '#F0FDF4',
    title: 'Missions', desc: 'Missions du cabinet : réalisées, refusées, détectées ou suggérées par l\'IA.',
    tags: ['missions', 'honoraires', 'refus', 'détectée'],
    tips: ['Les missions DÉTECTÉES sont des opportunités à proposer au client.', 'L\'IA peut suggérer automatiquement des missions (type IA).'],
  },
  {
    icon: 'flag', color: '#9333EA', bg: '#FAF5FF',
    title: 'Objectifs Client', desc: 'Objectifs à 12 mois, 3-5 ans, long terme. Attentes envers le cabinet et qualité de la relation.',
    tags: ['objectifs', 'court terme', 'moyen terme', 'long terme'],
    tips: ['Mettez à jour les objectifs à chaque réunion annuelle.', 'La qualité de la relation influence la priorité de suivi.'],
  },
  {
    icon: 'security', color: '#0F766E', bg: '#F0FDFA',
    title: 'Contrôle Interne', desc: 'Process fonctionnels et défaillants, outils de pilotage utilisés, note générale.',
    tags: ['contrôle', 'pilotage', 'process', 'outils'],
    tips: ['Les outils de pilotage (Revo, Excel, ERP) renseignent le niveau de maturité du client.', 'Un process défaillant non corrigé est un risque à signaler.'],
  },
  {
    icon: 'local_shipping', color: '#B45309', bg: '#FFFBEB',
    title: 'Fournisseurs', desc: 'Liste des fournisseurs principaux avec contacts, catégorie et IBAN.',
    tags: ['fournisseurs', 'contacts', 'achats'],
    tips: ['Identifiez les fournisseurs stratégiques pour évaluer les risques d\'approvisionnement.'],
  },
  {
    icon: 'folder_copy', color: '#475569', bg: '#F8FAFC',
    title: 'Dossier de Travail', desc: 'Cycles de révision comptable : achats, ventes, trésorerie, social, fiscal. Assertions et conclusions.',
    tags: ['dossier travail', 'révision', 'cycles', 'audit'],
    tips: ['Complétez les cycles dans l\'ordre : achats → ventes → trésorerie.', 'La note de synthèse est générée depuis les conclusions des cycles.'],
  },
  {
    icon: 'checklist', color: '#0284C7', bg: '#EFF6FF',
    title: 'Tâches', route: '/tasks',
    desc: 'Gestion des tâches : TVA, paie, achats, ventes. Priorités, suivi du temps, grille hebdo/mensuelle.',
    tags: ['tâches', 'tva', 'paie', 'planning', 'temps'],
    tips: ['Le chronomètre intégré mesure le temps réel passé sur chaque tâche.', 'Groupez les tâches par semaine pour optimiser l\'organisation.'],
  },
  {
    icon: 'groups', color: '#7C3AED', bg: '#FAF5FF',
    title: 'Équipes', route: '/equipes',
    desc: 'Organigramme, attribution des dossiers, gestion des permissions par rôle.',
    tags: ['équipe', 'rôles', 'permissions', 'organigramme'],
    tips: ['Assignez un responsable Réunion et un collaborateur Madagascar à chaque dossier.'],
  },
  {
    icon: 'schedule', color: '#0F766E', bg: '#F0FDFA',
    title: 'Pointage', route: '/pointage',
    desc: 'Suivi des présences : pointage quotidien, récapitulatifs hebdomadaires, configuration des règles.',
    tags: ['pointage', 'présences', 'temps'],
    tips: ['Le pointage se fait en début et fin de journée depuis l\'onglet Présences.'],
  },
  {
    icon: 'manage_accounts', color: '#BE185D', bg: '#FFF1F2',
    title: 'Ressources Humaines', route: '/rh',
    desc: 'Fiches salariés, bulletins de paie, congés et absences, soldes.',
    tags: ['rh', 'salariés', 'congés', 'paie'],
    tips: ['Approuvez les demandes de congés depuis l\'onglet Congés & Absences.', 'Chaque salarié a une fiche complète avec contrat et informations bancaires.'],
  },
  {
    icon: 'smart_toy', color: '#4338CA', bg: '#EEF2FF',
    title: 'Assistant IA Dossier', desc: 'IA dédiée à chaque dossier. Connaît toutes les données du client pour répondre à vos questions.',
    tags: ['ia', 'assistant', 'intelligence artificielle', 'résumé'],
    tips: ['Demandez "Résume-moi ce dossier" pour une prise en charge rapide.', 'L\'IA connaît la fiche identité, le SWOT, les objectifs et le contrôle interne.'],
  },
];

const SUGGESTIONS = [
  { icon: 'folder_open',  text: 'Comment créer un nouveau dossier ?' },
  { icon: 'psychology',   text: 'À quoi sert l\'ADN entreprise ?' },
  { icon: 'analytics',    text: 'Comment faire une analyse SWOT ?' },
  { icon: 'receipt_long', text: 'Comment suivre les flux mensuels ?' },
  { icon: 'smart_toy',    text: 'Que peut faire l\'assistant IA ?' },
  { icon: 'security',     text: 'Qu\'est-ce que le contrôle interne ?' },
];

@Component({
  selector: 'app-help-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatTooltipModule],
  template: `
@if (helpSvc.isOpen()) {
  <!-- Backdrop -->
  <div class="help-backdrop" (click)="helpSvc.close()"></div>

  <!-- Panel -->
  <div class="help-panel">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="hp-header">
      <div class="hp-header__brand">
        <div class="hp-logo">
          <mat-icon>help_outline</mat-icon>
        </div>
        <div>
          <div class="hp-title">Centre d'aide</div>
          <div class="hp-subtitle">Passidoc · AFYM Audit Expertise</div>
        </div>
      </div>
      <button class="hp-close" (click)="helpSvc.close()" matTooltip="Fermer (Échap)">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <!-- ── Tabs ───────────────────────────────────────────────── -->
    <div class="hp-tabs">
      <button class="hp-tab" [class.hp-tab--active]="activeTab() === 'guide'" (click)="activeTab.set('guide')">
        <mat-icon>menu_book</mat-icon> Guide
      </button>
      <button class="hp-tab" [class.hp-tab--active]="activeTab() === 'ia'" (click)="activeTab.set('ia'); focusInput()">
        <mat-icon>smart_toy</mat-icon> Assistant IA
      </button>
    </div>

    <!-- ══════════════════ ONGLET GUIDE ══════════════════════════ -->
    @if (activeTab() === 'guide') {
      <div class="hp-body">

        <!-- Search -->
        <div class="hp-search">
          <mat-icon class="hp-search__icon">search</mat-icon>
          <input class="hp-search__input"
                 [(ngModel)]="searchQuery"
                 placeholder="Rechercher une fonctionnalité…"
                 #searchInput />
          @if (searchQuery) {
            <button class="hp-search__clear" (click)="searchQuery = ''">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>

        <!-- Résultats filtrés -->
        @if (searchQuery && filteredModules().length === 0) {
          <div class="hp-empty">
            <mat-icon>search_off</mat-icon>
            <p>Aucun résultat pour "{{ searchQuery }}"</p>
          </div>
        }

        <!-- Module cards -->
        <div class="hp-modules">
          @for (m of filteredModules(); track m.title) {
            <div class="hp-card" [class.hp-card--expanded]="expandedCard === m.title">
              <div class="hp-card__head" (click)="toggleCard(m.title)">
                <div class="hp-card__icon" [style.background]="m.bg" [style.color]="m.color">
                  <mat-icon>{{ m.icon }}</mat-icon>
                </div>
                <div class="hp-card__info">
                  <div class="hp-card__title">{{ m.title }}</div>
                  <div class="hp-card__desc">{{ m.desc }}</div>
                </div>
                <mat-icon class="hp-card__chevron">
                  {{ expandedCard === m.title ? 'expand_less' : 'expand_more' }}
                </mat-icon>
              </div>
              @if (expandedCard === m.title) {
                <div class="hp-card__tips">
                  <div class="hp-tips-label">
                    <mat-icon>lightbulb</mat-icon> Conseils pratiques
                  </div>
                  @for (tip of m.tips; track tip) {
                    <div class="hp-tip">
                      <mat-icon>arrow_right</mat-icon>
                      <span>{{ tip }}</span>
                    </div>
                  }
                  @if (m.route) {
                    <a [routerLink]="m.route" class="hp-card__link" (click)="helpSvc.close()">
                      <mat-icon>open_in_new</mat-icon> Ouvrir {{ m.title }}
                    </a>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Raccourcis clavier -->
        <div class="hp-shortcuts">
          <div class="hp-shortcuts__title">Raccourcis clavier</div>
          <div class="hp-shortcuts__list">
            <div class="hp-shortcut"><kbd>?</kbd><span>Ouvrir l'aide</span></div>
            <div class="hp-shortcut"><kbd>Échap</kbd><span>Fermer le panneau</span></div>
            <div class="hp-shortcut"><kbd>Entrée</kbd><span>Envoyer un message IA</span></div>
          </div>
        </div>

      </div>
    }

    <!-- ══════════════════ ONGLET IA ══════════════════════════════ -->
    @if (activeTab() === 'ia') {
      <div class="hp-body hp-body--ia">

        <!-- Messages -->
        <div class="hp-messages" #messagesContainer>
          @if (messages().length === 0 && !loading()) {
            <div class="hp-ia-welcome">
              <div class="hp-ia-avatar">
                <mat-icon>smart_toy</mat-icon>
              </div>
              <div class="hp-ia-welcome__text">
                <strong>Assistant d'aide Passidoc</strong>
                <p>Posez-moi une question sur n'importe quelle fonctionnalité de l'application.</p>
              </div>
            </div>
            <div class="hp-suggestions">
              @for (s of suggestions; track s.text) {
                <button class="hp-sugg" (click)="sendSuggestion(s.text)">
                  <mat-icon>{{ s.icon }}</mat-icon>
                  <span>{{ s.text }}</span>
                </button>
              }
            </div>
          }

          @for (msg of messages(); track $index) {
            <div class="hp-msg" [class.hp-msg--user]="msg.role === 'user'" [class.hp-msg--ai]="msg.role === 'assistant'">
              @if (msg.role === 'assistant') {
                <div class="hp-msg__avatar hp-msg__avatar--ai">
                  <mat-icon>smart_toy</mat-icon>
                </div>
              }
              <div class="hp-msg__bubble">
                <div class="hp-msg__content" [innerHTML]="formatMd(msg.content)"></div>
              </div>
              @if (msg.role === 'user') {
                <div class="hp-msg__avatar hp-msg__avatar--user">
                  <mat-icon>person</mat-icon>
                </div>
              }
            </div>
          }

          @if (loading()) {
            <div class="hp-msg hp-msg--ai">
              <div class="hp-msg__avatar hp-msg__avatar--ai"><mat-icon>smart_toy</mat-icon></div>
              <div class="hp-msg__bubble">
                <div class="hp-typing"><span></span><span></span><span></span></div>
              </div>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="hp-input-area">
          @if (messages().length > 0) {
            <button class="hp-clear" (click)="clearChat()" matTooltip="Nouvelle conversation">
              <mat-icon>delete_sweep</mat-icon>
            </button>
          }
          <div class="hp-input" [class.hp-input--focused]="inputFocused">
            <textarea class="hp-textarea"
                      [(ngModel)]="inputText"
                      placeholder="Votre question sur Passidoc…"
                      rows="1"
                      (keydown.enter)="onEnter($event)"
                      (focus)="inputFocused = true"
                      (blur)="inputFocused = false"
                      [disabled]="loading()"
                      #inputEl>
            </textarea>
            <button class="hp-send"
                    [disabled]="!inputText.trim() || loading()"
                    (click)="send()">
              <mat-icon>{{ loading() ? 'hourglass_empty' : 'send' }}</mat-icon>
            </button>
          </div>
          <p class="hp-hint"><kbd>Entrée</kbd> pour envoyer · <kbd>Shift+Entrée</kbd> saut de ligne</p>
        </div>

      </div>
    }

  </div>
}
  `,
  styles: [`
    /* ── Backdrop ─────────────────────────────────────────────── */
    .help-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      z-index: 1099; backdrop-filter: blur(2px);
      animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    /* ── Panel ────────────────────────────────────────────────── */
    .help-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 440px; max-width: 100vw;
      background: #fff; z-index: 1100;
      display: flex; flex-direction: column;
      box-shadow: -8px 0 40px rgba(0,0,0,.18);
      animation: slideIn .25s cubic-bezier(.22,1,.36,1);
    }
    @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

    /* ── Header ───────────────────────────────────────────────── */
    .hp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px 16px;
      background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
      flex-shrink: 0;
    }
    .hp-header__brand { display: flex; align-items: center; gap: 12px; }
    .hp-logo {
      width: 40px; height: 40px; border-radius: 12px;
      background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center;
      mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    }
    .hp-title   { font-size: 16px; font-weight: 700; color: #fff; }
    .hp-subtitle { font-size: 11px; color: rgba(255,255,255,.65); margin-top: 1px; }
    .hp-close {
      width: 34px; height: 34px; border-radius: 8px; border: none;
      background: rgba(255,255,255,.12); color: rgba(255,255,255,.8);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background .15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: rgba(255,255,255,.22); }
    }

    /* ── Tabs ─────────────────────────────────────────────────── */
    .hp-tabs {
      display: flex; gap: 0; border-bottom: 1px solid #E2E8F0;
      background: #F8FAFC; flex-shrink: 0; padding: 0 8px;
    }
    .hp-tab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 11px 16px; border: none; background: transparent;
      font-size: 13px; font-weight: 600; color: #94A3B8;
      cursor: pointer; border-bottom: 2px solid transparent;
      margin-bottom: -1px; transition: all .15s; font-family: inherit;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
      &:hover { color: #475569; }
    }
    .hp-tab--active { color: #1D4ED8; border-bottom-color: #1D4ED8; }
    .hp-tab__badge {
      font-size: 9px; font-weight: 700; background: #DDD6FE; color: #6D28D9;
      padding: 2px 5px; border-radius: 4px; letter-spacing: .04em;
    }

    /* ── Body ─────────────────────────────────────────────────── */
    .hp-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
    .hp-body--ia { overflow: hidden; }

    /* ── Search ───────────────────────────────────────────────── */
    .hp-search {
      display: flex; align-items: center; gap: 8px;
      margin: 16px 16px 8px; padding: 9px 12px;
      background: #F1F5F9; border-radius: 10px; border: 1.5px solid transparent;
      transition: border-color .15s;
      &:focus-within { border-color: #3B82F6; background: #fff; }
    }
    .hp-search__icon { font-size: 18px !important; width: 18px !important; height: 18px !important; color: #94A3B8; flex-shrink: 0; }
    .hp-search__input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: 13px; color: #1E293B; font-family: inherit;
      &::placeholder { color: #94A3B8; }
    }
    .hp-search__clear {
      border: none; background: transparent; cursor: pointer; padding: 0; color: #94A3B8;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
      &:hover { color: #475569; }
    }
    .hp-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 40px 20px; color: #94A3B8; text-align: center;
      mat-icon { font-size: 40px !important; width: 40px !important; height: 40px !important; opacity: .5; }
      p { font-size: 13px; margin: 0; }
    }

    /* ── Module cards ─────────────────────────────────────────── */
    .hp-modules { display: flex; flex-direction: column; gap: 6px; padding: 4px 16px 8px; }
    .hp-card {
      border: 1px solid #E2E8F0; border-radius: 12px;
      overflow: hidden; transition: box-shadow .15s;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.07); }
    }
    .hp-card--expanded { border-color: #BFDBFE; box-shadow: 0 2px 12px rgba(29,78,216,.08); }
    .hp-card__head {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 14px; cursor: pointer;
    }
    .hp-card__icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 19px !important; width: 19px !important; height: 19px !important; }
    }
    .hp-card__info { flex: 1; min-width: 0; }
    .hp-card__title { font-size: 13px; font-weight: 700; color: #1E293B; }
    .hp-card__desc  { font-size: 12px; color: #64748B; margin-top: 2px; line-height: 1.4; }
    .hp-card__chevron {
      font-size: 18px !important; width: 18px !important; height: 18px !important;
      color: #CBD5E1; flex-shrink: 0; margin-top: 10px;
    }
    .hp-card__tips {
      padding: 0 14px 14px 64px; border-top: 1px solid #F1F5F9;
      background: #FAFCFF;
    }
    .hp-tips-label {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 700; color: #F59E0B;
      text-transform: uppercase; letter-spacing: .06em;
      padding: 10px 0 6px;
      mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    }
    .hp-tip {
      display: flex; align-items: flex-start; gap: 4px;
      font-size: 12px; color: #475569; margin-bottom: 5px; line-height: 1.5;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #93C5FD; flex-shrink: 0; margin-top: 1px; }
    }
    .hp-card__link {
      display: inline-flex; align-items: center; gap: 5px;
      margin-top: 10px; padding: 5px 12px; border-radius: 7px;
      background: #EFF6FF; color: #1D4ED8; font-size: 12px; font-weight: 600;
      text-decoration: none; transition: background .15s;
      mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
      &:hover { background: #DBEAFE; }
    }

    /* ── Shortcuts ────────────────────────────────────────────── */
    .hp-shortcuts {
      margin: 8px 16px 20px; padding: 14px 16px;
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;
    }
    .hp-shortcuts__title { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; }
    .hp-shortcuts__list { display: flex; flex-direction: column; gap: 6px; }
    .hp-shortcut { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #475569; }
    kbd {
      display: inline-block; padding: 2px 7px; border-radius: 5px;
      border: 1px solid #CBD5E1; background: #fff;
      font-size: 11px; font-family: inherit; color: #334155;
      box-shadow: 0 1px 2px rgba(0,0,0,.06);
    }

    /* ── IA Messages ──────────────────────────────────────────── */
    .hp-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .hp-ia-welcome {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 16px; background: linear-gradient(135deg, #EFF6FF, #EDE9FE);
      border-radius: 14px; border: 1px solid #C7D2FE;
    }
    .hp-ia-avatar {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #1e40af, #4338ca);
      display: flex; align-items: center; justify-content: center;
      mat-icon { color: #fff; font-size: 18px !important; width: 18px !important; height: 18px !important; }
    }
    .hp-ia-welcome__text {
      flex: 1;
      strong { font-size: 13px; color: #1E293B; display: block; margin-bottom: 4px; }
      p { font-size: 12px; color: #64748B; margin: 0; line-height: 1.5; }
    }
    .hp-suggestions { display: flex; flex-direction: column; gap: 6px; }
    .hp-sugg {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; border: 1px solid #E2E8F0; border-radius: 10px;
      background: #fff; color: #475569; font-size: 12px; cursor: pointer;
      font-family: inherit; text-align: left; transition: all .15s;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #94A3B8; }
      &:hover { border-color: #3B82F6; color: #1D4ED8; background: #EFF6FF;
        mat-icon { color: #3B82F6; } }
    }
    .hp-msg { display: flex; align-items: flex-start; gap: 8px; }
    .hp-msg--user { flex-direction: row-reverse; }
    .hp-msg__avatar {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; }
    }
    .hp-msg__avatar--ai { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); mat-icon { color: #4338CA; } }
    .hp-msg__avatar--user { background: linear-gradient(135deg, #1e40af, #3730a3); mat-icon { color: #fff; } }
    .hp-msg__bubble {
      max-width: 78%; padding: 10px 14px; border-radius: 12px;
      font-size: 13px; line-height: 1.65; color: #1E293B;
    }
    .hp-msg--ai .hp-msg__bubble { background: #F8FAFC; border: 1px solid #E2E8F0; border-top-left-radius: 3px; }
    .hp-msg--user .hp-msg__bubble { background: linear-gradient(135deg, #1e40af, #3730a3); color: #fff; border-top-right-radius: 3px; }
    .hp-msg__content {
      p { margin: 0 0 8px; &:last-child { margin-bottom: 0; } }
      strong { font-weight: 700; }
      ul, ol { margin: 4px 0 4px 16px; padding: 0; }
      li { margin-bottom: 2px; }
      code { font-family: monospace; font-size: 11px; background: rgba(99,102,241,.08); color: #4338CA; padding: 1px 4px; border-radius: 3px; }
    }
    .hp-typing { display: flex; gap: 4px; align-items: center; padding: 4px 0; }
    .hp-typing span { width: 6px; height: 6px; border-radius: 50%; background: #94A3B8; animation: bounce 1.2s infinite; }
    .hp-typing span:nth-child(2) { animation-delay: .2s; }
    .hp-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

    /* ── Input ────────────────────────────────────────────────── */
    .hp-input-area {
      padding: 12px 16px 16px; border-top: 1px solid #F1F5F9;
      background: #fff; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;
    }
    .hp-clear {
      align-self: flex-end; display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: 1px solid #E2E8F0; border-radius: 7px;
      background: #fff; color: #CBD5E1; cursor: pointer; transition: all .15s;
      mat-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; }
      &:hover { border-color: #FCA5A5; color: #F87171; background: #FFF5F5; }
    }
    .hp-input {
      display: flex; align-items: flex-end; gap: 8px;
      background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px;
      padding: 8px 8px 8px 14px; transition: border-color .15s;
    }
    .hp-input--focused { border-color: #3B82F6; background: #fff; }
    .hp-textarea {
      flex: 1; border: none; outline: none; resize: none;
      font-size: 13px; font-family: inherit; color: #1E293B;
      background: transparent; line-height: 1.5; max-height: 120px;
      &::placeholder { color: #94A3B8; }
    }
    .hp-send {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 9px; border: none;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      color: #fff; cursor: pointer; flex-shrink: 0; transition: opacity .15s;
      mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }
      &:disabled { opacity: .35; cursor: default; }
      &:not(:disabled):hover { opacity: .85; }
    }
    .hp-hint {
      font-size: 10px; color: #CBD5E1; margin: 0; text-align: center;
      kbd { padding: 1px 4px; font-size: 9px; }
    }
  `],
})
export class HelpPanelComponent implements AfterViewChecked {
  helpSvc      = inject(HelpService);
  activeTab    = signal<'guide' | 'ia'>('guide');
  searchQuery  = '';
  expandedCard = '';
  inputText    = '';
  inputFocused = false;
  loading      = signal(false);
  messages     = signal<HelpMessage[]>([]);
  suggestions  = SUGGESTIONS;
  private shouldScroll = false;

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('inputEl') inputEl!: ElementRef;

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') this.helpSvc.close();
    if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      this.helpSvc.toggle();
    }
  }

  filteredModules = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return MODULES;
    return MODULES.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.desc.toLowerCase().includes(q) ||
      m.tags.some(t => t.includes(q)),
    );
  });

  ngAfterViewChecked() {
    if (this.shouldScroll && this.messagesContainer) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  toggleCard(title: string) {
    this.expandedCard = this.expandedCard === title ? '' : title;
  }

  focusInput() {
    setTimeout(() => this.inputEl?.nativeElement?.focus(), 80);
  }

  onEnter(e: Event) {
    if (!(e as KeyboardEvent).shiftKey) { e.preventDefault(); this.send(); }
  }

  sendSuggestion(text: string) {
    this.inputText = text;
    this.send();
  }

  async send() {
    const content = this.inputText.trim();
    if (!content || this.loading()) return;
    this.inputText = '';
    this.loading.set(true);
    this.messages.update(m => [...m, { role: 'user', content }]);
    this.messages.update(m => [...m, { role: 'assistant', content: '' }]);
    this.shouldScroll = true;
    const idx = this.messages().length - 1;
    const toSend = this.messages().slice(0, -1).filter(m => m.content.trim()).slice(-8);

    await this.helpSvc.chatStream(
      toSend,
      chunk => {
        this.messages.update(msgs => {
          const updated = [...msgs];
          updated[idx] = { ...updated[idx], content: updated[idx].content + chunk };
          return updated;
        });
        this.shouldScroll = true;
      },
      () => { this.loading.set(false); this.shouldScroll = true; this.inputEl?.nativeElement?.focus(); },
      err => {
        this.messages.update(msgs => {
          const updated = [...msgs];
          updated[idx] = { ...updated[idx], content: `⚠️ ${err}` };
          return updated;
        });
        this.loading.set(false);
      },
    );
  }

  clearChat() { this.messages.set([]); }

  formatMd(text: string): string {
    if (!text) return '';
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^\s*][^*]*)\*/g, '<em>$1</em>');
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    const lines = text.split('\n');
    const out: string[] = []; let inList = false;
    for (const line of lines) {
      const li = line.match(/^[-•*]\s+(.+)$/);
      if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${li[1]}</li>`); }
      else { if (inList) { out.push('</ul>'); inList = false; } out.push(line); }
    }
    if (inList) out.push('</ul>');
    text = out.join('\n');
    const blocks = text.split(/\n\n+/);
    return blocks.map(b => {
      b = b.trim(); if (!b) return '';
      if (/^<(ul|h[2-4])/.test(b)) return b;
      return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
}
