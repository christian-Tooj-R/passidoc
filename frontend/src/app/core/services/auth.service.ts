import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiUrl}/auth`;
  private _user = signal<User | null>(null);
  private _token = signal<string | null>(localStorage.getItem('token'));

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('user');
    if (stored) this._user.set(JSON.parse(stored));
  }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.api}/login`, { email, password }).pipe(
      tap((res) => {
        if (res.access_token) this.setSession(res);
      }),
    );
  }

  verify2fa(userId: number, token: string) {
    return this.http.post<any>(`${this.api}/2fa/verify`, { userId, token }).pipe(
      tap((res) => this.setSession(res)),
    );
  }

  setup2fa() {
    return this.http.get<{ qrCode: string; secret: string }>(`${this.api}/2fa/setup`);
  }

  enable2fa(token: string) {
    return this.http.post<any>(`${this.api}/2fa/enable`, { token });
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null { return this._token(); }
  currentUser(): User | null { return this._user(); }
  isLoggedIn(): boolean { return !!this._token(); }
  isAdmin(): boolean { return this._user()?.role === 'ADMIN'; }

  private setSession(res: any) {
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('user', JSON.stringify(res.user));
    this._token.set(res.access_token);
    this._user.set(res.user);
  }
}
