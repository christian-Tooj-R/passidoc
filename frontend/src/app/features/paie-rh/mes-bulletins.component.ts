import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PaieRhService, BulletinSalarie, deviseSymbole } from '../../core/services/paie-rh.service';
import { BulletinPdfPreviewDialogComponent } from './bulletin-pdf-preview-dialog.component';
import { AuthService } from '../../core/services/auth.service';
import { SalariesService } from '../salaries/salaries.service';

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Portail salarié (V1) — un collaborateur connecté consulte SES PROPRES bulletins déjà
 * générés (lecture seule). CDC §18/critère d'acceptation §34.
 */
@Component({
  selector: 'app-mes-bulletins',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule, MatTooltipModule],
  template: `
<div class="mb-wrap">
  <div class="rhx-page-head">
    <div class="rhx-page-head__main">
      <div class="rhx-page-head__icon"><mat-icon>receipt_long</mat-icon></div>
      <div>
        <h1>Mes bulletins de salaire</h1>
        <p class="rhx-page-head__sub">Vos bulletins déjà générés et publiés par le service RH.</p>
      </div>
    </div>
  </div>

  <div class="rhx-card">
    @if (loading()) {
      <div class="mb-loading"><div class="spinner"></div><span>Chargement…</span></div>
    }

    <table class="mb-table rhx-table">
      <thead><tr><th>Période</th><th class="num">Net à payer</th><th>Paiement</th><th></th></tr></thead>
      <tbody>
        @for (b of bulletins(); track b.id) {
          <tr>
            <td><span class="strong">{{ MOIS_LABEL[b.mois-1] }} {{ b.annee }}</span> @if (b.estRegularisation) { <span class="rhx-chip rhx-chip--amber rhx-chip--nodot badge-r">régularisation</span> }</td>
            <td class="num strong">{{ b.netAPayer | number:'1.2-2' }} {{ symboleDevise() }}</td>
            <td>
              @if (b.datePaiement) {
                <span class="rhx-chip rhx-chip--teal">Payé le {{ b.datePaiement | date:'dd/MM/yyyy' }}{{ b.modePaiement ? ' · ' + b.modePaiement : '' }}</span>
              } @else {
                <span class="rhx-chip rhx-chip--muted">Non renseigné</span>
              }
            </td>
            <td class="actions">
              <button mat-icon-button matTooltip="Visualiser le bulletin" aria-label="Visualiser le bulletin" (click)="visualiser(b)"><mat-icon>visibility</mat-icon></button>
              <button mat-icon-button matTooltip="Télécharger le PDF" aria-label="Télécharger le PDF" (click)="telecharger(b)"><mat-icon>picture_as_pdf</mat-icon></button>
            </td>
          </tr>
        }
        @if (!loading() && !bulletins().length) {
          <tr><td colspan="4" class="mb-empty">
            <div class="rhx-empty"><mat-icon>receipt_long</mat-icon><div class="rhx-empty__title">Aucun bulletin disponible pour le moment.</div><div class="rhx-empty__hint">Vos bulletins apparaîtront ici dès leur génération par le service RH.</div></div>
          </td></tr>
        }
      </tbody>
    </table>
  </div>
</div>
  `,
  styles: [`
    .mb-wrap { padding: 24px 28px 48px; max-width: 1000px; margin: 0 auto; }
    .mb-loading { display: flex; align-items: center; gap: 8px; padding: 12px 0; color: #64748B; font-size: 13px; }
    .spinner { width: 18px; height: 18px; border: 2px solid #E2E8F0; border-top-color: #7C3AED; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .badge-r { margin-left: 6px; }
  `],
})
export class MesBulletinsComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  private salariesService = inject(SalariesService);
  readonly MOIS_LABEL = MOIS_LABEL;

  loading = signal(true);
  bulletins = signal<BulletinSalarie[]>([]);
  /** Devise du collaborateur connecté (`User.devise`) — jamais "€" supposé, voir `deviseSymbole()`. */
  symboleDevise = signal('€');

  ngOnInit() {
    this.paieRh.mesBulletins().subscribe({
      next: (b) => { this.bulletins.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.salariesService.getOne(userId).subscribe({
        next: (c) => this.symboleDevise.set(deviseSymbole(c.devise)),
        error: () => {},
      });
    }
  }

  telecharger(b: BulletinSalarie) {
    this.paieRh.telechargerMonBulletinPdf(b.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bulletin-salaire-${b.annee}-${String(b.mois).padStart(2, '0')}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  visualiser(b: BulletinSalarie) {
    this.paieRh.telechargerMonBulletinPdf(b.id).subscribe((blob) => {
      this.dialog.open(BulletinPdfPreviewDialogComponent, {
        panelClass: ['rounded-dialog', 'no-pad-dialog'],
        width: '900px', maxWidth: '96vw', height: '90vh', maxHeight: '90vh',
        data: { blob, titre: `Bulletin — ${this.MOIS_LABEL[b.mois - 1]} ${b.annee}` },
      });
    });
  }
}
