import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FluxMensuel, StatutDepot } from '../entities/flux-mensuel.entity';
import { ClientsService } from '../clients/clients.service';
import { CreateFluxDto } from './dto/create-flux.dto';
import { UpdateFluxDto } from './dto/update-flux.dto';

@Injectable()
export class FluxMensuelService {
  constructor(
    @InjectRepository(FluxMensuel) private repo: Repository<FluxMensuel>,
    private clientsService: ClientsService,
  ) {}

  async create(clientId: number, dto: CreateFluxDto) {
    const flux = this.repo.create({ ...dto, client: { id: clientId } });
    const saved = await this.repo.save(flux);
    await this.clientsService.updateSantePassation(clientId);
    return saved;
  }

  async findByClient(clientId: number, annee?: number) {
    const query = this.repo.createQueryBuilder('flux')
      .where('flux.clientId = :clientId', { clientId })
      .orderBy('flux.annee', 'DESC')
      .addOrderBy('flux.mois', 'DESC');

    if (annee) query.andWhere('flux.annee = :annee', { annee });
    return query.getMany();
  }

  async getAlertes(clientId: number) {
    return this.repo.find({
      where: [
        { client: { id: clientId }, statut: StatutDepot.MANQUANT },
        { client: { id: clientId }, statut: StatutDepot.EN_RETARD },
      ],
    });
  }

  async update(id: number, clientId: number, dto: UpdateFluxDto) {
    const flux = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!flux) throw new NotFoundException('Flux introuvable');

    if (dto.statut === StatutDepot.DEPOSE) {
      await this.repo.update(id, { ...dto, dateDepot: new Date() });
    } else {
      await this.repo.update(id, dto);
    }
    await this.clientsService.updateSantePassation(clientId);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number, clientId: number) {
    const flux = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!flux) throw new NotFoundException('Flux introuvable');
    await this.repo.delete(id);
    return { message: 'Flux supprimé' };
  }
}
