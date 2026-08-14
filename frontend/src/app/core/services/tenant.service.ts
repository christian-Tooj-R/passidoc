import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay, tap, map, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantConfig } from '../models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private http = inject(HttpClient);

  private _configured = signal<boolean | null>(null);
  private _config     = signal<TenantConfig | null>(null);
  private _slug       = signal<string | null>(this._detectSlug());

  private _checkObs: Observable<boolean> | null = null;

  readonly nomSociete  = computed(() => this._config()?.nomSociete  ?? 'Passidoc');
  readonly logoUrl     = computed(() => this._config()?.logoUrl     ?? null);
  readonly poleLabel1  = computed(() => this._config()?.poleLabel1  ?? 'La Réunion');
  readonly poleLabel2  = computed(() => this._config()?.poleLabel2  ?? 'Madagascar');
  readonly poleFlag1   = computed(() => this._config()?.poleFlag1   ?? '🇷🇪');
  readonly poleFlag2   = computed(() => this._config()?.poleFlag2   ?? '🇲🇬');
  readonly isConfigured = computed(() => this._configured());
  readonly slug         = computed(() => this._slug());

  poleLabel(site: string): string {
    return site === 'REUNION' ? this.poleLabel1() : this.poleLabel2();
  }
  poleFlag(site: string): string {
    return site === 'REUNION' ? this.poleFlag1() : this.poleFlag2();
  }

  private _detectSlug(): string | null {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const params = new URLSearchParams(window.location.search);
    const qSlug  = params.get('tenant');

    if (parts.length >= 3) {
      // Sur Render (*.onrender.com) ou domaine custom multi-niveaux
      if (qSlug) {
        // Persist pour que les navigations internes sans ?tenant= restent sur le bon tenant
        localStorage.setItem('tenant_slug', qSlug.toLowerCase());
        return qSlug.toLowerCase();
      }
      // Navigation interne (pas de ?tenant=) : lire depuis localStorage
      const stored = localStorage.getItem('tenant_slug');
      if (stored) return stored;
      // Aucun slug connu → hostname = "passidoc-app" → pas de tenant → setup wizard
      return parts[0].toLowerCase();
    }

    // localhost / dev : ?tenant= ou localStorage
    if (qSlug) {
      localStorage.setItem('tenant_slug', qSlug.toLowerCase());
      return qSlug.toLowerCase();
    }
    const stored = localStorage.getItem('tenant_slug');
    if (stored) return stored.toLowerCase();

    return null;
  }

  /** Appelé après le setup wizard pour mettre à jour le slug courant */
  setSlug(slug: string) {
    localStorage.setItem('tenant_slug', slug.toLowerCase());
    this._slug.set(slug.toLowerCase());
    // Ne pas réinitialiser _configured : le tenant vient d'être créé, il est forcément configuré
  }

  /** Appelé depuis la landing page pour changer de cabinet — force une re-vérification */
  switchTenant(slug: string) {
    localStorage.setItem('tenant_slug', slug.toLowerCase());
    this._slug.set(slug.toLowerCase());
    this._configured.set(null);
    this._checkObs = null;
  }

  /** Appelé après le setup wizard pour mettre à jour le cache local */
  markConfigured(config?: TenantConfig) {
    this._configured.set(true);
    if (config) this._config.set(config);
  }

  checkSetup(): Observable<boolean> {
    const cached = this._configured();
    if (cached !== null) return of(cached);

    if (!this._checkObs) {
      this._checkObs = this.http
        .get<{ configured: boolean }>(`${environment.apiUrl}/setup/status`)
        .pipe(
          tap(s => {
            this._configured.set(s.configured);
            if (s.configured) {
              this.http.get<TenantConfig>(`${environment.apiUrl}/tenant/config`)
                .pipe(catchError(() => of(null)))
                .subscribe(c => { if (c) this._config.set(c); });
            }
            this._checkObs = null;
          }),
          map(s => s.configured),
          catchError(() => {
            this._configured.set(false); // fail closed → redirige vers setup
            this._checkObs = null;
            return of(false);
          }),
          shareReplay(1),
        );
    }

    return this._checkObs;
  }

  loadConfig(): Observable<TenantConfig | null> {
    return this.http.get<TenantConfig>(`${environment.apiUrl}/tenant/config`).pipe(
      tap(c => { if (c) this._config.set(c); }),
      catchError(() => of(null)),
    );
  }

  updateConfig(dto: Partial<TenantConfig>): Observable<TenantConfig> {
    return this.http.patch<TenantConfig>(`${environment.apiUrl}/tenant/config`, dto).pipe(
      tap(c => this._config.set(c)),
    );
  }
}
