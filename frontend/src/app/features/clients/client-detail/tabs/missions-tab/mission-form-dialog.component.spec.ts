import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { MissionFormDialogComponent, MissionFormData } from './mission-form-dialog.component';
import { MissionsService } from '../../../../../core/services/missions.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { Mission } from '../../../../../core/models/mission.model';

const svc = {
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  historique: vi.fn().mockReturnValue(of([{ id: 1, ancienStatut: null, nouveauStatut: 'PROPOSEE', auteurNom: 'Ada', createdAt: '2026-10-27T10:00:00Z' }])),
};
const ref = { close: vi.fn() };
const users = [{ id: 7, firstName: 'Julie', lastName: 'R' }, { id: 8, firstName: 'Ancien', lastName: 'Collab', isActive: false }];
const mission = (o: Partial<Mission> = {}): Mission => ({
  id: 5, titre: 'Plan de trésorerie', honoraires: 2700, statut: 'PROPOSEE', cycle: 'TRE', exerciceId: 40, dateRelance: '2026-11-15',
  responsableId: 7, responsable: { id: 7, firstName: 'Julie', lastName: 'R' }, archivee: false, aRelancer: false,
  createdAt: '', updatedAt: '', ...o,
});

async function creer(data: Partial<MissionFormData>) {
  await TestBed.configureTestingModule({
    imports: [MissionFormDialogComponent],
    providers: [
      provideAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: { clientId: 60, exerciceId: 40, annee: 2026, utilisateurs: users, peutEcrire: true, cycleModifiable: false, ...data } },
      { provide: MatDialogRef, useValue: ref },
      { provide: MissionsService, useValue: svc },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: ConfirmService, useValue: { confirm: vi.fn().mockReturnValue(of(true)) } },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(MissionFormDialogComponent);
  f.detectChanges();
  return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
}
const boutons = (el: HTMLElement) => [...el.querySelectorAll('button')].map(b => b.textContent?.trim() ?? '');

describe('MissionFormDialogComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    svc.create.mockReturnValue(of({ id: 9 }));
    svc.update.mockReturnValue(of({}));
    svc.delete.mockReturnValue(of({}));
  });

  it("création depuis un cycle : statut « Proposée », cycle et exercice transmis, montant vide = null", async () => {
    const { c } = await creer({ cycle: 'CLI' });
    expect(c.statut).toBe('PROPOSEE');
    c.titre = '  Analyse concentration clients ';
    c.honoraires = '' as any;
    c.enregistrer();
    expect(svc.create).toHaveBeenCalledWith(60, expect.objectContaining({
      titre: 'Analyse concentration clients', cycle: 'CLI', exerciceId: 40, annee: 2026, statut: 'PROPOSEE', honoraires: null, dateRelance: null,
    }));
    expect(ref.close).toHaveBeenCalledWith('saved');
  });

  it("création hors cycle : pas d'exercice ; reprise d'une mission refusée transmise", async () => {
    const { c } = await creer({ cycle: null, cycleModifiable: true, prefill: { titre: 'Grille salariale', repriseDeId: 3 } });
    expect(c.titre).toBe('Grille salariale');
    c.enregistrer();
    expect(svc.create).toHaveBeenCalledWith(60, expect.objectContaining({ cycle: null, exerciceId: null, repriseDeId: 3 }));
  });

  it("intitulé obligatoire", async () => {
    const { c } = await creer({ cycle: 'CLI' });
    c.enregistrer();
    expect(svc.create).not.toHaveBeenCalled();
    expect(c.erreur()).toContain('obligatoire');
  });

  it('modification : historique affiché, collaborateurs inactifs masqués, erreur serveur affichée', async () => {
    const { f, c, el } = await creer({ mission: mission() });
    f.detectChanges();
    expect(svc.historique).toHaveBeenCalledWith(60, 5);
    expect(el.textContent).toContain('Historique du statut');
    expect(c.utilisateurs.map(u => u.id)).toEqual([7]);
    svc.update.mockReturnValueOnce(throwError(() => ({ error: { message: 'Accès refusé' } })));
    c.statut = 'EN_DISCUSSION';
    c.enregistrer();
    expect(svc.update).toHaveBeenCalledWith(60, 5, expect.objectContaining({ statut: 'EN_DISCUSSION' }));
    expect(c.erreur()).toBe('Accès refusé');
  });

  it('R7 : « Supprimer » pour une mission proposée, « Archiver » sinon', async () => {
    let { el, c } = await creer({ mission: mission({ statut: 'PROPOSEE' }) });
    expect(boutons(el).some(t => t.includes('Supprimer'))).toBe(true);
    c.supprimer();
    expect(svc.delete).toHaveBeenCalledWith(60, 5);
    TestBed.resetTestingModule();
    ({ el, c } = await creer({ mission: mission({ statut: 'ACCEPTEE' }) }));
    expect(boutons(el).some(t => t.includes('Supprimer'))).toBe(false);
    expect(boutons(el).some(t => t.includes('Archiver'))).toBe(true);
    c.archiver();
    expect(svc.update).toHaveBeenCalledWith(60, 5, { archivee: true });
  });

  it('lecture seule : ni enregistrement ni suppression', async () => {
    const { el } = await creer({ mission: mission(), peutEcrire: false });
    const b = boutons(el);
    expect(b.some(t => t.includes('Enregistrer'))).toBe(false);
    expect(b.some(t => t.includes('Supprimer') || t.includes('Archiver'))).toBe(false);
    expect(b).toContain('Fermer');
  });
});
