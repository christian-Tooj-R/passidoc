import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControleInterne } from '../entities/controle-interne.entity';
import { Client } from '../entities/client.entity';

@Injectable()
export class ControleInterneService {
  constructor(
    @InjectRepository(ControleInterne) private repo: Repository<ControleInterne>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
  ) {}

  async findByClient(clientId: number): Promise<ControleInterne> {
    const ci = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!ci) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
      return this.repo.save(this.repo.create({ client }));
    }
    return ci;
  }

  async upsert(clientId: number, data: Partial<ControleInterne>): Promise<ControleInterne> {
    let ci = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!ci) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
      ci = this.repo.create({ client });
    }
    Object.assign(ci, data);
    return this.repo.save(ci);
  }
}
