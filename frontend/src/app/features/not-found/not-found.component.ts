import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="not-found">
      <mat-icon>search_off</mat-icon>
      <h1>404</h1>
      <p>Page introuvable</p>
      <a mat-flat-button color="primary" routerLink="/dashboard">Retour au tableau de bord</a>
    </div>
  `,
  styles: [`
    .not-found {
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px; color: #64748b;
    }
    .not-found mat-icon { font-size: 64px; width: 64px; height: 64px; color: #94a3b8; }
    .not-found h1 { margin: 0; font-size: 72px; font-weight: 700; color: #1e293b; }
    .not-found p { margin: 0; font-size: 18px; }
  `],
})
export class NotFoundComponent {}
