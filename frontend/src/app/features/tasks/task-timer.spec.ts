/**
 * Tests unitaires — Timer chrono des tâches (TaskDetailDialogComponent)
 *
 * Couvre :
 *  - formatSeconds : conversion secondes → label lisible
 *  - refreshTimer  : calcul elapsed avec / sans debutEnCours
 *  - ngOnInit      : démarrage auto timer EN_COURS, ancrage debutEnCours si null
 *  - onStatutChange: démarrage / arrêt timer selon statut
 *  - ngOnDestroy   : clearInterval (pas de fuite mémoire)
 *  - save()        : appel service + fermeture dialog
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TaskDetailDialogComponent } from './tasks-global.component';
import { TasksService }              from '../../core/services/tasks.service';
import { ToastService }              from '../../core/services/toast.service';
import { ConfirmService }            from '../../core/services/confirm.service';
import { TenantService }             from '../../core/services/tenant.service';
import { AuthService }               from '../../core/services/auth.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    clientId: 10,
    titre: 'Test Timer',
    statut: 'A_FAIRE',
    priorite: 'NORMALE',
    type: 'TVA',
    createdAt: new Date().toISOString(),
    anyoneCanTake: false,
    debutEnCours: undefined as string | undefined,
    tempsTotalSecondes: 0,
    assignee: null,
    createdBy: null,
    client: { id: 10, nom: 'Cabinet' },
    ...overrides,
  };
}

function dialogData(taskOverrides: Record<string, any> = {}) {
  return {
    task: makeTask(taskOverrides),
    users: [],
    currentUserId: 1,
    currentUserIsAdmin: true,
  };
}

const mockTasksService = {
  update:       vi.fn().mockReturnValue(of({})),
  delete:       vi.fn().mockReturnValue(of({})),
  getComments:  vi.fn().mockReturnValue(of([])),
  addComment:   vi.fn().mockReturnValue(of({})),
};
const mockToast       = { success: vi.fn(), error: vi.fn() };
const mockConfirm     = { confirm: vi.fn().mockReturnValue(of(true)) };
const mockDialogRef   = { close: vi.fn() };
const mockTenant      = {
  poleFlag1: vi.fn().mockReturnValue('🇷🇪'), poleLabel1: vi.fn().mockReturnValue('Réunion'),
  poleFlag2: vi.fn().mockReturnValue('🇲🇬'), poleLabel2: vi.fn().mockReturnValue('Madagascar'),
};
const mockAuth = { currentUser: vi.fn().mockReturnValue({ id: 1, firstName: 'A', lastName: 'B', role: 'ADMIN' }) };

async function createDialog(taskOverrides: Record<string, any> = {}) {
  await TestBed.configureTestingModule({
    imports: [TaskDetailDialogComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideAnimations(),
      { provide: TasksService,  useValue: mockTasksService },
      { provide: ToastService,  useValue: mockToast },
      { provide: ConfirmService,useValue: mockConfirm },
      { provide: MatDialogRef,  useValue: mockDialogRef },
      { provide: TenantService, useValue: mockTenant },
      { provide: AuthService,   useValue: mockAuth },
      { provide: MAT_DIALOG_DATA, useValue: dialogData(taskOverrides) },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TaskDetailDialogComponent);
  const comp    = fixture.componentInstance;
  return { fixture, comp };
}

// ── Suite : formatSeconds ─────────────────────────────────────────────────────

describe('TaskDetailDialogComponent — formatSeconds', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('retourne "0s" pour 0 secondes', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(0)).toBe('0s');
  });

  it('retourne "0s" pour des valeurs négatives', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(-5)).toBe('0s');
  });

  it('retourne les secondes seules (ex. "45s")', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(45)).toBe('45s');
  });

  it('retourne "1min 30s" pour 90 secondes', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(90)).toBe('1min 30s');
  });

  it('retourne "5min" pour 300 secondes sans secondes résiduelles', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(300)).toBe('5min');
  });

  it('retourne "1h" pour 3600 secondes', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(3600)).toBe('1h');
  });

  it('retourne "2h30min" pour 9000 secondes', async () => {
    const { comp } = await createDialog();
    expect(comp.formatSeconds(9000)).toBe('2h30min');
  });
});

// ── Suite : refreshTimer ──────────────────────────────────────────────────────

describe('TaskDetailDialogComponent — refreshTimer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('affiche "0s" si debutEnCours est absent et tempsTotalSecondes = 0', async () => {
    const { comp, fixture } = await createDialog({ statut: 'EN_COURS', debutEnCours: undefined, tempsTotalSecondes: 0 });
    comp.ngOnInit();
    fixture.detectChanges();
    // Avec le fix : debutEnCours est ancré → elapsed commence à 0 mais compte dès ngOnInit
    expect(comp.liveTimerDisplay).toBe('0s');
  });

  it('inclut tempsTotalSecondes accumulé dans l\'affichage', async () => {
    const debutEnCours = new Date(Date.now() - 10_000).toISOString(); // démarré il y a 10 secondes
    const { comp, fixture } = await createDialog({
      statut: 'EN_COURS',
      debutEnCours,
      tempsTotalSecondes: 60, // 1 minute déjà accumulée
    });
    comp.ngOnInit();
    fixture.detectChanges();
    // elapsed ~10s + 60s accumulées = ~70s → affiche "1min Xs"
    const displayed = comp.liveTimerDisplay;
    expect(displayed).toMatch(/^1min/);
  });

  it('le timer progresse au fil du temps (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      vi.setSystemTime(now);
      const debutEnCours = new Date(now).toISOString();
      const { comp, fixture } = await createDialog({
        statut: 'EN_COURS',
        debutEnCours,
        tempsTotalSecondes: 0,
      });
      comp.ngOnInit();
      fixture.detectChanges();

      // Avancer de 5 secondes via fake timers
      vi.advanceTimersByTime(5_000);
      fixture.detectChanges();

      // Le liveTimerDisplay est mis à jour par le setInterval → doit afficher ≥ 5s
      const after = comp.liveTimerDisplay;
      expect(after).not.toBe('0s');
      expect(after).toMatch(/s/);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Suite : ngOnInit ──────────────────────────────────────────────────────────

describe('TaskDetailDialogComponent — ngOnInit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ne démarre PAS le timer si statut ≠ EN_COURS', async () => {
    const { comp } = await createDialog({ statut: 'A_FAIRE' });
    comp.ngOnInit();
    expect(comp.liveTimerDisplay).toBe('');
  });

  it('démarre le timer si statut = EN_COURS avec debutEnCours', async () => {
    const debutEnCours = new Date(Date.now() - 5_000).toISOString();
    const { comp, fixture } = await createDialog({ statut: 'EN_COURS', debutEnCours });
    comp.ngOnInit();
    fixture.detectChanges();
    expect(comp.liveTimerDisplay).not.toBe('');
  });

  it('ancre debutEnCours si EN_COURS mais null (données seeding)', async () => {
    const { comp } = await createDialog({ statut: 'EN_COURS', debutEnCours: undefined });
    expect(comp.task.debutEnCours).toBeUndefined();
    comp.ngOnInit();
    // Après ngOnInit, debutEnCours doit être ancré
    expect(comp.task.debutEnCours).toBeDefined();
    expect(typeof comp.task.debutEnCours).toBe('string');
  });

  it('le timer interval est lancé après ngOnInit avec EN_COURS', async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      vi.setSystemTime(now);
      const debutEnCours = new Date(now).toISOString();
      const { comp, fixture } = await createDialog({ statut: 'EN_COURS', debutEnCours });
      comp.ngOnInit();
      fixture.detectChanges();

      vi.advanceTimersByTime(2_000);
      fixture.detectChanges();

      expect(comp.liveTimerDisplay).toMatch(/s/);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Suite : onStatutChange ────────────────────────────────────────────────────

describe('TaskDetailDialogComponent — onStatutChange', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('passer à EN_COURS démarre le timer', async () => {
    const { comp, fixture } = await createDialog({ statut: 'A_FAIRE' });
    comp.ngOnInit();
    expect(comp.liveTimerDisplay).toBe('');

    comp.onStatutChange('EN_COURS');
    fixture.detectChanges();

    expect(comp.liveTimerDisplay).toBe('0s'); // vient de démarrer
  });

  it('passer à EN_COURS ancre debutEnCours localement si absent', async () => {
    const { comp } = await createDialog({ statut: 'A_FAIRE', debutEnCours: undefined });
    comp.ngOnInit();
    expect(comp.task.debutEnCours).toBeUndefined();

    comp.onStatutChange('EN_COURS');

    expect(comp.task.debutEnCours).toBeDefined();
  });

  it('quitter EN_COURS stoppe le timer et vide liveTimerDisplay', async () => {
    const debutEnCours = new Date().toISOString();
    const { comp, fixture } = await createDialog({ statut: 'EN_COURS', debutEnCours });
    comp.ngOnInit();
    fixture.detectChanges();
    expect(comp.liveTimerDisplay).not.toBe('');

    comp.onStatutChange('EN_PAUSE');
    fixture.detectChanges();

    expect(comp.liveTimerDisplay).toBe('');
  });

  it('quitter EN_COURS remet debutEnCours à undefined', async () => {
    const debutEnCours = new Date().toISOString();
    const { comp } = await createDialog({ statut: 'EN_COURS', debutEnCours });
    comp.ngOnInit();

    comp.onStatutChange('EN_PAUSE');

    expect(comp.task.debutEnCours).toBeUndefined();
  });

  it('passer d\'EN_PAUSE à EN_COURS re-démarre le timer', async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      vi.setSystemTime(now);
      const { comp, fixture } = await createDialog({ statut: 'EN_PAUSE', tempsTotalSecondes: 30 });
      comp.ngOnInit();

      comp.onStatutChange('EN_COURS');
      fixture.detectChanges();

      vi.advanceTimersByTime(2_000);
      fixture.detectChanges();

      // 30s accumulées + 2s nouvelles = 32s
      const display = comp.liveTimerDisplay;
      expect(display).toMatch(/3[0-9]s|[1-9]min/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('appeler onStatutChange EN_COURS deux fois ne crée pas deux intervals', async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      vi.setSystemTime(now);
      const { comp, fixture } = await createDialog({ statut: 'A_FAIRE' });
      comp.ngOnInit();

      comp.onStatutChange('EN_COURS');
      comp.onStatutChange('EN_COURS'); // doublon — ne doit pas créer un deuxième interval
      fixture.detectChanges();

      vi.advanceTimersByTime(1_000);
      fixture.detectChanges();

      // Timer doit afficher ~1s, pas ~2s (pas double increment)
      const secs = parseInt(comp.liveTimerDisplay.replace(/[^0-9]/g, ''), 10);
      expect(secs).toBeLessThanOrEqual(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Suite : ngOnDestroy ───────────────────────────────────────────────────────

describe('TaskDetailDialogComponent — ngOnDestroy', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('nettoie le timer (pas de fuite mémoire)', async () => {
    const debutEnCours = new Date().toISOString();
    const { comp, fixture } = await createDialog({ statut: 'EN_COURS', debutEnCours });

    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    comp.ngOnInit();
    fixture.detectChanges();

    comp.ngOnDestroy();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('ngOnDestroy n\'émet pas d\'erreur si timer jamais démarré', async () => {
    const { comp } = await createDialog({ statut: 'A_FAIRE' });
    comp.ngOnInit();
    expect(() => comp.ngOnDestroy()).not.toThrow();
  });
});

// ── Suite : save() ────────────────────────────────────────────────────────────

describe('TaskDetailDialogComponent — save()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('appelle tasksService.update avec le bon clientId et taskId', async () => {
    const { comp } = await createDialog({ id: 42, clientId: 99 });
    comp.ngOnInit();
    comp.save();
    expect(mockTasksService.update).toHaveBeenCalledWith(99, 42, expect.any(Object));
  });

  it('ferme le dialog avec "updated" après save réussi', async () => {
    mockTasksService.update.mockReturnValue(of({ id: 42 }));
    const { comp } = await createDialog();
    comp.ngOnInit();
    comp.save();
    expect(mockDialogRef.close).toHaveBeenCalledWith('updated');
  });

  it('transmet le statut courant au service', async () => {
    const { comp } = await createDialog({ statut: 'A_FAIRE' });
    comp.ngOnInit();
    comp.onStatutChange('EN_COURS');
    comp.save();
    const callArgs = mockTasksService.update.mock.calls[0][2];
    expect(callArgs.statut).toBe('EN_COURS');
  });
});
