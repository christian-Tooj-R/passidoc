import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required: UserRole[] = route.data['roles'];

  if (!required || required.includes(auth.currentUser()?.role as UserRole)) return true;
  router.navigate(['/dashboard']);
  return false;
};
