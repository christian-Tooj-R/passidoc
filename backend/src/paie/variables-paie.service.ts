import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VariablePaie } from '../entities/variable-paie.entity';
import { EmployeClient } from '../entities/employe-client.entity';
import { UpsertVariablePaieDto } from './dto/variable-paie.dto';

@Injectable()
export class VariablesPaieService {
  constructor(
    @InjectRepository(VariablePaie) private repo: Repository<VariablePaie>,
    @InjectRepository(EmployeClient) private employeRepo: Repository<EmployeClient>,
  ) {}

  async upsert(dto: UpsertVariablePaieDto, tenantId: number, userId: number): Promise<VariablePaie> {
    const employe = await this.employeRepo.findOne({ where: { id: dto.employeClientId, tenantId } });
    if (!employe) throw new NotFoundException(`Employé client ${dto.employeClientId} introuvable`);

    let variable = await this.repo.findOne({
      where: { employeClientId: dto.employeClientId, mois: dto.mois, annee: dto.annee },
    });

    if (variable) {
      Object.assign(variable, dto);
    } else {
      variable = this.repo.create({ ...dto, tenantId, createdById: userId });
    }
    return this.repo.save(variable);
  }

  findOneByPeriode(employeClientId: number, mois: number, annee: number): Promise<VariablePaie | null> {
    return this.repo.findOne({ where: { employeClientId, mois, annee } });
  }

  findByEmploye(employeClientId: number): Promise<VariablePaie[]> {
    return this.repo.find({
      where: { employeClientId },
      order: { annee: 'DESC', mois: 'DESC' },
    });
  }

  async remove(id: number, tenantId: number): Promise<void> {
    const variable = await this.repo.findOne({ where: { id, tenantId } });
    if (!variable) throw new NotFoundException(`Variable de paie ${id} introuvable`);
    await this.repo.delete(id);
  }
}
