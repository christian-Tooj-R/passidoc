import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule],
  template: `
<div class="mb-wrap">
  <h1><mat-icon>receipt_long</mat-icon> Mes bulletins de salaire</h1>
  <p class="mb-sub">Vos bulletins déjà générés et publiés par le service RH.</p>

  @if (loading()) {
    <div class="mb-loading"><div class="spinner"></div><span>Chargement…</span></div>
  }

  <table class="mb-table">
    <thead><tr><th>Période</th><th>Net à payer</th><th>Paiement</th><th></th></tr></thead>
    <tbody>
      @for (b of bulletins(); track b.id) {
        <tr>
          <td>{{ MOIS_LABEL[b.mois-1] }} {{ b.annee }} @if (b.estRegularisation) { <span class="badge-r">régularisation</span> }</td>
          <td>{{ b.netAPayer | number:'1.2-2' }} {{ symboleDevise() }}</td>
          <td>{{ b.datePaiement ? (b.datePaiement + ' — ' + b.modePaiement) : 'Non renseigné' }}</td>
          <td>
            <button mat-icon-button matTooltip="Visualiser le bulletin" aria-label="Visualiser le bulletin" (click)="visualiser(b)"><mat-icon>visibility</mat-icon></button>
            <button mat-icon-button matTooltip="Télécharger le PDF" aria-label="Télécharger le PDF" (click)="telecharger(b)"><mat-icon>picture_as_pdf</mat-icon></button>
          </td>
        </tr>
      }
      @if (!loading() && !bulletins().length) {
        <tr><td colspan="4" class="mb-empty">Aucun bulletin disponible pour le moment.</td></tr>
      }
    </tbody>
  </table>
</div>
  `,
  styles: [`
    .mb-wrap { padding: 24px 28px 48px; max-width: 900px; margin: 0 auto; }
    h1 { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 4px;
      mat-icon { color: #7C3AED; } }
    .mb-sub { font-size: 12px; color: #94A3B8; margin: 0 0 18px; }
    .mb-loading { display: flex; align-items: center; gap: 8px; padding: 20px; color: #64748B; }
    .spinner { width: 18px; height: 18px; border: 2px solid #E2E8F0; border-top-color: #7C3AED; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .mb-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
    .mb-table th { text-align: left; color: #94A3B8; font-size: 11px; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid #E2E8F0; background: #F8FAFC; }
    .mb-table td { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .mb-empty { text-align: center; color: #94A3B8; padding: 20px !important; }
    .badge-r { font-size: 10px; background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
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
