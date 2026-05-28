import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ThemeService, SIDEBAR_THEMES, ACCENT_COLORS, PANEL_STYLES } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-personnalisation',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatRippleModule, MatSnackBarModule],
  template: `
<div class="page">

  <!-- ─── Header ────────────────────────────────────────────────── -->
  <div class="page-header">
    <div class="page-icon"><mat-icon>palette</mat-icon></div>
    <div>
      <h1 class="page-title">Personnalisation</h1>
      <p class="page-sub">Configurez l'interface en temps réel — les changements sont appliqués instantanément.</p>
    </div>
  </div>

  <!-- ─── Layout 2 colonnes ─────────────────────────────────────── -->
  <div class="layout">

    <!-- ══ Colonne gauche ══════════════════════════════════════════ -->
    <div class="col-settings">

      <!-- ── 1 · Thème de la barre latérale ──────────────────── -->
      <div class="card">
        <div class="card-head">
          <div class="card-icon ci-blue"><mat-icon>view_sidebar</mat-icon></div>
          <div>
            <h2 class="card-title">Thème de la barre latérale</h2>
            <p class="card-sub">3 thèmes prédéfinis ou créez le vôtre avec le mode Personnalisé.</p>
          </div>
        </div>

        <div class="theme-grid">
          @for (t of SIDEBAR_THEMES; track t.id) {
            <button class="t-sw"
                    [class.t-sw--on]="theme.prefs().sidebarThemeId === t.id"
                    matRipple
                    (click)="setSidebar(t.id)">
              <div class="t-sw__bar"
                   [style.background]="t.id === 'custom' ? customGradient() : (t.gradient || 'linear-gradient(180deg,#334155,#64748B)')">
              </div>
              <span class="t-sw__label">{{ t.label }}</span>
              @if (theme.prefs().sidebarThemeId === t.id) {
                <mat-icon class="t-sw__check">check_circle</mat-icon>
              }
            </button>
          }
        </div>

        <!-- Constructeur dégradé personnalisé -->
        @if (theme.prefs().sidebarThemeId === 'custom') {
          <div class="cg-builder">
            <div class="cg-title">
              <mat-icon>gradient</mat-icon>
              Constructeur de dégradé personnalisé
            </div>

            <div class="cg-row">

              <!-- Couleur départ -->
              <div class="cp-field">
                <span class="cp-field__label">Départ</span>
                <label class="cp-wrap">
                  <div class="cp-swatch" [style.background]="theme.prefs().customStart"></div>
                  <input class="cp-input" type="color"
                         [value]="theme.prefs().customStart"
                         (input)="setCustomStart($any($event.target).value)" />
                </label>
                <span class="cp-hex">{{ theme.prefs().customStart }}</span>
              </div>

              <!-- Preview bar -->
              <div class="cg-preview" [style.background]="customGradient()"></div>

              <!-- Couleur fin -->
              <div class="cp-field">
                <span class="cp-field__label">Fin</span>
                <label class="cp-wrap">
                  <div class="cp-swatch" [style.background]="theme.prefs().customEnd"></div>
                  <input class="cp-input" type="color"
                         [value]="theme.prefs().customEnd"
                         (input)="setCustomEnd($any($event.target).value)" />
                </label>
                <span class="cp-hex">{{ theme.prefs().customEnd }}</span>
              </div>

            </div>

            <!-- Angle -->
            <div class="cg-angles">
              <span class="cg-angles__label">Direction</span>
              @for (a of ANGLES; track a.deg) {
                <button class="angle-btn"
                        [class.angle-btn--on]="theme.prefs().gradientAngle === a.deg"
                        (click)="setAngle(a.deg)">
                  <mat-icon [style.transform]="'rotate(' + a.deg + 'deg)'">arrow_upward</mat-icon>
                  <span>{{ a.label }}</span>
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- ── 2 · Style du panneau ──────────────────────────────── -->
      <div class="card">
        <div class="card-head">
          <div class="card-icon ci-slate"><mat-icon>layers</mat-icon></div>
          <div>
            <h2 class="card-title">Style du panneau</h2>
            <p class="card-sub">Apparence du menu de navigation secondaire.</p>
          </div>
        </div>
        <div class="ps-grid">
          @for (ps of PANEL_STYLES; track ps.id) {
            <button class="ps-card"
                    [class.ps-card--on]="theme.prefs().panelStyleId === ps.id"
                    matRipple
                    (click)="setPanelStyle(ps.id)">
              <!-- Faux fond représentant le style -->
              <div class="ps-card__bg"
                   [style.background]="ps.bg"
                   [style.border-color]="ps.border">
                <!-- Faux items dans le mini-panel -->
                <div class="ps-fake-header" [style.border-color]="ps.border">
                  <div class="ps-fh-dot" [style.background]="ps.titleColor"></div>
                  <div class="ps-fh-bar" [style.background]="ps.titleColor"></div>
                </div>
                @for (i of [0,1,2]; track i) {
                  <div class="ps-fake-item"
                       [style.background]="i === 0 ? ps.hoverBg : 'transparent'">
                    <div class="ps-fi-dot"
                         [style.background]="i === 0 ? accentStart() : ps.labelColor"></div>
                    <div class="ps-fi-bar"
                         [style.background]="i === 0 ? ps.titleColor : ps.labelColor"
                         [style.opacity]="i === 0 ? '1' : '0.6'"></div>
                  </div>
                }
              </div>
              <!-- Nom + icône -->
              <div class="ps-card__foot">
                <mat-icon>{{ ps.icon }}</mat-icon>
                <span>{{ ps.label }}</span>
              </div>
              @if (theme.prefs().panelStyleId === ps.id) {
                <mat-icon class="ps-check">check_circle</mat-icon>
              }
            </button>
          }
        </div>
      </div>

      <!-- ── 3 · Couleur d'accent ──────────────────────────────── -->
      <div class="card">
        <div class="card-head">
          <div class="card-icon ci-teal"><mat-icon>color_lens</mat-icon></div>
          <div>
            <h2 class="card-title">Couleur d'accent</h2>
            <p class="card-sub">Boutons, badges, indicateurs actifs et liens.</p>
          </div>
        </div>

        <div class="acc-grid">
          @for (a of ACCENT_COLORS; track a.id) {
            @if (a.id === 'custom') {
              <label class="a-sw"
                     [class.a-sw--on]="theme.prefs().accentId === 'custom'"
                     [style.--ring]="theme.prefs().customAccentColor"
                     matRipple>
                <div class="a-sw__circle" [style.background]="theme.prefs().customAccentColor">
                  @if (theme.prefs().accentId === 'custom') {
                    <mat-icon>check</mat-icon>
                  } @else {
                    <mat-icon class="a-sw__palette-ic">palette</mat-icon>
                  }
                </div>
                <span class="a-sw__label">{{ a.label }}</span>
                <input class="a-sw__picker" type="color"
                       [value]="theme.prefs().customAccentColor"
                       (input)="setAccentCustom($any($event.target).value)" />
              </label>
            } @else {
              <button class="a-sw"
                      [class.a-sw--on]="theme.prefs().accentId === a.id"
                      [style.--ring]="a.start"
                      matRipple
                      (click)="setAccent(a.id)">
                <div class="a-sw__circle"
                     [style.background]="'linear-gradient(135deg,' + a.start + ',' + a.end + ')'">
                  @if (theme.prefs().accentId === a.id) {
                    <mat-icon>check</mat-icon>
                  }
                </div>
                <span class="a-sw__label">{{ a.label }}</span>
              </button>
            }
          }
        </div>

        <!-- Aperçu accent -->
        <div class="acc-preview">
          <span class="ap-tag">Aperçu</span>
          <button class="ap-btn" [style.background]="accentGradient()">
            <mat-icon>add</mat-icon> Nouveau
          </button>
          <span class="ap-badge" [style.background]="accentLight()" [style.color]="accentStart()">
            Actif
          </span>
          <div class="ap-toggle" [style.background]="accentStart()">
            <div class="ap-toggle__thumb"></div>
          </div>
          <span class="ap-link" [style.color]="accentStart()">Lien accent →</span>
        </div>
      </div>

      <!-- ── Footer ───────────────────────────────────────────── -->
      <div class="page-footer">
        <button class="btn-reset" matRipple (click)="reset()">
          <mat-icon>restart_alt</mat-icon> Réinitialiser tout
        </button>
        <span class="footer-hint">Les préférences sont stockées localement dans ce navigateur.</span>
      </div>

    </div><!-- /col-settings -->

    <!-- ══ Colonne droite : aperçu sticky ══════════════════════════ -->
    <div class="col-preview">
      <div class="pv-sticky">

        <div class="pv-label">
          <mat-icon>visibility</mat-icon>
          Aperçu en direct
        </div>

        <!-- Mini sidebar mockup -->
        <div class="mini-shell">

          <!-- Rail -->
          <div class="mini-rail" [style.background]="theme.computedGradient()">
            <div class="mini-logo">
              <mat-icon>description</mat-icon>
            </div>
            <div class="mini-divider"></div>
            <!-- Active item -->
            <div class="mini-item mini-item--active">
              <div class="mini-pill" [style.background]="'var(--rail-active-bg)'">
                <div class="mini-dot" [style.background]="'var(--rail-active-color)'"></div>
              </div>
              <div class="mini-lbl" [style.background]="'var(--rail-active-color)'"></div>
            </div>
            <!-- Other items -->
            @for (i of [1,2,3,4]; track i) {
              <div class="mini-item">
                <div class="mini-pill">
                  <div class="mini-dot" style="background:rgba(255,255,255,.30)"></div>
                </div>
                <div class="mini-lbl" style="background:rgba(255,255,255,.18)"></div>
              </div>
            }
            <div class="mini-spacer"></div>
            <div class="mini-av">{{ initials() }}</div>
          </div>

          <!-- Panel -->
          <div class="mini-panel"
               [style.background]="'var(--panel-bg)'"
               [style.border-left-color]="'var(--panel-border)'"
               [style.backdrop-filter]="'var(--panel-backdrop)'">

            <!-- Header panel -->
            <div class="mini-ph" [style.border-bottom-color]="'var(--panel-border)'">
              <div class="mini-ph-ic" [style.background]="accentLight()"></div>
              <div class="mini-ph-t" [style.background]="'var(--panel-title)'"></div>
            </div>

            <!-- Nav items -->
            <div class="mini-pnav">
              <div class="mini-pi mini-pi--act"
                   [style.background]="accentLight()">
                <div class="mini-pi-ic" [style.background]="accentStart()"></div>
                <div class="mini-pi-bar" [style.background]="accentStart()"></div>
              </div>
              @for (i of [1,2,3]; track i) {
                <div class="mini-pi">
                  <div class="mini-pi-ic" [style.background]="'var(--panel-label)'"></div>
                  <div class="mini-pi-bar" [style.background]="'var(--panel-text)'"></div>
                </div>
              }

              @if (theme.prefs().orgName) {
                <div class="mini-org-chip">{{ theme.prefs().orgName }}</div>
              }
            </div>

            <!-- Footer panel -->
            <div class="mini-pfoot" [style.border-top-color]="'var(--panel-border)'">
              <div class="mini-pf-av" [style.background]="accentGradient()"></div>
              <div class="mini-pf-lines">
                <div class="mini-pf-name" [style.background]="'var(--panel-title)'"></div>
                <div class="mini-pf-role" [style.background]="'var(--panel-label)'"></div>
              </div>
            </div>

          </div><!-- /mini-panel -->

        </div><!-- /mini-shell -->

        <!-- Info chips du thème actuel -->
        <div class="pv-chips">
          <span class="pv-chip">
            <mat-icon>view_sidebar</mat-icon> {{ currentThemeLabel() }}
          </span>
          <span class="pv-chip">
            <mat-icon>layers</mat-icon> {{ currentPanelLabel() }}
          </span>
          <span class="pv-chip pv-chip--accent"
                [style.background]="accentLight()"
                [style.color]="accentStart()">
            <mat-icon>color_lens</mat-icon> {{ currentAccentLabel() }}
          </span>
        </div>

      </div><!-- /pv-sticky -->
    </div><!-- /col-preview -->

  </div><!-- /layout -->
</div>
  `,
  styles: [`
    /* ── Page ────────────────────────────────────────────────────── */
    .page { padding: 32px 36px 64px; }

    .page-header {
      display: flex; align-items: center; gap: 16px; margin-bottom: 28px;
    }
    .page-icon {
      width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
      background: linear-gradient(135deg, #7C3AED, #A78BFA);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(124,58,237,.28);
    }
    .page-icon mat-icon { font-size: 26px; width: 26px; height: 26px; color: white; }
    .page-title { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0; }
    .page-sub   { font-size: 13px; color: #64748B; margin: 3px 0 0; }

    /* ── Layout 2 cols ───────────────────────────────────────────── */
    .layout {
      display: grid;
      grid-template-columns: 1fr 272px;
      gap: 20px;
      align-items: start;
    }
    .col-settings { display: flex; flex-direction: column; gap: 14px; }

    /* ── Cards ───────────────────────────────────────────────────── */
    .card {
      background: white; border-radius: 16px; padding: 20px 22px;
      border: 1px solid #E8ECF0; box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .card-head {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px;
    }
    .card-icon {
      width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: white; }
    }
    .ci-blue   { background: linear-gradient(135deg, #1565C0, #42A5F5); }
    .ci-slate  { background: linear-gradient(135deg, #334155, #64748B); }
    .ci-teal   { background: linear-gradient(135deg, #00695C, #26A69A); }
    .card-title { font-size: 14.5px; font-weight: 700; color: #0F172A; margin: 0; }
    .card-sub   { font-size: 12px;   color: #64748B;  margin: 3px 0 0; }

    /* ── Thèmes sidebar ──────────────────────────────────────────── */
    .theme-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .t-sw {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      border: 2px solid #E8ECF0; border-radius: 14px;
      padding: 14px 10px 10px; background: white; cursor: pointer; position: relative;
      transition: border-color .15s, box-shadow .15s, transform .12s;
      &:hover { border-color: #A5B4FC; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
      &--on   { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
    }
    .t-sw__bar {
      width: 36px; height: 80px; border-radius: 9px;
      box-shadow: 0 3px 12px rgba(0,0,0,.22);
    }
    .t-sw__label {
      font-size: 11px; font-weight: 600; color: #475569; text-align: center;
    }
    .t-sw--on .t-sw__label { color: #4338CA; }
    .t-sw__check {
      position: absolute; top: -7px; right: -7px;
      font-size: 18px !important; width: 18px !important; height: 18px !important;
      color: #6366F1 !important; background: white; border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,.12);
    }

    /* ── Constructeur dégradé ────────────────────────────────────── */
    .cg-builder {
      margin-top: 16px; padding: 16px 18px;
      background: linear-gradient(135deg, #F8FAFF, #EEF2FF);
      border-radius: 12px; border: 1px solid #DDE3F8;
    }
    .cg-title {
      display: flex; align-items: center; gap: 7px;
      font-size: 12.5px; font-weight: 700; color: #4338CA; margin-bottom: 14px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .cg-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
    }
    .cp-field { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .cp-field__label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .4px; }
    .cp-wrap {
      display: flex; align-items: center; gap: 8px; cursor: pointer;
      background: white; border-radius: 10px; padding: 6px 10px;
      border: 1.5px solid #DDE3F8; transition: border-color .15s;
      &:hover { border-color: #6366F1; }
    }
    .cp-swatch {
      width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
      box-shadow: 0 1px 4px rgba(0,0,0,.15);
    }
    .cp-input {
      width: 0; height: 0; opacity: 0; position: absolute; pointer-events: none;
    }
    .cp-hex { font-size: 11px; font-weight: 600; color: #475569; font-family: monospace; }
    .cg-preview {
      flex: 1; height: 52px; border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,.18);
    }
    .cg-angles {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .cg-angles__label {
      font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .4px;
      margin-right: 4px;
    }
    .angle-btn {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 7px 10px; border-radius: 9px; border: 1.5px solid #DDE3F8;
      background: white; cursor: pointer; transition: border-color .12s, background .12s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748B; transition: color .12s; }
      span { font-size: 10px; font-weight: 700; color: #64748B; }
      &:hover { border-color: #6366F1; background: #EEF2FF; }
      &--on {
        border-color: #6366F1; background: #6366F1;
        mat-icon { color: white; }
        span { color: white; }
      }
    }

    /* ── Style du panneau ────────────────────────────────────────── */
    .ps-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    }
    .ps-card {
      display: flex; flex-direction: column; gap: 0;
      border: 2px solid #E8ECF0; border-radius: 14px; overflow: hidden;
      background: white; cursor: pointer; padding: 0; position: relative;
      transition: border-color .15s, box-shadow .15s, transform .12s;
      &:hover { border-color: #A5B4FC; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,.10); }
      &--on   { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
    }
    .ps-card__bg {
      padding: 10px 8px 6px; border-bottom-width: 1px; border-bottom-style: solid;
      min-height: 96px;
    }
    .ps-fake-header {
      display: flex; align-items: center; gap: 5px;
      padding-bottom: 7px; margin-bottom: 5px;
      border-bottom-width: 1px; border-bottom-style: solid;
    }
    .ps-fh-dot { width: 16px; height: 16px; border-radius: 5px; flex-shrink: 0; opacity: .5; }
    .ps-fh-bar { height: 5px; border-radius: 3px; flex: 1; opacity: .45; }
    .ps-fake-item {
      display: flex; align-items: center; gap: 5px;
      border-radius: 8px; padding: 4px 6px; margin: 1px 0;
    }
    .ps-fi-dot  { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
    .ps-fi-bar  { height: 4px; border-radius: 2px; flex: 1; }
    .ps-card__foot {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px 8px; background: white;
      font-size: 12px; font-weight: 700; color: #475569;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #6366F1; }
    }
    .ps-check {
      position: absolute; top: -7px; right: -7px;
      font-size: 18px !important; width: 18px !important; height: 18px !important;
      color: #6366F1 !important; background: white; border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,.12);
    }

    /* ── Accent colors ───────────────────────────────────────────── */
    .acc-grid {
      display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;
    }
    .a-sw {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      border: none; background: transparent; cursor: pointer; padding: 4px;
      border-radius: 12px; transition: background .12s;
      &:hover { background: #F1F5F9; }
    }
    .a-sw__circle {
      width: 42px; height: 42px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,.18);
      transition: box-shadow .18s, transform .12s;
      mat-icon { font-size: 19px; width: 19px; height: 19px; color: white; }
    }
    .a-sw--on .a-sw__circle {
      box-shadow: 0 0 0 3px white, 0 0 0 5px var(--ring, #6366F1);
      transform: scale(1.08);
    }
    .a-sw__palette-ic { font-size: 17px !important; width: 17px !important; height: 17px !important; opacity: .85; }
    .a-sw__label { font-size: 11px; font-weight: 600; color: #475569; }
    .a-sw--on .a-sw__label { color: #4338CA; }
    /* Input color caché — le label parent le déclenche au clic */
    .a-sw__picker {
      position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;
    }
    .a-sw { position: relative; cursor: pointer; }

    /* Aperçu accent */
    .acc-preview {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 12px 14px; background: #F8FAFC; border-radius: 10px; border: 1px solid #E8ECF0;
    }
    .ap-tag {
      font-size: 10px; font-weight: 800; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .6px;
    }
    .ap-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 13px; border-radius: 20px; border: none; cursor: default;
      font-size: 12.5px; font-weight: 600; color: white; font-family: inherit;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .ap-badge {
      display: inline-flex; padding: 2px 9px; border-radius: 20px;
      font-size: 11.5px; font-weight: 700;
    }
    .ap-toggle {
      width: 34px; height: 18px; border-radius: 9px; position: relative;
      flex-shrink: 0; transition: background .2s;
    }
    .ap-toggle__thumb {
      width: 13px; height: 13px; border-radius: 50%; background: white;
      position: absolute; top: 2.5px; right: 3px;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .ap-link { font-size: 12.5px; font-weight: 600; }

    /* ── Footer ──────────────────────────────────────────────────── */
    .page-footer {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding-top: 4px;
    }
    .btn-reset {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border: 1.5px solid #E2E8F0; border-radius: 9px;
      background: white; cursor: pointer; font-size: 13px; font-weight: 600;
      color: #64748B; font-family: inherit; transition: border-color .12s, background .12s, color .12s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { border-color: #F87171; color: #DC2626; background: #FEF2F2; }
    }
    .footer-hint { font-size: 11.5px; color: #94A3B8; }

    /* ═══════════════════════════════════════════════════════════════
       COLONNE DROITE — Aperçu sticky
    ═══════════════════════════════════════════════════════════════ */
    .col-preview { position: relative; }

    .pv-sticky {
      position: sticky; top: 24px;
      background: white; border-radius: 16px; padding: 16px;
      border: 1px solid #E8ECF0; box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }

    .pv-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 800; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .6px;
      margin-bottom: 14px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Mini sidebar mockup ─────────────────────────────────────── */
    .mini-shell {
      display: flex; border-radius: 12px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12);
      height: 240px; margin-bottom: 14px;
    }

    /* Mini rail */
    .mini-rail {
      width: 52px; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center;
      padding: 10px 0 10px; gap: 2px;
    }
    .mini-logo {
      width: 28px; height: 28px; border-radius: 8px;
      background: linear-gradient(135deg, #1565C0, #60a5fa);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 7px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: white; }
    }
    .mini-divider {
      width: 28px; height: 1px; background: rgba(255,255,255,.10); margin: 3px 0 5px;
    }
    .mini-item {
      width: 44px; display: flex; flex-direction: column;
      align-items: center; gap: 3px; padding: 4px 0; border-radius: 10px;
    }
    .mini-item--active { background: rgba(255,255,255,.06); }
    .mini-pill {
      width: 32px; height: 18px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .mini-dot { width: 8px; height: 8px; border-radius: 50%; }
    .mini-lbl { width: 22px; height: 3px; border-radius: 2px; }
    .mini-spacer { flex: 1; }
    .mini-av {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, #1565C0, #42A5F5);
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; color: white;
    }

    /* Mini panel */
    .mini-panel {
      flex: 1; display: flex; flex-direction: column;
      border-left-width: 1px; border-left-style: solid;
      overflow: hidden;
    }
    .mini-ph {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 10px 8px; flex-shrink: 0;
      border-bottom-width: 1px; border-bottom-style: solid;
    }
    .mini-ph-ic { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; opacity: .5; }
    .mini-ph-t  { height: 5px; border-radius: 3px; flex: 1; opacity: .6; }
    .mini-pnav { flex: 1; padding: 6px 6px 0; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .mini-pi {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 6px; border-radius: 8px;
      &--act { }
    }
    .mini-pi-ic  { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
    .mini-pi-bar { height: 4px; border-radius: 2px; flex: 1; opacity: .55; }
    .mini-org-chip {
      margin-top: 6px; padding: 2px 6px;
      font-size: 7px; font-weight: 700; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .mini-pfoot {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 8px 8px; flex-shrink: 0;
      border-top-width: 1px; border-top-style: solid;
    }
    .mini-pf-av   { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; }
    .mini-pf-lines { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .mini-pf-name { height: 4px; border-radius: 2px; width: 70%; opacity: .7; }
    .mini-pf-role { height: 3px; border-radius: 2px; width: 50%; opacity: .4; }

    /* Info chips */
    .pv-chips {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .pv-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 9px; border-radius: 20px;
      font-size: 10.5px; font-weight: 600; color: #475569;
      background: #F1F5F9; border: 1px solid #E2E8F0;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
      &--accent { border-color: transparent; }
    }

    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .col-preview { display: none; }
    }
  `],
})
export class PersonnalisationComponent {
  theme  = inject(ThemeService);
  auth   = inject(AuthService);
  private snack = inject(MatSnackBar);

