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
      <div class="not-found__bg-orb not-found__bg-orb--1"></div>
      <div class="not-found__bg-orb not-found__bg-orb--2"></div>

      <div class="not-found__card">
        <div class="not-found__icon">
          <mat-icon>search_off</mat-icon>
        </div>
        <div class="not-found__code">404</div>
        <h1>Page introuvable</h1>
        <p>La page que vous recherchez n'existe pas ou a été déplacée.</p>
        <a mat-flat-button routerLink="/dashboard" class="btn-home">
          <mat-icon>home</mat-icon>
          Retour au tableau de bord
        </a>
      </div>

      <div class="not-found__brand">Passidoc · AFYM Audit Expertise</div>
    </div>
  `,
  styles: [`
    .not-found {
      min-height: 100vh;
      background: linear-gradient(145deg, #0f2040 0%, #1e3a8a 55%, #312e81 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }

    .not-found__bg-orb {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.05);
      pointer-events: none;
    }
    .not-found__bg-orb--1 { width: 500px; height: 500px; top: -150px; right: -150px; }
    .not-found__bg-orb--2 { width: 350px; height: 350px; bottom: -100px; left: -100px; }

    .not-found__card {
      position: relative; z-index: 1;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 24px;
      padding: 56px 64px;
      text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      max-width: 440px; width: 90%;
    }

    .not-found__icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 8px;
    }
    .not-found__icon mat-icon { font-size: 36px; width: 36px; height: 36px; color: white; }

    .not-found__code {
      font-size: 80px; font-weight: 800; color: white;
      letter-spacing: -4px; line-height: 1;
      opacity: 0.9;
    }

    h1 {
      font-size: 22px; font-weight: 700; color: white;
      margin: 0; letter-spacing: -0.3px;
    }

    p {
      font-size: 15px; color: rgba(255,255,255,0.6);
      margin: 0; line-height: 1.6;
    }

    .btn-home {
      margin-top: 8px;
      border-radius: 12px !important;
      background: rgba(255,255,255,0.15) !important;
      color: white !important;
      font-weight: 600;
      padding: 10px 24px !important;
      height: auto !important;
      border: 1px solid rgba(255,255,255,0.25) !important;
      display: flex; align-items: center; gap: 8px;
      transition: all 0.18s !important;
    }
    .btn-home:hover { background: rgba(255,255,255,0.22) !important; }
    .btn-home mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .not-found__brand {
      position: relative; z-index: 1;
      margin-top: 32px;
      font-size: 12px; color: rgba(255,255,255,0.3);
    }
  `],
})
export class NotFoundComponent {}
