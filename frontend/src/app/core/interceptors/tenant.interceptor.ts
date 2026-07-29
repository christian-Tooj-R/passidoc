import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { TenantService } from '../services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenant = inject(TenantService);
  const slug   = tenant.slug();

  if (!slug) return next(req);

  return next(req.clone({
    setHeaders: { 'x-tenant-slug': slug },
  }));
};
