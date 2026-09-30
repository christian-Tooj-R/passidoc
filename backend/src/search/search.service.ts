import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { Document } from '../entities/document.entity';
import { User } from '../entities/user.entity';

export interface SearchResult {
  type: 'client' | 'document';
  id: number;
  titre: string;
  sousTitre?: string;
  clientId?: number;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Document) private documentRepo: Repository<Document>,
  ) {}

  async search(q: string, currentUser: User): Promise<SearchResult[]> {
    const term = q.trim();
    if (term.length < 2) return [];

    const [clients, documents] = await Promise.all([
      this.searchClients(term, currentUser),
      this.searchDocuments(term, currentUser),
    ]);

    return [...clients, ...documents];
  }

  private async searchClients(term: string, currentUser: User): Promise<SearchResult[]> {
    const qb = this.clientRepo.createQueryBuilder('client')
      .leftJoin('client.ficheIdentite', 'fiche')
      .where('client.isActive = :active', { active: true })
      .andWhere(
        '(client.nom ILIKE :term OR fiche.raisonSociale ILIKE :term OR fiche.siren ILIKE :term)',
        { term: `%${term}%` },
      )
      .orderBy('client.nom', 'ASC')
      .take(8);

    if (currentUser.tenantId) {
      qb.andWhere('client.tenantId = :tenantId', { tenantId: currentUser.tenantId });
    }

    const clients = await qb.getMany();
    return clients.map(c => ({
      type: 'client' as const,
      id: c.id,
      titre: c.nom,
      sousTitre: 'Dossier client',
    }));
  }

  private async searchDocuments(term: string, currentUser: User): Promise<SearchResult[]> {
    const qb = this.documentRepo.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.client', 'client')
      .where('doc.nom ILIKE :term', { term: `%${term}%` })
      .orderBy('doc.createdAt', 'DESC')
      .take(8);

    if (currentUser.tenantId) {
      qb.andWhere('client.tenantId = :tenantId', { tenantId: currentUser.tenantId });
    }

    const docs = await qb.getMany();
    return docs.map(d => ({
      type: 'document' as const,
      id: d.id,
      titre: d.nom,
      sousTitre: d.client?.nom ? `Document — ${d.client.nom}` : 'Document',
      clientId: d.client?.id,
    }));
  }
}
