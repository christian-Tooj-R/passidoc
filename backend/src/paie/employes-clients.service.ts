import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeClient } from '../entities/employe-client.entity';
import { Client } from '../entities/client.entity';
import { CreateEmployeClientDto, UpdateEmployeClientDto } from './dto/employe-client.dto';

@Injectable()
export class EmployesClientsService {
  constructor(
    @InjectRepository(EmployeClient) private repo: Repository<EmployeClient>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
  ) {}

  async create(dto: CreateEmployeClientDto, tenantId: number): Promise<EmployeClient> {
    let regimePaieCode = dto.regimePaieCode;
    if (!regimePaieCode) {
      const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
      regimePaieCode = client?.site ?? 'TOUS';
    }
    const employe = this.repo.create({ ...dto, regimePaieCode, tenantId });
    return this.repo.save(employe);
  }

  findByClient(clientId: number, tenantId: number): Promise<EmployeClient[]> {
    return this.repo.find({
      where: { clientId, tenantId },
      order: { nom: 'ASC', prenom: 'ASC' },
    });
  }

  async findOne(id: number, tenantId: number): Promise<EmployeClient> {
    const employe = await this.repo.findOne({ where: { id, tenantId } });
    if (!employe) throw new NotFoundException(`Employé client ${id} introuvable`);
    return employe;
  }

  async update(id: number, dto: UpdateEmployeClientDto, tenantId: number): Promise<EmployeClient> {
    await this.findOne(id, tenantId);
    await this.repo.update(id, dto as any);
    return this.findOne(id, tenantId);
  }

  async remove(id: number, tenantId: number): Promise<void> {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
  }
}
