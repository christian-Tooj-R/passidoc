import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { TenantService } from '../services/tenant.service';
import { AuthService } from '../services/auth.service';

/** Bloque l'accès si l'application n'est pas encore configurée → redirige vers /setup */
export const setupGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Utilisateur déjà authentifié → le tenant était forcément configuré au login.
  // Si la config n'est pas encore chargée (ex: rechargement de page), on la charge avant de continuer.
  if (auth.isLoggedIn()) {
    if (tenant.configLoaded()) return true;
    return tenant.loadConfig().pipe(map(() => true), catchError(() => of(true)));
  }

  const cached = tenant.isConfigured();
  if (cached === true)  return true;
  if (cached === false) return router.createUrlTree(['/setup']);

  return tenant.checkSetup().pipe(
    map(ok => ok ? true : router.createUrlTree(['/setup'])),
  );
};

/** Redirige HORS de /setup uniquement si l'utilisateur est déjà connecté → dashboard.
 *  Tant que personne n'est connecté, /setup reste affiché même si le tenant est configuré.
 *  ?force=true bypass le guard (accès admin pour reconfiguration). */
export const alreadySetupGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  if (route.queryParamMap.get('force') === 'true') return true;

  const auth = inject(AuthService);
  const router = inject(Router);

  // Si connecté → aller au dashboard directement
  if (auth.isLoggedIn()) return router.createUrlTree(['/dashboard']);

  // Pas connecté → laisser /setup s'afficher (peu importe si configuré ou non)
  return true;
};
