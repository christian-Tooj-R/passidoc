import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContratTravail, HistoriqueContratEntry, StatutContratTravail,
} from '../entities/contrat-travail.entity';
import { User } from '../entities/user.entity';
import { CyclePaieRh, StatutCyclePaieRh } from '../entities/cycle-paie-rh.entity';
import { CreateContratTravailDto, UpdateContratTravailDto } from './dto/contrat-travail.dto';

/** Champs sensibles journalisés dans `historique` à chaque modification (CDC §6.2) */
const CHAMPS_HISTORISES: Array<keyof ContratTravail> = [
  'salaireBase', 'quotiteTravail', 'typeContrat', 'regimePaieCode', 'statut', 'dateFin',
];

@Injectable()
export class ContratsTravailService {
  constructor(
    @InjectRepository(ContratTravail) private repo: Repository<ContratTravail>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CyclePaieRh) private cycleRepo: Repository<CyclePaieRh>,
  ) {}

  async create(dto: CreateContratTravailDto, tenantId: number, createdById: number): Promise<ContratTravail> {
    const user = await this.userRepo.findOne({ where: { id: dto.salarieId } });
    if (!user) throw new NotFoundException(`Salarié ${dto.salarieId} introuvable`);

    // Un seul contrat ACTIF à la fois par salarié : le précédent est marqué ROMPU
    // (l'historique complet reste consultable via findBySalarie).
    const actif = await this.repo.findOne({
      where: { salarieId: dto.salarieId, statut: StatutContratTravail.ACTIF },
    });
    if (actif) {
      actif.statut = StatutContratTravail.ROMPU;
      actif.dateFin = actif.dateFin ?? dto.dateDebut;
      actif.motifFin = dto.motif ?? 'Remplacé par un nouveau contrat';
      await this.repo.save(actif);
    }

    const contrat = this.repo.create({
      salarieId: dto.salarieId,
      typeContrat: dto.typeContrat,
      dateDebut: dto.dateDebut,
      dateFin: dto.dateFin ?? null,
      quotiteTravail: dto.quotiteTravail ?? 100,
      salaireBase: dto.salaireBase,
      // Le régime de paie (taux de cotisation applicables) suit désormais le pôle/antenne
      // (EST/OUEST, géré dans le menu Équipes) — l'ancienne distinction par site
      // (REUNION/MADAGASCAR) est abandonnée. Repli sur 'TOUS' si le salarié n'a pas encore
      // d'antenne assignée (cf. "sans antenne" dans Équipes), pour ne jamais bloquer la
      // création d'un contrat.
      regimePaieCode: dto.regimePaieCode ?? user.antenne ?? 'TOUS',
      tenantId,
      createdById,
      historique: [{
        date: new Date().toISOString(),
        champ: 'creation',
        ancienneValeur: null,
        nouvelleValeur: 'Contrat créé',
        auteurId: createdById,
        motif: dto.motif ?? null,
      }],
    });
    return this.repo.save(contrat);
  }

  findBySalarie(salarieId: number, tenantId: number): Promise<ContratTravail[]> {
    return this.repo.find({
      where: { salarieId, tenantId },
      order: { dateDebut: 'DESC' },
    });
  }

  async findActifBySalarie(salarieId: number, tenantId: number): Promise<ContratTravail | null> {
    return this.repo.findOne({
      where: { salarieId, tenantId, statut: StatutContratTravail.ACTIF },
    });
  }

  /**
   * Contrat applicable à une PÉRIODE DE PAIE donnée (mois/année) — pas forcément le contrat
   * ACTIF actuel. À la création d'un nouveau contrat, l'ancien est marqué ROMPU avec sa
   * `dateFin` renseignée (voir `create()` ci-dessus) : chaque contrat porte donc une plage
   * [dateDebut, dateFin] bien définie. Recalculer un mois passé APRÈS un changement de
   * salaire doit résoudre le contrat qui était en vigueur CE MOIS-LÀ, pas le contrat
   * actuellement actif — sans quoi un recalcul de septembre après une augmentation en
   * octobre appliquerait à tort le nouveau salaire à septembre.
   */
  async findPourPeriode(salarieId: number, mois: number, annee: number, tenantId: number): Promise<ContratTravail | null> {
    const debutPeriode = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const finPeriode = new Date(annee, mois, 0).toISOString().split('T')[0];
    return this.repo
      .createQueryBuilder('c')
      .where('c.salarieId = :salarieId', { salarieId })
      .andWhere('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.dateDebut <= :finPeriode', { finPeriode })
      .andWhere('(c.dateFin IS NULL OR c.dateFin >= :debutPeriode)', { debutPeriode })
      .orderBy('c.dateDebut', 'DESC')
      .getOne();
  }

  /** Tous les salariés avec un contrat actif — base de la liste "à traiter" du cycle mensuel. */
  findTousActifs(tenantId: number): Promise<ContratTravail[]> {
    return this.repo.find({
      where: { tenantId, statut: StatutContratTravail.ACTIF },
      relations: ['salarie'],
    });
  }

  /**
   * Tous les salariés dont le contrat était EN VIGUEUR PENDANT LA PÉRIODE donnée (mois/année)
   * — même principe que `findPourPeriode()` mais pour l'ensemble du tenant. Base de l'écran
   * "Activité" (~"Activité"/"Feuille d'activité" RADIAN) : par opposition à `findTousActifs`,
   * un salarié sorti en cours de période reste inclus pour le mois où il était encore actif.
   */
  async findTousPourPeriode(mois: number, annee: number, tenantId: number): Promise<ContratTravail[]> {
    const debutPeriode = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const finPeriode = new Date(annee, mois, 0).toISOString().split('T')[0];
    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.salarie', 'salarie')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.dateDebut <= :finPeriode', { finPeriode })
      .andWhere('(c.dateFin IS NULL OR c.dateFin >= :debutPeriode)', { debutPeriode })
      .orderBy('salarie.lastName', 'ASC')
      .getMany();
  }

  async findOne(id: number, tenantId: number): Promise<ContratTravail> {
    const contrat = await this.repo.findOne({ where: { id, tenantId } });
    if (!contrat) throw new NotFoundException(`Contrat de travail ${id} introuvable`);
    return contrat;
  }

  async update(id: number, dto: UpdateContratTravailDto, tenantId: number, auteurId: number): Promise<ContratTravail> {
    const contrat = await this.findOne(id, tenantId);
    await this.assertPeriodeModifiable(contrat, tenantId);

    const historique: HistoriqueContratEntry[] = Array.isArray(contrat.historique) ? [...contrat.historique] : [];
    for (const champ of CHAMPS_HISTORISES) {
      if (dto[champ as keyof UpdateContratTravailDto] !== undefined
        && dto[champ as keyof UpdateContratTravailDto] !== (contrat as any)[champ]) {
        historique.push({
          date: new Date().toISOString(),
          champ,
          ancienneValeur: (contrat as any)[champ],
          nouvelleValeur: dto[champ as keyof UpdateContratTravailDto] as unknown,
          auteurId,
          motif: dto.motif ?? null,
        });
      }
    }

    const { motif, ...champs } = dto;
    Object.assign(contrat, champs, { historique });
    return this.repo.save(contrat);
  }

  async remove(id: number, tenantId: number): Promise<void> {
    const contrat = await this.findOne(id, tenantId);
    await this.assertPeriodeModifiable(contrat, tenantId);
    await this.repo.delete(id);
  }

  /**
   * Immutabilité d'une paie clôturée (CDC §1 / critère d'acceptation §34) : si le contrat a
   * déjà servi à générer un bulletin sur un mois dont le cycle est CLOTURE, on interdit sa
   * modification directe (une régularisation doit passer par un nouveau contrat/avenant).
   * Vérification best-effort au niveau du mois courant du dernier cycle clôturé du tenant.
   */
  private async assertPeriodeModifiable(contrat: ContratTravail, tenantId: number): Promise<void> {
    const dernierCloture = await this.cycleRepo.findOne({
      where: { tenantId, statut: StatutCyclePaieRh.CLOTURE },
      order: { annee: 'DESC', mois: 'DESC' },
    });
    if (!dernierCloture) return;
    const dateCloture = `${dernierCloture.annee}-${String(dernierCloture.mois).padStart(2, '0')}-01`;
    if (contrat.dateDebut <= dateCloture && contrat.statut === StatutContratTravail.ROMPU) {
      throw new BadRequestException(
        `Ce contrat est antérieur à une période de paie déjà clôturée (${dernierCloture.mois}/${dernierCloture.annee}) — utilisez une régularisation plutôt qu'une modification directe.`,
      );
    }
  }
}
