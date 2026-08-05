import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DossierMessage } from '../entities/dossier-message.entity';

@Injectable()
export class DossierMessagesService {
  constructor(
    @InjectRepository(DossierMessage) private repo: Repository<DossierMessage>,
  ) {}

  findByClient(clientId: number, tenantId?: number) {
    return this.repo.find({
      where: { clientId, ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  create(clientId: number, userId: number, contenu: string, tenantId?: number) {
    return this.repo.save(this.repo.create({ clientId, userId, contenu, tenantId }));
  }

  async remove(id: number, userId: number, tenantId?: number) {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException();
    if (tenantId && msg.tenantId && msg.tenantId !== tenantId) throw new ForbiddenException();
    if (msg.userId !== userId) throw new ForbiddenException('Vous ne pouvez supprimer que vos propres messages');
    await this.repo.remove(msg);
  }
}
