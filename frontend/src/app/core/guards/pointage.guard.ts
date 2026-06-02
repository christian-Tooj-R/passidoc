import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map, catchError, of } from 'rxjs';
import { PointageService } from '../services/pointage.service';
import { PointageModalComponent } from '../../features/pointage/pointage-modal.component';

const DIALOG_CONFIG = {
  disableClose:  true,
  hasBackdrop:   true,                      // bloque TOUS les clics derrière
  backdropClass: 'pointage-backdrop',       // backdrop semi-transparent avec blur
  panelClass:    'pointage-dialog',
  width:         '380px',
};

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
        const ref = dialog.open(PointageModalComponent, DIALOG_CONFIG);

        // Si fermé sans pointer (bypass console devtools), relancer
        ref.afterClosed().subscribe((pointe: boolean) => {
          if (!pointe) {
            svc.getMonStatut().subscribe(s => {
              if (!s.estPointe && dialog.openDialogs.length === 0) {
                dialog.open(PointageModalComponent, DIALOG_CONFIG);
              }
            });
          }
        });
      }
      return true;
    }),
    catchError(() => of(true)),
  );
};
