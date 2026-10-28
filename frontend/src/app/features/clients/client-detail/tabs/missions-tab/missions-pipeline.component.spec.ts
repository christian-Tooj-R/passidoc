import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MissionsPipelineComponent } from './missions-pipeline.component';
import { Mission } from '../../../../../core/models/mission.model';

const m = (o: Partial<Mission>): Mission => ({
  id: 1, titre: 'M', honoraires: null, statut: 'PROPOSEE', cycle: null, exerciceId: null, dateRelance: null,
  responsableId: null, responsable: null, archivee: false, aRelancer: false, createdAt: '', updatedAt: '', ...o,
});
// Mercredi 18/11/2026 : fin de semaine le 22, fin de mois le 30.
const MISSIONS = [
  m({ id: 1, cycle: 'CLI', honoraires: 2500, dateRelance: '2026-11-20', responsableId: 7, responsable: { id: 7, firstName: 'Julie', lastName: 'R' } }),
  m({ id: 2, statut: 'EN_DISCUSSION', dateRelance: '2026-11-10', aRelancer: true }),
  m({ id: 3, cycle: 'TRE', statut: 'ACCEPTEE', honoraires: 6000, dateRelance: '2026-11-25' }),
  m({ id: 4, cycle: 'SOC', dateRelance: '2026-11-28', archivee: true }),
  m({ id: 5, cycle: 'FIS', dateRelance: '2026-11-27', statut: 'EN_DISCUSSION' }),
];

describe('MissionsPipelineComponent — filtres', () => {
  let c: MissionsPipelineComponent;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 18, 10, 0));
    await TestBed.configureTestingModule({ imports: [MissionsPipelineComponent] }).compileComponents();
    const f = TestBed.createComponent(MissionsPipelineComponent);
    c = f.componentInstance;
    f.componentRef.setInput('missions', MISSIONS);
    f.detectChanges();
  });
  afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });
  const ids = () => c.vues().map(x => x.id);

  it('archivées masquées par défaut', () => {
    expect(ids()).toEqual([1, 2, 3, 5]);
    c.archivees.set(true);
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
  });

  it('statut, cycle, hors cycle, responsable, avec montant', () => {
    c.statut.set('EN_DISCUSSION'); expect(ids()).toEqual([2, 5]); c.statut.set('');
    c.cycle.set('TRE'); expect(ids()).toEqual([3]);
    c.cycle.set('HORS_CYCLE'); expect(ids()).toEqual([2]); c.cycle.set('');
    c.responsableId.set(7); expect(ids()).toEqual([1]); c.responsableId.set(null);
    c.avecMontant.set(true); expect(ids()).toEqual([1, 3]);
  });

  it('relance : cette semaine, ce mois (missions ouvertes), dépassée', () => {
    c.relance.set('SEMAINE'); expect(ids()).toEqual([1]);
    c.relance.set('MOIS'); expect(ids()).toEqual([1, 5]);
    c.relance.set('RETARD'); expect(ids()).toEqual([2]);
  });

  it('responsables proposés au filtre : ceux des missions', () => {
    expect(c.responsables()).toEqual([{ id: 7, nom: 'Julie R' }]);
  });

  it('date en rouge si dépassée et mission ni acceptée ni refusée', () => {
    expect(c.relanceDepassee(MISSIONS[1])).toBe(true);
    expect(c.relanceDepassee(m({ statut: 'ACCEPTEE', dateRelance: '2026-11-01' }))).toBe(false);
    expect(c.relanceDepassee(MISSIONS[0])).toBe(false);
  });
});
