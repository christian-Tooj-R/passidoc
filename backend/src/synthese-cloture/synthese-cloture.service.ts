import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyntheseCloture } from '../entities/synthese-cloture.entity';
import { ClientsService } from '../clients/clients.service';
import { CreateSyntheseCloture } from './dto/create-synthese.dto';

@Injectable()
export class SyntheseCloureService {
  constructor(
    @InjectRepository(SyntheseCloture) private repo: Repository<SyntheseCloture>,
    private clientsService: ClientsService,
  ) {}

  async create(clientId: number, dto: CreateSyntheseCloture) {
    const synthese = this.repo.create({ ...dto, client: { id: clientId } });
    const saved = await this.repo.save(synthese);
    await this.clientsService.updateSantePassation(clientId);
    return saved;
  }

  findByClient(clientId: number) {
    return this.repo.find({ where: { client: { id: clientId } }, order: { exercice: 'DESC' } });
  }

  async findOne(id: number, clientId: number) {
    const s = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!s) throw new NotFoundException('Synthèse introuvable');
    return s;
  }

  async update(id: number, clientId: number, dto: Partial<CreateSyntheseCloture>) {
    await this.findOne(id, clientId);
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number, clientId: number) {
    await this.findOne(id, clientId);
    await this.repo.delete(id);
    return { message: 'Synthèse supprimée' };
  }
}
