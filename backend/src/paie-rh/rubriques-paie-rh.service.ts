import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ImputationRubriqueRh, RubriquePaieRh, SourceOperandeRubriqueRh, TypeCalculRubriqueRh,
  elementParDefaut, operandeParDefaut,
} from '../entities/rubrique-paie-rh.entity';
import { CreateRubriquePaieRhDto, UpdateRubriquePaieRhDto } from './dto/rubrique-paie-rh.dto';

/**
 * ⚠️ Rubriques d'EXEMPLE, générées automatiquement quand un tenant n'a encore aucune
 * rubrique paramétrée pour la paie interne, pour permettre de démontrer le parcours de
 * bout en bout — refonte du calcul guidé (~Sage 100 Paie & RH, voir
 * Doc/MODULE_PAIE_RH_NOTES.md). Ces taux ne proviennent d'AUCUNE source officielle du
 * dossier. À faire valider avant toute mise en production réelle.
 *
 * Démontre volontairement les 3 usages clés de la refonte :
 * - `TOTAL_BRUT_MENSUEL` : rubrique TOTALISATION (nature "non soumise", imputation
 *   INFORMATION) servant d'ASSIETTE explicite pour `SECU_MALADIE` (`assietteRubriqueCode`).
 * - `RETRAITE_COMPL` : taux salarial/patronal référencés via une `ConstantePaieRh`
 *   (au lieu d'une valeur en dur) — ouvre le "picker" de constante côté front.
 * - `INDEMNITE_TRANSPORT` : type MONTANT_FIXE dont la Base référence elle aussi une
 *   constante (`INDEMNITE_TRANSPORT_FORFAIT`) — reproduit l'exemple Sage "rubrique 115".
 */
const RUBRIQUES_PLACEHOLDER: Array<Partial<RubriquePaieRh>> = [
  {
    code: 'TOTAL_BRUT_MENSUEL',
    libelle: 'Total brut mensuel (placeholder — totalisation, à valider)',
    memo: 'TOTAL_BRUT',
    typeCalcul: TypeCalculRubriqueRh.TOTALISATION,
    elementSalarial: elementParDefaut(),
    imputation: ImputationRubriqueRh.INFORMATION,
    ordreAffichage: 5,
  },
  {
    code: 'SECU_MALADIE',
    libelle: 'Sécurité sociale — Maladie (placeholder, à valider)',
    memo: 'SECU_MAL',
    typeCalcul: TypeCalculRubriqueRh.BASE_X_TAUX,
    elementSalarial: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: operandeParDefaut(0),
    },
    elementPatronal: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: operandeParDefaut(7),
    },
    assietteRubriqueCode: 'TOTAL_BRUT_MENSUEL',
    imputation: ImputationRubriqueRh.COTISATION,
    ordreAffichage: 10,
  },
  {
    code: 'RETRAITE_COMPL',
    libelle: 'Retraite complémentaire (placeholder, à valider)',
    memo: 'RETR_COMPL',
    typeCalcul: TypeCalculRubriqueRh.BASE_X_TAUX,
    elementSalarial: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: { source: SourceOperandeRubriqueRh.CONSTANTE, valeur: null, constanteCode: 'TAUX_RETRAITE_COMPL_SALARIAL' },
    },
    elementPatronal: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: { source: SourceOperandeRubriqueRh.CONSTANTE, valeur: null, constanteCode: 'TAUX_RETRAITE_COMPL_PATRONAL' },
    },
    imputation: ImputationRubriqueRh.COTISATION,
    ordreAffichage: 20,
  },
  {
    code: 'CHOMAGE',
    libelle: 'Assurance chômage (placeholder, à valider)',
    memo: 'CHOMAGE',
    typeCalcul: TypeCalculRubriqueRh.BASE_X_TAUX,
    elementSalarial: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: operandeParDefaut(0),
    },
    elementPatronal: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: operandeParDefaut(4.05),
    },
    imputation: ImputationRubriqueRh.COTISATION,
    ordreAffichage: 30,
  },
  {
    code: 'CSG_CRDS',
    libelle: 'CSG / CRDS (placeholder — non déductible ignoré en v1, à valider)',
    memo: 'CSG_CRDS',
    typeCalcul: TypeCalculRubriqueRh.BASE_X_TAUX,
    elementSalarial: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: operandeParDefaut(9.7),
    },
    elementPatronal: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.BRUT, valeur: null, constanteCode: null },
      taux: operandeParDefaut(0),
    },
    imputation: ImputationRubriqueRh.COTISATION,
    ordreAffichage: 40,
  },
  {
    code: 'INDEMNITE_TRANSPORT',
    libelle: 'Indemnité de transport (placeholder — Base référence une constante, à valider)',
    memo: 'IND_TRANSP',
    typeCalcul: TypeCalculRubriqueRh.MONTANT_FIXE,
    elementSalarial: {
      ...elementParDefaut(),
      base: { source: SourceOperandeRubriqueRh.CONSTANTE, valeur: null, constanteCode: 'INDEMNITE_TRANSPORT_FORFAIT' },
    },
    imputation: ImputationRubriqueRh.PRIME,
    ordreAffichage: 50,
  },
  {
    code: 'MUTUELLE',
    libelle: 'Mutuelle obligatoire (placeholder forfaitaire, à valider)',
    memo: 'MUTUELLE',
    typeCalcul: TypeCalculRubriqueRh.MONTANT_FIXE,
    elementSalarial: {
      ...elementParDefaut(),
      base: operandeParDefaut(25),
    },
    elementPatronal: {
      ...elementParDefaut(),
      base: operandeParDefaut(0),
    },
    imputation: ImputationRubriqueRh.COTISATION,
    ordreAffichage: 60,
  },
];

