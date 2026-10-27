import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RentabiliteService } from './rentabilite.service';
import { BudgetDossier } from '../entities/budget-dossier.entity';
import { Client } from '../entities/client.entity';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AffairesService } from './affaires.service';

const admin  = { id: 1, tenantId: 1, role: UserRole.ADMIN, email: 'admin@x.re', firstName: 'Alvin', lastName: 'P', isActive: true } as User;
const resp   = { id: 3, tenantId: 1, role: UserRole.COLLABORATEUR, email: 'julie@x.re', firstName: 'Julie', lastName: 'R', isActive: true } as User;
const autre  = { id: 4, tenantId: 1, role: UserRole.COLLABORATEUR, email: 'fab@x.re', firstName: 'Fab', lastName: 'L', isActive: true } as User;
const expert = { id: 5, tenantId: 1, role: UserRole.EXPERT_COMPTABLE, email: 'exp@x.re', firstName: 'Exp', lastName: 'C', isActive: true } as User;

const dossier = () => ({
  id: 10, nom: 'TRANSMAS', site: 'EST', tenantId: 1, dateClotureExercice: '09-30',
  directeurId: null, directeur: null, responsableId: 3, responsable: resp, collaborateurOuestId: null, collaborateurOuest: null,
  ficheIdentite: { honoraires: { comptables: 3000 } },
});

/** QueryBuilder chaînable : getRawMany → consommations, getMany → dossiers. */
let consoRows: any[] = [];
let clientsRows: any[] = [];
const andWhere = jest.fn();
const makeQb = () => {
  const qb: any = {};
  for (const m of ['leftJoin', 'leftJoinAndSelect', 'select', 'addSelect', 'where', 'groupBy', 'addGroupBy']) qb[m] = jest.fn(() => qb);
  qb.andWhere = jest.fn((...a: any[]) => { andWhere(...a); return qb; });
  qb.getRawMany = jest.fn(async () => consoRows);
  qb.getMany = jest.fn(async () => clientsRows);
  return qb;
};

let budget: any = null;
const budgetRepo = {
  findOne: jest.fn(async () => budget),
  find: jest.fn(async () => (budget ? [budget] : [])),
  create: jest.fn((d: any) => ({ ...d })),
  save: jest.fn(async (b: any) => { budget = { id: 1, ...b }; return budget; }),
  findOneByOrFail: jest.fn(async () => budget),
  delete: jest.fn(),
};
const saisieRepo = { createQueryBuilder: jest.fn(makeQb), find: jest.fn().mockResolvedValue([]) };
const clientRepo = { createQueryBuilder: jest.fn(makeQb) };
const userRepo = { find: jest.fn().mockResolvedValue([admin]) };
const notifications = { emit: jest.fn() };
const mail = { sendBudgetDossierAlerte: jest.fn().mockResolvedValue(undefined) };
const affaires = {
  contexte: jest.fn().mockResolvedValue({ dateClotureExercice: '09-30', exercices: [] }),
  contextes: jest.fn(async (ids: number[]) => new Map(ids.map(id => [id, { dateClotureExercice: '09-30', exercices: [] }]))),
  lister: jest.fn().mockResolvedValue([{ code: 'C2026-09', dateOuverture: '2025-10-01', dateCloture: '2026-09-30', etat: 'O', source: 'CALCUL' }]),
};

const consommation = (heures: number, valorisation = 0) => { consoRows = [{ clientId: 10, affaire: 'C2026-09', heures, valorisation }]; };