  readonly SIDEBAR_THEMES = SIDEBAR_THEMES;
  readonly ACCENT_COLORS  = ACCENT_COLORS;
  readonly PANEL_STYLES   = PANEL_STYLES;

  readonly ANGLES = [
    { deg: 90,  label: '90°'  },
    { deg: 135, label: '135°' },
    { deg: 180, label: '180°' },
    { deg: 225, label: '225°' },
  ];

  setSidebar(id: string)    { this.theme.update({ sidebarThemeId: id }); }
  setAccent(id: string)     { this.theme.update({ accentId: id });       }
  setPanelStyle(id: string) { this.theme.update({ panelStyleId: id });   }
  setCustomStart(v: string)       { this.theme.update({ customStart: v });            }
  setCustomEnd(v: string)         { this.theme.update({ customEnd: v });              }
  setAccentCustom(v: string) { this.theme.update({ accentId: 'custom', customAccentColor: v }); }
  setAngle(deg: number)     { this.theme.update({ gradientAngle: deg }); }
  reset() {
    this.theme.reset();
    this.snack.open('Préférences réinitialisées', undefined, { duration: 2500 });
  }

  customGradient() {
    const p = this.theme.prefs();
    return `linear-gradient(${p.gradientAngle}deg, ${p.customStart} 0%, ${p.customEnd} 100%)`;
  }

