import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fournisseur } from '../entities/fournisseur.entity';
import { ClientsService } from '../clients/clients.service';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto';

@Injectable()
export class FournisseursService {
  constructor(
    @InjectRepository(Fournisseur) private repo: Repository<Fournisseur>,
    private clientsService: ClientsService,
  ) {}

  async create(clientId: number, dto: CreateFournisseurDto) {
    const f = this.repo.create({ ...dto, client: { id: clientId } });
    const saved = await this.repo.save(f);
    await this.clientsService.updateSantePassation(clientId);
    return saved;
  }

  findByClient(clientId: number) {
    return this.repo.find({ where: { client: { id: clientId } }, order: { nom: 'ASC' } });
  }

  async update(id: number, clientId: number, dto: Partial<CreateFournisseurDto>) {
    const f = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!f) throw new NotFoundException('Fournisseur introuvable');
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number, clientId: number) {
    const f = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!f) throw new NotFoundException('Fournisseur introuvable');
    await this.repo.delete(id);
    return { message: 'Fournisseur supprimé' };
  }
}
