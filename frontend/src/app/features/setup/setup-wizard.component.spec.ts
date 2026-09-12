import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { SetupWizardComponent } from './setup-wizard.component';
import { TenantService } from '../../core/services/tenant.service';

const mockTenant = {
  slug:              vi.fn().mockReturnValue('afym'),
  resetForSetupPage: vi.fn(),
  switchTenant:      vi.fn(),
  markConfigured:    vi.fn(),
  setSlug:           vi.fn(),
  poleFlag1:  vi.fn().mockReturnValue('🔵'),
  poleLabel1: vi.fn().mockReturnValue('Pôle EST'),
  poleFlag2:  vi.fn().mockReturnValue('🟠'),
  poleLabel2: vi.fn().mockReturnValue('Pôle OUEST'),
  poleFlag:   vi.fn(),
  poleLabel:  vi.fn(),
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [SetupWizardComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: TenantService, useValue: mockTenant },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SetupWizardComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('SetupWizardComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('currentStep démarre à 0', async () => {
    const { comp } = await createComponent();
    expect(comp.currentStep()).toBe(0);
  });

  it('loading est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.loading()).toBe(false);
  });

  it('submitError est vide par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.submitError()).toBe('');
  });

  it('showPw est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.showPw()).toBe(false);
  });

  it('urlCopied est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.urlCopied()).toBe(false);
  });

  it('expose les deux pôles fixes (plus de saisie de pays)', async () => {
    const { comp } = await createComponent();
    expect(comp.POLE_LABEL_1).toBe('Pôle EST');
    expect(comp.POLE_LABEL_2).toBe('Pôle OUEST');
    expect(comp.POLE_FLAG_1).toBe('🔵');
    expect(comp.POLE_FLAG_2).toBe('🟠');
    expect((comp as unknown as Record<string, unknown>)['step1']).toBeUndefined();
  });

  it('affiche un contenu de configuration', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.length).toBeGreaterThan(0);
  });
});
