import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FluxMensuelService } from './flux-mensuel.service';
import { FluxMensuel, StatutDepot } from '../entities/flux-mensuel.entity';
import { ClientsService } from '../clients/clients.service';

// ── Données de test ──────────────────────────────────
const makeFlux = (overrides: Partial<FluxMensuel> = {}): FluxMensuel =>
  ({
    id: 1,
    type: 'RELEVE_BANCAIRE',
    mois: 3,
    annee: 2026,
    statut: StatutDepot.MANQUANT,
    dateDepot: null,
    dateRelance: null,
    commentaire: null,
    createdAt: new Date(),
    client: { id: 42 } as any,
    ...overrides,
  } as FluxMensuel);

const mockQB = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([makeFlux()]),
};

const mockRepo = {
  create:             jest.fn((v: any) => (Array.isArray(v) ? v : { ...v })),
  save:               jest.fn().mockImplementation((v: any) => Promise.resolve(Array.isArray(v) ? v : { id: 1, ...v })),
  findOne:            jest.fn().mockResolvedValue(makeFlux()),
  find:               jest.fn().mockResolvedValue([makeFlux()]),
  update:             jest.fn().mockResolvedValue({}),
  delete:             jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn().mockReturnValue(mockQB),
};

const mockClientsService = {};

describe('FluxMensuelService', () => {
  let service: FluxMensuelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FluxMensuelService,
        { provide: getRepositoryToken(FluxMensuel), useValue: mockRepo },
        { provide: ClientsService, useValue: mockClientsService },
      ],
    }).compile();

    service = module.get<FluxMensuelService>(FluxMensuelService);
    jest.clearAllMocks();
    mockRepo.create.mockImplementation((v: any) => (Array.isArray(v) ? v : { ...v }));
    mockRepo.save.mockImplementation((v: any) => Promise.resolve(Array.isArray(v) ? v : { id: 1, ...v }));
    mockRepo.findOne.mockResolvedValue(makeFlux());
    mockRepo.createQueryBuilder.mockReturnValue(mockQB);
    mockQB.getMany.mockResolvedValue([makeFlux()]);
  });

  // ── create ────────────────────────────────────────────────────────

  describe('create', () => {
    it('accepte un type standard (RELEVE_BANCAIRE)', async () => {
      const dto = { type: 'RELEVE_BANCAIRE', mois: 3, annee: 2026, statut: StatutDepot.MANQUANT };
      await service.create(42, dto as any);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'RELEVE_BANCAIRE', mois: 3, annee: 2026 }),
      );
    });

    it('accepte un type personnalisé (CUSTOM_xxx)', async () => {
      const dto = { type: 'CUSTOM_RELEVE_CHARGES_1234567890', mois: 5, annee: 2026, statut: StatutDepot.MANQUANT };
      await service.create(42, dto as any);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CUSTOM_RELEVE_CHARGES_1234567890' }),
      );
    });

    it('associe le flux au bon client', async () => {
      await service.create(99, { type: 'PAIE', mois: 1, annee: 2026 } as any);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ client: { id: 99 } }),
      );
    });
  });

  // ── findByClient ──────────────────────────────────────────────────

  describe('findByClient', () => {
    it('filtre par clientId', async () => {
      await service.findByClient(42);
      expect(mockQB.where).toHaveBeenCalledWith('flux.clientId = :clientId', { clientId: 42 });
    });

    it('filtre par année si fournie', async () => {
      await service.findByClient(42, 2025);
      expect(mockQB.andWhere).toHaveBeenCalledWith('flux.annee = :annee', { annee: 2025 });
    });

    it('ne filtre pas par année si absente', async () => {
      await service.findByClient(42);
      expect(mockQB.andWhere).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe('update', () => {
    it('lève NotFoundException si le flux est introuvable', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, 42, { statut: StatutDepot.DEPOSE })).rejects.toThrow(NotFoundException);
    });

    it('renseigne dateDepot quand le statut passe à DEPOSE', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeFlux({ dateDepot: null })) // premier appel : flux sans dateDepot
        .mockResolvedValueOnce(makeFlux({ statut: StatutDepot.DEPOSE, dateDepot: new Date() })); // second appel : après update

      await service.update(1, 42, { statut: StatutDepot.DEPOSE });

      const call = mockRepo.update.mock.calls[0];
      expect(call[1]).toMatchObject({ statut: StatutDepot.DEPOSE });
      expect(call[1].dateDepot).toBeInstanceOf(Date);
    });

    it('ne réinitialise pas dateDepot si déjà défini', async () => {
      const existingDate = new Date('2026-03-01');
      mockRepo.findOne
        .mockResolvedValueOnce(makeFlux({ dateDepot: existingDate }))
        .mockResolvedValueOnce(makeFlux({ dateDepot: existingDate }));

      await service.update(1, 42, { statut: StatutDepot.DEPOSE });

      const call = mockRepo.update.mock.calls[0];
      expect(call[1].dateDepot).toBeUndefined();
    });

    it('enregistre dateRelance pour MANQUANT', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeFlux())
        .mockResolvedValueOnce(makeFlux({ statut: StatutDepot.MANQUANT }));

      await service.update(1, 42, { statut: StatutDepot.MANQUANT });

      const call = mockRepo.update.mock.calls[0];
      expect(call[1].dateRelance).toBeInstanceOf(Date);
    });
  });

  // ── remove ────────────────────────────────────────────────────────

  describe('remove', () => {
    it('supprime le flux et retourne un message', async () => {
      const result = await service.remove(1, 42);
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
      expect(result.message).toContain('supprimé');
    });

    it('lève NotFoundException si le flux est introuvable', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 42)).rejects.toThrow(NotFoundException);
    });
  });

  // ── type personnalisé : intégration bout en bout ─────────────────

  describe('type personnalisé (CUSTOM_*)', () => {
    it('créer puis retrouver un flux avec un type custom', async () => {
      const customType = 'CUSTOM_RELEVE_CHARGES_1720000000000';
      const fluxCustom = makeFlux({ type: customType });

      mockRepo.findOne.mockResolvedValue(fluxCustom);
      mockQB.getMany.mockResolvedValue([fluxCustom]);

      await service.create(42, { type: customType, mois: 6, annee: 2026, statut: StatutDepot.MANQUANT } as any);
      const liste = await service.findByClient(42, 2026);

      expect(liste.some(f => f.type === customType)).toBe(true);
    });
  });
});
