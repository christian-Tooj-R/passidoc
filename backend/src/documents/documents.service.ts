import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { MinioService } from '../storage/minio.service';
import { User } from '../entities/user.entity';

const BUCKET = 'passidoc-documents';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private repo: Repository<Document>,
    private minio: MinioService,
  ) {}

  async upload(clientId: number, file: Express.Multer.File, user: User) {
    const objectName = `clients/${clientId}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    await this.minio.uploadFile(BUCKET, objectName, file.buffer, file.mimetype);
    const doc = this.repo.create({
      nom: file.originalname,
      storagePath: objectName,
      mimeType: file.mimetype,
      taille: file.size,
      client: { id: clientId },
      uploadePar: user,
    });
    return this.repo.save(doc);
  }

  findByClient(clientId: number) {
    return this.repo.find({
      where: { client: { id: clientId } },
      relations: ['uploadePar'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, clientId: number) {
    const doc = await this.repo.findOne({ where: { id, client: { id: clientId } } });
    if (!doc) throw new NotFoundException('Document introuvable');
    return doc;
  }

  async getStream(id: number, clientId: number) {
    const doc = await this.findOne(id, clientId);
    const stream = await this.minio.getStream(BUCKET, doc.storagePath);
    return { stream, doc };
  }

  async remove(id: number, clientId: number) {
    const doc = await this.findOne(id, clientId);
    await this.minio.deleteFile(BUCKET, doc.storagePath);
    await this.repo.delete(id);
    return { message: 'Document supprimé' };
  }
}
