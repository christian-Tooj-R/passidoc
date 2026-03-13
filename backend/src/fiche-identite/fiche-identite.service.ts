import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { ClientsService } from '../clients/clients.service';
import { UpdateFicheIdentiteDto } from './dto/update-fiche-identite.dto';

@Injectable()
export class FicheIdentiteService {
  constructor(
    @InjectRepository(FicheIdentite) private repo: Repository<FicheIdentite>,
    private clientsService: ClientsService,
  ) {}

  async findByClient(clientId: number) {
    const fiche = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!fiche) throw new NotFoundException('Fiche identité introuvable');
    return fiche;
  }

  async update(clientId: number, dto: UpdateFicheIdentiteDto) {
    const fiche = await this.findByClient(clientId);
    await this.repo.update(fiche.id, dto);
    return this.findByClient(clientId);
  }
}
