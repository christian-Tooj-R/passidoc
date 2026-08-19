import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { PersonnalisationComponent } from './personnalisation.component';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';

const mockTheme = {
  prefs:            vi.fn().mockReturnValue({ sidebarThemeId: 'default', accentColorId: 'blue', panelStyleId: 'light', glassColorId: null }),
  sidebarThemes:    vi.fn().mockReturnValue([]),
  accentColors:     vi.fn().mockReturnValue([]),
  panelStyles:      vi.fn().mockReturnValue([]),
  glassColors:      vi.fn().mockReturnValue([]),
  computedGradient: vi.fn().mockReturnValue('linear-gradient(135deg, #6366f1, #8b5cf6)'),
  setSidebarTheme:  vi.fn(),
  setAccentColor:   vi.fn(),
  setPanelStyle:    vi.fn(),
  update:           vi.fn(),
};
const mockAuth = { currentUser: vi.fn().mockReturnValue({ id: 1, firstName: 'Sophie' }) };
const mockSnack = { open: vi.fn() };

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [PersonnalisationComponent],
    providers: [
      provideAnimations(),
      { provide: ThemeService, useValue: mockTheme },
      { provide: AuthService,  useValue: mockAuth },
      { provide: MatSnackBar,  useValue: mockSnack },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PersonnalisationComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('PersonnalisationComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('affiche le texte palette ou personnalisation', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.toLowerCase()).toMatch(/palette|personnalisation|thème/i);
  });
});
