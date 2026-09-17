import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from '../entities/role-permission.entity';

export const ALL_MENU_ITEMS = [
  'dashboard', 'clients', 'portefeuilles',
  'tasks', 'documents', 'notes', 'equipes',
];

const DEFAULTS: Record<string, string[]> = {
  EXPERT_COMPTABLE:   ALL_MENU_ITEMS,
  CHEF_ANTENNE:       ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
  CHEF_MISSION:       ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
  GERANT_OUEST:  ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
  COLLABORATEUR:      ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
};

@Injectable()
export class RolePermissionsService implements OnModuleInit {
  constructor(
    @InjectRepository(RolePermission) private repo: Repository<RolePermission>,
  ) {}

  async onModuleInit() {
    await this.seedIfEmpty();
  }

  /** Crée les lignes de permission par défaut manquantes — appelé au démarrage de l'appli
   *  ET après un reset complet de la base (`SetupService.resetDatabase()`), puisque
   *  `onModuleInit` ne se redéclenche pas suite à un reset déclenché en cours d'exécution. */
  async seedIfEmpty(): Promise<void> {
    for (const [role, menuItems] of Object.entries(DEFAULTS)) {
      const exists = await this.repo.findOne({ where: { role } });
      if (!exists) await this.repo.save({ role, menuItems });
    }
  }

  findAll(): Promise<RolePermission[]> {
    return this.repo.find();
  }

  async upsert(role: string, menuItems: string[]): Promise<RolePermission> {
    await this.repo.save({ role, menuItems });
    return this.repo.findOneOrFail({ where: { role } });
  }
}
