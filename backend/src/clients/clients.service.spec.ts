import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientsService, computeExercice } from './clients.service';
import { Client, ClientSite } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { User, UserRole } from '../entities/user.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';
import { MinioService } from '../storage/minio.service';
import { NotificationsService } from '../notifications/notifications.service';

const admin   = { id: 1, role: UserRole.ADMIN, tenantId: 1 } as User;
const expert  = { id: 2, role: UserRole.EXPERT_COMPTABLE, tenantId: 1 } as User;
const collab  = { id: 3, role: UserRole.COLLABORATEUR, tenantId: 1 } as User;
const autre   = { id: 4, role: UserRole.COLLABORATEUR, tenantId: 1 } as User;
const intrus  = { id: 5, role: UserRole.ADMIN, tenantId: 2 } as User;

const makeClient = (p: Partial<Client> = {}): Client => ({
  id: 1, nom: 'Boulangerie Du Four', site: ClientSite.EST, isActive: true, tenantId: 1,
  responsableId: 3, directeurId: null, collaborateurOuestId: null, createdById: 1,
  ...p,
} as unknown as Client);

const qb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};
const clientRepo = {
  create: jest.fn((d: any) => ({ ...d })),
  save: jest.fn(async (c: any) => ({ id: 10, ...c })),
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn(() => qb),
};
const ficheRepo    = { create: jest.fn((d: any) => d), save: jest.fn(async (d: any) => d) };
const exerciceRepo = { create: jest.fn((d: any) => d), save: jest.fn(async (d: any) => d) };
const notifications = { emit: jest.fn() };

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    qb.getMany.mockResolvedValue([makeClient()]);
    clientRepo.findOne.mockResolvedValue(makeClient());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(FicheIdentite), useValue: ficheRepo },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Exercice), useValue: exerciceRepo },
        { provide: MinioService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(ClientsService);
  });

  describe('findAll', () => {
    it('ne liste que les dossiers actifs du tenant de l’utilisateur', async () => {
      const res = await service.findAll(collab);
      expect(res).toHaveLength(1);
      expect(qb.where).toHaveBeenCalledWith('client.isActive = :active', { active: true });
      expect(qb.andWhere).toHaveBeenCalledWith('client.tenantId = :tenantId', { tenantId: 1 });
    });

    it('filtre par site et par intervenant si fournis', async () => {
      await service.findAll(admin, 'EST', 3);
      expect(qb.andWhere).toHaveBeenCalledWith('client.site = :site', { site: 'EST' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(client.responsableId = :cid OR client.collaborateurOuestId = :cid OR client.directeurId = :cid)', { cid: 3 },
      );
    });

    it('charge la fiche identité (honoraires) avec la liste', async () => {
      await service.findAll(collab);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('client.ficheIdentite', 'ficheIdentite');
    });
  });

  describe('findOne / findOneForUser', () => {
    it('retourne le dossier par son id', async () => {
      const res = await service.findOne(1);
      expect(res.nom).toBe('Boulangerie Du Four');
    });

    it('lève NotFoundException si le dossier est introuvable', async () => {
      clientRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it("refuse l'accès à un dossier d'un autre cabinet", async () => {
      await expect(service.findOneForUser(1, intrus)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('crée le dossier, sa fiche identité et le premier exercice si une clôture est fournie', async () => {
      await service.create({ nom: 'Nouveau', site: ClientSite.OUEST, dateClotureExercice: '12-31' } as any, admin);
      expect(clientRepo.save).toHaveBeenCalled();
      expect(ficheRepo.save).toHaveBeenCalled();
      expect(exerciceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ clientId: 10, statut: ExerciceStatut.OUVERT }));
    });

    it("assigne le créateur non ADMIN comme responsable", async () => {
      await service.create({ nom: 'Nouveau', site: ClientSite.EST } as any, collab);
      const saved = clientRepo.save.mock.calls[0][0] as any;
      expect(saved.responsable).toBe(collab);
      expect(saved.tenantId).toBe(1);
      expect(exerciceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('archive le dossier (isActive = false) pour son responsable', async () => {
      await service.remove(1, collab);
      expect(clientRepo.update).toHaveBeenCalledWith(1, { isActive: false });
    });

    it("refuse l'archivage à un collaborateur ni créateur ni responsable", async () => {
      await expect(service.remove(1, autre)).rejects.toThrow(ForbiddenException);
      expect(clientRepo.update).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le dossier est introuvable', async () => {
      clientRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertCanEdit', () => {
    it('autorise ADMIN, expert-comptable et intervenants', async () => {
      await expect(service.assertCanEdit(1, admin)).resolves.toBeUndefined();
      await expect(service.assertCanEdit(1, expert)).resolves.toBeUndefined();
      await expect(service.assertCanEdit(1, collab)).resolves.toBeUndefined();
    });

    it('refuse un collaborateur non assigné', async () => {
      await expect(service.assertCanEdit(1, autre)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('computeExercice', () => {
    it("couvre 12 mois : du lendemain de la clôture précédente jusqu'à la prochaine clôture", () => {
      expect(computeExercice('12-31', new Date(2026, 9, 19))).toEqual({ annee: 2026, dateOuverture: '2026-01-01', dateCloture: '2026-12-31' });
      expect(computeExercice('09-30', new Date(2026, 9, 19))).toEqual({ annee: 2027, dateOuverture: '2026-10-01', dateCloture: '2027-09-30' });
      expect(computeExercice('09-30', new Date(2026, 8, 30))).toEqual({ annee: 2026, dateOuverture: '2025-10-01', dateCloture: '2026-09-30' });
    });

    it("ne décale pas l'ouverture d'un jour sur un serveur en UTC+4 (Réunion)", () => {
      const tz = process.env.TZ;
      process.env.TZ = 'Indian/Reunion';
      try {
        expect(computeExercice('12-31', new Date(2026, 9, 19)).dateOuverture).toBe('2026-01-01');
      } finally {
        process.env.TZ = tz;
      }
    });
  });
});
