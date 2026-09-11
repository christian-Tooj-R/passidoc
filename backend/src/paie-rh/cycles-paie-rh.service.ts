import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CyclePaieRh, StatutCyclePaieRh } from '../entities/cycle-paie-rh.entity';
import { BulletinSalarie } from '../entities/bulletin-salarie.entity';
import { ContratsTravailService } from './contrats-travail.service';
import { BulletinsSalarieService } from './bulletins-salarie.service';
import { ExercicesRhService } from './exercices-rh.service';

/**
 * Cycle mensuel de paie interne AFYM (CDC §10) : ouverture de la période, liste des
 * salariés à traiter (tous ceux ayant un contrat ACTIF), calcul en masse, validation,
 * clôture (verrouillage/immutabilité).
 */
@Injectable()
export class CyclesPaieRhService {
  constructor(
    @InjectRepository(CyclePaieRh) private repo: Repository<CyclePaieRh>,
    @InjectRepository(BulletinSalarie) private bulletinRepo: Repository<BulletinSalarie>,
    private contratsService: ContratsTravailService,
    private bulletinsService: BulletinsSalarieService,
    private exercicesService: ExercicesRhService,
  ) {}

  async ouvrir(mois: number, annee: number, tenantId: number): Promise<CyclePaieRh> {
    let cycle = await this.repo.findOne({ where: { mois, annee, tenantId } });
    if (cycle) return cycle;

    // Un cycle mensuel ne peut être ouvert que sur une année dont l'exercice RH est OUVERT
    // (~"un seul exercice ouvert" RADIAN/URA) — voir ExercicesRhService.
    const exerciceOuvert = await this.exercicesService.findOuvert(tenantId);
    if (!exerciceOuvert || exerciceOuvert.annee !== annee) {
      throw new BadRequestException(
        `Aucun exercice RH ${annee} ouvert — ouvrez l'exercice RH ${annee} (menu "Période en cours") avant de démarrer un cycle de paie sur cette année.`,
      );
    }

    const actifs = await this.contratsService.findTousActifs(tenantId);
    cycle = this.repo.create({
      tenantId, mois, annee,
      statut: StatutCyclePaieRh.OUVERT,
      nbSalaries: actifs.length,
    });
    return this.repo.save(cycle);
  }

  async findOne(mois: number, annee: number, tenantId: number): Promise<CyclePaieRh> {
    const cycle = await this.repo.findOne({ where: { mois, annee, tenantId } });
    if (!cycle) throw new NotFoundException(`Aucun cycle de paie ouvert pour ${mois}/${annee}`);
    return cycle;
  }

  findAll(tenantId: number): Promise<CyclePaieRh[]> {
    return this.repo.find({ where: { tenantId }, order: { annee: 'DESC', mois: 'DESC' } });
  }

  /** Liste des salariés à traiter pour la période (contrat actif), avec le statut de leur bulletin. */
  async listerSalariesATraiter(mois: number, annee: number, tenantId: number) {
    const actifs = await this.contratsService.findTousActifs(tenantId);
    const bulletins = await this.bulletinsService.findByPeriode(mois, annee, tenantId);
    // Un seul bulletin affiché par salarié : le plus récemment généré (hors régularisation),
    // pour ne jamais faire remonter un ancien snapshot si plusieurs lignes coexistent.
    const bulletinParSalarie = new Map<number, BulletinSalarie>();
    for (const b of bulletins) {
      if (b.estRegularisation) continue;
      const courant = bulletinParSalarie.get(b.salarieId);
      if (!courant || new Date(b.dateGeneration) > new Date(courant.dateGeneration)) bulletinParSalarie.set(b.salarieId, b);
    }

    return actifs.map((contrat) => {
      const bulletin = bulletinParSalarie.get(contrat.salarieId);
      return {
        salarieId: contrat.salarieId,
        salarie: (contrat as any).salarie
          ? {
              id: (contrat as any).salarie.id, firstName: (contrat as any).salarie.firstName,
              lastName: (contrat as any).salarie.lastName, site: (contrat as any).salarie.site,
              devise: (contrat as any).salarie.devise,
            }
          : undefined,
        contratId: contrat.id,
        regimePaieCode: contrat.regimePaieCode,
        salaireBase: Number(contrat.salaireBase),
        bulletinId: bulletin?.id ?? null,
        bulletinStatut: bulletin ? 'GENERE' : 'A_TRAITER',
        netAPayer: bulletin ? Number(bulletin.netAPayer) : null,
        totalBrut: bulletin ? Number(bulletin.totalBrut) : null,
        totalCotisationsSalariales: bulletin ? Number(bulletin.totalCotisationsSalariales) : null,
        totalCotisationsPatronales: bulletin ? Number(bulletin.totalCotisationsPatronales) : null,
        coutEmployeur: bulletin ? Number(bulletin.coutEmployeur) : null,
      };
    });
  }

