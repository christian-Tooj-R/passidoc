import {
  CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor, NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { from, Observable, switchMap } from 'rxjs';

/** Route d'un dossier : `clients/:clientId/…` (onglets) ou `clients/:id/…` (ClientsController).
 *  Les routes hors `/clients` (ex. `saisies-temps/rentabilite/dossier/:clientId`) gardent leur
 *  propre contrôle, qui répond 404. */
const ROUTE_DOSSIER = /\/clients\/:(clientId|id)(\/|$)/;

/**
 * Une route de dossier client n'est servie que si le dossier appartient au cabinet de
 * l'utilisateur connecté (même règle que `ClientsService.findOneForUser`).
 *
 * Beaucoup de contrôleurs d'onglets (fiche identité, ADN, synthèses, salariés du client,
 * objectifs, exercices, flux…) ne recevaient pas l'utilisateur : n'importe quel compte, même
 * d'un autre cabinet, pouvait lire et modifier ces données en appelant l'API avec un autre
 * identifiant de dossier. Le contrôle est fait ici une fois pour toutes, y compris pour les
 * routes à venir. Les droits d'écriture propres à chaque onglet restent dans les services.
 */
@Injectable()
export class DossierCabinetInterceptor implements NestInterceptor {
  constructor(private ds: DataSource) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    // Routes publiques (@Public) : pas d'utilisateur, rien à comparer.
    if (!req.user) return next.handle();
    const route = ROUTE_DOSSIER.exec(req.route?.path ?? '');
    const brut = route ? req.params?.[route[1]] : undefined;
    const id = Number(brut);
    // Paramètre absent ou non numérique : rien à contrôler ici (ParseIntPipe répond 400).
    if (brut === undefined || !Number.isInteger(id)) return next.handle();

    return from(this.ds.query(`SELECT "tenantId" FROM clients WHERE id = $1`, [id])).pipe(
      switchMap((rows: { tenantId: number | null }[]) => {
        if (!rows.length) throw new NotFoundException('Dossier introuvable');
        if ((rows[0].tenantId ?? null) !== (req.user.tenantId ?? null)) throw new ForbiddenException('Accès interdit');
        return next.handle();
      }),
    );
  }
}
