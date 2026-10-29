/**
 * Cloche : « vue » (badge) ≠ « lue » (surlignage). Ouvrir la cloche vide le badge, une nouvelle
 * notification le fait revenir à 1 ; « Tout marquer comme lu » et l'ouverture d'une
 * notification la marquent lue sur le serveur.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationStreamService } from './notification-stream.service';
import { AlertesService, AlerteFlux } from './alertes.service';
import { AuthService } from './auth.service';

const notif = (id: number, read = false) =>
  ({ id, type: 'CLIENT_ASSIGNED', message: `n${id}`, titre: '', clientId: 1, createdAt: '2026-10-29T10:00:00Z', read });
const alerte = (id: number) =>
  ({ id, type: 'RELEVE_BANCAIRE', mois: 1, annee: 2026, statut: 'MANQUANT', client: { id: 1, nom: 'A', site: 'EST' } } as AlerteFlux);

function configurer(userId = 7) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: userId }), getToken: () => null } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('NotificationStreamService — badge de la cloche', () => {
  let http: HttpTestingController;
  let svc: NotificationStreamService;

  const charger = (liste: any[]) => {
    svc = TestBed.inject(NotificationStreamService);
    (svc as any).loadFromApi();
    http.expectOne(r => r.url.endsWith('/notifications')).flush(liste);
  };

  beforeEach(() => { localStorage.clear(); http = configurer(); });
  afterEach(() => http.verify());

  it('ouvrir la cloche vide le badge sans marquer comme lu ; une nouvelle notification le remet à 1', () => {
    charger([notif(3), notif(2), notif(1, true)]);
    expect(svc.nonVuesCount()).toBe(2);

    svc.marquerVues();
    expect(svc.nonVuesCount()).toBe(0);
    expect(svc.unreadCount()).toBe(2);   // toujours surlignées : « Tout marquer comme lu » reste utile

    (svc as any).addNotification(notif(4));
    expect(svc.nonVuesCount()).toBe(1);
    svc.marquerVues();
    expect(svc.nonVuesCount()).toBe(0);
  });

  it('le badge vidé le reste après rechargement de la page (même utilisateur)', () => {
    charger([notif(3), notif(2)]);
    svc.marquerVues();

    http = configurer();
    charger([notif(3), notif(2)]);
    expect(svc.nonVuesCount()).toBe(0);

    http = configurer(8);                  // un autre utilisateur sur ce navigateur
    charger([notif(3), notif(2)]);
    expect(svc.nonVuesCount()).toBe(2);
  });

  it('« Tout marquer comme lu » et l\'ouverture d\'une notification passent par le serveur', () => {
    charger([notif(3), notif(2)]);
    svc.markRead(2);
    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/notifications/2/read')).flush({});
    expect(svc.notifications().find(n => n.id === 2)!.read).toBe(true);
    svc.markRead(2);                       // déjà lue : pas de nouvel appel

    svc.markAllRead();
    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/notifications/read-all')).flush({});
    expect(svc.unreadCount()).toBe(0);
  });
});

describe('AlertesService — badge de la cloche', () => {
  let http: HttpTestingController;

  beforeEach(() => { localStorage.clear(); http = configurer(); });
  afterEach(() => http.verify());

  it('les alertes vues ne comptent plus ; une nouvelle alerte compte 1, même après rechargement', () => {
    let svc = TestBed.inject(AlertesService);
    svc.refresh();
    http.expectOne(r => r.url.endsWith('/alertes')).flush([alerte(1), alerte(2)]);
    expect(svc.nonVuesCount()).toBe(2);
    svc.marquerVues();
    expect(svc.nonVuesCount()).toBe(0);
    expect(svc.count()).toBe(2);           // la liste de la cloche reste complète

    http = configurer();
    svc = TestBed.inject(AlertesService);
    svc.startPolling();
    http.expectOne(r => r.url.endsWith('/alertes')).flush([alerte(1), alerte(2), alerte(3)]);
    expect(svc.nonVuesCount()).toBe(1);
    svc.stopPolling();
  });
});
