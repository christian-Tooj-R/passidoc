import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { PointageService } from '../../core/services/pointage.service';
import { AuthService } from '../../core/services/auth.service';
import { PointageModalComponent } from '../../features/pointage/pointage-modal.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, MatDialogModule],
  template: `
    <div class="layout">
      <app-sidebar />
      <div class="layout__content">
        <app-header />
        <main class="layout__main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout { display: flex; height: 100vh; overflow: hidden; background: #F4F6FB; }
    .layout__content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
    .layout__main { flex: 1; overflow-y: auto; background: #F4F6FB; padding: 28px 32px; }
  `],
})
export class MainLayoutComponent implements OnInit {
  constructor(
    private dialog: MatDialog,
    private pointageSvc: PointageService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    if (!this.auth.currentUser()) return;
    this.verifierPointage();
  }

  private verifierPointage() {
    this.pointageSvc.getMonStatut().subscribe(statut => {
      if (statut.estPointe) return;

      // Ne pas ouvrir un second modal si le guard l'a déjà ouvert
      const dejaOuvert = this.dialog.openDialogs.some(
        d => d.componentInstance instanceof PointageModalComponent
      );
      if (dejaOuvert) return;

      const ref = this.dialog.open(PointageModalComponent, {
        disableClose: true,
        hasBackdrop: true,
        panelClass: 'pointage-dialog',
        width: '360px',
      });

      // Si le modal est fermé sans avoir pointé (ex: dialogRef.close() console),
      // on le réouvre après un court délai
      ref.afterClosed().subscribe((pointe: boolean) => {
        if (!pointe) setTimeout(() => this.verifierPointage(), 300);
      });
    });
  }
}
