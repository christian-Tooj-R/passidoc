import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
    @InjectRepository(FicheIdentite) private ficheRepo: Repository<FicheIdentite>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateClientDto, currentUser: User) {
    const client = this.repo.create(dto);
    // Auto-assign to creator if not ADMIN
    if (currentUser.role !== UserRole.ADMIN) {
      client.responsable = currentUser;
    }
    const saved = await this.repo.save(client);

    const ficheData = dto.ficheData ?? {};
    const fiche = this.ficheRepo.create({
      client: saved,
      raisonSociale: ficheData.raisonSociale,
      siren: ficheData.siren,
      siret: ficheData.siret,
      formeJuridique: ficheData.formeJuridique,
      adresse: ficheData.adresse,
      gerants: ficheData.gerants?.map(g => ({
        nom: g.nom,
        age: 0,
        situationFamiliale: '',
        contratMariage: '',
        nbEnfants: 0,
      })) ?? [],
    });
    await this.ficheRepo.save(fiche);

    return this.findOne(saved.id);
  }

  async findAll(currentUser: User, site?: string) {
    const query = this.repo.createQueryBuilder('client')
      .leftJoinAndSelect('client.ficheIdentite', 'fiche')
      .leftJoinAndSelect('client.responsable', 'responsable')
      .where('client.isActive = :active', { active: true });

    if (currentUser.role !== UserRole.ADMIN) {
      query.andWhere('client.responsableId = :userId', { userId: currentUser.id });
    }

    if (site) query.andWhere('client.site = :site', { site });

    return query.orderBy('client.nom', 'ASC').getMany();
  }

  // Internal: no auth check (used by other services)
  async findOne(id: number) {
    const client = await this.repo.findOne({
      where: { id },
      relations: ['ficheIdentite', 'fluxMensuels', 'fournisseurs', 'synthesesCloture', 'documents', 'responsable'],
    });
    if (!client) throw new NotFoundException('Dossier client introuvable');
    return client;
  }

  // Controller: checks access rights
  async findOneForUser(id: number, currentUser: User) {
    const client = await this.findOne(id);
    if (currentUser.role !== UserRole.ADMIN && client.responsable?.id !== currentUser.id) {
      throw new ForbiddenException('Vous n\'avez pas accès à ce dossier');
    }
    return client;
  }

  async update(id: number, dto: UpdateClientDto, currentUser: User) {
    await this.findOneForUser(id, currentUser);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.update(id, { isActive: false });
    return { message: 'Dossier archivé' };
  }

  async assign(clientId: number, responsableId: number) {
    await this.findOne(clientId);
    await this.repo.update(clientId, { responsable: { id: responsableId } });
    return this.findOne(clientId);
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
