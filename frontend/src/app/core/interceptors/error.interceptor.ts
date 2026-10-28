import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout();
        router.navigate(['/auth/login']);
      }
      const message = err.error?.message || 'Une erreur est survenue';
      // `status` et `error` restent lisibles : les écrans affichent `err.error.message` (message
      // du serveur, ex. « Cet email est déjà utilisé ») ou testent `err.status`.
      return throwError(() => Object.assign(new Error(message), { status: err.status, error: err.error }));
    }),
  );
};
