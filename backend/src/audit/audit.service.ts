import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  async log(action: string, ressource: string, ressourceId: number, clientId: number | null, avant: any, apres: any, user?: User, ip?: string) {
    const entry = this.repo.create({ action, ressource, ressourceId, clientId: clientId ?? undefined, avant, apres, user, userId: user?.id, ipAddress: ip });
    await this.repo.save(entry);
  }

  findByClient(clientId: number) {
    return this.repo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  findByUser(userId: number) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
