import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Canvas } from './canvas.entity';
import { User } from '../entities/user.entity';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class CanvasService {
  constructor(
    @InjectRepository(Canvas) private repo: Repository<Canvas>,
    private clientsService: ClientsService,
  ) {}

  async findOrCreate(clientId: number): Promise<Canvas> {
    let canvas = await this.repo.findOne({ where: { clientId } });
    if (!canvas) {
      canvas = this.repo.create({ clientId });
      canvas = await this.repo.save(canvas);
    }
    return canvas;
  }

  async update(clientId: number, data: Partial<Canvas>, currentUser: User): Promise<Canvas> {
    await this.clientsService.assertCanEdit(clientId, currentUser);
    const canvas = await this.findOrCreate(clientId);
    Object.assign(canvas, data);
    return this.repo.save(canvas);
  }
}
