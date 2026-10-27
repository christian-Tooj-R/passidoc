import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { AffairesService } from './affaires.service';
import { Exercice } from '../entities/exercice.entity';
import { Client } from '../entities/client.entity';
import { SaisieTemps } from '../entities/saisie-temps.entity';
import { BudgetDossier } from '../entities/budget-dossier.entity';

const exerciceRepo = { find: jest.fn() };
const clientRepo = { find: jest.fn(), findOne: jest.fn() };
const qb: any = { select: jest.fn(() => qb), where: jest.fn(() => qb), getRawMany: jest.fn().mockResolvedValue([]) };
const saisieRepo = { find: jest.fn(), update: jest.fn().mockResolvedValue({}), createQueryBuilder: jest.fn(() => qb) };
const budgetRepo = { find: jest.fn().mockResolvedValue([]) };

describe('AffairesService', () => {
  let service: AffairesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    clientRepo.find.mockResolvedValue([{ id: 1, dateClotureExercice: '09-30' }, { id: 2, dateClotureExercice: null }]);
    exerciceRepo.find.mockResolvedValue([{ clientId: 1, dateOuverture: '2025-10-01', dateCloture: '2026-09-30', statut: 'OUVERT' }]);
    const module = await Test.createTestingModule({
      providers: [
        AffairesService,
        { provide: getRepositoryToken(Exercice), useValue: exerciceRepo },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(SaisieTemps), useValue: saisieRepo },
        { provide: getRepositoryToken(BudgetDossier), useValue: budgetRepo },
      ],
    }).compile();
    service = module.get(AffairesService);
  });

  it('résout une affaire en tenant compte des exercices PASSIDOC du dossier', async () => {
    // exercice 2026 encore ouvert → la révision d'octobre 2026 reste sur C2026-09
    expect(await service.resoudre(1, '2026-10-16', 'TCO')).toBe('C2026-09');
    expect(await service.resoudre(2, '2026-10-16')).toBe('C2026-12');
    expect(await service.resoudre(null, '2026-10-16')).toBeNull();
  });

  it('rattrape au démarrage les saisies sans affaire, par lots, sans toucher aux autres', async () => {
    saisieRepo.find
      .mockResolvedValueOnce([
        { id: 11, clientId: 1, date: '2026-10-16', missionCode: null },
        { id: 12, clientId: 1, date: '2026-02-17', missionCode: 'TCO' },
        { id: 13, clientId: 2, date: '2026-05-10', missionCode: null },
      ])
      .mockResolvedValueOnce([]); // pôles de travail : rien à rattraper
    await service.onApplicationBootstrap();
    expect(saisieRepo.update).toHaveBeenCalledWith({ id: In([11, 12]) }, { affaire: 'C2026-09' });
    expect(saisieRepo.update).toHaveBeenCalledWith({ id: In([13]) }, { affaire: 'C2026-12' });
    expect(saisieRepo.update).toHaveBeenCalledTimes(2);
  });

  it('rattrape au démarrage le pôle de travail des saisies antérieures (site du collaborateur)', async () => {
    saisieRepo.find
      .mockResolvedValueOnce([]) // affaires : rien à rattraper — ne doit pas court-circuiter la suite
      .mockResolvedValueOnce([
        { id: 21, collaborateur: { id: 1, site: 'EST' } },
        { id: 22, collaborateur: { id: 2, site: 'OUEST' } },
        { id: 23, collaborateur: null },
      ]);
    await service.onApplicationBootstrap();
    expect(saisieRepo.update).toHaveBeenCalledWith({ id: In([21, 23]) }, { lieuTravail: 'EST' });
    expect(saisieRepo.update).toHaveBeenCalledWith({ id: In([22]) }, { lieuTravail: 'OUEST' });
  });

  it('ne fait rien quand tout est déjà attribué, et ne bloque jamais le démarrage', async () => {
    saisieRepo.find.mockResolvedValue([]);
    await service.onApplicationBootstrap();
    expect(saisieRepo.update).not.toHaveBeenCalled();
    saisieRepo.find.mockRejectedValue(new Error('colonne absente'));
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it("refuse de lister les affaires d'un dossier d'un autre cabinet", async () => {
    clientRepo.findOne.mockResolvedValue(null);
    await expect(service.lister(1, 99)).rejects.toThrow(NotFoundException);
    expect(clientRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, tenantId: 99 } }));
  });

  it('liste aussi les affaires déjà portées par des saisies ou des budgets', async () => {
    clientRepo.findOne.mockResolvedValue({ id: 1 });
    qb.getRawMany.mockResolvedValue([{ affaire: 'C2023-09' }]);
    budgetRepo.find.mockResolvedValue([{ affaire: 'C2030-09' }]);
    const codes = (await service.lister(1, 1)).map(a => a.code);
    expect(codes).toEqual(expect.arrayContaining(['C2023-09', 'C2030-09', 'C2026-09']));
  });
});