  /**
   * Calcule (génère) le bulletin des salariés à traiter. Par défaut seuls ceux SANS bulletin
   * sont traités ; avec `forcer`, tous sont (re)générés — les bulletins déjà payés sont
   * refusés par `BulletinsSalarieService.generer()` et remontent dans `erreurs`.
   */
  async calculerTout(
    mois: number, annee: number, tenantId: number, forcer = false,
  ): Promise<{ generes: number; erreurs: Array<{ salarieId: number; message: string }> }> {
    const cycle = await this.ouvrir(mois, annee, tenantId);
    if (cycle.statut === StatutCyclePaieRh.CLOTURE) {
      throw new BadRequestException('Ce cycle est clôturé — impossible de recalculer.');
    }

    const actifs = await this.contratsService.findTousActifs(tenantId);
    const bulletinsExistants = await this.bulletinsService.findByPeriode(mois, annee, tenantId);
    const dejaTraites = new Set(bulletinsExistants.map((b) => b.salarieId));

    let generes = 0;
    const erreurs: Array<{ salarieId: number; message: string }> = [];

    for (const contrat of actifs) {
      if (!forcer && dejaTraites.has(contrat.salarieId)) continue;
      try {
        await this.bulletinsService.generer(contrat.salarieId, mois, annee, tenantId);
        generes++;
      } catch (e: any) {
        erreurs.push({ salarieId: contrat.salarieId, message: e?.message ?? 'Erreur inconnue' });
      }
    }

    await this.recalculerTotaux(cycle.id, mois, annee, tenantId, StatutCyclePaieRh.CALCULE);
    return { generes, erreurs };
  }

  async valider(mois: number, annee: number, tenantId: number, valideParId: number): Promise<CyclePaieRh> {
    const cycle = await this.findOne(mois, annee, tenantId);
    const bulletins = await this.bulletinsService.findByPeriode(mois, annee, tenantId);
    const actifs = await this.contratsService.findTousActifs(tenantId);
    if (bulletins.length < actifs.length) {
      throw new BadRequestException(
        `Tous les salariés actifs n'ont pas de bulletin généré (${bulletins.length}/${actifs.length}) — calculez le cycle avant de le valider.`,
      );
    }
    cycle.statut = StatutCyclePaieRh.VALIDE;
    cycle.dateValidation = new Date();
    cycle.valideParId = valideParId;
    return this.repo.save(cycle);
  }

  /** Clôture : verrouille définitivement la période (immutabilité — CDC §1). */
  async cloturer(mois: number, annee: number, tenantId: number): Promise<CyclePaieRh> {
    const cycle = await this.findOne(mois, annee, tenantId);
    if (cycle.statut !== StatutCyclePaieRh.VALIDE) {
      throw new BadRequestException('Le cycle doit être VALIDE avant clôture.');
    }
    cycle.statut = StatutCyclePaieRh.CLOTURE;
    cycle.dateCloture = new Date();
    return this.repo.save(cycle);
  }

  private async recalculerTotaux(cycleId: number, mois: number, annee: number, tenantId: number, statut: StatutCyclePaieRh): Promise<void> {
    const bulletins = await this.bulletinRepo.find({ where: { mois, annee, tenantId } });
    const actifs = await this.contratsService.findTousActifs(tenantId);
    const totalBrut = bulletins.reduce((s, b) => s + Number(b.totalBrut), 0);
    const totalNetAPayer = bulletins.reduce((s, b) => s + Number(b.netAPayer), 0);
    await this.repo.update(cycleId, {
      statut,
      // Rafraîchi à chaque calcul : figé à l'ouverture, ce compteur restait à 0 si le cycle
      // avait été ouvert avant la création des contrats ("10 / 0 bulletins générés").
      nbSalaries: actifs.length,
      nbBulletinsGeneres: bulletins.length,
      totalBrut,
      totalNetAPayer,
      dateCalcul: new Date(),
    });
  }
}
