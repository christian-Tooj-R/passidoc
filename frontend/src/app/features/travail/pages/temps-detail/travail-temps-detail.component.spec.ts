import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { TravailTempsDetailComponent } from './travail-temps-detail.component';
import { SaisieTempsService, LigneRapportDetail } from '../../../../core/services/saisie-temps.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';

let seq = 0;
const ligne = (p: Partial<LigneRapportDetail>): LigneRapportDetail => ({
  id: ++seq, source: 'SAISIE', date: '2026-10-16', collaborateurId: 7, collaborateur: 'Julie R', presence: 'FACTURABLE',
  clientId: 3, client: 'TRANSMAS', clientTnf: 'TRANSMAS', affaire: 'C2026-09', affaireEtat: 'O', missionCode: 'REV',
  categorie: null, libelle: 'Révision dossier', dureeHeures: 3, tauxHoraire: 100, tauxFige: true, pv: 300,
  heureDebut: null, heureFin: null, isLocked: false, ...p,
});

const lignes = () => [
  ligne({}),
  ligne({ collaborateurId: 8, collaborateur: 'Aro R', clientId: 4, client: 'TRANSMASCA', clientTnf: 'TRANSMASCA', missionCode: 'TCO', dureeHeures: 2, pv: 40, libelle: 'TVA' }),
  ligne({ presence: 'NON_FACTURABLE', clientId: null, client: null, clientTnf: 'Formation', affaire: null, affaireEtat: null, missionCode: null, dureeHeures: 1, pv: 0, libelle: 'Webinaire' }),
  ligne({ source: 'ABSENCE', presence: 'ABSENCE', clientId: null, client: null, clientTnf: 'Congés payés', affaire: null, affaireEtat: null, missionCode: null, dureeHeures: 7, pv: 0, isLocked: true }),
];

const mockSvc = {
  getRapportDetail: vi.fn(() => of({ lignes: lignes() })),
  update: vi.fn(() => of({})),
  create: vi.fn(() => of({})),
  delete: vi.fn(() => of(undefined)),
  getAffaires: vi.fn(() => of([])),
};
let estAdmin = true;
const mockAuth = { isAdmin: vi.fn(() => estAdmin), currentUser: vi.fn(() => ({ id: 7, role: estAdmin ? 'ADMIN' : 'COLLABORATEUR' })) };
const mockClients = { getAll: vi.fn(() => of([{ id: 3, nom: 'TRANSMAS' }, { id: 4, nom: 'TRANSMASCA' }])) };
const mockUsers = { getAll: vi.fn(() => of([{ id: 7, firstName: 'Julie', lastName: 'R' }, { id: 8, firstName: 'Aro', lastName: 'R' }])) };
const mockTenant = { nomSociete: vi.fn(() => 'AFYM'), poleLabel: vi.fn((s: string) => (s === 'EST' ? 'Pôle EST' : 'Pôle OUEST')) };

