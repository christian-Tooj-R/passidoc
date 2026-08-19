import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { Verify2faComponent } from './verify-2fa.component';
import { AuthService } from '../../../core/services/auth.service';

const mockAuth = {
  verify2fa: vi.fn(),
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [Verify2faComponent],
    providers: [
      provideRouter([]),
      provideAnimations(),
      { provide: AuthService, useValue: mockAuth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Verify2faComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('Verify2faComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.verify2fa.mockReturnValue(of({ access_token: 'tok', user: { id: 1 } }));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('affiche le titre Vérification 2FA', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2FA');
  });

  describe('form', () => {
    it('est invalide si token vide', async () => {
      const { comp } = await createComponent();
      expect(comp.form.invalid).toBe(true);
    });

    it('est invalide si token < 6 caractères', async () => {
      const { comp } = await createComponent();
      comp.form.setValue({ token: '12345' });
      expect(comp.form.invalid).toBe(true);
    });

    it('est valide avec 6 caractères', async () => {
      const { comp } = await createComponent();
      comp.form.setValue({ token: '123456' });
      expect(comp.form.valid).toBe(true);
    });
  });

  describe('submit', () => {
    it('appelle verify2fa avec le token saisi', async () => {
      const { comp } = await createComponent();
      comp.form.setValue({ token: '123456' });
      comp.submit();
      expect(mockAuth.verify2fa).toHaveBeenCalled();
    });

    it('affiche l\'erreur si la vérification échoue', async () => {
      const { comp } = await createComponent();
      mockAuth.verify2fa.mockReturnValue(throwError(() => ({ message: 'Code invalide' })));
      comp.form.setValue({ token: '000000' });
      comp.submit();
      expect(comp.error).toContain('Code');
    });
  });

  it('loading est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.loading).toBe(false);
  });
});
