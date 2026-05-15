import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FluxMensuel, StatutDepot, TypeFlux } from '../entities/flux-mensuel.entity';
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

    const patch: Partial<FluxMensuel> = { ...dto } as any;
    if (dto.statut === StatutDepot.DEPOSE && !flux.dateDepot) {
      patch.dateDepot = new Date();
    }
    if (dto.statut === StatutDepot.MANQUANT || dto.statut === StatutDepot.EN_RETARD) {
      patch.dateRelance = new Date(); // noter la date de dernière relance
    }
    await this.repo.update(id, patch);
    return this.repo.findOne({ where: { id } });
  }

  // Initialise tous les types × 12 mois de l'année comme MANQUANT (si pas déjà existants)
  async initAnnee(clientId: number, annee: number) {
    const types = Object.values(TypeFlux);
    const existing = await this.repo.find({ where: { client: { id: clientId } } });
    const toCreate: Partial<FluxMensuel>[] = [];
    for (const type of types) {
      for (let mois = 1; mois <= 12; mois++) {
        const already = existing.find(f => f.type === type && f.mois === mois && f.annee === annee);
        if (!already) {
          toCreate.push({ type, mois, annee, statut: StatutDepot.MANQUANT, client: { id: clientId } as any });
        }
      }
    }
    if (toCreate.length > 0) await this.repo.save(this.repo.create(toCreate as any[]));
    return { created: toCreate.length };
  }

  async getAlertesGlobales() {
    return this.repo.find({
      where: [
        { statut: StatutDepot.MANQUANT },
        { statut: StatutDepot.EN_RETARD },
      ],
      relations: ['client'],
      order: { annee: 'DESC', mois: 'DESC' },
    });
  }

  async remove(id: number, clientId: number) {
    const flux = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!flux) throw new NotFoundException('Flux introuvable');
    await this.repo.delete(id);
    return { message: 'Flux supprimé' };
  }
}
