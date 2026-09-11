import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParametrePaie } from '../entities/parametre-paie.entity';
import { CreateParametrePaieDto, UpdateParametrePaieDto } from './dto/parametre-paie.dto';

/**
 * ⚠️ Valeurs d'EXEMPLE (placeholder) — à valider avant utilisation réelle.
 * 151.67 = durée légale mensuelle française usuelle (35h/semaine), 25% = majoration légale
 * des 8 premières heures sup en France. Rien de spécifique à Madagascar n'est connu/documenté
 * dans ce dossier : le même défaut est utilisé pour tous les régimes tant qu'un expert paie
 * n'a pas fourni de valeur différente par régime. Voir Doc/MODULE_PAIE_NOTES.md.
 */
const PARAMETRES_PLACEHOLDER: Array<Partial<ParametrePaie>> = [
  {
    code: 'HEURES_LEGALES_MOIS',
    libelle: 'Durée légale mensuelle (heures) — placeholder',
    valeur: 151.67,
  },
  {
    code: 'TAUX_MAJORATION_HS_DEFAUT',
    libelle: 'Taux de majoration des heures sup par défaut (%) — placeholder',
    valeur: 25,
  },
  {
    code: 'PLAFOND_SECU_MENSUEL',
    libelle: 'Plafond mensuel sécurité sociale (indicatif, non branché par défaut) — placeholder',
    valeur: 3925,
  },
];

@Injectable()
export class ParametresPaieService {
  constructor(@InjectRepository(ParametrePaie) private repo: Repository<ParametrePaie>) {}

  async create(dto: CreateParametrePaieDto, tenantId: number): Promise<ParametrePaie> {
    const parametre = this.repo.create({ ...dto, tenantId, estPlaceholder: false });
    return this.repo.save(parametre);
  }

  async findByRegime(regimePaieCode: string, tenantId: number): Promise<ParametrePaie[]> {
    await this.ensureDefaults(tenantId);
    return this.repo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('(p.regimePaieCode = :regime OR p.regimePaieCode = :tous)', {
        regime: regimePaieCode,
        tous: 'TOUS',
      })
      .getMany();
  }

  async findAllForTenant(tenantId: number): Promise<ParametrePaie[]> {
    await this.ensureDefaults(tenantId);
    return this.repo.find({ where: { tenantId } });
  }

  async findOne(id: number, tenantId: number): Promise<ParametrePaie> {
    const parametre = await this.repo.findOne({ where: { id, tenantId } });
    if (!parametre) throw new NotFoundException(`Paramètre de paie ${id} introuvable`);
    return parametre;
  }

  async update(id: number, dto: UpdateParametrePaieDto, tenantId: number): Promise<ParametrePaie> {
    await this.findOne(id, tenantId);
    await this.repo.update(id, dto as any);
    return this.findOne(id, tenantId);
  }

  async remove(id: number, tenantId: number): Promise<void> {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
  }

  private async ensureDefaults(tenantId: number): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = PARAMETRES_PLACEHOLDER.map((p) =>
      this.repo.create({ ...p, tenantId, regimePaieCode: 'TOUS', estPlaceholder: true }),
    );
    await this.repo.save(rows);
  }
}
