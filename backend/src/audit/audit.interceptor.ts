import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

// Actions à auditer par méthode HTTP
const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE', PATCH: 'UPDATE', PUT: 'UPDATE', DELETE: 'DELETE',
};

// Ressources à ne PAS auditer (trop fréquentes)
const SKIP_PATHS = ['/notifications', '/auth', '/audit', '/tasks/dashboard', '/grille', '/toggle'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const method = req.method;
    const action = METHOD_ACTION[method];
    if (!action) return next.handle();
    if (SKIP_PATHS.some(p => req.url.includes(p))) return next.handle();

    const user = req.user;
    const ip = req.ip || req.headers['x-forwarded-for'];

    // Extraire la ressource depuis l'URL : /api/clients/3/tasks/5 → 'clients'
    const urlParts = req.url.replace('/api/', '').split('/');
    const ressource = urlParts[0] || 'unknown';
    const ressourceId = parseInt(urlParts[1]) || 0;
    const clientId = ressource === 'clients' ? ressourceId : (parseInt(urlParts[urlParts.indexOf('clients') + 1]) || null);

    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          await this.audit.log(
            action, ressource, ressourceId, clientId,
            method === 'DELETE' ? { id: ressourceId } : null,
            method !== 'DELETE' ? responseBody : null,
            user, ip,
          );
        } catch {/* ne pas bloquer sur erreur audit */}
      }),
    );
  }
}
