import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectifsClient } from '../entities/objectifs-client.entity';
import { Client } from '../entities/client.entity';

@Injectable()
export class ObjectifsService {
  constructor(
    @InjectRepository(ObjectifsClient) private repo: Repository<ObjectifsClient>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
  ) {}

  async findByClient(clientId: number): Promise<ObjectifsClient> {
    const obj = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!obj) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
      return this.repo.save(this.repo.create({ client }));
    }
    return obj;
  }

  async upsert(clientId: number, data: Partial<ObjectifsClient>): Promise<ObjectifsClient> {
    let obj = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!obj) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
      obj = this.repo.create({ client });
    }
    Object.assign(obj, data);
    return this.repo.save(obj);
  }
}
