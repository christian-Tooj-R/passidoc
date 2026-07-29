import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { TenantService } from '../services/tenant.service';

/** Bloque l'accès si l'application n'est pas encore configurée → redirige vers /setup */
export const setupGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const router = inject(Router);

  const cached = tenant.isConfigured();
  if (cached === true)  return true;
  if (cached === false) return router.createUrlTree(['/setup']);

  return tenant.checkSetup().pipe(
    map(ok => ok ? true : router.createUrlTree(['/setup'])),
  );
};

/** Redirige HORS de /setup si l'application est déjà configurée */
export const alreadySetupGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const router = inject(Router);

  const cached = tenant.isConfigured();
  if (cached === true)  return router.createUrlTree(['/auth/login']);
  if (cached === false) return true;

  return tenant.checkSetup().pipe(
    map(ok => ok ? router.createUrlTree(['/auth/login']) : true),
  );
};
