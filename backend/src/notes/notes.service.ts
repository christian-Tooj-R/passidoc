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
    const note = this.repo.create({ ...dto, userId });
    return this.repo.save(note);
  }

  async update(id: number, userId: number, dto: Partial<Note>): Promise<Note> {
    const note = await this.repo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException('Note introuvable');
    Object.assign(note, dto);
    return this.repo.save(note);
  }

  async remove(id: number, userId: number): Promise<void> {
    const note = await this.repo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException('Note introuvable');
    await this.repo.remove(note);
  }
}