async function create() {
  await TestBed.configureTestingModule({
    imports: [TravailTempsDetailComponent],
    providers: [
      provideAnimations(), provideNativeDateAdapter(),
      { provide: SaisieTempsService, useValue: mockSvc },
      { provide: ClientsService, useValue: mockClients },
      { provide: UsersService, useValue: mockUsers },
      { provide: AuthService, useValue: mockAuth },
      { provide: TenantService, useValue: mockTenant },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TravailTempsDetailComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('TravailTempsDetailComponent', () => {
  beforeEach(() => { vi.clearAllMocks(); estAdmin = true; });

  it("charge l'année en cours avec absences, et affiche le regroupement Tempolia", async () => {
    const { comp, el } = await create();
    const appel = (mockSvc.getRapportDetail.mock.calls[0] as any[])[0];
    expect(appel.dateDebut).toBe(`${new Date().getFullYear()}-01-01`);
    expect(comp.regroupements).toEqual(['presence', 'client', 'affaire']);
    expect(comp.groupes().map(g => g.libelle)).toEqual(['Présence facturable', 'Présence non facturable', 'Absence']);
    expect(el.textContent).toContain('Présence : Présence facturable');
    expect(el.textContent).toContain('Total C2026-09');
    expect(el.textContent).toContain('Récapitulatif général');
  });

  it('calcule les totaux, le PV Col et le taux facturable', async () => {
    const { comp } = await create();
    expect(comp.totalGeneral()).toEqual({ heures: 13, pv: 340 });
    expect(comp.totalPresence('ABSENCE')).toBe(7);
    expect(comp.tauxFacturable()).toBe(83); // 5 h facturables / 6 h de présence
  });

  it("un non-ADMIN n'envoie jamais de filtre collaborateur et ne voit pas le sélecteur", async () => {
    estAdmin = false;
    const { comp, el } = await create();
    comp.collaborateurIds = [8];
    comp.load();
    expect((mockSvc.getRapportDetail.mock.calls.at(-1) as any[])[0].collaborateurIds).toBeUndefined();
    expect(el.textContent).not.toContain('Collaborateurs');
  });

  it("l'ADMIN filtre côté serveur par collaborateurs et clients", async () => {
    const { comp } = await create();
    comp.collaborateurIds = [8];
    comp.clientIds = [4];
    comp.load();
    expect((mockSvc.getRapportDetail.mock.calls.at(-1) as any[])[0]).toMatchObject({ collaborateurIds: [8], clientIds: [4] });
    expect(comp.restrictions()[0]).toContain('1 collaborateur(s) sélectionné(s) : Aro R');
    expect(comp.restrictions()[1]).toContain('TRANSMASCA');
  });

  it('filtre à l’écran par présence, affaire, tâche et recherche', async () => {
    const { comp } = await create();
    comp.togglePresence('ABSENCE');
    expect(comp.lignesVue().some(l => l.presence === 'ABSENCE')).toBe(false);
    comp.affaires = ['C2026-09'];
    comp.recalculer();
    expect(comp.lignesVue()).toHaveLength(2);
    comp.missions = ['TCO'];
    comp.recalculer();
    expect(comp.lignesVue().map(l => l.collaborateur)).toEqual(['Aro R']);
    comp.affaires = []; comp.missions = []; comp.recherche = 'webinaire';
    comp.recalculer();
    expect(comp.lignesVue().map(l => l.libelle)).toEqual(['Webinaire']);
  });

  it('garde au moins une présence cochée', async () => {
    const { comp } = await create();
    comp.togglePresence('ABSENCE');
    comp.togglePresence('NON_FACTURABLE');
    comp.togglePresence('FACTURABLE');
    expect(comp.presenceActive('FACTURABLE')).toBe(true);
  });

  it('change les regroupements (vider un niveau vide les suivants) et interdit les doublons', async () => {
    const { comp } = await create();
    comp.setRegroupement(0, 'collaborateur');
    expect(comp.groupes().map(g => g.libelle)).toEqual(['Aro R', 'Julie R']);
    expect(comp.dimensionPrise('collaborateur', 1)).toBe(true);
    comp.setRegroupement(1, '');
    expect(comp.regroupements).toEqual(['collaborateur']);
    comp.setRegroupement(0, '');
    expect(comp.groupes()).toEqual([]);
  });

  it('replie et déplie les sections', async () => {
    const { comp, fixture, el } = await create();
    comp.toutReplier();
    fixture.detectChanges();
    expect(el.querySelectorAll('table.data-table').length).toBe(0);
    comp.toutDeplier();
    fixture.detectChanges();
    expect(el.querySelectorAll('table.data-table').length).toBeGreaterThan(0);
  });

  it("masque les lignes de détail quand « Lignes de détail : Non »", async () => {
    const { comp, fixture, el } = await create();
    comp.detail = false;
    fixture.detectChanges();
    expect(el.querySelectorAll('tr.data-row').length).toBe(0);
    expect(el.textContent).toContain('Total général');
  });

  it("propose l'édition seulement sur ses propres saisies non verrouillées, avec l'affaire", async () => {
    const { comp, el } = await create();
    // Julie (id 7) : sa saisie facturable et sa non facturable — pas son absence, ni la saisie d'Aro
    expect(el.querySelectorAll('button[title="Modifier"]').length).toBe(2);
    comp.startEdit(comp.lignesVue().find(l => l.collaborateurId === 7 && l.source === 'SAISIE' && l.presence === 'FACTURABLE')!);
    expect(comp.editSeed()).toMatchObject({ affaire: 'C2026-09', type: 'FACTURABLE', commentaire: 'Révision dossier' });
  });

  it('enregistre une modification puis recharge le rapport', async () => {
    const { comp } = await create();
    const l = comp.lignesVue()[0];
    comp.startEdit(l);
    comp.onSaveEdit({ date: l.date, dureeHeures: 4, type: 'FACTURABLE', affaire: null });
    expect(mockSvc.update).toHaveBeenCalledWith(l.id, expect.objectContaining({ dureeHeures: 4, affaire: null }));
    expect(mockSvc.getRapportDetail).toHaveBeenCalledTimes(2);
    expect(comp.editing()).toBe(false);
  });

  it('supprime une saisie après confirmation', async () => {
    const { comp } = await create();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const l = comp.lignesVue().find(x => x.source === 'SAISIE')!;
    comp.supprimer(l);
    expect(mockSvc.delete).toHaveBeenCalledWith(l.id);
    expect(comp.lignesVue().some(x => x.id === l.id && x.source === 'SAISIE')).toBe(false);
  });

  it('réinitialise sur la présentation Tempolia', async () => {
    const { comp } = await create();
    comp.setRegroupement(0, 'mois');
    comp.detail = false;
    comp.recherche = 'x';
    comp.reinitialiser();
    expect(comp.regroupements).toEqual(['presence', 'client', 'affaire']);
    expect(comp.detail).toBe(true);
    expect(comp.recherche).toBe('');
  });
});
