import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValeurActiviteRh, StatutValeurActiviteRh } from '../entities/valeur-activite-rh.entity';
import { Pointage } from '../entities/pointage.entity';
import { CongeAbsence, StatutConge } from '../entities/conge-absence.entity';
import { ContratsTravailService } from './contrats-travail.service';
import { ConstantesPaieRhService } from './constantes-paie-rh.service';
import { resoudreConstante } from './constante-resolution.util';

export type GranulariteActivite = 'hebdomadaire' | 'mensuelle' | 'annuelle';

/** Catalogue FIXE des variables d'activité journalière (~"Gestion de variables" RADIAN,
 *  simplifiée : pas d'écran d'administration en v1, seulement ces 4 variables calculées
 *  depuis les données déjà présentes — pointage applicatif + congés/absences validés). */
export const CATALOGUE_VARIABLES_ACTIVITE = [
  { code: 'PRESENCE', libelle: 'Présence', unite: 'bool' as const },
  { code: 'ABSENCE', libelle: 'Absence', unite: 'bool' as const },
  { code: 'HEURES_TRAVAILLEES', libelle: 'Heures travaillées', unite: 'h' as const },
  { code: 'HEURES_SUP', libelle: 'Heures supplémentaires', unite: 'h' as const },
];

const joursDuMois = (mois: number, annee: number): string[] => {
  const nbJours = new Date(annee, mois, 0).getDate();
  return Array.from({ length: nbJours }, (_, i) => `${annee}-${String(mois).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
};

/** Numéro de semaine ISO-8601 (lundi=1er jour, semaine 1 = celle contenant le 1er jeudi). */
const semaineIso = (dateStr: string): number => {
  const d = new Date(dateStr + 'T00:00:00Z');
  const jour = (d.getUTCDay() + 6) % 7; // lundi=0..dimanche=6
  d.setUTCDate(d.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diffSemaines = Math.round((d.getTime() - premierJeudi.getTime()) / (7 * 86400000));
  return 1 + diffSemaines;
};

/**
 * "Feuille d'activité" journalière par salarié (~RADIAN : "Calcul Activité" +
 * "Consultation feuille d'activité") — distincte de `VariablesPaieRhService` (résumé
 * MENSUEL, lignes libres primes/absences, entrée directe du moteur de bulletin). Ici,
 * chaque jour reçoit une valeur PAR VARIABLE du catalogue fixe (voir
 * `CATALOGUE_VARIABLES_ACTIVITE`), calculée depuis le pointage applicatif et les congés
 * validés — pas de badgeuse physique ni de planning théorique (hors scope pour AFYM, voir
 * l'analyse de gap RADIAN vs Passidoc).
 */
@Injectable()
export class ActiviteJourRhService {
  constructor(
    @InjectRepository(ValeurActiviteRh) private repo: Repository<ValeurActiviteRh>,
    @InjectRepository(Pointage) private pointageRepo: Repository<Pointage>,
    @InjectRepository(CongeAbsence) private congeRepo: Repository<CongeAbsence>,
    private contratsService: ContratsTravailService,
    private constantesService: ConstantesPaieRhService,
  ) {}

  findCatalogue() {
    return CATALOGUE_VARIABLES_ACTIVITE;
  }

  /** Grille journalière (~onglet "Journalière" de "Consultation feuille d'activité"). */
  async findGrilleJournaliere(
    salarieId: number, variableCode: string, mois: number, annee: number, tenantId: number,
  ): Promise<Array<{ jour: string; semaine: number; valeur: number; statut: StatutValeurActiviteRh | null; id: number | null }>> {
    const jours = joursDuMois(mois, annee);
    const rows = await this.repo.find({ where: { salarieId, variableCode, tenantId } });
    const parJour = new Map(rows.filter((r) => jours.includes(r.date)).map((r) => [r.date, r]));

    return jours.map((jour) => {
      const r = parJour.get(jour);
      return {
        jour,
        semaine: semaineIso(jour),
        valeur: r ? Number(r.valeur) : 0,
        statut: r?.statut ?? null,
        id: r?.id ?? null,
      };
    });
  }

  /** Regroupement hebdomadaire/mensuel/annuel (~onglets Hebdomadaire/Mensuelle/Annuel). */
  async findRollup(
    salarieId: number, variableCode: string, granularite: GranulariteActivite, mois: number, annee: number, tenantId: number,
  ): Promise<Array<{ periode: string; valeur: number }>> {
    const isBooleenne = CATALOGUE_VARIABLES_ACTIVITE.find((v) => v.code === variableCode)?.unite === 'bool';

    if (granularite === 'annuelle') {
      const rows = await this.repo.find({ where: { salarieId, variableCode, tenantId } });
      const parAnnee = new Map<number, number>();
      for (const r of rows) {
        const a = Number(r.date.slice(0, 4));
        parAnnee.set(a, (parAnnee.get(a) ?? 0) + Number(r.valeur));
      }
      return Array.from(parAnnee.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([a, v]) => ({ periode: String(a), valeur: isBooleenne ? v : Math.round(v * 100) / 100 }));
    }

    const jours = await this.findGrilleJournaliere(salarieId, variableCode, mois, annee, tenantId);
    const cle = granularite === 'hebdomadaire'
      ? (j: { jour: string; semaine: number }) => `Semaine ${j.semaine}`
      : () => `${MOIS_FR[mois - 1]} ${annee}`;

    const parCle = new Map<string, number>();
    for (const j of jours) parCle.set(cle(j), (parCle.get(cle(j)) ?? 0) + j.valeur);
    return Array.from(parCle.entries()).map(([periode, valeur]) => ({ periode, valeur: isBooleenne ? valeur : Math.round(valeur * 100) / 100 }));
  }

  /**
   * "Initialiser" : crée les lignes EN_ATTENTE manquantes pour le mois (toutes variables,
   * un ou tous les salariés en contrat sur la période) — ne recrée jamais une ligne déjà
   * calculée/modifiée. Voir règle RADIAN : "on doit initialiser les calculs avant de
   * pouvoir faire le calcul".
   */
  async initialiser(mois: number, annee: number, tenantId: number, salarieId?: number): Promise<{ creees: number }> {
    const salarieIds = await this.resoudreSalarieIds(mois, annee, tenantId, salarieId);
    const jours = joursDuMois(mois, annee);
    const existantes = await this.repo.find({ where: { tenantId } });
    const clesExistantes = new Set(existantes.map((r) => `${r.salarieId}|${r.variableCode}|${r.date}`));

    const aCreer: Partial<ValeurActiviteRh>[] = [];
    for (const sid of salarieIds) {
      for (const v of CATALOGUE_VARIABLES_ACTIVITE) {
        for (const jour of jours) {
          const cle = `${sid}|${v.code}|${jour}`;
          if (!clesExistantes.has(cle)) {
            aCreer.push({ tenantId, salarieId: sid, variableCode: v.code, date: jour, valeur: 0, statut: StatutValeurActiviteRh.EN_ATTENTE });
          }
        }
      }
    }
    if (aCreer.length) await this.repo.save(this.repo.create(aCreer));
    return { creees: aCreer.length };
  }

  /**
   * "Calculer" : (re)calcule PRESENCE/ABSENCE/HEURES_TRAVAILLEES/HEURES_SUP depuis le
   * pointage applicatif et les congés validés. Initialise à la volée toute ligne
   * manquante. Ignore les lignes MODIFIE_MANUEL sauf `recalculerModifsManuelles`.
   */
  async calculer(
    mois: number, annee: number, tenantId: number, salarieId?: number, recalculerModifsManuelles = false,
  ): Promise<{ calculees: number }> {
    await this.initialiser(mois, annee, tenantId, salarieId);
    const salarieIds = await this.resoudreSalarieIds(mois, annee, tenantId, salarieId);
    const jours = joursDuMois(mois, annee);

    const constantes = await this.constantesService.findByRegime('TOUS', tenantId);
    const heuresLegalesMois = this.getConstanteValeur(constantes, 'HEURES_LEGALES_MOIS', 151.67);
    const joursOuvresMois = this.getConstanteValeur(constantes, 'JOURS_OUVRES_MOIS_DEFAUT', 22);
    const seuilJournalier = joursOuvresMois > 0 ? heuresLegalesMois / joursOuvresMois : 8;

    let calculees = 0;
    for (const sid of salarieIds) {
      const pointages = await this.pointageRepo.find({ where: { userId: sid } });
      const pointageParJour = new Map(pointages.filter((p) => jours.includes(p.date)).map((p) => [p.date, p]));

      const conges = await this.congeRepo
        .createQueryBuilder('c')
        .where('c.userId = :sid', { sid })
        .andWhere('c.statut = :statut', { statut: StatutConge.APPROUVEE })
        .andWhere('c.dateDebut <= :fin', { fin: jours[jours.length - 1] })
        .andWhere('c.dateFin >= :debut', { debut: jours[0] })
        .getMany();
      const estAbsent = (jour: string) => conges.some((c) => c.dateDebut <= jour && c.dateFin >= jour);

      const lignes = await this.repo.find({ where: { tenantId, salarieId: sid } });
      const parCle = new Map(lignes.map((l) => [`${l.variableCode}|${l.date}`, l]));

      for (const jour of jours) {
        const pointage = pointageParJour.get(jour);
        const heuresTravaillees = pointage ? this.calcHeuresNettes(pointage) : 0;
        const valeurs: Record<string, number> = {
          PRESENCE: pointage ? 1 : 0,
          ABSENCE: estAbsent(jour) ? 1 : 0,
          HEURES_TRAVAILLEES: Math.round(heuresTravaillees * 100) / 100,
          HEURES_SUP: Math.round(Math.max(0, heuresTravaillees - seuilJournalier) * 100) / 100,
        };

        for (const v of CATALOGUE_VARIABLES_ACTIVITE) {
          const ligne = parCle.get(`${v.code}|${jour}`);
          if (!ligne) continue;
          if (ligne.statut === StatutValeurActiviteRh.MODIFIE_MANUEL && !recalculerModifsManuelles) continue;
          ligne.valeur = valeurs[v.code];
          ligne.statut = StatutValeurActiviteRh.CALCULE;
          await this.repo.save(ligne);
          calculees++;
        }
      }
    }
    return { calculees };
  }

  /** Modification manuelle d'une valeur (crayon dans la grille) — protège la ligne du recalcul auto. */
  async modifierValeur(id: number, valeur: number, tenantId: number): Promise<ValeurActiviteRh> {
    const ligne = await this.repo.findOne({ where: { id, tenantId } });
    if (!ligne) throw new NotFoundException(`Valeur d'activité ${id} introuvable`);
    ligne.valeur = valeur;
    ligne.statut = StatutValeurActiviteRh.MODIFIE_MANUEL;
    return this.repo.save(ligne);
  }

  private async resoudreSalarieIds(mois: number, annee: number, tenantId: number, salarieId?: number): Promise<number[]> {
    if (salarieId) return [salarieId];
    const contrats = await this.contratsService.findTousPourPeriode(mois, annee, tenantId);
    return contrats.map((c) => c.salarieId);
  }

  /** Heures nettes (arrivée → départ, moins pauses) — même principe que `PointageService.calcNette()`,
   *  dupliqué ici en minutes→heures pour éviter un couplage inter-module (voir `round2` dupliqué ailleurs). */
  private calcHeuresNettes(p: Pointage): number {
    if (!p.heureArrivee) return 0;
    const fin = p.heureDepart ? new Date(p.heureDepart) : new Date(p.heureArrivee);
    const totalMin = Math.max(0, Math.floor((fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000));
    const pauseMin = (p.pauses ?? []).reduce((s, pp) => {
      const finPause = pp.heureFin ? new Date(pp.heureFin) : fin;
      return s + Math.max(0, Math.floor((finPause.getTime() - new Date(pp.heureDebut).getTime()) / 60000));
    }, 0);
    return Math.max(0, totalMin - pauseMin) / 60;
  }

  private getConstanteValeur(constantes: Parameters<typeof resoudreConstante>[1], code: string, defaut: number): number {
    try {
      return resoudreConstante(code, constantes);
    } catch {
      return defaut;
    }
  }
}

const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
