import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client, ClientSite } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';

const mockClient: Client = {
  id: 1,
  nom: 'Boulangerie Du Four',
  site: ClientSite.REUNION,
  santePassation: 0,
  isActive: true,
  logoUrl: null,
  ficheIdentite: null,
  fluxMensuels: [],
  fournisseurs: [],
  synthesesCloture: [],
  documents: [],
  conversationsIA: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockQueryBuilder = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([mockClient]),
};

const mockClientRepo = {
  create: jest.fn().mockReturnValue(mockClient),
  save: jest.fn().mockResolvedValue(mockClient),
  findOne: jest.fn().mockResolvedValue(mockClient),
  update: jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockFicheRepo = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
};

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(FicheIdentite), useValue: mockFicheRepo },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
    mockClientRepo.findOne.mockResolvedValue(mockClient);
    mockClientRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('findAll', () => {
    it('doit retourner la liste des clients actifs', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockClient]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('client.isActive = :active', { active: true });
    });

    it('doit filtrer par site si fourni', async () => {
      await service.findAll('REUNION');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('client.site = :site', { site: 'REUNION' });
    });
  });

  describe('findOne', () => {
    it('doit retourner un client par son id', async () => {
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
      expect(result.nom).toBe('Boulangerie Du Four');
    });

    it('doit lever NotFoundException si le client n\'existe pas', async () => {
      mockClientRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('doit créer un client et une fiche identité vide', async () => {
      await service.create({ nom: 'Nouveau Client', site: ClientSite.MADAGASCAR });
      expect(mockClientRepo.save).toHaveBeenCalled();
      expect(mockFicheRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('doit archiver un client (isActive = false)', async () => {
      await service.remove(1);
      expect(mockClientRepo.update).toHaveBeenCalledWith(1, { isActive: false });
    });

    it('doit lever NotFoundException si le client est introuvable', async () => {
      mockClientRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSantePassation', () => {
    it('doit calculer le score à 0 si aucune donnée', async () => {
      mockClientRepo.findOne.mockResolvedValue({
        ...mockClient,
        ficheIdentite: {},
        fluxMensuels: [],
        fournisseurs: [],
        synthesesCloture: [],
        documents: [],
      });
      await service.updateSantePassation(1);
      expect(mockClientRepo.update).toHaveBeenCalledWith(1, { santePassation: 0 });
    });

    it('doit calculer un score partiel si certaines données sont présentes', async () => {
      mockClientRepo.findOne.mockResolvedValue({
        ...mockClient,
        ficheIdentite: { raisonSociale: 'Test', siren: '123456789', gerants: [{ nom: 'G' }] },
        fluxMensuels: [{ id: 1 }],
        fournisseurs: [],
        synthesesCloture: [],
        documents: [],
      });
      await service.updateSantePassation(1);
      const call = mockClientRepo.update.mock.calls[0];
      expect(call[1].santePassation).toBeGreaterThan(0);
      expect(call[1].santePassation).toBeLessThanOrEqual(100);
    });
  });
});
