import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CongeAbsence, TypeConge, StatutConge } from '../entities/conge-absence.entity';
import { SoldeConge } from '../entities/solde-conge.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class CongesAbsencesService {
  constructor(
    @InjectRepository(CongeAbsence) private congeRepo: Repository<CongeAbsence>,
    @InjectRepository(SoldeConge)   private soldeRepo: Repository<SoldeConge>,
    @InjectRepository(User)         private userRepo: Repository<User>,
  ) {}

  /* ── Demandes ──────────────────────────────────────────────── */

  async findAll(filters?: { userId?: number; statut?: StatutConge; annee?: number }) {
    const qb = this.congeRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .orderBy('c.dateDebut', 'DESC');

    if (filters?.userId) qb.andWhere('c.userId = :userId', { userId: filters.userId });
    if (filters?.statut) qb.andWhere('c.statut = :statut', { statut: filters.statut });
    if (filters?.annee) {
      qb.andWhere('EXTRACT(YEAR FROM c."dateDebut") = :annee', { annee: filters.annee });
    }

    const conges = await qb.getMany();
    return conges.map(c => this.safeConge(c));
  }

  async findOne(id: number) {
    const c = await this.congeRepo.findOne({ where: { id }, relations: ['user'] });
    if (!c) throw new NotFoundException('Demande introuvable');
    return this.safeConge(c);
  }

  async create(dto: {
    userId: number;
    typeConge: TypeConge;
    dateDebut: string;
    dateFin: string;
    nombreJours: number;
    motif?: string;
  }) {
    if (!dto.dateDebut || isNaN(new Date(dto.dateDebut).getTime())) {
      throw new BadRequestException('Date de début invalide');
    }
    if (!dto.dateFin || isNaN(new Date(dto.dateFin).getTime())) {
      throw new BadRequestException('Date de fin invalide');
    }

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const solde = await this.getSoldeForType(dto.userId, dto.typeConge, new Date(dto.dateDebut).getFullYear());
    const disponible = Number(solde.joursAcquis) - Number(solde.joursPris) - Number(solde.joursEnAttente);
    if (['CONGES_PAYES', 'RTT', 'RECUPERATION'].includes(dto.typeConge) && dto.nombreJours > disponible) {
      throw new BadRequestException(`Solde insuffisant. Disponible : ${disponible} jours`);
    }

    const conge = this.congeRepo.create({ ...dto, statut: StatutConge.EN_ATTENTE });
    const saved = await this.congeRepo.save(conge);

    await this.soldeRepo.update(
      { userId: dto.userId, typeConge: dto.typeConge, annee: new Date(dto.dateDebut).getFullYear() },
      { joursEnAttente: () => `"joursEnAttente" + ${dto.nombreJours}` },
    );

    return this.findOne(saved.id);
  }

  async approuver(id: number, approbateurId: number, commentaire?: string) {
    const conge = await this.congeRepo.findOne({ where: { id } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.statut !== StatutConge.EN_ATTENTE) throw new BadRequestException('Demande déjà traitée');

    await this.congeRepo.update(id, {
      statut: StatutConge.APPROUVEE,
      approbateurId,
      dateApprobation: new Date().toISOString().split('T')[0],
      commentaireRH: commentaire ?? null,
    });

    const annee = new Date(conge.dateDebut).getFullYear();
    await this.soldeRepo.update(
      { userId: conge.userId, typeConge: conge.typeConge, annee },
      {
        joursPris:       () => `"joursPris" + ${conge.nombreJours}`,
        joursEnAttente:  () => `"joursEnAttente" - ${conge.nombreJours}`,
      },
    );

    return this.findOne(id);
  }

  async refuser(id: number, approbateurId: number, commentaire?: string) {
    const conge = await this.congeRepo.findOne({ where: { id } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.statut !== StatutConge.EN_ATTENTE) throw new BadRequestException('Demande déjà traitée');

    await this.congeRepo.update(id, {
      statut: StatutConge.REFUSEE,
      approbateurId,
      dateApprobation: new Date().toISOString().split('T')[0],
      commentaireRH: commentaire ?? null,
    });

    const annee = new Date(conge.dateDebut).getFullYear();
    await this.soldeRepo.update(
      { userId: conge.userId, typeConge: conge.typeConge, annee },
      { joursEnAttente: () => `"joursEnAttente" - ${conge.nombreJours}` },
    );

    return this.findOne(id);
  }

  async annuler(id: number, userId: number) {
    const conge = await this.congeRepo.findOne({ where: { id } });
    if (!conge) throw new NotFoundException('Demande introuvable');
    if (conge.userId !== userId) throw new BadRequestException('Action non autorisée');
    if (conge.statut === StatutConge.APPROUVEE) throw new BadRequestException('Impossible d\'annuler une demande déjà approuvée');

    const wasEnAttente = conge.statut === StatutConge.EN_ATTENTE;
    await this.congeRepo.update(id, { statut: StatutConge.ANNULEE });

    if (wasEnAttente) {
      const annee = new Date(conge.dateDebut).getFullYear();
      await this.soldeRepo.update(
        { userId: conge.userId, typeConge: conge.typeConge, annee },
        { joursEnAttente: () => `"joursEnAttente" - ${conge.nombreJours}` },
      );
    }

    return this.findOne(id);
  }

  /* ── Soldes ───────────────────────────────────────────────── */

  async getSoldes(userId: number, annee?: number) {
    const year = annee ?? new Date().getFullYear();
    const soldes = await this.soldeRepo.find({ where: { userId, annee: year } });

    const tous = Object.values(TypeConge).map(type => {
      const s = soldes.find(x => x.typeConge === type);
      return {
        typeConge: type,
        annee: year,
        joursAcquis:    Number(s?.joursAcquis    ?? 0),
        joursPris:      Number(s?.joursPris       ?? 0),
        joursEnAttente: Number(s?.joursEnAttente  ?? 0),
        solde:          Number(s?.joursAcquis ?? 0) - Number(s?.joursPris ?? 0) - Number(s?.joursEnAttente ?? 0),
      };
    });

    return tous;
  }

  async updateSolde(userId: number, typeConge: TypeConge, annee: number, joursAcquis: number) {
    const existing = await this.soldeRepo.findOne({ where: { userId, typeConge, annee } });
    if (existing) {
      await this.soldeRepo.update(existing.id, { joursAcquis });
    } else {
      await this.soldeRepo.save(this.soldeRepo.create({ userId, typeConge, annee, joursAcquis }));
    }
    return this.getSoldes(userId, annee);
  }

  /* ── Stats ───────────────────────────────────────────────── */

  async getStats(annee?: number) {
    const year = annee ?? new Date().getFullYear();
    const conges = await this.congeRepo.find({
      where: { statut: StatutConge.APPROUVEE },
      relations: ['user'],
    });

    const total       = conges.filter(c => new Date(c.dateDebut).getFullYear() === year).length;
    const parType     = Object.values(TypeConge).map(t => ({
      type: t,
      count: conges.filter(c => c.typeConge === t && new Date(c.dateDebut).getFullYear() === year).length,
      jours: conges.filter(c => c.typeConge === t && new Date(c.dateDebut).getFullYear() === year)
                   .reduce((s, c) => s + Number(c.nombreJours), 0),
    }));

    const enAttente = await this.congeRepo.count({ where: { statut: StatutConge.EN_ATTENTE } });

    return { annee: year, totalApprouves: total, enAttente, parType };
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  private async getSoldeForType(userId: number, typeConge: TypeConge, annee: number) {
    let solde = await this.soldeRepo.findOne({ where: { userId, typeConge, annee } });
    if (!solde) {
      solde = this.soldeRepo.create({ userId, typeConge, annee, joursAcquis: 0, joursPris: 0, joursEnAttente: 0 });
      await this.soldeRepo.save(solde);
    }
    return solde;
  }

  private safeConge(c: CongeAbsence & { user?: User }) {
    const { user, ...rest } = c as any;
    return {
      ...rest,
      user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, site: user.site } : undefined,
    };
  }
}