@Injectable()
export class RubriquesPaieRhService {
  constructor(@InjectRepository(RubriquePaieRh) private repo: Repository<RubriquePaieRh>) {}

  async create(dto: CreateRubriquePaieRhDto, tenantId: number): Promise<RubriquePaieRh> {
    const rubrique = this.repo.create({ ...dto, tenantId, estPlaceholder: false } as Partial<RubriquePaieRh>);
    return this.repo.save(rubrique);
  }

  /**
   * Résout, pour un régime et une date de référence donnés, la ligne la plus récente et la
   * plus spécifique par code (historisation par `dateEffet` + priorité régime spécifique >
   * 'TOUS') — même algorithme que `ConstantesPaieRhService.findByRegime()`, pour que les
   * deux tables se comportent de façon cohérente. Sans `dateRef`, résout à la date du jour
   * (comportement historique inchangé pour un appelant qui ne précise pas de période).
   */
  async findByRegime(regimePaieCode: string, tenantId: number, dateRef?: string): Promise<RubriquePaieRh[]> {
    await this.ensureDefaults(tenantId);
    const ref = dateRef ?? new Date().toISOString().split('T')[0];

    const rows = await this.repo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('(r.regimePaieCode = :regime OR r.regimePaieCode = :tous)', {
        regime: regimePaieCode,
        tous: 'TOUS',
      })
      .andWhere('r.dateEffet <= :ref', { ref })
      .orderBy('r.ordreAffichage', 'ASC')
      .getMany();

    const parCode = new Map<string, RubriquePaieRh>();
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
    // L'ordre d'affichage/calcul (ordreAffichage) doit être préservé après dédoublonnage.
    return Array.from(parCode.values()).sort((a, b) => a.ordreAffichage - b.ordreAffichage);
  }

  async findAllForTenant(tenantId: number): Promise<RubriquePaieRh[]> {
    await this.ensureDefaults(tenantId);
    return this.repo.find({ where: { tenantId }, order: { ordreAffichage: 'ASC' } });
  }

  async findOne(id: number, tenantId: number): Promise<RubriquePaieRh> {
    const rubrique = await this.repo.findOne({ where: { id, tenantId } });
    if (!rubrique) throw new NotFoundException(`Rubrique de paie RH ${id} introuvable`);
    return rubrique;
  }

  async update(id: number, dto: UpdateRubriquePaieRhDto, tenantId: number): Promise<RubriquePaieRh> {
    await this.findOne(id, tenantId);
    await this.repo.update(id, dto as any);
    return this.findOne(id, tenantId);
  }

  async remove(id: number, tenantId: number): Promise<void> {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
  }

  /**
   * Génère les rubriques d'exemple pour un tenant qui n'en a encore aucune, afin que le
   * parcours (calcul + bulletin) soit démontrable immédiatement. Ne s'exécute qu'une fois
   * (no-op si des rubriques existent déjà, même modifiées/supprimées manuellement ensuite).
   */
  private async ensureDefaults(tenantId: number): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = RUBRIQUES_PLACEHOLDER.map((r) =>
      this.repo.create({ ...r, tenantId, regimePaieCode: 'TOUS', isActive: true, estPlaceholder: true } as Partial<RubriquePaieRh>),
    );
    await this.repo.save(rows);
  }
}
