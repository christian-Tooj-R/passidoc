import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { MissionsExportService } from './missions.export';
import { MissionsCabinetComponent } from './missions-cabinet.component';
import { MissionsService } from '../../core/services/missions.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';

const ligne = (o: any) => ({
  id: 1, titre: 'M', honoraires: null, statut: 'PROPOSEE', cycle: null, exerciceId: null, dateRelance: null, responsableId: null,
  responsable: null, archivee: false, aRelancer: false, createdAt: '', updatedAt: '2026-10-27', secteur: null,
  client: { id: 3, nom: 'Société A', secteur: 'Transport' }, ...o,
});
const TABLEAU = {
  aujourdhui: '2026-10-27', peutModifier: true,
  kpi: { total: 2, potentiel: 5200, proposees: { nombre: 1, montant: 2500 }, enDiscussion: { nombre: 1, montant: 2700 }, acceptees: { nombre: 0, montant: 0 }, refusees: 0, sansSuite: 0, aRelancer: 1, tauxConversion: 0 },
  missions: [
    ligne({ id: 1, titre: 'Analyse concentration clients', cycle: 'CLI', honoraires: 2500 }),
    ligne({ id: 2, titre: 'Plan de trésorerie', cycle: 'TRE', honoraires: 2700, statut: 'EN_DISCUSSION', aRelancer: true, dateRelance: '2026-10-20', client: { id: 4, nom: 'Société B', secteur: null } }),
  ],
  responsables: [{ id: 7, nom: 'Julie R' }],
  secteurs: [{ code: 'TRANSPORT', label: 'Transport' }],
};
const svc = { tableauCabinet: vi.fn(), update: vi.fn() };
const exports = { excel: vi.fn(), rapportMensuel: vi.fn() };

async function creer() {
  await TestBed.configureTestingModule({
    imports: [MissionsCabinetComponent],
    providers: [
      provideRouter([]), provideAnimations(),
      { provide: MissionsService, useValue: svc },
      { provide: TenantService, useValue: { nomSociete: () => 'AFYM' } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: MissionsExportService, useValue: exports },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(MissionsCabinetComponent);
  f.detectChanges();
  return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
}

describe('MissionsCabinetComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    svc.tableauCabinet.mockReturnValue(of(TABLEAU));
    svc.update.mockReturnValue(of({}));
  });

  it('affiche KPI et tableau consolidé (dossier cliquable, badge « À relancer »)', async () => {
    const { el } = await creer();
    const t = (el.textContent ?? '').replace(/[  ]/g, ' ');
    expect(t).toContain('5 200 €');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.querySelector('tbody a')?.getAttribute('href')).toContain('/clients/3');
    expect(el.querySelectorAll('.badge-relance')).toHaveLength(1);
  });

  it('filtres envoyés au serveur : statuts (clic = ce statut seul, puis ajout), relance en retard', async () => {
    const { c } = await creer();
    c.basculerStatut('EN_DISCUSSION');
    expect(svc.tableauCabinet).toHaveBeenLastCalledWith(expect.objectContaining({ statuts: ['EN_DISCUSSION'] }));
    c.basculerStatut('ACCEPTEE');
    expect(svc.tableauCabinet).toHaveBeenLastCalledWith(expect.objectContaining({ statuts: ['EN_DISCUSSION', 'ACCEPTEE'] }));
    c.basculerStatut('EN_DISCUSSION');
    c.basculerStatut('ACCEPTEE');
    expect(svc.tableauCabinet).toHaveBeenLastCalledWith(expect.objectContaining({ statuts: [] }));
  });

  it('recherche locale sur le dossier et l’intitulé', async () => {
    const { c } = await creer();
    c.recherche.set('trésorerie');
    expect(c.lignes().map(m => m.id)).toEqual([2]);
    c.recherche.set('société a');
    expect(c.lignes().map(m => m.id)).toEqual([1]);
  });

  it('ADMIN : statut modifiable en ligne', async () => {
    const { c } = await creer();
    c.changerStatut(TABLEAU.missions[0] as any, 'ACCEPTEE');
    expect(svc.update).toHaveBeenCalledWith(3, 1, { statut: 'ACCEPTEE' });
  });

  it('exports Excel et PDF des lignes affichées, avec les filtres en en-tête', async () => {
    const { c } = await creer();
    c.recherche.set('trésorerie');
    c.exportExcel();
    expect(exports.excel).toHaveBeenCalledWith([expect.objectContaining({ id: 2 })], expect.stringMatching(/^missions-\d{4}-\d{2}\.xlsx$/));
    c.moisRapport = '2026-10';
    c.exportPdf();
    expect(exports.rapportMensuel).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 2 })], TABLEAU.kpi,
      { cabinet: 'AFYM', mois: '2026-10', filtres: ['« trésorerie »'] },
    );
  });
});
