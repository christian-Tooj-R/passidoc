import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SaisieTempsService } from './saisie-temps.service';
import { SaisieTemps, TypeTemps } from '../entities/saisie-temps.entity';
import { BudgetMission } from '../entities/budget-mission.entity';
import { Pointage } from '../entities/pointage.entity';
import { IncoherencePointage } from '../entities/incoherence-pointage.entity';
import { CongeAbsence } from '../entities/conge-absence.entity';
import { User, UserRole } from '../entities/user.entity';
import { AffairesService } from './affaires.service';
import { RentabiliteService } from './rentabilite.service';

const user = { id: 7, tenantId: 1, role: UserRole.COLLABORATEUR, firstName: 'Julie', lastName: 'R', prixVenteHoraire: '20.00' } as unknown as User;

const repo = {
  create: jest.fn((d: any) => ({ ...d })),
  save: jest.fn(async (d: any) => ({ id: 100, ...d })),
  findOne: jest.fn(),
  find: jest.fn(),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};
const pointageRepo = { findOne: jest.fn().mockResolvedValue(null) };
const congeRepo = { find: jest.fn().mockResolvedValue([]) };
const affaires = {
  resoudre: jest.fn().mockResolvedValue('C2026-09'),
  contextes: jest.fn().mockResolvedValue(new Map()),
};
const rentabilite = { verifierAlertes: jest.fn().mockResolvedValue(undefined) };

