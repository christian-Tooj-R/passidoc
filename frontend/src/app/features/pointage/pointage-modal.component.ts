import { Component, OnInit, OnDestroy, AfterViewInit, signal, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRippleModule } from '@angular/material/core';
import { PointageService, SiteLocation } from '../../core/services/pointage.service';
import { GeoLocationService, GeoCoords } from '../../core/services/geo-location.service';
import { AuthService } from '../../core/services/auth.service';
import * as L from 'leaflet';

type GeoState = 'idle' | 'loading' | 'ok' | 'too-far' | 'denied' | 'no-config';

@Component({
  selector: 'app-pointage-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatRippleModule],
  template: `
<div class="pm-wrap">

  <div class="pm-bg"></div>

  <div class="pm-content">

    <!-- Heure + date -->
    <div class="pm-time">{{ heure() }}</div>
    <div class="pm-date">{{ dateLabel() }}</div>

    <!-- Avatar -->
    <div class="pm-avatar">{{ initiales() }}</div>
    <h2 class="pm-title">{{ greet() }}, {{ prenom() }} !</h2>

    <!-- ── Zone géolocalisation ── -->
    <div class="pm-geo">

      @if (geoState() === 'loading') {
        <div class="geo-status geo-status--loading">
          <div class="geo-spinner"></div>
          <span>Vérification de votre localisation…</span>
        </div>
      }

      @if (geoState() === 'ok') {
        <div class="geo-status geo-status--ok">
          <mat-icon>check_circle</mat-icon>
          <span>Sur site — {{ distanceLabel() }}</span>
        </div>
      }

      @if (geoState() === 'too-far') {
        <div class="geo-status geo-status--far">
          <mat-icon>location_off</mat-icon>
          <span>Trop loin du bureau ({{ distanceLabel() }})</span>
        </div>
      }

      @if (geoState() === 'denied') {
        <div class="geo-status geo-status--denied">
          <mat-icon>gps_off</mat-icon>
          <span>{{ geoError() }}</span>
        </div>
      }

      @if (geoState() === 'no-config') {
        <div class="geo-status geo-status--noconfig">
          <mat-icon>location_on</mat-icon>
          <span>Aucune zone configurée — pointage libre</span>
        </div>
      }

      <!-- Carte Leaflet (visible si on a des coordonnées) -->
      @if (userCoords() && siteLocation()) {
        <div class="geo-map-wrap">
          <div #mapContainer class="geo-map"></div>
          <div class="geo-map-legend">
            <span class="legend-dot legend-dot--office"></span> Bureau
            <span class="legend-dot legend-dot--user"></span> Vous
          </div>
        </div>
      }

    </div>

    <!-- Message sous la carte si trop loin -->
    @if (geoState() === 'too-far') {
      <p class="pm-sub pm-sub--warn">
        Vous devez être dans un rayon de <strong>{{ siteLocation()?.radiusMeters }} m</strong>
        du bureau pour pointer.
      </p>
    }

    @if (geoState() === 'ok' || geoState() === 'no-config') {
      <p class="pm-sub">Pointez votre arrivée pour commencer la journée</p>
    }

    <!-- Bouton pointer -->
    <button class="pm-btn"
            matRipple
            [disabled]="!canPointer()"
            (click)="pointer()">
      <mat-icon>fingerprint</mat-icon>
      <span>{{ loading() ? 'Enregistrement…' : 'Je suis arrivé' }}</span>
    </button>

    <!-- Réessayer géolocalisation -->
    @if (geoState() === 'denied' || geoState() === 'too-far') {
      <button class="pm-retry" (click)="checkGeo()">
        <mat-icon>refresh</mat-icon> Réessayer
      </button>
    }

  </div>
</div>
  `,
  styles: [`
    .pm-wrap {
      position: relative; width: 380px; border-radius: 24px;
      overflow: hidden;
      background: linear-gradient(145deg, #1e3a5f 0%, #1D4ED8 100%);
      color: #fff;
    }
    .pm-bg {
      position: absolute; inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='250' cy='50' r='120' fill='rgba(255,255,255,.06)'/%3E%3Ccircle cx='30' cy='260' r='90' fill='rgba(255,255,255,.04)'/%3E%3C/svg%3E") no-repeat right top;
      pointer-events: none;
    }
    .pm-content {
      position: relative; display: flex; flex-direction: column;
      align-items: center; padding: 32px 28px 28px; gap: 8px; text-align: center;
    }
    .pm-time { font-size: 2.8rem; font-weight: 800; letter-spacing: -2px; line-height: 1; }
    .pm-date { font-size: 0.80rem; opacity: .7; text-transform: capitalize; }
    .pm-avatar {
      width: 58px; height: 58px; border-radius: 50%; margin-top: 4px;
      background: rgba(255,255,255,.20); border: 3px solid rgba(255,255,255,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem; font-weight: 700;
    }
    .pm-title { margin: 0; font-size: 1.2rem; font-weight: 700; }
    .pm-sub { margin: 0; font-size: 0.82rem; opacity: .75; max-width: 260px; line-height: 1.4; }
    .pm-sub--warn { color: #FDE68A; opacity: 1; font-size: 0.80rem; }
    .pm-sub--warn strong { font-weight: 700; }

    /* ── Zone géolocalisation ──────────────────────── */
    .pm-geo { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; }

    .geo-status {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .geo-status--loading { background: rgba(255,255,255,.15); color: rgba(255,255,255,.9); }
    .geo-status--ok      { background: rgba(34,197,94,.25);  color: #86EFAC; }
    .geo-status--far     { background: rgba(239,68,68,.25);  color: #FCA5A5; }
    .geo-status--denied  { background: rgba(251,146,60,.25); color: #FDE68A; }
    .geo-status--noconfig { background: rgba(255,255,255,.12); color: rgba(255,255,255,.8); }

    .geo-spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3);
      border-top-color: rgba(255,255,255,.9); border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Carte Leaflet ───────────────────────────── */
    .geo-map-wrap { width: 100%; border-radius: 12px; overflow: hidden; position: relative; }
    .geo-map { width: 100%; height: 160px; border-radius: 12px; }
    .geo-map-legend {
      position: absolute; bottom: 6px; left: 8px;
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.92); border-radius: 6px;
      padding: 3px 8px; font-size: 11px; font-weight: 600; color: #374151;
      z-index: 1000;
    }
    .legend-dot {
      width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0;
    }
    .legend-dot--office { background: #1D4ED8; border: 2px solid white; }
    .legend-dot--user   { background: #22C55E; border: 2px solid white; }

    /* ── Bouton pointer ──────────────────────────── */
    .pm-btn {
      margin-top: 10px; display: flex; align-items: center; gap: 10px;
      padding: 13px 34px; border-radius: 50px;
      background: rgba(255,255,255,.20); border: 2px solid rgba(255,255,255,.5);
      color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer;
      transition: background .2s, transform .1s; backdrop-filter: blur(4px);
      &:hover:not(:disabled) { background: rgba(255,255,255,.30); transform: translateY(-1px); }
      &:disabled { opacity: .4; cursor: not-allowed; }
      mat-icon { font-size: 1.3rem; width: 1.3rem; height: 1.3rem; }
    }

    .pm-retry {
      display: flex; align-items: center; gap: 5px;
      background: none; border: none; color: rgba(255,255,255,.65);
      font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit;
      padding: 4px 8px; border-radius: 6px; transition: color .15s;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { color: rgba(255,255,255,.95); }
    }
  `],
})
export class PointageModalComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  loading       = signal(false);
  heure         = signal('');
  geoState      = signal<GeoState>('idle');
  userCoords    = signal<GeoCoords | null>(null);
  siteLocation  = signal<SiteLocation | null>(null);
  distanceM     = signal<number | null>(null);
  geoError      = signal('');

  private timer?: ReturnType<typeof setInterval>;
  private map?: L.Map;

  private dialogRef = inject(MatDialogRef<PointageModalComponent>);
  private svc       = inject(PointageService);
  private geo       = inject(GeoLocationService);
  private auth      = inject(AuthService);
  private snack     = inject(MatSnackBar);

  ngOnInit() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
    this.checkGeo();
  }

  ngAfterViewInit() {
    // La carte sera initialisée après récupération des coordonnées
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.map?.remove();
  }

  checkGeo() {
    const user = this.auth.currentUser();
    if (!user) return;

    this.geoState.set('loading');
    this.userCoords.set(null);
    this.distanceM.set(null);

    // 1. Récupérer la config du site
    this.svc.getSiteLocation(user.site).subscribe({
      next: (siteLoc) => {
        if (!siteLoc) {
          // Pas de configuration → pointage libre
          this.siteLocation.set(null);
          this.geoState.set('no-config');
          return;
        }
        this.siteLocation.set(siteLoc);

        // 2. Demander la position GPS
        this.geo.getCurrentPosition().subscribe({
          next: (coords) => {
            this.userCoords.set(coords);
            const dist = this.geo.distanceTo(
              coords.latitude, coords.longitude,
              Number(siteLoc.latitude), Number(siteLoc.longitude),
            );
            this.distanceM.set(dist);

            if (dist <= Number(siteLoc.radiusMeters)) {
              this.geoState.set('ok');
            } else {
              this.geoState.set('too-far');
            }

            // Initialiser la carte après mise à jour du DOM
            setTimeout(() => this.initMap(), 100);
          },
          error: (err) => {
            this.geoError.set(err.message);
            this.geoState.set('denied');
          },
        });
      },
      error: () => {
        // Erreur réseau → pointage libre
        this.siteLocation.set(null);
        this.geoState.set('no-config');
      },
    });
  }

  private initMap() {
    const user   = this.userCoords();
    const site   = this.siteLocation();
    if (!user || !site || !this.mapContainer?.nativeElement) return;

    this.map?.remove();

    const siteLat = Number(site.latitude);
    const siteLng = Number(site.longitude);

    // Centre entre les deux points
    const centerLat = (user.latitude + siteLat) / 2;
    const centerLng = (user.longitude + siteLng) / 2;

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: false, attributionControl: false,
    }).setView([centerLat, centerLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    // Cercle de rayon autorisé (autour du bureau)
    L.circle([siteLat, siteLng], {
      radius: Number(site.radiusMeters),
      color: '#1D4ED8', fillColor: '#1D4ED8', fillOpacity: 0.10, weight: 2,
    }).addTo(this.map);

    // Pin bureau (bleu)
    L.circleMarker([siteLat, siteLng], {
      radius: 8, color: 'white', fillColor: '#1D4ED8', fillOpacity: 1, weight: 2,
    }).addTo(this.map).bindTooltip('Bureau', { permanent: false });

    // Pin utilisateur (vert ou rouge)
    const isOk = this.geoState() === 'ok';
    L.circleMarker([user.latitude, user.longitude], {
      radius: 8, color: 'white', fillColor: isOk ? '#22C55E' : '#EF4444', fillOpacity: 1, weight: 2,
    }).addTo(this.map).bindTooltip('Vous', { permanent: false });

    // Ajuster le zoom pour voir les deux pins
    const bounds = L.latLngBounds(
      [siteLat, siteLng],
      [user.latitude, user.longitude],
    );
    this.map.fitBounds(bounds.pad(0.5));
  }

  canPointer(): boolean {
    if (this.loading()) return false;
    const s = this.geoState();
    return s === 'ok' || s === 'no-config';
  }

  distanceLabel(): string {
    const d = this.distanceM();
    return d !== null ? this.geo.formatDistance(d) : '';
  }

  pointer() {
    if (!this.canPointer()) return;
    this.loading.set(true);
    const coords = this.userCoords();
    this.svc.pointer(coords?.latitude, coords?.longitude).subscribe({
      next: () => this.dialogRef.close(true),
      error: (e) => {
        this.snack.open(e.error?.message ?? 'Erreur', undefined, { duration: 4000 });
        this.loading.set(false);
      },
    });
  }

  private tick() {
    this.heure.set(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }

  dateLabel() {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  prenom()    { return this.auth.currentUser()?.firstName ?? ''; }
  initiales() {
    const u = this.auth.currentUser();
    return u ? (u.firstName[0] + u.lastName[0]).toUpperCase() : '?';
  }
  greet() {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  }
}
