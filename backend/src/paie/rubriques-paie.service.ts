import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCalculRubrique, ImputationRubrique, RubriquePaie } from '../entities/rubrique-paie.entity';
import { CreateRubriquePaieDto, UpdateRubriquePaieDto } from './dto/rubrique-paie.dto';

/**
 * ⚠️ Rubriques d'EXEMPLE, générées automatiquement quand un tenant n'a encore aucune
 * rubrique paramétrée, pour permettre de démontrer le parcours de bout en bout.
 * Ces taux ne proviennent d'AUCUNE source officielle du dossier (CDC/mémoire AFYM) — ce sont
 * des ordres de grandeur à faire valider par un expert paie avant toute mise en prod réelle.
 * Voir Doc/MODULE_PAIE_NOTES.md.
 */
const RUBRIQUES_PLACEHOLDER: Array<Partial<RubriquePaie>> = [
  {
    code: 'SECU_MALADIE',
    libelle: 'Sécurité sociale — Maladie (placeholder)',
    baseCalcul: BaseCalculRubrique.BRUT,
    tauxSalarial: 0,
    tauxPatronal: 7,
    imputation: ImputationRubrique.COTISATION,
    ordreAffichage: 10,
  },
  {
    code: 'RETRAITE_BASE',
    libelle: 'Retraite de base (placeholder)',
    baseCalcul: BaseCalculRubrique.BRUT,
    tauxSalarial: 6.9,
    tauxPatronal: 8.55,
    imputation: ImputationRubrique.COTISATION,
    ordreAffichage: 20,
  },
  {
    code: 'RETRAITE_COMPL',
    libelle: 'Retraite complémentaire (placeholder)',
    baseCalcul: BaseCalculRubrique.BRUT,
    tauxSalarial: 3.15,
    tauxPatronal: 4.72,
    imputation: ImputationRubrique.COTISATION,
    ordreAffichage: 30,
  },
  {
    code: 'CHOMAGE',
    libelle: 'Assurance chômage (placeholder)',
    baseCalcul: BaseCalculRubrique.BRUT,
    tauxSalarial: 0,
    tauxPatronal: 4.05,
    imputation: ImputationRubrique.COTISATION,
    ordreAffichage: 40,
  },
  {
    code: 'CSG_CRDS',
    libelle: 'CSG / CRDS (placeholder — non déductible ignoré en v1)',
    baseCalcul: BaseCalculRubrique.BRUT,
    tauxSalarial: 9.7,
    tauxPatronal: 0,
    imputation: ImputationRubrique.COTISATION,
    ordreAffichage: 50,
  },
  {
    code: 'MUTUELLE',
    libelle: 'Mutuelle obligatoire (placeholder)',
    baseCalcul: BaseCalculRubrique.FIXE,
    montantFixe: 25,
    tauxPatronal: 0,
    imputation: ImputationRubrique.COTISATION,
    ordreAffichage: 60,
  },
];

@Injectable()
export class RubriquesPaieService {
  constructor(@InjectRepository(RubriquePaie) private repo: Repository<RubriquePaie>) {}

  async create(dto: CreateRubriquePaieDto, tenantId: number): Promise<RubriquePaie> {
    const rubrique = this.repo.create({ ...dto, tenantId, estPlaceholder: false });
    return this.repo.save(rubrique);
  }

  async findByRegime(regimePaieCode: string, tenantId: number): Promise<RubriquePaie[]> {
    await this.ensureDefaults(tenantId);
    return this.repo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('(r.regimePaieCode = :regime OR r.regimePaieCode = :tous)', {
        regime: regimePaieCode,
        tous: 'TOUS',
      })
      .orderBy('r.ordreAffichage', 'ASC')
      .getMany();
  }

  async findAllForTenant(tenantId: number): Promise<RubriquePaie[]> {
    await this.ensureDefaults(tenantId);
    return this.repo.find({ where: { tenantId }, order: { ordreAffichage: 'ASC' } });
  }

  async findOne(id: number, tenantId: number): Promise<RubriquePaie> {
    const rubrique = await this.repo.findOne({ where: { id, tenantId } });
    if (!rubrique) throw new NotFoundException(`Rubrique de paie ${id} introuvable`);
    return rubrique;
  }

  async update(id: number, dto: UpdateRubriquePaieDto, tenantId: number): Promise<RubriquePaie> {
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
   * (no-op si des rubriques existent déjà, même modifiées/supprimées manuellement ensuite —
   * dans ce cas il suffit qu'il en reste au moins une pour ne pas re-semer).
   */
  private async ensureDefaults(tenantId: number): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = RUBRIQUES_PLACEHOLDER.map((r) =>
      this.repo.create({ ...r, tenantId, regimePaieCode: 'TOUS', isActive: true, estPlaceholder: true }),
    );
    await this.repo.save(rows);
  }
}
