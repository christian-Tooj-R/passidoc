import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyseStrategique } from '../entities/analyse-strategique.entity';
import { Client } from '../entities/client.entity';

@Injectable()
export class AnalyseStrategiqueService {
  constructor(
    @InjectRepository(AnalyseStrategique)
    private repo: Repository<AnalyseStrategique>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async findByClient(clientId: number): Promise<AnalyseStrategique> {
    const analyse = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!analyse) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
      const newAnalyse = this.repo.create({ client });
      return this.repo.save(newAnalyse);
    }
    return analyse;
  }

  async upsert(clientId: number, data: Partial<AnalyseStrategique>): Promise<AnalyseStrategique> {
    let analyse = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!analyse) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
      analyse = this.repo.create({ client });
    }
    Object.assign(analyse, data);
    return this.repo.save(analyse);
  }
}