describe('RentabiliteService', () => {
  let service: RentabiliteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    budget = null;
    consoRows = [];
    clientsRows = [dossier()];
    const module = await Test.createTestingModule({
      providers: [
        RentabiliteService,
        { provide: getRepositoryToken(BudgetDossier), useValue: budgetRepo },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(SaisieTemps), useValue: saisieRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AffairesService, useValue: affaires },
        { provide: NotificationsService, useValue: notifications },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: { get: () => 'https://passidoc.test' } },
      ],
    }).compile();
    service = module.get(RentabiliteService);
  });

  describe('verifierAlertes — seuils 80 % / 100 %', () => {
    beforeEach(() => { budget = { id: 1, clientId: 10, affaire: 'C2026-09', heuresBudget: 100, alerte80At: null, alerte100At: null }; });

    it("n'alerte pas sous 80 %", async () => {
      consommation(79);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(notifications.emit).not.toHaveBeenCalled();
      expect(mail.sendBudgetDossierAlerte).not.toHaveBeenCalled();
    });

    it("alerte une seule fois à 80 % (intervenants + ADMIN en in-app, intervenants par email)", async () => {
      consommation(85);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(notifications.emit.mock.calls.map(c => c[0]).sort()).toEqual([1, 3]);
      expect(notifications.emit).toHaveBeenCalledWith(3, expect.objectContaining({ type: 'BUDGET_DOSSIER_ATTENTION', clientId: 10 }));
      expect(mail.sendBudgetDossierAlerte).toHaveBeenCalledTimes(1);
      expect(mail.sendBudgetDossierAlerte).toHaveBeenCalledWith(expect.objectContaining({ to: 'julie@x.re', seuil: 80, pourcentage: 85 }));
      expect(budget.alerte80At).toBeInstanceOf(Date);

      jest.clearAllMocks();
      consommation(90);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it("alerte le dépassement à 100 % sans renvoyer l'alerte 80 %", async () => {
      consommation(120);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(notifications.emit).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'BUDGET_DOSSIER_DEPASSE', titre: 'Budget temps dépassé' }));
      expect(notifications.emit.mock.calls.every(c => c[1].type === 'BUDGET_DOSSIER_DEPASSE')).toBe(true);
      expect(budget.alerte100At).toBeInstanceOf(Date);
      expect(budget.alerte80At).toBeInstanceOf(Date);
    });

    it('réarme les seuils quand la consommation redescend (budget relevé, saisie supprimée)', async () => {
      budget.alerte80At = new Date();
      budget.alerte100At = new Date();
      consommation(90);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(budget.alerte100At).toBeNull();
      expect(budget.alerte80At).not.toBeNull();
      consommation(10);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(budget.alerte80At).toBeNull();
    });

    it("prévient l'ADMIN par email quand le dossier n'a pas d'intervenant", async () => {
      clientsRows = [{ ...dossier(), responsable: null, responsableId: null }];
      consommation(100);
      await service.verifierAlertes(1, 10, 'C2026-09');
      expect(mail.sendBudgetDossierAlerte).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@x.re', seuil: 100 }));
    });

    it("ne lève jamais (une alerte ratée ne doit pas faire échouer la saisie)", async () => {
      budgetRepo.findOne.mockRejectedValueOnce(new Error('base indisponible'));
      await expect(service.verifierAlertes(1, 10, 'C2026-09')).resolves.toBeUndefined();
    });

    it('ignore les saisies sans dossier ou sans affaire', async () => {
      await service.verifierAlertes(1, null, null);
      expect(budgetRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('enregistrerBudget — droits et validation', () => {
    const dto = { affaire: 'C2026-09', heuresBudget: 100 };

    it("autorise l'ADMIN, l'expert-comptable et les intervenants du dossier", async () => {
      for (const u of [admin, expert, resp]) {
        await expect(service.enregistrerBudget(10, u, dto)).resolves.toMatchObject({ heuresBudget: 100 });
      }
    });

    it('refuse un collaborateur qui n’intervient pas sur le dossier', async () => {
      await expect(service.enregistrerBudget(10, autre, dto)).rejects.toThrow(ForbiddenException);
      expect(budgetRepo.save).not.toHaveBeenCalled();
    });

    it('refuse une affaire mal formée ou un budget nul', async () => {
      await expect(service.enregistrerBudget(10, admin, { affaire: '2026-09', heuresBudget: 10 })).rejects.toThrow(BadRequestException);
      await expect(service.enregistrerBudget(10, admin, { affaire: 'C2026-09', heuresBudget: 0 })).rejects.toThrow(BadRequestException);
    });

    it('404 pour un dossier inconnu ou d’un autre cabinet', async () => {
      clientsRows = [];
      await expect(service.enregistrerBudget(99, admin, dto)).rejects.toThrow(NotFoundException);
    });

    it("vide honoraires / prix de vente à 0 (= repris de la fiche / calculé) et vérifie les alertes", async () => {
      consommation(95);
      const b = await service.enregistrerBudget(10, admin, { ...dto, honoraires: 0, prixVenteHoraire: 0 });
      expect(b.honoraires).toBeNull();
      expect(b.prixVenteHoraire).toBeNull();
      expect(notifications.emit).toHaveBeenCalled();
    });
  });

  describe('dossier — visibilité', () => {
    beforeEach(() => {
      budget = { id: 1, clientId: 10, affaire: 'C2026-09', heuresBudget: 100, honoraires: null, prixVenteHoraire: null };
      consommation(50, 1500);
      saisieRepo.find.mockResolvedValue([
        { clientId: 10, collaborateurId: 3, collaborateur: resp, type: 'FACTURABLE', missionCode: 'REV', date: '2026-09-10', dureeHeures: 30, tauxHoraire: 30 },
        { clientId: 10, collaborateurId: 3, collaborateur: resp, type: 'FACTURABLE', missionCode: null, date: '2026-08-10', dureeHeures: 20, tauxHoraire: 30 },
        { clientId: 10, collaborateurId: 3, collaborateur: resp, type: 'FACTURABLE', missionCode: 'SOC', date: '2026-08-11', dureeHeures: 4, tauxHoraire: 30 },
      ]);
    });

    it("donne à l'ADMIN valorisation, marge réelle et détail par collaborateur", async () => {
      const d = await service.dossier(10, admin);
      expect(d.indicateurs).toMatchObject({ honoraires: 3000, honorairesSource: 'FICHE', prixVenteHoraire: 30, heuresConsommees: 50, boniMali: 1500, valorisation: 1500, margeValorisation: 1500 });
      expect(d.parCollaborateur).toEqual([{ collaborateurId: 3, collaborateur: 'Julie R', heures: 50, valorisation: 1500 }]);
      expect(d.heuresHorsBudget).toBe(4);
      expect(d.parMission).toEqual([{ missionCode: 'REV', heures: 30 }, { missionCode: 'SANS', heures: 20 }]);
      expect(d.voirValorisation).toBe(true);
    });

    it('masque valorisation et détail par collaborateur aux autres profils', async () => {
      const d = await service.dossier(10, autre);
      expect(d.indicateurs.valorisation).toBeNull();
      expect(d.indicateurs.margeValorisation).toBeNull();
      expect(d.indicateurs.boniMali).toBe(1500);
      expect(d.parCollaborateur).toBeNull();
      expect(d.peutModifierBudget).toBe(false);
    });
  });

  describe('tableauDeBord — périmètre', () => {
    it("restreint un non-ADMIN à SES dossiers, quel que soit le filtre demandé", async () => {
      await service.tableauDeBord(autre, { annee: 2026, collaborateurId: 3 });
      expect(andWhere).toHaveBeenCalledWith(expect.stringContaining('c.responsableId = :iid'), { iid: 4 });
    });

    it("laisse l'ADMIN filtrer par intervenant, ou tout voir", async () => {
      await service.tableauDeBord(admin, { annee: 2026, collaborateurId: 3 });
      expect(andWhere).toHaveBeenCalledWith(expect.stringContaining('c.responsableId = :iid'), { iid: 3 });
      andWhere.mockClear();
      await service.tableauDeBord(admin, { annee: 2026 });
      expect(andWhere.mock.calls.some(c => String(c[0]).includes(':iid'))).toBe(false);
    });

    it("montre l'affaire attendue de l'année pour un dossier sans temps ni budget", async () => {
      const t = await service.tableauDeBord(admin, { annee: 2027 });
      expect(t.lignes).toHaveLength(1);
      expect(t.lignes[0]).toMatchObject({ affaire: 'C2027-09', statut: 'NON_BUDGETE', honoraires: 3000, heuresConsommees: 0 });
    });

    it('totalise et masque la valorisation hors ADMIN', async () => {
      budget = { id: 1, clientId: 10, affaire: 'C2026-09', heuresBudget: 100, honoraires: null, prixVenteHoraire: null };
      consommation(120, 2000);
      const t = await service.tableauDeBord(resp, { annee: 2026 });
      expect(t.totaux).toMatchObject({ honoraires: 3000, heuresConsommees: 120, boniMali: -600, dossiersDepasses: 1, valorisation: null });
      expect(t.lignes[0].valorisation).toBeNull();
    });
  });
});
