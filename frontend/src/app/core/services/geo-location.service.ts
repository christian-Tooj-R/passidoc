import { Injectable } from '@angular/core';
import { Observable, throwError, from } from 'rxjs';

export interface GeoCoords { latitude: number; longitude: number; accuracy: number; }

@Injectable({ providedIn: 'root' })
export class GeoLocationService {

  /** Demande la position GPS du navigateur */
  getCurrentPosition(): Observable<GeoCoords> {
    if (!navigator.geolocation) {
      return throwError(() => new Error('La géolocalisation n\'est pas supportée par ce navigateur.'));
    }
    return from(
      new Promise<GeoCoords>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          err => {
            const msg: Record<number, string> = {
              1: 'Permission de géolocalisation refusée. Autorisez l\'accès dans les paramètres du navigateur.',
              2: 'Position introuvable. Vérifiez votre connexion GPS.',
              3: 'Délai de localisation dépassé. Réessayez.',
            };
            reject(new Error(msg[err.code] ?? 'Erreur de géolocalisation.'));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      })
    );
  }

  /** Distance en mètres entre deux points GPS (formule Haversine) */
  distanceTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  formatDistance(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  }
}
