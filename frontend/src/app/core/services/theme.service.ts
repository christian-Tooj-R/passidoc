import { Injectable, signal } from '@angular/core';

// ── 3 thèmes prédéfinis + personnalisé ─────────────────────────
export const SIDEBAR_THEMES = [
  { id: 'navy',   label: 'Navy',        gradient: 'linear-gradient(180deg, #0c1a3a 0%, #1e3a8a 50%, #1d4ed8 100%)',  swatch: '#1d4ed8' },
  { id: 'foret',  label: 'Forêt',       gradient: 'linear-gradient(180deg, #064E3B 0%, #065F46 50%, #059669 100%)',  swatch: '#059669' },
  { id: 'violet', label: 'Violet',      gradient: 'linear-gradient(180deg, #2E1065 0%, #4C1D95 50%, #7C3AED 100%)', swatch: '#7C3AED' },
  { id: 'custom', label: 'Personnalisé', gradient: '',                                                                swatch: '' },
];

// ── Couleurs d'accent ──────────────────────────────────────────
export const ACCENT_COLORS = [
  { id: 'teal',    label: 'Teal',        start: '#19D9B4', end: '#53DA85', hover: '#14C4A2', light: '#E6FBF7', border: '#A7F3E6', railColor: '#5eead4', railBg: 'rgba(94,234,212,0.20)'  },
  { id: 'indigo',  label: 'Indigo',      start: '#6366F1', end: '#818CF8', hover: '#4F46E5', light: '#EEF2FF', border: '#C7D2FE', railColor: '#a5b4fc', railBg: 'rgba(165,180,252,0.20)' },
  { id: 'amber',   label: 'Ambre',       start: '#F59E0B', end: '#FCD34D', hover: '#D97706', light: '#FFFBEB', border: '#FDE68A', railColor: '#fcd34d', railBg: 'rgba(252,211,77,0.20)'  },
  { id: 'emerald', label: 'Émeraude',    start: '#059669', end: '#34D399', hover: '#047857', light: '#ECFDF5', border: '#A7F3D0', railColor: '#6ee7b7', railBg: 'rgba(110,231,183,0.20)' },
  { id: 'rose',    label: 'Rose',        start: '#F43F5E', end: '#FB7185', hover: '#E11D48', light: '#FFF1F2', border: '#FECDD3', railColor: '#fda4af', railBg: 'rgba(253,164,175,0.20)' },
  { id: 'blue',    label: 'Bleu',        start: '#3B82F6', end: '#60A5FA', hover: '#2563EB', light: '#EFF6FF', border: '#BFDBFE', railColor: '#93c5fd', railBg: 'rgba(147,197,253,0.22)' },
  { id: 'custom',  label: 'Personnalisé', start: '',        end: '',        hover: '',        light: '',        border: '',        railColor: '',        railBg: ''                        },
];

// ── Styles du panel ────────────────────────────────────────────
export const PANEL_STYLES = [
  { id: 'light', label: 'Clair',  icon: 'light_mode',  bg: '#F0F4FF',               border: '#DDE3F0',               text: '#3C4043', titleColor: '#202124', labelColor: '#80868B', hoverBg: '#E2E9F8',              userHover: '#E2E9F8',              backdrop: 'none',
    pageBg: '#F4F6FB',          pageHeaderBg: '#FFFBFE',                  pageHeaderBorder: '#E0E2EC',              pageCardBg: '#FFFFFF',          pageCardBorder: '#E8ECF0' },
  { id: 'dark',  label: 'Sombre', icon: 'dark_mode',   bg: '#1E293B',               border: 'rgba(255,255,255,.12)', text: '#CBD5E1', titleColor: '#F1F5F9', labelColor: '#94A3B8', hoverBg: '#2D3F55',               userHover: 'rgba(255,255,255,.08)', backdrop: 'none',
    pageBg: '#0F172A',          pageHeaderBg: '#1A2540',                  pageHeaderBorder: 'rgba(255,255,255,.10)', pageCardBg: '#1E293B',          pageCardBorder: 'rgba(255,255,255,.15)' },
  { id: 'glass', label: 'Verre',  icon: 'blur_linear', bg: 'rgba(255,255,255,.22)',  border: 'rgba(255,255,255,.45)', text: '#2D3A5E', titleColor: '#1A1F36', labelColor: '#64748B', hoverBg: 'rgba(255,255,255,.30)', userHover: 'rgba(255,255,255,.30)', backdrop: 'blur(20px) saturate(200%)',
    pageBg: 'linear-gradient(135deg,#c7d8ff 0%,#dcd0ff 35%,#c8e8ff 65%,#d0c8ff 100%)', pageHeaderBg: 'rgba(255,255,255,.30)', pageHeaderBorder: 'rgba(255,255,255,.50)', pageCardBg: 'rgba(255,255,255,.22)', pageCardBorder: 'rgba(255,255,255,.45)' },
];

