import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../entities/document.entity';
import { ClientsService } from '../clients/clients.service';
import { User } from '../entities/user.entity';

@Injectable()
export class DocumentsService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Document) private repo: Repository<Document>,
    private clientsService: ClientsService,
  ) {}

  async upload(clientId: number, file: Express.Multer.File, user: User) {
    const doc = this.repo.create({
      nom: file.originalname,
      storagePath: file.path,
      mimeType: file.mimetype,
      taille: file.size,
      client: { id: clientId },
      uploadePar: user,
    });
    const saved = await this.repo.save(doc);
    await this.clientsService.updateSantePassation(clientId);
    return saved;
  }

  findByClient(clientId: number) {
    return this.repo.find({
      where: { client: { id: clientId } },
      relations: ['uploadePar'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFilePath(id: number, clientId: number): Promise<string> {
    const doc = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!doc) throw new NotFoundException('Document introuvable');
    return doc.storagePath;
  }

  async findOne(id: number, clientId: number) {
    const doc = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!doc) throw new NotFoundException('Document introuvable');
    return doc;
  }

  async remove(id: number, clientId: number) {
    const doc = await this.findOne(id, clientId);
    if (fs.existsSync(doc.storagePath)) {
      fs.unlinkSync(doc.storagePath);
    }
    await this.repo.delete(id);
    return { message: 'Document supprimé' };
  }
}
