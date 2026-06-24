import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { ClientsService } from '../clients/clients.service';
import { UpdateFicheIdentiteDto } from './dto/update-fiche-identite.dto';

const JSON_COLUMNS: (keyof FicheIdentite)[] = [
  'actionnaires', 'honoraires', 'reseauxSociaux',
  'reseauxSociauxStructures', 'gerants', 'salaries', 'reglementations',
];

function parseJsonColumns(fiche: FicheIdentite): FicheIdentite {
  for (const col of JSON_COLUMNS) {
    const val = (fiche as any)[col];
    if (typeof val === 'string') {
      try { (fiche as any)[col] = JSON.parse(val); } catch { (fiche as any)[col] = null; }
    }
  }
  return fiche;
}

@Injectable()
export class FicheIdentiteService {
  constructor(
    @InjectRepository(FicheIdentite) private repo: Repository<FicheIdentite>,
    private clientsService: ClientsService,
  ) {}

  async findByClient(clientId: number): Promise<FicheIdentite> {
    const fiche = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!fiche) throw new NotFoundException('Fiche identité introuvable');
    return parseJsonColumns(fiche);
  }

  async update(clientId: number, dto: UpdateFicheIdentiteDto): Promise<FicheIdentite> {
    const fiche = await this.repo.findOne({ where: { client: { id: clientId } } });
    if (!fiche) throw new NotFoundException('Fiche identité introuvable');
    // repo.update() génère un UPDATE direct sans dirty-checking (contourne le bug TypeORM 0.3.x sur les colonnes JSON)
    const data = JSON.parse(JSON.stringify(dto));
    await this.repo.update(fiche.id, data);
    return this.findByClient(clientId);
  }
}
