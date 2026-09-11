import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ArrondiConstantePaieRh, ConstantePaieRh, OperateurCalculConstante,
  SourceOperandeConstante, TypeConstantePaieRh,
} from '../entities/constante-paie-rh.entity';
import { CreateConstantePaieRhDto, UpdateConstantePaieRhDto } from './dto/constante-paie-rh.dto';
import { resoudreConstante } from './constante-resolution.util';

/**
 * ⚠️ Constantes d'EXEMPLE, générées automatiquement quand un tenant n'a encore aucune
 * constante paramétrée. Valeurs illustratives NON vérifiées — voir Doc/MODULE_PAIE_RH_NOTES.md.
 * `INDEMNITE_TRANSPORT_MAJOREE` démontre la composition (constante CALCUL référençant une
 * autre constante + une valeur littérale), à l'image des constantes calculées Sage
 * ("EV_HP22", "EV_HRSCAL" dans l'analyse vidéo de référence).
 */
const CONSTANTES_PLACEHOLDER: Array<Partial<ConstantePaieRh>> = [
  {
    code: 'TAUX_RETRAITE_COMPL_SALARIAL',
    libelle: 'Taux retraite complémentaire — part salariale (placeholder, à valider)',
    memo: 'RETR_COMPL_SAL',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 3.15,
  },
  {
    code: 'TAUX_RETRAITE_COMPL_PATRONAL',
    libelle: 'Taux retraite complémentaire — part patronale (placeholder, à valider)',
    memo: 'RETR_COMPL_PAT',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 4.72,
  },
  {
    code: 'INDEMNITE_TRANSPORT_FORFAIT',
    libelle: 'Indemnité transport — forfait mensuel de base (placeholder, à valider)',
    memo: 'IND_TRANSP',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 20,
  },
  {
    code: 'INDEMNITE_TRANSPORT_MAJOREE',
    libelle: 'Indemnité transport majorée — exemple de composition (placeholder, à valider)',
    memo: 'IND_TRANSP_MAJ',
    typeConstante: TypeConstantePaieRh.CALCUL,
    operandes: [
      { operateur: OperateurCalculConstante.ADDITION, source: SourceOperandeConstante.CONSTANTE, constanteCode: 'INDEMNITE_TRANSPORT_FORFAIT', valeur: null },
      { operateur: OperateurCalculConstante.ADDITION, source: SourceOperandeConstante.VALEUR, constanteCode: null, valeur: 5 },
    ],
  },
  // ── Réglages moteur — fusionnés depuis l'ancien "Paramètres" (ParametrePaieRh), qui
  // faisait doublon avec Constantes (même structure code+valeur). Voir
  // Doc/MODULE_PAIE_RH_NOTES.md. 151.67 = durée légale mensuelle française usuelle
  // (35h/semaine), 25% = majoration légale des 8 premières heures sup en France. Rien de
  // spécifique à Madagascar n'est connu/documenté dans ce dossier : le même défaut est
  // utilisé pour tous les régimes tant qu'un expert paie n'a pas fourni une valeur
  // différente par régime.
  {
    code: 'HEURES_LEGALES_MOIS',
    libelle: 'Durée légale mensuelle (heures) — placeholder',
    memo: 'HEURES_MOIS',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 151.67,
  },
  {
    code: 'TAUX_MAJORATION_HS_DEFAUT',
    libelle: 'Taux de majoration des heures sup par défaut (%) — placeholder',
    memo: 'MAJ_HS',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 25,
  },
  {
    code: 'PLAFOND_SECU_MENSUEL',
    libelle: 'Plafond mensuel sécurité sociale (indicatif, non branché par défaut) — placeholder',
    memo: 'PLAF_SECU',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 3925,
  },
  {
    code: 'JOURS_OUVRES_MOIS_DEFAUT',
    libelle: "Jours ouvrés par mois utilisés pour valoriser une journée d'absence — placeholder",
    memo: 'JOURS_MOIS',
    typeConstante: TypeConstantePaieRh.VALEUR,
    valeur: 22,
  },
  // ── Taux de maintien de salaire par type d'absence (CDC §8.2 "règles de maintien de
  // salaire") — 100 = salaire maintenu intégralement (aucune retenue), 0 = aucun maintien
  // (retenue intégrale du jour). Valeurs de DÉPART arbitraires (raisonnables mais non
  // certifiées) pour rendre le parcours démontrable — À VALIDER avec un expert paie avant
  // toute utilisation réelle.
  { code: 'MAINTIEN_CONGES_PAYES', libelle: 'Maintien salaire — Congés payés (%) — placeholder', memo: 'MAINT_CP', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 100 },
  { code: 'MAINTIEN_MALADIE', libelle: 'Maintien salaire — Maladie (%) — placeholder', memo: 'MAINT_MAL', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 90 },
  { code: 'MAINTIEN_MATERNITE', libelle: 'Maintien salaire — Maternité (%) — placeholder', memo: 'MAINT_MAT', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 100 },
  { code: 'MAINTIEN_PATERNITE', libelle: 'Maintien salaire — Paternité (%) — placeholder', memo: 'MAINT_PAT', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 100 },
  { code: 'MAINTIEN_SANS_SOLDE', libelle: 'Maintien salaire — Sans solde (%) — placeholder', memo: 'MAINT_SS', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 0 },
  { code: 'MAINTIEN_EVENEMENT_FAMILIAL', libelle: 'Maintien salaire — Événement familial (%) — placeholder', memo: 'MAINT_EVFAM', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 100 },
  { code: 'MAINTIEN_RECUPERATION', libelle: 'Maintien salaire — Récupération (%) — placeholder', memo: 'MAINT_RECUP', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 100 },
  { code: 'MAINTIEN_AUTRE', libelle: 'Maintien salaire — Autre (%) — placeholder', memo: 'MAINT_AUTRE', typeConstante: TypeConstantePaieRh.VALEUR, valeur: 100 },
];

