import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcompteSalarie, StatutAcompteSalarie } from '../entities/acompte-salarie.entity';
import { CreateAcompteSalarieDto } from './dto/acompte-salarie.dto';

@Injectable()
export class AcomptesSalarieService {
  constructor(@InjectRepository(AcompteSalarie) private repo: Repository<AcompteSalarie>) {}

  async create(dto: CreateAcompteSalarieDto, tenantId: number, createdById: number): Promise<AcompteSalarie> {
    const acompte = this.repo.create({
      ...dto,
      dateDemande: dto.dateDemande ?? new Date().toISOString().split('T')[0],
      tenantId,
      createdById,
      statut: StatutAcompteSalarie.DEMANDE,
    });
    return this.repo.save(acompte);
  }

  findBySalarie(salarieId: number, tenantId: number): Promise<AcompteSalarie[]> {
    return this.repo.find({ where: { salarieId, tenantId }, order: { dateDemande: 'DESC' } });
  }

  findByPeriode(mois: number, annee: number, tenantId: number): Promise<AcompteSalarie[]> {
    return this.repo.find({ where: { periodeMois: mois, periodeAnnee: annee, tenantId } });
  }

  async findOne(id: number, tenantId: number): Promise<AcompteSalarie> {
    const acompte = await this.repo.findOne({ where: { id, tenantId } });
    if (!acompte) throw new NotFoundException(`Acompte ${id} introuvable`);
    return acompte;
  }

  async valider(id: number, tenantId: number): Promise<AcompteSalarie> {
    const acompte = await this.findOne(id, tenantId);
    if (acompte.statut !== StatutAcompteSalarie.DEMANDE) {
      throw new BadRequestException('Seul un acompte au statut DEMANDE peut être validé');
    }
    acompte.statut = StatutAcompteSalarie.VALIDE;
    acompte.dateVersement = new Date().toISOString().split('T')[0];
    return this.repo.save(acompte);
  }

  async annuler(id: number, tenantId: number): Promise<AcompteSalarie> {
    const acompte = await this.findOne(id, tenantId);
    if (acompte.statut === StatutAcompteSalarie.DEDUIT) {
      throw new BadRequestException('Impossible d\'annuler un acompte déjà déduit d\'un bulletin');
    }
    acompte.statut = StatutAcompteSalarie.ANNULE;
    return this.repo.save(acompte);
  }

  /** Appelé par BulletinsSalarieService lors de la génération effective du bulletin. */
  async marquerDeduits(salarieId: number, mois: number, annee: number, tenantId: number): Promise<void> {
    await this.repo.update(
      { salarieId, periodeMois: mois, periodeAnnee: annee, tenantId, statut: StatutAcompteSalarie.VALIDE },
      { statut: StatutAcompteSalarie.DEDUIT },
    );
  }
}
