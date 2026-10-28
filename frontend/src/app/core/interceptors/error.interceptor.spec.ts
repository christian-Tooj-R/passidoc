import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  const auth = { logout: vi.fn() };
  const router = { navigate: vi.fn() };

  beforeEach(() => {
    auth.logout.mockClear();
    router.navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  const echec = (status: number, body: object | null) => {
    let erreur: any;
    http.post('/api/auth/register', {}).subscribe({ error: e => (erreur = e) });
    ctrl.expectOne('/api/auth/register').flush(body, { status, statusText: 'KO' });
    return erreur;
  };

  it('garde le message du serveur, son corps et le statut HTTP', () => {
    const e = echec(409, { message: 'Cet email est déjà utilisé dans ce cabinet', statusCode: 409 });
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('Cet email est déjà utilisé dans ce cabinet');
    expect(e.error.message).toBe('Cet email est déjà utilisé dans ce cabinet');
    expect(e.status).toBe(409);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('message générique sans corps exploitable ; 401 → déconnexion', () => {
    const e = echec(401, null);
    expect(e.message).toBe('Une erreur est survenue');
    expect(e.status).toBe(401);
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
