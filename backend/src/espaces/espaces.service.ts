import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Espace } from '../entities/espace.entity';
import { EspaceDoc } from '../entities/espace-doc.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EspacesService {
  constructor(
    @InjectRepository(Espace) private espaceRepo: Repository<Espace>,
    @InjectRepository(EspaceDoc) private docRepo: Repository<EspaceDoc>,
  ) {}

  findAll(userId: number) {
    return this.espaceRepo.find({
      where: { userId },
      relations: ['documents'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(nom: string, userId: number, couleur?: string | null) {
    const espace = this.espaceRepo.create({ nom: nom.trim(), userId, couleur: couleur ?? null });
    return this.espaceRepo.save(espace);
  }

  async remove(id: number, userId: number) {
    const espace = await this.espaceRepo.findOne({
      where: { id, userId },
      relations: ['documents'],
    });
    if (!espace) throw new NotFoundException('Espace introuvable');

    // Supprimer les fichiers physiques
    for (const doc of espace.documents) {
      if (fs.existsSync(doc.storagePath)) fs.unlinkSync(doc.storagePath);
    }
    // Supprimer le répertoire de l'espace s'il existe
    const dir = path.join(process.cwd(), 'uploads', 'espaces', String(id));
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

    await this.espaceRepo.remove(espace);
    return { message: 'Espace supprimé' };
  }

  async findDocs(espaceId: number, userId: number) {
    const espace = await this.espaceRepo.findOne({ where: { id: espaceId, userId } });
    if (!espace) throw new NotFoundException('Espace introuvable');
    return this.docRepo.find({
      where: { espaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async addDoc(espaceId: number, userId: number, file: Express.Multer.File) {
    const espace = await this.espaceRepo.findOne({ where: { id: espaceId, userId } });
    if (!espace) {
      // Fichier déjà écrit sur disque par multer, on le supprime
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new ForbiddenException('Espace introuvable ou accès refusé');
    }
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const doc = this.docRepo.create({
      nom: originalName,
      storagePath: file.path,
      mimeType: file.mimetype,
      taille: file.size,
      espaceId,
      uploadeParId: userId,
    });
    return this.docRepo.save(doc);
  }

  async removeDoc(espaceId: number, docId: number, userId: number) {
    const espace = await this.espaceRepo.findOne({ where: { id: espaceId, userId } });
    if (!espace) throw new ForbiddenException('Accès refusé');
    const doc = await this.docRepo.findOne({ where: { id: docId, espaceId } });
    if (!doc) throw new NotFoundException('Document introuvable');
    if (fs.existsSync(doc.storagePath)) fs.unlinkSync(doc.storagePath);
    await this.docRepo.remove(doc);
    return { message: 'Document supprimé' };
  }

  async updateCouleur(id: number, couleur: string | null, userId: number) {
    const espace = await this.espaceRepo.findOne({ where: { id, userId } });
    if (!espace) throw new NotFoundException('Espace introuvable');
    espace.couleur = couleur;
    return this.espaceRepo.save(espace);
  }

  async getDocStream(espaceId: number, docId: number, userId: number) {
    const espace = await this.espaceRepo.findOne({ where: { id: espaceId, userId } });
    if (!espace) throw new ForbiddenException('Accès refusé');
    const doc = await this.docRepo.findOne({ where: { id: docId, espaceId } });
    if (!doc) throw new NotFoundException('Document introuvable');
    if (!fs.existsSync(doc.storagePath)) throw new NotFoundException('Fichier introuvable sur le serveur');
    return { stream: fs.createReadStream(doc.storagePath), doc };
  }
}