@Injectable()
export class ConstantesPaieRhService {
  constructor(@InjectRepository(ConstantePaieRh) private repo: Repository<ConstantePaieRh>) {}

  async create(dto: CreateConstantePaieRhDto, tenantId: number): Promise<ConstantePaieRh> {
    const constante = this.repo.create({ ...dto, tenantId, estPlaceholder: false } as Partial<ConstantePaieRh>);
    return this.repo.save(constante);
  }

  /**
   * Toutes les lignes du tenant (toutes dates d'effet confondues) — utilisé par l'écran
   * d'administration "Liste des constantes" (historique visible, pas juste la valeur courante).
   */
  async findAllForTenant(tenantId: number): Promise<ConstantePaieRh[]> {
    await this.ensureDefaults(tenantId);
    return this.repo.find({ where: { tenantId }, order: { code: 'ASC', dateEffet: 'DESC' } });
  }

  /**
   * Résout, pour un régime et une date de référence donnés, la ligne la plus récente et la
   * plus spécifique par code (historisation par `dateEffet` + priorité régime spécifique >
   * 'TOUS'). C'est cette liste qui doit être passée au moteur de calcul / à
   * `resoudreConstante()` — jamais `findAllForTenant()` qui contient tout l'historique.
   */
  async findByRegime(regime: string, tenantId: number, dateRef?: string): Promise<ConstantePaieRh[]> {
    await this.ensureDefaults(tenantId);
    const ref = dateRef ?? new Date().toISOString().split('T')[0];

    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('(c.regimePaieCode = :regime OR c.regimePaieCode = :tous)', { regime, tous: 'TOUS' })
      .andWhere('c.dateEffet <= :ref', { ref })
      .getMany();

    const parCode = new Map<string, ConstantePaieRh>();
    for (const row of rows) {
      const existing = parCode.get(row.code);
      if (!existing) {
        parCode.set(row.code, row);
        continue;
      }
      const rowSpecifique = row.regimePaieCode !== 'TOUS';
      const existingSpecifique = existing.regimePaieCode !== 'TOUS';
      if (rowSpecifique !== existingSpecifique) {
        // Un régime spécifique gagne toujours sur 'TOUS', quelle que soit la date d'effet.
        if (rowSpecifique) parCode.set(row.code, row);
        continue;
      }
      // Même spécificité : la dateEffet la plus récente (≤ ref) gagne.
      if (row.dateEffet > existing.dateEffet) parCode.set(row.code, row);
    }
    return Array.from(parCode.values());
  }

  async findOne(id: number, tenantId: number): Promise<ConstantePaieRh> {
    const constante = await this.repo.findOne({ where: { id, tenantId } });
    if (!constante) throw new NotFoundException(`Constante de paie RH ${id} introuvable`);
    return constante;
  }

  async update(id: number, dto: UpdateConstantePaieRhDto, tenantId: number): Promise<ConstantePaieRh> {
    await this.findOne(id, tenantId);
    await this.repo.update(id, dto as any);
    return this.findOne(id, tenantId);
  }

  async remove(id: number, tenantId: number): Promise<void> {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
  }

  /**
   * Prévisualisation de la valeur résolue d'une constante pour un régime/date donnés —
   * utilisée par le "picker" de constante côté front (aperçu live avant sélection) et par
   * l'écran d'édition d'une constante CALCUL (aperçu du résultat de la composition).
   */
  async previsualiser(code: string, regime: string, tenantId: number, dateRef?: string): Promise<number> {
    const constantes = await this.findByRegime(regime, tenantId, dateRef);
    return resoudreConstante(code, constantes);
  }

  /**
   * Génère les constantes d'exemple pour un tenant qui n'en a encore aucune, afin que le
   * parcours (rubriques référençant des constantes) soit démontrable immédiatement. Ne
   * s'exécute qu'une fois (no-op si des constantes existent déjà).
   */
  private async ensureDefaults(tenantId: number): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = CONSTANTES_PLACEHOLDER.map((c) =>
      this.repo.create({ ...c, tenantId, regimePaieCode: 'TOUS', visible: true, estPlaceholder: true } as Partial<ConstantePaieRh>),
    );
    await this.repo.save(rows);
  }
}
