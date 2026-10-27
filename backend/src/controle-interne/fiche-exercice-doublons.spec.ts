import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ControleInterneService } from './controle-interne.service';
import { ObjectifsService } from '../objectifs/objectifs.service';
import { AnalyseStrategiqueService } from '../analyse-strategique/analyse-strategique.service';
import { ControleInterne } from '../entities/controle-interne.entity';
import { ObjectifsClient } from '../entities/objectifs-client.entity';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';
import { Exercice } from '../entities/exercice.entity';
import { ClientsService } from '../clients/clients.service';

/**
 * Fiches « par exercice » (contrôle interne, objectifs, analyse stratégique) : l'ancienne
 * lecture get-or-create, appelée deux fois à l'ouverture de l'onglet, créait des doublons ;
 * lectures et écritures tombaient ensuite au hasard sur l'une ou l'autre fiche.
 */
const cas = [
  { nom: 'contrôle interne', service: ControleInterneService, entite: ControleInterne, upsert: (s: any, d: any) => s.upsert(21, 2, d, { id: 1, role: 'ADMIN' }) },
  { nom: 'objectifs', service: ObjectifsService, entite: ObjectifsClient, upsert: (s: any, d: any) => s.upsert(21, 2, d) },
  { nom: 'analyse stratégique', service: AnalyseStrategiqueService, entite: AnalyseStrategique, upsert: (s: any, d: any) => s.upsert(21, 2, d) },
];

describe.each(cas)('fiche par exercice — $nom', ({ service, entite, upsert }) => {
  let svc: any;
  const repo = {
    findOne: jest.fn(),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (d: any) => ({ id: 99, ...d })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        service,
        { provide: getRepositoryToken(entite), useValue: repo },
        { provide: getRepositoryToken(Exercice), useValue: { findOne: jest.fn().mockResolvedValue({ id: 2, statut: 'OUVERT' }) } },
        { provide: ClientsService, useValue: { assertCanEdit: jest.fn() } },
      ],
    }).compile();
    svc = module.get(service);
  });

  it("la lecture ne crée jamais de fiche (plus de doublon à l'ouverture de l'onglet)", async () => {
    repo.findOne.mockResolvedValue(null);
    const fiche = await svc.findByExercice(21, 2);
    expect(fiche).toMatchObject({ clientId: 21, exerciceId: 2 });
    expect(fiche.id).toBeUndefined();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('lit et enregistre toujours dans la fiche la plus récemment modifiée', async () => {
    repo.findOne.mockResolvedValue({ id: 12, clientId: 21, exerciceId: 2 });
    await svc.findByExercice(21, 2);
    await upsert(svc, { noteGenerale: 'x' });
    for (const appel of repo.findOne.mock.calls.filter(c => c[0]?.where?.clientId === 21)) {
      expect(appel[0]).toEqual({ where: { clientId: 21, exerciceId: 2 }, order: { updatedAt: 'DESC', id: 'DESC' } });
    }
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 12, noteGenerale: 'x' }));
  });

  it('crée la fiche au premier enregistrement', async () => {
    repo.findOne.mockResolvedValue(null);
    await upsert(svc, { noteGenerale: 'première saisie' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ clientId: 21, exerciceId: 2, noteGenerale: 'première saisie' }));
  });
});

it('contrôle interne : une fiche vide reprend la valeur par défaut de « mission de conseil potentielle »', async () => {
  const repo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d: any) => ({ ...d })), save: jest.fn() };
  const module = await Test.createTestingModule({
    providers: [
      ControleInterneService,
      { provide: getRepositoryToken(ControleInterne), useValue: repo },
      { provide: getRepositoryToken(Exercice), useValue: {} },
      { provide: ClientsService, useValue: {} },
    ],
  }).compile();
  expect((await module.get(ControleInterneService).findByExercice(21, 2)).missionConseilPotentielle).toBe(false);
});
