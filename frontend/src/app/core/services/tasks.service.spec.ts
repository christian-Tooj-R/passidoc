/**
 * TasksService — saisie automatique du temps quand une tâche passe à « Terminée » :
 * heure locale envoyée au serveur, route globale pour une tâche sans dossier, minuteur de la
 * tâche abandonné une fois son temps saisi, message à l'utilisateur.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TasksService } from './tasks.service';
import { ToastService } from './toast.service';
import { TimerService } from './saisie-temps.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('TasksService — tâche terminée', () => {
  let service: TasksService;
  let http: HttpTestingController;
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const timer = { oublierTache: vi.fn() };
  const auth = { currentUser: () => ({ id: 7 }) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: TimerService, useValue: timer },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(TasksService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.useRealTimers(); });

  it("envoie la date et l'heure locales et signale la saisie créée", () => {
    service.update(4, 12, { statut: 'TERMINEE' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/clients/4/tasks/12`);
    expect(req.request.body.statut).toBe('TERMINEE');
    expect(req.request.body.dateFinLocale).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(req.request.body.heureFinLocale).toMatch(/^\d{2}:\d{2}$/);
    req.flush({ id: 12, saisieAuto: { creee: true, saisieId: 90, dureeHeures: 1.5, date: '2026-10-27', collaborateurId: 7, collaborateur: 'Julie R' } });

    expect(timer.oublierTache).toHaveBeenCalledWith(12);
    vi.runAllTimers();
    expect(toast.success).toHaveBeenCalledWith('Tâche terminée : 1h30 ajoutée à votre saisie des temps');
  });

  it("nomme le collaborateur quand la saisie est faite pour quelqu'un d'autre", () => {
    service.update(4, 12, { statut: 'TERMINEE' }).subscribe();
    http.expectOne(`${environment.apiUrl}/clients/4/tasks/12`)
      .flush({ id: 12, saisieAuto: { creee: true, saisieId: 91, dureeHeures: 0.5, date: '2026-10-27', collaborateurId: 9, collaborateur: 'Marc T' } });
    vi.runAllTimers();
    expect(toast.success).toHaveBeenCalledWith('Tâche terminée : 0h30 ajoutée à la saisie des temps de Marc T');
  });

  it('garde le minuteur si le temps n’a pas pu être saisi, et le dit', () => {
    service.update(4, 12, { statut: 'TERMINEE' }).subscribe();
    http.expectOne(`${environment.apiUrl}/clients/4/tasks/12`)
      .flush({ id: 12, saisieAuto: { creee: false, motif: 'REFUSEE', message: 'Vous ne pouvez pas saisir plus de 2.00h' } });
    vi.runAllTimers();
    expect(timer.oublierTache).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Tâche terminée, mais temps non saisi : Vous ne pouvez pas saisir plus de 2.00h');
  });

  it('tâche sans dossier : route globale ; pas d’heure de fin hors terminaison', () => {
    service.update(null, 13, { statut: 'EN_COURS' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/tasks/13`);
    expect(req.request.body).toEqual({ statut: 'EN_COURS' });
    req.flush({ id: 13 });
    vi.runAllTimers();
    expect(toast.success).not.toHaveBeenCalled();
    expect(timer.oublierTache).not.toHaveBeenCalled();
  });
});

describe('TimerService.oublierTache', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* indisponible */ } });

  it('arrête le minuteur actif sur la tâche', () => {
    const t = new TimerService();
    t.startWithTask({ taskId: 5, clientId: 1, taskTitre: 'A' } as any);
    t.oublierTache(5);
    expect(t.status()).toBe('idle');
    expect(t.activeTaskCtx()).toBeNull();
  });

  it('oublie le temps d’une tâche en pause sans toucher à la tâche active', () => {
    const t = new TimerService();
    t.startWithTask({ taskId: 5, clientId: 1, taskTitre: 'A' } as any);
    t.startWithTask({ taskId: 6, clientId: 1, taskTitre: 'B' } as any);   // 5 passe en pause
    expect(t.pausedTasks()[5]).toBeTruthy();
    t.oublierTache(5);
    expect(t.pausedTasks()[5]).toBeUndefined();
    expect(t.activeTaskCtx()?.taskId).toBe(6);
    expect(t.status()).toBe('running');
    t.stop();
  });
});
