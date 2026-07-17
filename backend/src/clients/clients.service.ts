import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { Exercice, ExerciceStatut } from '../entities/exercice.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { MinioService } from '../storage/minio.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private repo: Repository<Client>,
    @InjectRepository(FicheIdentite) private ficheRepo: Repository<FicheIdentite>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Exercice) private exerciceRepo: Repository<Exercice>,
    private minio: MinioService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateClientDto, currentUser: User) {
    const client = this.repo.create(dto);
    // Auto-assign to creator if not ADMIN
    if (currentUser.role !== UserRole.ADMIN) {
      client.responsable = currentUser;
    }
    const saved = await this.repo.save(client);

    const ficheData = dto.ficheData ?? {};
    const fiche = this.ficheRepo.create({
      client: saved,
      raisonSociale: ficheData.raisonSociale,
      siren: ficheData.siren,
      siret: ficheData.siret,
      formeJuridique: ficheData.formeJuridique,
      adresse: ficheData.adresse,
      gerants: ficheData.gerants?.map(g => ({
        nom: g.nom,
        age: 0,
        situationFamiliale: '',
        contratMariage: '',
        nbEnfants: 0,
      })) ?? [],
    });
    await this.ficheRepo.save(fiche);

    // Créer le premier exercice si dateClotureExercice fourni
    if (dto.dateClotureExercice) {
      const ex = computeExercice(dto.dateClotureExercice);
      await this.exerciceRepo.save(
        this.exerciceRepo.create({ clientId: saved.id, ...ex, statut: ExerciceStatut.OUVERT }),
      );
    }

    return this.findOne(saved.id);
  }

  async findAll(currentUser: User, site?: string, collaborateurId?: number) {
    // Liste allégée : seules les relations nécessaires pour les cartes
    const query = this.repo.createQueryBuilder('client')
      .leftJoinAndSelect('client.responsable', 'responsable')
      .leftJoinAndSelect('client.collaborateurMg', 'collaborateurMg')
      .where('client.isActive = :active', { active: true });

    if (currentUser.role !== UserRole.ADMIN) {
      if (currentUser.site === UserSite.REUNION) {
        query.andWhere('client.responsableId = :userId', { userId: currentUser.id });
      } else {
        query.andWhere('client.collaborateurMgId = :userId', { userId: currentUser.id });
      }
    } else if (collaborateurId) {
      // ADMIN filtre par collaborateur spécifique
      query.andWhere(
        '(client.responsableId = :cid OR client.collaborateurMgId = :cid)',
        { cid: collaborateurId },
      );
    }

    if (site) query.andWhere('client.site = :site', { site });

    return query.orderBy('client.nom', 'ASC').getMany();
  }

  // Internal: no auth check (used by other services)
  async findOne(id: number) {
    const client = await this.repo.findOne({
      where: { id },
      relations: ['ficheIdentite', 'responsable', 'collaborateurMg'],
    });
    if (!client) throw new NotFoundException('Dossier client introuvable');
    return client;
  }

  // Controller: checks access rights
  async findOneForUser(id: number, currentUser: User) {
    const client = await this.findOne(id);
    if (currentUser.role === UserRole.ADMIN) return client;
    if (currentUser.site === UserSite.REUNION && client.responsableId === currentUser.id) return client;
    if (currentUser.site === UserSite.MADAGASCAR && client.collaborateurMgId === currentUser.id) return client;
    throw new ForbiddenException('Vous n\'avez pas accès à ce dossier');
  }

  async update(id: number, dto: UpdateClientDto, currentUser: User) {
    await this.findOneForUser(id, currentUser);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.update(id, { isActive: false });
    return { message: 'Dossier archivé' };
  }

  async assign(clientId: number, responsableId: number, actorId: number) {
    const client = await this.findOne(clientId);
    await this.repo.update(clientId, { responsable: { id: responsableId } });
    if (responsableId !== actorId) {
      await this.notifications.emit(responsableId, {
        type: 'CLIENT_ASSIGNED',
        message: `Le dossier "${client.nom}" vous a été assigné`,
        titre: client.nom,
        clientId,
      });
    }
    return this.findOne(clientId);
  }

  async assignMg(clientId: number, collaborateurMgId: number | null, currentUser: User) {
    const client = await this.findOne(clientId);
    const previousMgId = client.collaborateurMgId ?? null;

    if (currentUser.role !== UserRole.ADMIN) {
      if (client.responsableId !== currentUser.id) {
        throw new ForbiddenException('Ce dossier ne fait pas partie de votre portefeuille');
      }
      if (collaborateurMgId) {
        const mgUser = await this.userRepo.findOne({ where: { id: collaborateurMgId } });
        if (!mgUser || mgUser.site !== UserSite.MADAGASCAR) {
          throw new ForbiddenException('Ce collaborateur ne fait pas partie de l\'équipe Madagascar');
        }
      }
    }

    await this.repo.update(clientId, { collaborateurMgId: collaborateurMgId as any });

    if (collaborateurMgId) {
      // Assignation : notifier le collab MG (sauf si c'est lui qui agit)
      if (collaborateurMgId !== currentUser.id) {
        await this.notifications.emit(collaborateurMgId, {
          type: 'CLIENT_ASSIGNED',
          message: `Le dossier "${client.nom}" vous a été distribué`,
          titre: client.nom,
          clientId,
        });
      }
      // Notifier le responsable Réunion (sauf si c'est lui qui agit)
      if (client.responsableId && client.responsableId !== currentUser.id) {
        const mgUser = await this.userRepo.findOne({ where: { id: collaborateurMgId } });
        await this.notifications.emit(client.responsableId, {
          type: 'CLIENT_ASSIGNED',
          message: `${mgUser?.firstName} ${mgUser?.lastName} a été assigné au dossier "${client.nom}"`,
          titre: client.nom,
          clientId,
        });
      }
    } else if (previousMgId) {
      // Dé-assignation : notifier le collab MG retiré (sauf si c'est lui qui agit)
      if (previousMgId !== currentUser.id) {
        await this.notifications.emit(previousMgId, {
          type: 'CLIENT_ASSIGNED',
          message: `Le dossier "${client.nom}" vous a été retiré`,
          titre: client.nom,
          clientId,
        });
      }
      // Notifier le responsable Réunion (sauf si c'est lui qui agit)
      if (client.responsableId && client.responsableId !== currentUser.id) {
        const previousMg = await this.userRepo.findOne({ where: { id: previousMgId } });
        await this.notifications.emit(client.responsableId, {
          type: 'CLIENT_ASSIGNED',
          message: `${previousMg?.firstName} ${previousMg?.lastName} a été retiré du dossier "${client.nom}"`,
          titre: client.nom,
          clientId,
        });
      }
    }

    return this.findOne(clientId);
  }

  async uploadLogo(id: number, file: Express.Multer.File): Promise<Client> {
    const client = await this.findOne(id);
    const ext = file.originalname.split('.').pop();
    const objectName = `logos/${id}/${Date.now()}.${ext}`;
    const url = await this.minio.uploadFile('passidoc-logos', objectName, file.buffer, file.mimetype);
    await this.repo.update(id, { logoUrl: url });
    return this.findOne(id);
  }
}

/** Calcule annee + dateOuverture + dateCloture à partir de "MM-DD" */
export function computeExercice(dateClotureExercice: string): { annee: number; dateOuverture: string; dateCloture: string } {
  const today = new Date();
  const [month, day] = dateClotureExercice.split('-').map(Number);
  const clotureThisYear = new Date(today.getFullYear(), month - 1, day);
  const annee = today <= clotureThisYear ? today.getFullYear() : today.getFullYear() + 1;
  const dateCloture = `${annee}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const prevCloture = new Date(annee - 1, month - 1, day);
  prevCloture.setDate(prevCloture.getDate() + 1);
  const dateOuverture = prevCloture.toISOString().split('T')[0];
  return { annee, dateOuverture, dateCloture };
}
