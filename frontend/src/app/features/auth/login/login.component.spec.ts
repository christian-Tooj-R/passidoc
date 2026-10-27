import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';

const mockAuth = {
  login:    vi.fn(),
  register: vi.fn(),
};

const mockTenant = {
  poleFlag1:  vi.fn().mockReturnValue('🔵'),
  poleLabel1: vi.fn().mockReturnValue('Pôle EST'),
  poleFlag2:  vi.fn().mockReturnValue('🟠'),
  poleLabel2: vi.fn().mockReturnValue('Pôle OUEST'),
  intervenantLabel1: vi.fn().mockReturnValue('Collaborateur Réunion'),
  intervenantLabel2: vi.fn().mockReturnValue('Collaborateur Madagascar'),
  slug:       vi.fn().mockReturnValue('afym'),
};

/** Formulaire d'inscription complet et valide (mot de passe confirmé). */
const INSCRIPTION = {
  firstName: 'Sophie', lastName: 'Martin', email: 'sophie@afym.re',
  password: '12345678', confirmPassword: '12345678', site: 'EST',
};

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: AuthService,   useValue: mockAuth },
      { provide: TenantService, useValue: mockTenant },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LoginComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('LoginComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.login.mockReturnValue(of({ access_token: 'tok', user: { id: 1 }, requires2FA: false }));
    mockAuth.register.mockReturnValue(of({ email: 'sophie@afym.re', emailSent: true }));
  });

  describe('rendu initial', () => {
    it('se crée sans erreur', async () => {
      const { comp } = await createComponent();
      expect(comp).toBeTruthy();
    });

    it('mode initial est login', async () => {
      const { comp } = await createComponent();
      expect(comp.mode()).toBe('login');
    });

    it('affiche le texte Passidoc dans le DOM', async () => {
      const { fixture } = await createComponent();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Passidoc');
    });

    it('affiche le formulaire de connexion', async () => {
      const { fixture } = await createComponent();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Bienvenue');
    });

    it("affiche l'année en cours dans le footer", async () => {
      const { comp } = await createComponent();
      expect(comp.year).toBe(new Date().getFullYear());
    });
  });

  describe('switchMode', () => {
    it('passe en mode register', async () => {
      const { comp } = await createComponent();
      comp.switchMode('register');
      expect(comp.mode()).toBe('register');
    });

    it('revient en mode login depuis register', async () => {
      const { comp } = await createComponent();
      comp.switchMode('register');
      comp.switchMode('login');
      expect(comp.mode()).toBe('login');
    });

    it('efface loginError au changement de mode', async () => {
      const { comp } = await createComponent();
      comp.loginError = 'Une erreur';
      comp.switchMode('register');
      expect(comp.loginError).toBe('');
    });

    it('efface registerError au changement de mode', async () => {
      const { comp } = await createComponent();
      comp.registerError = 'Une erreur';
      comp.switchMode('login');
      expect(comp.registerError).toBe('');
    });
  });

  describe('formulaire loginForm', () => {
    it('est invalide si email vide', async () => {
      const { comp } = await createComponent();
      comp.loginForm.setValue({ email: '', password: '' });
      expect(comp.loginForm.invalid).toBe(true);
    });

    it('est invalide si email malformé', async () => {
      const { comp } = await createComponent();
      comp.loginForm.setValue({ email: 'pas-un-email', password: 'secret' });
      expect(comp.loginForm.invalid).toBe(true);
    });

    it('est valide avec email + mot de passe corrects', async () => {
      const { comp } = await createComponent();
      comp.loginForm.setValue({ email: 'sophie@afym.re', password: 'motdepasse' });
      expect(comp.loginForm.valid).toBe(true);
    });
  });

  describe('submitLogin', () => {
    it('ne soumet pas si formulaire invalide', async () => {
      const { comp } = await createComponent();
      comp.loginForm.setValue({ email: '', password: '' });
      comp.submitLogin();
      expect(mockAuth.login).not.toHaveBeenCalled();
    });

    it('appelle AuthService.login avec les bonnes credentials', async () => {
      const { comp } = await createComponent();
      comp.loginForm.setValue({ email: 'sophie@afym.re', password: 'secret123' });
      comp.submitLogin();
      expect(mockAuth.login).toHaveBeenCalledWith('sophie@afym.re', 'secret123');
    });

    it('affiche loginError en cas d\'erreur serveur', async () => {
      const { comp } = await createComponent();
      mockAuth.login.mockReturnValue(throwError(() => ({ message: 'Identifiants invalides' })));
      comp.loginForm.setValue({ email: 'a@b.re', password: 'wrongpwd' });
      comp.submitLogin();
      expect(comp.loginError).toBe('Identifiants invalides');
    });

    it('loginLoading repasse à false après erreur', async () => {
      const { comp } = await createComponent();
      mockAuth.login.mockReturnValue(throwError(() => new Error('fail')));
      comp.loginForm.setValue({ email: 'a@b.re', password: 'pwd' });
      comp.submitLogin();
      expect(comp.loginLoading).toBe(false);
    });
  });

  describe('formulaire registerForm', () => {
    it('est invalide si firstName vide', async () => {
      const { comp } = await createComponent();
      comp.registerForm.patchValue({ ...INSCRIPTION, firstName: '' });
      expect(comp.registerForm.invalid).toBe(true);
    });

    it('est invalide si les deux mots de passe diffèrent', async () => {
      const { comp } = await createComponent();
      comp.registerForm.patchValue({ ...INSCRIPTION, confirmPassword: 'autre-chose' });
      expect(comp.registerForm.hasError('passwordMismatch')).toBe(true);
      expect(comp.registerForm.invalid).toBe(true);
    });

    it('est invalide si le mot de passe fait moins de 8 caractères', async () => {
      const { comp } = await createComponent();
      comp.registerForm.patchValue({ ...INSCRIPTION, password: '1234', confirmPassword: '1234' });
      expect(comp.registerForm.invalid).toBe(true);
    });

    it('est valide avec tous les champs requis', async () => {
      const { comp } = await createComponent();
      comp.registerForm.patchValue(INSCRIPTION);
      expect(comp.registerForm.valid).toBe(true);
    });
  });

  describe('submitRegister', () => {
    it('ne soumet pas si formulaire invalide', async () => {
      const { comp } = await createComponent();
      comp.switchMode('register');
      comp.registerForm.patchValue({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', site: 'EST' });
      comp.submitRegister();
      expect(mockAuth.register).not.toHaveBeenCalled();
    });

    it('appelle AuthService.register avec les bonnes données', async () => {
      const { comp } = await createComponent();
      comp.switchMode('register');
      comp.registerForm.patchValue(INSCRIPTION);
      comp.submitRegister();
      expect(mockAuth.register).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Sophie', email: 'sophie@afym.re', site: 'EST' }),
      );
    });

    it("passe en vérification d'email après inscription réussie", async () => {
      const { comp } = await createComponent();
      comp.registerForm.patchValue(INSCRIPTION);
      comp.submitRegister();
      expect(comp.mode()).toBe('verify-email');
      expect(comp.pendingEmail()).toBe('sophie@afym.re');
      expect(comp.registerLoading).toBe(false);
    });

    it('prérempli le champ email du loginForm après inscription', async () => {
      const { comp } = await createComponent();
      comp.registerForm.patchValue(INSCRIPTION);
      comp.submitRegister();
      expect(comp.loginForm.value.email).toBe('sophie@afym.re');
    });

    it("reste sur l'inscription avec un message si l'email de code n'a pas pu partir", async () => {
      const { comp } = await createComponent();
      mockAuth.register.mockReturnValue(of({ email: 'sophie@afym.re', emailSent: false }));
      comp.switchMode('register');
      comp.registerForm.patchValue(INSCRIPTION);
      comp.submitRegister();
      expect(comp.mode()).toBe('register');
      expect(comp.registerError).toContain("l'envoi du code a échoué");
    });

    it("affiche registerError en cas d'erreur serveur", async () => {
      const { comp } = await createComponent();
      mockAuth.register.mockReturnValue(throwError(() => ({ error: { message: 'Email déjà utilisé' } })));
      comp.registerForm.patchValue(INSCRIPTION);
      comp.submitRegister();
      expect(comp.registerError).toBe('Email déjà utilisé');
      expect(comp.registerLoading).toBe(false);
    });
  });

  describe('toggle mot de passe', () => {
    it('hidePassword est true par défaut', async () => {
      const { comp } = await createComponent();
      expect(comp.hidePassword).toBe(true);
    });

    it('toggle hidePassword', async () => {
      const { comp } = await createComponent();
      comp.hidePassword = false;
      expect(comp.hidePassword).toBe(false);
    });
  });
});
