import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map, catchError, of } from 'rxjs';
import { PointageService } from '../services/pointage.service';
import { PointageModalComponent } from '../../features/pointage/pointage-modal.component';

export const pointageGuard: CanActivateFn = () => {
  const svc    = inject(PointageService);
  const dialog = inject(MatDialog);

  return svc.getMonStatut().pipe(
    map(statut => {
      if (statut.estPointe) return true;

      // Ouvrir le modal seulement s'il n'est pas déjà affiché
      const dejaOuvert = dialog.openDialogs.some(
        d => d.componentInstance instanceof PointageModalComponent
      );
      if (!dejaOuvert) {
        const ref = dialog.open(PointageModalComponent, {
          disableClose: true,
          hasBackdrop: true,
          panelClass: 'pointage-dialog',
          width: '360px',
        });

        // Si fermé sans pointer (console devtools), relancer la vérification
        ref.afterClosed().subscribe((pointe: boolean) => {
          if (!pointe) {
            svc.getMonStatut().subscribe(s => {
              if (!s.estPointe && dialog.openDialogs.length === 0) {
                dialog.open(PointageModalComponent, {
                  disableClose: true,
                  hasBackdrop: true,
                  panelClass: 'pointage-dialog',
                  width: '360px',
                });
              }
            });
          }
        });
      }
      // Laisser la navigation : le modal bloque visuellement toute interaction
      return true;
    }),
    catchError(() => of(true)), // En cas d'erreur réseau, ne pas bloquer l'app
  );
};
