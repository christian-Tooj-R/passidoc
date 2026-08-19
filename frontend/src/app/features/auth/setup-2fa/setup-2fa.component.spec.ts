import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { Setup2faComponent } from './setup-2fa.component';
import { AuthService } from '../../../core/services/auth.service';

const mockAuth = {
  setup2fa:  vi.fn(),
  enable2fa: vi.fn(),
};

async function createComponent() {
  mockAuth.setup2fa.mockReturnValue(of({ qrCode: 'data:image/png;base64,abc', secret: 'SECRET' }));
  await TestBed.configureTestingModule({
    imports: [Setup2faComponent],
    providers: [
      provideRouter([]),
      provideAnimations(),
      { provide: AuthService, useValue: mockAuth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Setup2faComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('Setup2faComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.setup2fa.mockReturnValue(of({ qrCode: 'data:image/png;base64,abc', secret: 'SECRET' }));
    mockAuth.enable2fa.mockReturnValue(of({}));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('charge le qrCode depuis AuthService.setup2fa au init', async () => {
    const { comp } = await createComponent();
    expect(comp.qrCode).toBe('data:image/png;base64,abc');
  });

  it('affiche le titre Configuration 2FA', async () => {
    const { fixture } = await createComponent();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2FA');
  });

  describe('form', () => {
    it('est invalide si token vide', async () => {
      const { comp } = await createComponent();
      expect(comp.form.invalid).toBe(true);
    });

    it('est valide avec 6 caractères', async () => {
      const { comp } = await createComponent();
      comp.form.setValue({ token: '123456' });
      expect(comp.form.valid).toBe(true);
    });
  });

  describe('enable', () => {
    it('appelle enable2fa avec le token saisi', async () => {
      const { comp } = await createComponent();
      comp.form.setValue({ token: '123456' });
      comp.enable();
      expect(mockAuth.enable2fa).toHaveBeenCalledWith('123456');
    });

    it('passe success à true après activation', async () => {
      const { comp } = await createComponent();
      comp.form.setValue({ token: '123456' });
      comp.enable();
      expect(comp.success).toBe(true);
    });

    it('affiche une erreur si activation échoue', async () => {
      const { comp } = await createComponent();
      mockAuth.enable2fa.mockReturnValue(throwError(() => ({ message: 'Code expiré' })));
      comp.form.setValue({ token: '000000' });
      comp.enable();
      expect(comp.error).toContain('Code');
    });
  });
});
