import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../entities/mission.entity';
import { Client } from '../entities/client.entity';

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission) private repo: Repository<Mission>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
  ) {}

  findAll(clientId: number) {
    return this.repo.find({ where: { client: { id: clientId } }, order: { createdAt: 'DESC' } });
  }

  async create(clientId: number, data: Partial<Mission>) {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client introuvable');
    return this.repo.save(this.repo.create({ ...data, client }));
  }

  async update(id: number, data: Partial<Mission>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    const mission = await this.repo.findOne({ where: { id } });
    if (!mission) throw new NotFoundException();
    await this.repo.delete(id);
  }
}
