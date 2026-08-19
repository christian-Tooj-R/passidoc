import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ForgotPasswordComponent } from './forgot-password.component';
import { TenantService } from '../../../core/services/tenant.service';

const mockTenant = {
  slug: vi.fn().mockReturnValue('afym'),
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [ForgotPasswordComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: TenantService, useValue: mockTenant },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ForgotPasswordComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('ForgotPasswordComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('état initial', () => {
    it('se crée sans erreur', async () => {
      const { comp } = await createComponent();
      expect(comp).toBeTruthy();
    });

    it('démarre à l\'étape email', async () => {
      const { comp } = await createComponent();
      expect(comp.step()).toBe('email');
    });

    it('loading est false par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.loading()).toBe(false);
    });

    it('error est vide par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.error()).toBe('');
    });

    it('hidePassword est true par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.hidePassword()).toBe(true);
    });
  });

  describe('emailForm validation', () => {
    it('invalide si email vide', async () => {
      const { comp } = await createComponent();
      expect(comp.emailForm.invalid).toBe(true);
    });

    it('invalide si email malformé', async () => {
      const { comp } = await createComponent();
      comp.emailForm.setValue({ email: 'pas-un-email' });
      expect(comp.emailForm.invalid).toBe(true);
    });

    it('valide avec un email correct', async () => {
      const { comp } = await createComponent();
      comp.emailForm.setValue({ email: 'sophie@afym.re' });
      expect(comp.emailForm.valid).toBe(true);
    });
  });

  describe('submitEmail', () => {
    it('ne soumet pas si emailForm invalide', async () => {
      const { comp } = await createComponent();
      const http = TestBed.inject(HttpTestingController);
      comp.submitEmail();
      http.expectNone(() => true);
      http.verify();
    });

    it('passe à l\'étape code après succès HTTP', async () => {
      const { comp } = await createComponent();
      const http = TestBed.inject(HttpTestingController);
      comp.emailForm.setValue({ email: 'sophie@afym.re' });
      comp.submitEmail();
      const req = http.expectOne(r => r.url.includes('forgot-password'));
      req.flush({});
      expect(comp.step()).toBe('code');
      http.verify();
    });

    it('affiche une erreur si la requête échoue', async () => {
      const { comp } = await createComponent();
      const http = TestBed.inject(HttpTestingController);
      comp.emailForm.setValue({ email: 'sophie@afym.re' });
      comp.submitEmail();
      const req = http.expectOne(r => r.url.includes('forgot-password'));
      req.flush('Erreur', { status: 500, statusText: 'Server Error' });
      expect(comp.error()).toContain('Impossible');
      http.verify();
    });
  });

  describe('backToEmail', () => {
    it('revient à l\'étape email', async () => {
      const { comp } = await createComponent();
      comp.step.set('code');
      comp.backToEmail();
      expect(comp.step()).toBe('email');
    });

    it('efface l\'erreur', async () => {
      const { comp } = await createComponent();
      comp.error.set('Code invalide');
      comp.backToEmail();
      expect(comp.error()).toBe('');
    });
  });

  describe('codeForm validation', () => {
    it('invalide si code vide', async () => {
      const { comp } = await createComponent();
      expect(comp.codeForm.invalid).toBe(true);
    });

    it('invalide si code non numérique ou longueur incorrecte', async () => {
      const { comp } = await createComponent();
      comp.codeForm.patchValue({ code: 'abc', newPassword: 'motdepasse1' });
      expect(comp.codeForm.invalid).toBe(true);
    });

    it('valide avec code à 6 chiffres et mot de passe ≥ 8 car.', async () => {
      const { comp } = await createComponent();
      comp.codeForm.patchValue({ code: '123456', newPassword: 'motdepasse1' });
      expect(comp.codeForm.valid).toBe(true);
    });
  });

  describe('submitCode', () => {
    it('ne soumet pas si codeForm invalide', async () => {
      const { comp } = await createComponent();
      const http = TestBed.inject(HttpTestingController);
      comp.step.set('code');
      comp.submitCode();
      http.expectNone(() => true);
      http.verify();
    });

    it('passe à l\'étape success après réinitialisation réussie', async () => {
      const { comp } = await createComponent();
      const http = TestBed.inject(HttpTestingController);
      comp.emailForm.setValue({ email: 'sophie@afym.re' });
      comp.step.set('code');
      comp.codeForm.patchValue({ code: '123456', newPassword: 'nouveauMdp1' });
      comp.submitCode();
      const req = http.expectOne(r => r.url.includes('reset-password'));
      req.flush({});
      expect(comp.step()).toBe('success');
      http.verify();
    });
  });

  describe('hidePassword toggle', () => {
    it('bascule hidePassword', async () => {
      const { comp } = await createComponent();
      comp.hidePassword.set(false);
      expect(comp.hidePassword()).toBe(false);
    });
  });
});