describe('SaisieTempsService', () => {
  let service: SaisieTempsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SaisieTempsService,
        { provide: getRepositoryToken(SaisieTemps), useValue: repo },
        { provide: getRepositoryToken(Pointage), useValue: pointageRepo },
        { provide: getRepositoryToken(BudgetMission), useValue: {} },
        { provide: getRepositoryToken(IncoherencePointage), useValue: {} },
        { provide: getRepositoryToken(CongeAbsence), useValue: congeRepo },
        { provide: AffairesService, useValue: affaires },
        { provide: RentabiliteService, useValue: rentabilite },
      ],
    }).compile();
    service = module.get(SaisieTempsService);
  });

  describe('create — affaire et taux figés', () => {
    it("attribue l'affaire automatiquement et fige le prix de vente du collaborateur", async () => {
      const s = await service.create({ date: '2026-10-16', dureeHeures: 2, type: TypeTemps.FACTURABLE, clientId: 3, missionCode: 'REV' }, user);
      expect(affaires.resoudre).toHaveBeenCalledWith(3, '2026-10-16', 'REV');
      expect(s.affaire).toBe('C2026-09');
      expect(s.tauxHoraire).toBe(20);
      expect(s.collaborateurId).toBe(7);
      expect(s.tenantId).toBe(1);
      expect(rentabilite.verifierAlertes).toHaveBeenCalledWith(1, 3, 'C2026-09');
    });

    it("respecte une affaire choisie explicitement", async () => {
      const s = await service.create({ date: '2026-10-16', dureeHeures: 1, type: TypeTemps.FACTURABLE, clientId: 3, affaire: 'C2025-09' }, user);
      expect(affaires.resoudre).not.toHaveBeenCalled();
      expect(s.affaire).toBe('C2025-09');
    });

    it("n'a pas d'affaire sans client, et pas de taux si le collaborateur n'a pas de tarif", async () => {
      const s = await service.create(
        { date: '2026-10-16', dureeHeures: 1, type: TypeTemps.NON_FACTURABLE, affaire: 'C2026-09' },
        { ...user, prixVenteHoraire: null } as User,
      );
      expect(s.affaire).toBeNull();
      expect(s.tauxHoraire).toBeNull();
    });
  });

  describe('pôle de travail (cahier v2 #5)', () => {
    it('par défaut : le site du collaborateur ; sinon le pôle choisi', async () => {
      expect((await service.create({ date: '2026-10-16', dureeHeures: 1, type: TypeTemps.FACTURABLE }, { ...user, site: 'OUEST' } as any)).lieuTravail).toBe('OUEST');
      expect((await service.create({ date: '2026-10-16', dureeHeures: 1, type: TypeTemps.FACTURABLE }, user)).lieuTravail).toBe('EST');
      expect((await service.create({ date: '2026-10-16', dureeHeures: 1, type: TypeTemps.FACTURABLE, lieuTravail: 'HORS_BUREAU' }, user)).lieuTravail).toBe('HORS_BUREAU');
    });

    it('modification : conservé si absent, changé si fourni, défaut du collaborateur si remis à null', async () => {
      const base = { id: 100, collaborateurId: 7, tenantId: 1, date: '2026-03-01', dureeHeures: 2, type: TypeTemps.FACTURABLE, isLocked: false, lieuTravail: 'HORS_BUREAU' };
      repo.findOne.mockResolvedValue({ ...base });
      expect((await service.update(100, { commentaire: 'x' }, user)).lieuTravail).toBe('HORS_BUREAU');
      repo.findOne.mockResolvedValue({ ...base });
      expect((await service.update(100, { lieuTravail: 'OUEST' }, user)).lieuTravail).toBe('OUEST');
      repo.findOne.mockResolvedValue({ ...base });
      expect((await service.update(100, { lieuTravail: null }, user)).lieuTravail).toBe('EST');
    });

    it("l'agenda d'un collègue ne renvoie que son identité, jamais l'entité User complète", async () => {
      repo.find.mockResolvedValue([{
        id: 1, date: '2026-10-16', collaborateurId: 9,
        collaborateur: { id: 9, firstName: 'Paul', lastName: 'M', site: 'EST', password: 'hash', twoFactorSecret: 's', iban: 'FR76', salaireBase: 3000 },
        client: { id: 3, nom: 'TRANSMAS', site: 'EST', tenantId: 1, ficheIdentite: { honoraires: { comptables: 9000 } } },
      }]);
      const [s] = await service.findByTenant(1, 7, '2026-10-01', '2026-10-31', 9);
      expect(s.collaborateur).toEqual({ id: 9, firstName: 'Paul', lastName: 'M', site: 'EST' });
      expect(s.client).toEqual({ id: 3, nom: 'TRANSMAS', site: 'EST' });
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 1, collaborateurId: 9 }) }));
    });
  });

  describe('update — règles de recalcul de l’affaire', () => {
    const existante = () => ({
      id: 100, collaborateurId: 7, tenantId: 1, date: '2026-03-01', dureeHeures: 2, type: TypeTemps.FACTURABLE,
      clientId: 3, missionCode: 'TCO', affaire: 'C2025-09', tauxHoraire: 15, isLocked: false,
    });

    it("garde l'affaire quand seul le commentaire change (pas de déplacement rétroactif)", async () => {
      repo.findOne.mockResolvedValue(existante());
      const s = await service.update(100, { commentaire: 'précision' }, user);
      expect(affaires.resoudre).not.toHaveBeenCalled();
      expect(s.affaire).toBe('C2025-09');
      expect(s.tauxHoraire).toBe(15);
    });

    it('recalcule quand la date change', async () => {
      repo.findOne.mockResolvedValue(existante());
      const s = await service.update(100, { date: '2026-11-02' }, user);
      expect(affaires.resoudre).toHaveBeenCalledWith(3, '2026-11-02', 'TCO');
      expect(s.affaire).toBe('C2026-09');
    });

    it('recalcule quand on demande le retour en automatique (affaire null)', async () => {
      repo.findOne.mockResolvedValue(existante());
      await service.update(100, { affaire: null }, user);
      expect(affaires.resoudre).toHaveBeenCalledWith(3, '2026-03-01', 'TCO');
    });

    it("prend l'affaire explicite même si la date change", async () => {
      repo.findOne.mockResolvedValue(existante());
      const s = await service.update(100, { date: '2026-11-02', affaire: 'C2024-09' }, user);
      expect(affaires.resoudre).not.toHaveBeenCalled();
      expect(s.affaire).toBe('C2024-09');
    });

    it("retire l'affaire quand on retire le client, et revérifie les deux budgets", async () => {
      repo.findOne.mockResolvedValue(existante());
      const s = await service.update(100, { clientId: null as any }, user);
      expect(s.affaire).toBeNull();
      expect(rentabilite.verifierAlertes).toHaveBeenCalledWith(1, null, null);
      expect(rentabilite.verifierAlertes).toHaveBeenCalledWith(1, 3, 'C2025-09');
    });

    it('refuse une saisie verrouillée ou appartenant à un autre', async () => {
      repo.findOne.mockResolvedValue({ ...existante(), isLocked: true });
      await expect(service.update(100, { commentaire: 'x' }, user)).rejects.toThrow(ForbiddenException);
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(100, { commentaire: 'x' }, user)).rejects.toThrow(NotFoundException);
    });
  });

  it('revérifie le budget après suppression (réarmement des alertes)', async () => {
    repo.findOne.mockResolvedValue({ id: 100, tenantId: 1, clientId: 3, affaire: 'C2026-09', isLocked: false });
    await service.remove(100, 7);
    expect(repo.delete).toHaveBeenCalledWith({ id: 100, collaborateurId: 7 });
    expect(rentabilite.verifierAlertes).toHaveBeenCalledWith(1, 3, 'C2026-09');
  });

  describe('getRapportDetail', () => {
    const collab = (prix: string | null) => ({ id: 7, firstName: 'Julie', lastName: 'R', prixVenteHoraire: prix });
    const saisies = [
      { id: 1, date: '2026-10-16', dureeHeures: 3, type: TypeTemps.FACTURABLE, clientId: 3, client: { nom: 'TRANSMAS' }, affaire: 'C2026-09', missionCode: 'REV', commentaire: 'Révision', tauxHoraire: 100, collaborateurId: 7, collaborateur: collab('40'), isLocked: false },
      { id: 2, date: '2026-10-12', dureeHeures: 1.5, type: TypeTemps.FACTURABLE, clientId: 3, client: { nom: 'TRANSMAS' }, affaire: 'C2026-09', missionCode: 'TCO', commentaire: null, tauxHoraire: null, collaborateurId: 7, collaborateur: collab('40'), isLocked: false },
      { id: 3, date: '2026-10-11', dureeHeures: 2, type: TypeTemps.NON_FACTURABLE, categorie: 'FORMATION', clientId: null, client: null, affaire: null, missionCode: null, tauxHoraire: null, collaborateurId: 7, collaborateur: collab(null), isLocked: false },
    ];

    beforeEach(() => repo.find.mockResolvedValue(saisies));

    it('valorise au taux figé, à défaut au tarif actuel (non figé)', async () => {
      const { lignes } = await service.getRapportDetail(1, { dateDebut: '2026-10-01', dateFin: '2026-10-31', inclureAbsences: false });
      const [l1, l2, l3] = lignes;
      expect([l1.pv, l1.tauxFige]).toEqual([300, true]);
      expect([l2.pv, l2.tauxHoraire, l2.tauxFige]).toEqual([60, 40, false]);
      expect([l3.pv, l3.presence, l3.clientTnf]).toEqual([0, 'NON_FACTURABLE', 'Formation']);
      expect(l1.clientTnf).toBe('TRANSMAS');
    });

    it('convertit les absences approuvées en heures, au prorata et dans la période', async () => {
      repo.find.mockResolvedValue([]);
      congeRepo.find.mockResolvedValue([
        // lun 05/10 → ven 09/10 : 5 jours ouvrés × 7 h (35 h/semaine par défaut)
        { id: 1, userId: 7, user: { firstName: 'Julie', lastName: 'R', heuresHebdo: null }, typeConge: 'CONGES_PAYES', dateDebut: '2026-10-05', dateFin: '2026-10-09', nombreJours: 5, motif: 'Vacances' },
        // demi-journée, contrat 39 h
        { id: 2, userId: 7, user: { firstName: 'Julie', lastName: 'R', heuresHebdo: '39.00' }, typeConge: 'RECUPERATION', dateDebut: '2026-10-14', dateFin: '2026-10-14', nombreJours: 0.5, motif: null },
        // du jeu 29/10 au mer 04/11 : seuls jeu 29 et ven 30 sont dans la période
        { id: 3, userId: 7, user: { firstName: 'Julie', lastName: 'R', heuresHebdo: null }, typeConge: 'MALADIE', dateDebut: '2026-10-29', dateFin: '2026-11-04', nombreJours: 5, motif: null },
      ]);
      const { lignes } = await service.getRapportDetail(1, { dateDebut: '2026-10-01', dateFin: '2026-10-31', inclureAbsences: true });
      const parId = new Map(lignes.map(l => [l.id, l]));
      expect(parId.get(1)!.dureeHeures).toBe(35);
      expect(parId.get(1)!.libelle).toBe('Congés payés du 05/10/2026 au 09/10/2026 — Vacances');
      expect(parId.get(2)!.dureeHeures).toBe(3.9);
      expect(parId.get(3)!.dureeHeures).toBe(14);
      expect(parId.get(3)!.date).toBe('2026-10-29');
      expect(lignes.every(l => l.presence === 'ABSENCE' && l.pv === 0 && l.isLocked)).toBe(true);
      expect(congeRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ statut: 'APPROUVEE' }) }));
    });

    it("n'ajoute pas les absences quand le rapport est restreint à des clients", async () => {
      await service.getRapportDetail(1, { dateDebut: '2026-10-01', dateFin: '2026-10-31', clientIds: [3], inclureAbsences: true });
      expect(congeRepo.find).not.toHaveBeenCalled();
    });
  });
});
