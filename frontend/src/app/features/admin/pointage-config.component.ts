import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PointageService, SiteLocation } from '../../core/services/pointage.service';
import { GeoLocationService } from '../../core/services/geo-location.service';

interface SiteForm {
  site: 'REUNION' | 'MADAGASCAR';
  label: string;
  flag: string;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  adresse: string;
  loading: boolean;
  saving: boolean;
  locating: boolean;
  saved: boolean;
}

@Component({
  selector: 'app-pointage-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
<div class="page">

  <div class="page-header">
    <div class="page-header__left">
      <h2>Configuration du pointage</h2>
      <p class="page-header__sub">Définissez la position GPS de chaque bureau. Le bouton "Pointer mon arrivée" ne sera actif que si le collaborateur se trouve dans le rayon configuré.</p>
    </div>
  </div>

  <div class="sites-grid">
    @for (s of sites(); track s.site) {
      <div class="site-card">
        <div class="site-card__header">
          <span class="site-flag">{{ s.flag }}</span>
          <div>
            <span class="site-name">{{ s.label }}</span>
            <span class="site-code">{{ s.site }}</span>
          </div>
          @if (s.loading) {
            <div class="loading-dot"></div>
          }
        </div>

        @if (!s.loading) {
          <div class="site-card__body">

            <!-- Bouton position actuelle -->
            <button class="btn-locate" [class.btn-locate--loading]="s.locating"
                    (click)="prendrePosition(s)" [disabled]="s.locating || s.saving">
              <mat-icon>my_location</mat-icon>
              <span>{{ s.locating ? 'Localisation…' : 'Utiliser ma position actuelle' }}</span>
            </button>

            <!-- Coordonnées -->
            <div class="form-row">
              <div class="form-field">
                <label>Latitude</label>
                <input type="number" step="0.0000001" placeholder="-20.8823"
                       [(ngModel)]="s.latitude" (ngModelChange)="s.saved = false" />
              </div>
              <div class="form-field">
                <label>Longitude</label>
                <input type="number" step="0.0000001" placeholder="55.4504"
                       [(ngModel)]="s.longitude" (ngModelChange)="s.saved = false" />
              </div>
            </div>

            <!-- Rayon -->
            <div class="form-field">
              <label>Rayon autorisé (mètres)</label>
              <div class="radius-row">
                <input type="range" min="50" max="2000" step="50"
                       [(ngModel)]="s.radiusMeters" (ngModelChange)="s.saved = false" />
                <span class="radius-val">{{ s.radiusMeters }} m</span>
              </div>
              <p class="field-hint">Les collaborateurs à plus de {{ s.radiusMeters }} m du bureau ne pourront pas pointer.</p>
            </div>

            <!-- Adresse -->
            <div class="form-field">
              <label>Adresse (optionnel)</label>
              <input type="text" placeholder="14 rue des Flamboyants, Saint-Denis"
                     [(ngModel)]="s.adresse" (ngModelChange)="s.saved = false" />
            </div>

            <!-- Lien vérification carte -->
            @if (s.latitude && s.longitude) {
              <a class="map-link"
                 [href]="'https://www.google.com/maps?q=' + s.latitude + ',' + s.longitude"
                 target="_blank" rel="noopener">
                <mat-icon>open_in_new</mat-icon>
                Vérifier sur Google Maps
              </a>
            }

            <!-- Sauvegarde -->
            <div class="site-card__footer">
              @if (s.saved) {
                <span class="saved-badge"><mat-icon>check_circle</mat-icon> Enregistré</span>
              }
              <button class="btn-save" (click)="sauvegarder(s)"
                      [disabled]="s.saving || !s.latitude || !s.longitude">
                <mat-icon>{{ s.saving ? 'hourglass_empty' : 'save' }}</mat-icon>
                {{ s.saving ? 'Enregistrement…' : 'Enregistrer' }}
              </button>
            </div>

          </div>
        }
      </div>
    }
  </div>

  <!-- Info générale -->
  <div class="info-card">
    <mat-icon>info</mat-icon>
    <div>
      <strong>Comment ça fonctionne</strong>
      <p>Si aucune position n'est configurée pour un site, les collaborateurs de ce site peuvent pointer sans contrainte de localisation. Dès qu'une position est enregistrée, la géolocalisation est obligatoire et le bouton est désactivé en dehors du rayon.</p>
    </div>
  </div>

</div>
  `,
  styles: [`
    .page { padding: 24px 28px; max-width: 860px; }

    .page-header { margin-bottom: 28px; }
    h2 { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #111827; letter-spacing: -.2px; }
    .page-header__sub { margin: 0; font-size: 13px; color: #6B7280; line-height: 1.5; }

    .sites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px; }

    .site-card {
      background: #fff; border: 1px solid #E5E7EB; border-radius: 12px;
      overflow: hidden;
    }
    .site-card__header {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 18px; border-bottom: 1px solid #F3F4F6;
      background: #FAFAFA;
    }
    .site-flag { font-size: 26px; line-height: 1; }
    .site-name { display: block; font-size: 14px; font-weight: 700; color: #111827; }
    .site-code { display: block; font-size: 11px; color: #9CA3AF; margin-top: 1px; }
    .loading-dot {
      margin-left: auto; width: 8px; height: 8px; border-radius: 50%;
      background: #162351; animation: pulse 1s ease infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

    .site-card__body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }

    .btn-locate {
      display: flex; align-items: center; gap: 7px;
      padding: 8px 14px; border: 1px dashed #D1D5DB; border-radius: 7px;
      background: #F9FAFB; color: #374151; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all .13s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; color: #162351; }
      &:hover:not([disabled]) { border-color: #162351; background: #EEF1FA; }
      &[disabled] { opacity: .6; cursor: not-allowed; }
    }
    .btn-locate--loading mat-icon { animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    .form-field { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: .04em; }
    input[type=text], input[type=number] {
      border: 1px solid #E5E7EB; border-radius: 6px; padding: 7px 10px;
      font-size: 13px; color: #111827; outline: none;
      transition: border-color .13s, box-shadow .13s;
      &:focus { border-color: #162351; box-shadow: 0 0 0 3px rgba(22,35,81,.08); }
    }

    .radius-row { display: flex; align-items: center; gap: 10px; }
    input[type=range] {
      flex: 1; accent-color: #162351; cursor: pointer; height: 4px;
    }
    .radius-val { font-size: 13px; font-weight: 700; color: #162351; min-width: 52px; text-align: right; }
    .field-hint { margin: 2px 0 0; font-size: 11.5px; color: #9CA3AF; }

    .map-link {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; color: #2563EB; text-decoration: none;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { text-decoration: underline; }
    }

    .site-card__footer {
      display: flex; align-items: center; justify-content: flex-end;
      gap: 10px; padding-top: 10px; border-top: 1px solid #F3F4F6; margin-top: 4px;
    }
    .saved-badge {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; color: #059669; font-weight: 500;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .btn-save {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; border: none; border-radius: 7px;
      background: #162351; color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background .13s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover:not([disabled]) { background: #1e3170; }
      &[disabled] { opacity: .5; cursor: not-allowed; }
    }

    .info-card {
      display: flex; gap: 12px; align-items: flex-start;
      background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px;
      padding: 14px 16px;
      mat-icon { color: #2563EB; flex-shrink: 0; margin-top: 2px; }
      strong { display: block; font-size: 13px; color: #1E40AF; margin-bottom: 3px; }
      p { margin: 0; font-size: 12.5px; color: #3B82F6; line-height: 1.5; }
    }
  `],
})
export class PointageConfigComponent implements OnInit {
  private svc  = inject(PointageService);
  private geo  = inject(GeoLocationService);
  private snack = inject(MatSnackBar);

  sites = signal<SiteForm[]>([
    { site: 'REUNION',    label: 'La Réunion',  flag: '🇷🇪', latitude: '', longitude: '', radiusMeters: 300, adresse: '', loading: true, saving: false, locating: false, saved: false },
    { site: 'MADAGASCAR', label: 'Madagascar',  flag: '🇲🇬', latitude: '', longitude: '', radiusMeters: 300, adresse: '', loading: true, saving: false, locating: false, saved: false },
  ]);

  ngOnInit() {
    this.sites().forEach(s => this.charger(s));
  }

  private charger(s: SiteForm) {
    this.svc.getSiteLocation(s.site).subscribe({
      next: loc => {
        if (loc) {
          s.latitude     = String(loc.latitude);
          s.longitude    = String(loc.longitude);
          s.radiusMeters = loc.radiusMeters;
          s.adresse      = loc.adresse ?? '';
        }
        s.loading = false;
        this.sites.update(l => [...l]);
      },
      error: () => { s.loading = false; this.sites.update(l => [...l]); },
    });
  }

  prendrePosition(s: SiteForm) {
    s.locating = true;
    this.sites.update(l => [...l]);
    this.geo.getCurrentPosition().subscribe({
      next: coords => {
        s.latitude  = String(coords.latitude);
        s.longitude = String(coords.longitude);
        s.locating  = false;
        s.saved     = false;
        this.sites.update(l => [...l]);
      },
      error: (err: Error) => {
        s.locating = false;
        this.sites.update(l => [...l]);
        this.snack.open(err.message, undefined, { duration: 4000 });
      },
    });
  }

  sauvegarder(s: SiteForm) {
    const lat = parseFloat(s.latitude);
    const lng = parseFloat(s.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      this.snack.open('Coordonnées invalides', undefined, { duration: 3000 });
      return;
    }
    s.saving = true;
    this.sites.update(l => [...l]);
    this.svc.upsertSiteLocation(s.site, {
      latitude: lat, longitude: lng,
      radiusMeters: s.radiusMeters,
      adresse: s.adresse || undefined,
    }).subscribe({
      next: () => {
        s.saving = false;
        s.saved  = true;
        this.sites.update(l => [...l]);
        this.snack.open(`Position ${s.label} enregistrée`, undefined, { duration: 2500 });
      },
      error: () => {
        s.saving = false;
        this.sites.update(l => [...l]);
        this.snack.open('Erreur lors de l\'enregistrement', undefined, { duration: 3000 });
      },
    });
  }
}