  private acc() {
    const p = this.theme.prefs();
    if (p.accentId === 'custom') {
      const c = p.customAccentColor;
      const toRgba = (hex: string, a: number) => {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
      };
      const lighten = (hex: string) => {
        const r = Math.min(255,parseInt(hex.slice(1,3),16)+40).toString(16).padStart(2,'0');
        const g = Math.min(255,parseInt(hex.slice(3,5),16)+40).toString(16).padStart(2,'0');
        const b = Math.min(255,parseInt(hex.slice(5,7),16)+40).toString(16).padStart(2,'0');
        return `#${r}${g}${b}`;
      };
      return { start: c, end: lighten(c), hover: c, light: toRgba(c, 0.12), border: toRgba(c, 0.30), railColor: c, railBg: toRgba(c, 0.20) };
    }
    return ACCENT_COLORS.find(a => a.id === p.accentId) ?? ACCENT_COLORS[0];
  }
  accentGradient() { const a = this.acc(); return `linear-gradient(135deg,${a.start},${a.end})`; }
  accentLight()    { return this.acc().light;  }
  accentStart()    { return this.acc().start;  }

  currentThemeLabel()  { return SIDEBAR_THEMES.find(t => t.id === this.theme.prefs().sidebarThemeId)?.label ?? ''; }
  currentPanelLabel()  { return PANEL_STYLES.find(s => s.id === this.theme.prefs().panelStyleId)?.label ?? '';    }
  currentAccentLabel() { return ACCENT_COLORS.find(a => a.id === this.theme.prefs().accentId)?.label ?? '';       }

  initials() {
    const u = this.auth.currentUser();
    return u ? (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '') : 'AB';
  }
}
