import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
    @InjectRepository(FicheIdentite) private ficheRepo: Repository<FicheIdentite>,
  ) {}

  async create(dto: CreateClientDto) {
    const client = this.repo.create(dto);
    const saved = await this.repo.save(client);

    // Créer une fiche identité vide liée au client
    const fiche = this.ficheRepo.create({ client: saved });
    await this.ficheRepo.save(fiche);

    return this.findOne(saved.id);
  }

  async findAll(site?: string) {
    const query = this.repo.createQueryBuilder('client')
      .leftJoinAndSelect('client.ficheIdentite', 'fiche')
      .where('client.isActive = :active', { active: true });

    if (site) query.andWhere('client.site = :site', { site });

    return query.orderBy('client.nom', 'ASC').getMany();
  }

  async findOne(id: number) {
    const client = await this.repo.findOne({
      where: { id },
      relations: ['ficheIdentite', 'fluxMensuels', 'fournisseurs', 'synthesesCloture', 'documents'],
    });
    if (!client) throw new NotFoundException('Dossier client introuvable');
    return client;
  }

  async update(id: number, dto: UpdateClientDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.update(id, { isActive: false });
    return { message: 'Dossier archivé' };
  }

  async updateSantePassation(id: number) {
    const client = await this.repo.findOne({
      where: { id },
      relations: ['ficheIdentite', 'fluxMensuels', 'fournisseurs', 'synthesesCloture', 'documents'],
    });
    if (!client) return;

    let score = 0;
    const fiche = client.ficheIdentite;

    if (fiche?.raisonSociale) score += 15;
    if (fiche?.siren) score += 10;
    if (fiche?.gerants?.length > 0) score += 15;
    if (fiche?.salaries?.length > 0) score += 10;
    if (client.fluxMensuels?.length > 0) score += 15;
    if (client.fournisseurs?.length > 0) score += 10;
    if (client.synthesesCloture?.length > 0) score += 15;
    if (client.documents?.length > 0) score += 10;

    await this.repo.update(id, { santePassation: Math.min(score, 100) });
  }
}
