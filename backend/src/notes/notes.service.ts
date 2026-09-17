import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from '../entities/note.entity';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note) private repo: Repository<Note>,
  ) {}

  findAll(userId: number): Promise<Note[]> {
    return this.repo.find({
      where: { userId },
      order: { pinned: 'DESC', updatedAt: 'DESC' },
    });
  }

  create(userId: number, dto: Partial<Note>): Promise<Note> {
    const { title, content, color, pinned } = dto;
    const note = this.repo.create({ title, content, color, pinned, userId });
    return this.repo.save(note);
  }

  async update(id: number, userId: number, dto: Partial<Note>): Promise<Note> {
    const note = await this.repo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException('Note introuvable');
    // Liste blanche explicite : le contrôleur reçoit un @Body() non typé (any), un
    // Object.assign(note, dto) direct laisserait passer n'importe quelle propriété du
    // corps de requête brut (ex: userId, pour réassigner la note à un autre utilisateur).
    const ALLOWED_KEYS = ['title', 'content', 'color', 'pinned'] as const;
    for (const key of ALLOWED_KEYS) {
      if (key in dto) (note as any)[key] = (dto as any)[key];
    }
    return this.repo.save(note);
  }

  async remove(id: number, userId: number): Promise<void> {
    const note = await this.repo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException('Note introuvable');
    await this.repo.remove(note);
  }
}