export interface ThemePrefs {
  sidebarThemeId:    string;
  customStart:       string;
  customEnd:         string;
  gradientAngle:     number;
  accentId:          string;
  customAccentColor: string;
  panelStyleId:      string;
  orgName:           string;
  reducedMotion:     boolean;
}

const STORAGE_KEY = 'passidoc_theme';

const DEFAULTS: ThemePrefs = {
  sidebarThemeId:    'navy',
  customStart:       '#1565C0',
  customEnd:         '#60A5FA',
  gradientAngle:     180,
  accentId:          'teal',
  customAccentColor: '#6366F1',
  panelStyleId:      'light',
  orgName:           '',
  reducedMotion:     false,
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  prefs = signal<ThemePrefs>({ ...DEFAULTS });

  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) this.prefs.set({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
    this.apply();
  }

  update(partial: Partial<ThemePrefs>) {
    this.prefs.set({ ...this.prefs(), ...partial });
    this.save();
    this.apply();
  }

  reset() {
    this.prefs.set({ ...DEFAULTS });
    this.save();
    this.apply();
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs()));
  }

  apply() {
    const p    = this.prefs();
    const root = document.documentElement;

    // ── Gradient sidebar ──────────────────────────────────────
    const grad = p.sidebarThemeId === 'custom'
      ? `linear-gradient(${p.gradientAngle}deg, ${p.customStart} 0%, ${p.customEnd} 100%)`
      : (SIDEBAR_THEMES.find(t => t.id === p.sidebarThemeId)?.gradient ?? SIDEBAR_THEMES[0].gradient);
    root.style.setProperty('--sidebar-gradient', grad);

    // ── Contraste texte rail (adaptatif) ──────────────────────
    const repColor = p.sidebarThemeId === 'custom'
      ? p.customEnd
      : (SIDEBAR_THEMES.find(t => t.id === p.sidebarThemeId)?.swatch ?? '#1d4ed8');
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lum = 0.2126 * toLinear(parseInt(repColor.slice(1,3),16)/255)
              + 0.7152 * toLinear(parseInt(repColor.slice(3,5),16)/255)
              + 0.0722 * toLinear(parseInt(repColor.slice(5,7),16)/255);
    const onDark = lum < 0.35;
    root.style.setProperty('--rail-text',     onDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.78)');
    root.style.setProperty('--rail-text-dim', onDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)');
    root.style.setProperty('--rail-hover',    onDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)');
    root.style.setProperty('--rail-divider',  onDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)');

    // ── Couleur d'accent ──────────────────────────────────────
    const toRgba = (hex: string, a: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const lighten = (hex: string) => {
      const r = Math.min(255, parseInt(hex.slice(1,3),16) + 40).toString(16).padStart(2,'0');
      const g = Math.min(255, parseInt(hex.slice(3,5),16) + 40).toString(16).padStart(2,'0');
      const b = Math.min(255, parseInt(hex.slice(5,7),16) + 40).toString(16).padStart(2,'0');
      return `#${r}${g}${b}`;
    };
    const accent = p.accentId === 'custom'
      ? {
          start:     p.customAccentColor,
          end:       lighten(p.customAccentColor),
          hover:     p.customAccentColor,
          light:     toRgba(p.customAccentColor, 0.12),
          border:    toRgba(p.customAccentColor, 0.30),
          railColor: p.customAccentColor,
          railBg:    toRgba(p.customAccentColor, 0.20),
        }
      : (ACCENT_COLORS.find(a => a.id === p.accentId) ?? ACCENT_COLORS[0]);
    root.style.setProperty('--teal',              accent.start);
    root.style.setProperty('--teal-end',          accent.end);
    root.style.setProperty('--teal-hover',        accent.hover);
    root.style.setProperty('--teal-light',        accent.light);
    root.style.setProperty('--teal-border',       accent.border);
    root.style.setProperty('--grad-teal',         `linear-gradient(135deg, ${accent.start} 0%, ${accent.end} 100%)`);
    // Sur fond sombre → pastel clair lisible ; sur fond clair → couleur assombrie (×0.55) pour contraste suffisant
    const darkenHex = (hex: string) => {
      const r = Math.round(parseInt(hex.slice(1,3),16) * 0.55).toString(16).padStart(2,'0');
      const g = Math.round(parseInt(hex.slice(3,5),16) * 0.55).toString(16).padStart(2,'0');
      const b = Math.round(parseInt(hex.slice(5,7),16) * 0.55).toString(16).padStart(2,'0');
      return `#${r}${g}${b}`;
    };
    root.style.setProperty('--rail-active-color', onDark ? accent.railColor          : darkenHex(accent.start));
    root.style.setProperty('--rail-active-bg',    onDark ? accent.railBg             : toRgba(accent.start, 0.14));

    // ── Style du panel ────────────────────────────────────────
    const panel = PANEL_STYLES.find(s => s.id === p.panelStyleId) ?? PANEL_STYLES[0];
    root.style.setProperty('--panel-bg',         panel.bg);
    root.style.setProperty('--panel-border',     panel.border);
    root.style.setProperty('--panel-text',       panel.text);
    root.style.setProperty('--panel-title',      panel.titleColor);
    root.style.setProperty('--panel-label',      panel.labelColor);
    root.style.setProperty('--panel-hover-bg',      panel.hoverBg);
    root.style.setProperty('--panel-user-hover',   panel.userHover);
    root.style.setProperty('--panel-backdrop',     panel.backdrop);
    root.style.setProperty('--page-bg',            panel.pageBg);
    root.style.setProperty('--page-header-bg',     panel.pageHeaderBg);
    root.style.setProperty('--page-header-border', panel.pageHeaderBorder);
    root.style.setProperty('--page-card-bg',       panel.pageCardBg);
    root.style.setProperty('--page-card-border',   panel.pageCardBorder);

    // ── Animations ────────────────────────────────────────────
    document.body.classList.toggle('reduced-motion', p.reducedMotion);

    // ── Couleurs des items panel (hover inclus) ────────────────
    const pd = p.panelStyleId;
    root.style.setProperty('--pi-color',  pd === 'dark'  ? '#B8C5D9' : '#3C4555');
    root.style.setProperty('--pi-icon',   pd === 'dark'  ? '#4D6080' : '#8B93A9');
    root.style.setProperty('--ph-bg',     pd === 'dark'  ? 'rgba(255,255,255,.07)'
                                        : pd === 'glass' ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.055)');
    root.style.setProperty('--ph-color',  pd === 'dark'  ? '#E2EAF4' : '#1A1F36');
    root.style.setProperty('--ph-icon',   pd === 'dark'  ? '#94A3B8' : '#4B5563');

    // ── Mode sombre sur <body> ─────────────────────────────────
    document.body.classList.toggle('theme-dark',  p.panelStyleId === 'dark');
    document.body.classList.toggle('theme-glass', p.panelStyleId === 'glass');
  }

  /** Retourne le gradient calculé (pour usage dans les templates) */
  computedGradient(): string {
    const p = this.prefs();
    if (p.sidebarThemeId === 'custom')
      return `linear-gradient(${p.gradientAngle}deg, ${p.customStart} 0%, ${p.customEnd} 100%)`;
    return SIDEBAR_THEMES.find(t => t.id === p.sidebarThemeId)?.gradient ?? SIDEBAR_THEMES[0].gradient;
  }
}
