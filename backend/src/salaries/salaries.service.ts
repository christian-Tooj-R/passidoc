import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salarie } from '../entities/salarie.entity';

export class CreateSalarieDto {
  nom: string;
  prenom: string;
  dateEntree?: string;
  dateSortie?: string;
  poste?: string;
  typeContrat?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class SalariesService {
  constructor(
    @InjectRepository(Salarie) private repo: Repository<Salarie>,
  ) {}

  findByClient(clientId: number): Promise<Salarie[]> {
    return this.repo.find({
      where: { clientId },
      order: { nom: 'ASC', prenom: 'ASC' },
    });
  }

  async create(clientId: number, dto: CreateSalarieDto): Promise<Salarie> {
    return this.repo.save(this.repo.create({ ...dto, clientId }));
  }

  async update(id: number, clientId: number, dto: Partial<CreateSalarieDto>): Promise<Salarie> {
    const s = await this.repo.findOne({ where: { id, clientId } });
    if (!s) throw new NotFoundException('Salarié introuvable');
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async remove(id: number, clientId: number): Promise<void> {
    const s = await this.repo.findOne({ where: { id, clientId } });
    if (!s) throw new NotFoundException('Salarié introuvable');
    await this.repo.remove(s);
  }
}
