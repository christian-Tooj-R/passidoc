import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Like, Repository } from 'typeorm';
import { BudgetDossier } from '../entities/budget-dossier.entity';
import { Client } from '../entities/client.entity';
import { SaisieTemps, TypeTemps } from '../entities/saisie-temps.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AffairesService, aujourdhuiIso } from './affaires.service';
import { ContexteAffaire, codeAffaire, estCodeAffaire, etatAffaire, periodeAffaire, resoudreAffaire } from './affaire.util';
import { BudgetDossierDto } from './dto/budget-dossier.dto';
import { Indicateurs, MISSIONS_HORS_COMPTA, SEUIL_ATTENTION, calculerIndicateurs, estTempsCompta } from './rentabilite.util';

export interface LigneRentabilite extends Indicateurs {
  clientId: number;
  client: string;
  site: string | null;
  intervenants: { directeur: string | null; responsable: string | null; collaborateurOuest: string | null };
  affaire: string;
  etat: 'O' | 'C';
  dateOuverture: string;
  dateCloture: string;
  budgetId: number | null;
}

type ClientRentabilite = Client & { ficheIdentite?: { honoraires?: { comptables?: number } } | null };

const nomComplet = (u?: User | null) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

function formatHeures(h: number): string {
  const minutes = Math.round((h || 0) * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Rentabilité des dossiers — cahier v2 #6 : budget temps par affaire, consommation, prix de
 * vente horaire, boni/mali, alertes 80 % / 100 %. Le temps consommé est le temps FACTURABLE
 * saisi sur le dossier pour l'affaire, hors MISSIONS_HORS_COMPTA.
 *
 * Visibilité : les heures et le boni/mali « budget » sont visibles de tous les profils qui
 * voient le dossier (le collaborateur doit savoir s'il est « dans les clous ») ; la
 * valorisation au prix de vente des collaborateurs et le détail par collaborateur sont
 * réservés à l'ADMIN (ils révèlent les tarifs individuels).
 */
@Injectable()
export class RentabiliteService {
  private readonly logger = new Logger(RentabiliteService.name);

  constructor(
    @InjectRepository(BudgetDossier) private budgetRepo: Repository<BudgetDossier>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(SaisieTemps) private saisieRepo: Repository<SaisieTemps>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private affaires: AffairesService,
    private notifications: NotificationsService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  // ── Lecture ────────────────────────────────────────────────────────────────

  /** Tableau de bord : une ligne par dossier et par affaire clôturant l'année demandée. */
  async tableauDeBord(user: User, opts: { annee?: number; collaborateurId?: number }) {
    const annee = opts.annee || new Date().getFullYear();
    const isAdmin = user.role === UserRole.ADMIN;
    const intervenantId = isAdmin ? opts.collaborateurId : user.id;
    const clients = await this.chargerClients(user.tenantId, { intervenantId });
    const ids = clients.map(c => c.id);

    const [ctxMap, budgets, conso] = await Promise.all([
      this.affaires.contextes(ids),
      ids.length ? this.budgetRepo.find({ where: { clientId: In(ids), affaire: Like(`C${annee}-%`) } }) : Promise.resolve([]),
      this.consommations(user.tenantId, { clientIds: ids, anneeCloture: annee }),
    ]);

    const lignes: LigneRentabilite[] = [];
    for (const c of clients) {
      const ctx = ctxMap.get(c.id) ?? {};
      const codes = new Set<string>([
        ...budgets.filter(b => b.clientId === c.id).map(b => b.affaire),
        ...[...conso.keys()].filter(k => k.startsWith(`${c.id}|`)).map(k => k.split('|')[1]),
      ]);
      if (!codes.size) codes.add(this.affaireAttendue(annee, ctx));
      for (const code of codes) {
        lignes.push(this.ligne(c, ctx, code, budgets.find(b => b.clientId === c.id && b.affaire === code), conso.get(`${c.id}|${code}`)));
      }
    }
    lignes.sort((a, b) => a.client.localeCompare(b.client, 'fr', { sensitivity: 'base' }) || a.affaire.localeCompare(b.affaire));

    const somme = (f: (l: LigneRentabilite) => number | null) => Math.round(lignes.reduce((s, l) => s + (f(l) ?? 0), 0) * 100) / 100;
    const totaux = {
      honoraires: somme(l => l.honoraires),
      heuresBudget: somme(l => l.heuresBudget),
      heuresConsommees: somme(l => l.heuresConsommees),
      montantRealise: somme(l => l.montantRealise),
      boniMali: somme(l => l.boniMali),
      valorisation: somme(l => l.valorisation),
      margeValorisation: somme(l => l.margeValorisation),
      dossiersDepasses: lignes.filter(l => l.statut === 'DEPASSE').length,
      dossiersAttention: lignes.filter(l => l.statut === 'ATTENTION').length,
    };
    return {
      annee,
      voirValorisation: isAdmin,
      lignes: isAdmin ? lignes : lignes.map(l => this.masquerValorisation(l)),
      totaux: isAdmin ? totaux : { ...totaux, valorisation: null, margeValorisation: null },
    };
  }

  /** Onglet « Rentabilité » d'un dossier : historique par affaire + détail de l'affaire choisie. */
  async dossier(clientId: number, user: User, affaireDemandee?: string) {
    const [client] = await this.chargerClients(user.tenantId, { clientId });
    if (!client) throw new NotFoundException('Dossier introuvable');
    const isAdmin = user.role === UserRole.ADMIN;

    const [ctx, affaires, budgets, conso] = await Promise.all([
      this.affaires.contexte(clientId),
      this.affaires.lister(clientId, user.tenantId),
      this.budgetRepo.find({ where: { clientId } }),
      this.consommations(user.tenantId, { clientIds: [clientId] }),
    ]);

    const aujourdhui = aujourdhuiIso();
    const actives = affaires.filter(a => budgets.some(b => b.affaire === a.code) || conso.has(`${clientId}|${a.code}`));
    const affaire = estCodeAffaire(affaireDemandee) ? affaireDemandee
      : actives[0]?.code ?? resoudreAffaire(aujourdhui, ctx, 'REV');

    const historique = actives.map(a => this.ligne(client, ctx, a.code, budgets.find(b => b.affaire === a.code), conso.get(`${clientId}|${a.code}`)));
    const courante = this.ligne(client, ctx, affaire, budgets.find(b => b.affaire === affaire), conso.get(`${clientId}|${affaire}`));

    // Détail de l'affaire choisie (toutes les saisies, y compris hors budget compta).
    const saisies = await this.saisieRepo.find({
      where: { tenantId: user.tenantId, clientId, affaire },
      relations: ['collaborateur'],
      order: { date: 'ASC' },
    });
    const parMission = new Map<string, number>();
    const parMois = new Map<string, number>();
    const parCollab = new Map<number, { collaborateurId: number; collaborateur: string; heures: number; valorisation: number }>();
    let heuresHorsBudget = 0;
    for (const s of saisies) {
      if (!estTempsCompta(s.type, s.missionCode)) { heuresHorsBudget += s.dureeHeures; continue; }
      const mission = s.missionCode || 'SANS';
      parMission.set(mission, (parMission.get(mission) ?? 0) + s.dureeHeures);
      parMois.set(s.date.slice(0, 7), (parMois.get(s.date.slice(0, 7)) ?? 0) + s.dureeHeures);
      const c = parCollab.get(s.collaborateurId) ?? { collaborateurId: s.collaborateurId, collaborateur: nomComplet(s.collaborateur) ?? `#${s.collaborateurId}`, heures: 0, valorisation: 0 };
      c.heures += s.dureeHeures;
      c.valorisation += s.dureeHeures * (s.tauxHoraire ?? Number(s.collaborateur?.prixVenteHoraire ?? 0));
      parCollab.set(s.collaborateurId, c);
    }
    const r2 = (n: number) => Math.round(n * 100) / 100;

    return {
      client: { id: client.id, nom: client.nom },
      affaire,
      affaires,
      indicateurs: isAdmin ? courante : this.masquerValorisation(courante),
      historique: isAdmin ? historique : historique.map(l => this.masquerValorisation(l)),
      heuresHorsBudget: r2(heuresHorsBudget),
      parMission: [...parMission].map(([missionCode, heures]) => ({ missionCode, heures: r2(heures) })).sort((a, b) => b.heures - a.heures),
      parMois: [...parMois].map(([mois, heures]) => ({ mois, heures: r2(heures) })),
      parCollaborateur: isAdmin
        ? [...parCollab.values()].map(c => ({ ...c, heures: r2(c.heures), valorisation: r2(c.valorisation) })).sort((a, b) => b.heures - a.heures)
        : null,
      peutModifierBudget: this.peutModifierBudget(client, user),
      voirValorisation: isAdmin,
      missionsHorsBudget: MISSIONS_HORS_COMPTA,
      seuilAttention: SEUIL_ATTENTION,
    };
  }

  // ── Écriture ───────────────────────────────────────────────────────────────

  async enregistrerBudget(clientId: number, user: User, dto: BudgetDossierDto): Promise<BudgetDossier> {
    const [client] = await this.chargerClients(user.tenantId, { clientId });
    if (!client) throw new NotFoundException('Dossier introuvable');
    if (!this.peutModifierBudget(client, user)) throw new ForbiddenException('Vous ne pouvez pas modifier le budget de ce dossier.');
    if (!estCodeAffaire(dto.affaire)) throw new BadRequestException('Affaire invalide (format attendu : C2026-09).');
    if (!(dto.heuresBudget > 0)) throw new BadRequestException('Le budget temps doit être supérieur à 0 heure.');

    const budget = (await this.budgetRepo.findOne({ where: { clientId, affaire: dto.affaire } }))
      ?? this.budgetRepo.create({ clientId, affaire: dto.affaire, tenantId: user.tenantId });
    budget.heuresBudget = dto.heuresBudget;
    budget.honoraires = dto.honoraires && dto.honoraires > 0 ? dto.honoraires : null;
    budget.prixVenteHoraire = dto.prixVenteHoraire && dto.prixVenteHoraire > 0 ? dto.prixVenteHoraire : null;
    const saved = await this.budgetRepo.save(budget);
    await this.verifierAlertes(user.tenantId, clientId, dto.affaire);
    // Relu après vérification : les dates d'alerte ont pu être armées ou réarmées.
    return this.budgetRepo.findOneByOrFail({ id: saved.id });
  }

  async supprimerBudget(clientId: number, affaire: string, user: User): Promise<void> {
    const [client] = await this.chargerClients(user.tenantId, { clientId });
    if (!client) throw new NotFoundException('Dossier introuvable');
    if (!this.peutModifierBudget(client, user)) throw new ForbiddenException('Vous ne pouvez pas modifier le budget de ce dossier.');
    await this.budgetRepo.delete({ clientId, affaire });
  }

  /**
   * Alerte in-app (intervenants du dossier + ADMIN) et email (intervenants, à défaut ADMIN)
   * au premier franchissement de 80 % puis de 100 % du budget. Les seuils sont réarmés si la
   * consommation repasse en dessous (budget relevé, saisie supprimée). Ne lève jamais : une
   * alerte ratée ne doit pas faire échouer la saisie qui l'a déclenchée.
   */
  async verifierAlertes(tenantId: number, clientId: number | null | undefined, affaire: string | null | undefined): Promise<void> {
    if (!clientId || !affaire) return;
    try {
      const budget = await this.budgetRepo.findOne({ where: { clientId, affaire } });
      if (!budget || !(budget.heuresBudget > 0)) return;
      const heures = (await this.consommations(tenantId, { clientIds: [clientId], affaires: [affaire] })).get(`${clientId}|${affaire}`)?.heures ?? 0;
      const taux = heures / budget.heuresBudget;

      let seuil: 80 | 100 | null = null;
      if (taux < SEUIL_ATTENTION) {
        budget.alerte80At = null;
        budget.alerte100At = null;
      } else if (taux < 1) {
        budget.alerte100At = null;
        if (!budget.alerte80At) { seuil = 80; budget.alerte80At = new Date(); }
      } else if (!budget.alerte100At) {
        seuil = 100;
        budget.alerte100At = new Date();
        budget.alerte80At ??= new Date();
      }
      await this.budgetRepo.save(budget);
      if (seuil) await this.notifierDepassement(tenantId, clientId, affaire, seuil, heures, budget.heuresBudget);
    } catch (e: any) {
      this.logger.error(`Vérification du budget ${clientId}/${affaire} impossible : ${e?.message ?? e}`);
    }
  }

  // ── Interne ────────────────────────────────────────────────────────────────

  /** Heures compta consommées et valorisation (PV figé, à défaut tarif actuel) par dossier × affaire. */
  private async consommations(
    tenantId: number,
    f: { clientIds?: number[]; affaires?: string[]; anneeCloture?: number },
  ): Promise<Map<string, { heures: number; valorisation: number }>> {
    const map = new Map<string, { heures: number; valorisation: number }>();
    if (f.clientIds && !f.clientIds.length) return map;
    const qb = this.saisieRepo.createQueryBuilder('s')
      .leftJoin('s.collaborateur', 'u')
      .select('s.clientId', 'clientId')
      .addSelect('s.affaire', 'affaire')
      .addSelect('SUM(s.dureeHeures)', 'heures')
      .addSelect('SUM(s.dureeHeures * COALESCE(s.tauxHoraire, u.prixVenteHoraire, 0))', 'valorisation')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.type = :type', { type: TypeTemps.FACTURABLE })
      .andWhere('s.clientId IS NOT NULL')
      .andWhere('s.affaire IS NOT NULL')
      .andWhere('(s.missionCode IS NULL OR s.missionCode NOT IN (:...hors))', { hors: MISSIONS_HORS_COMPTA })
      .groupBy('s.clientId')
      .addGroupBy('s.affaire');
    if (f.clientIds) qb.andWhere('s.clientId IN (:...clientIds)', { clientIds: f.clientIds });
    if (f.affaires?.length) qb.andWhere('s.affaire IN (:...affaires)', { affaires: f.affaires });
    if (f.anneeCloture) qb.andWhere('s.affaire LIKE :prefixe', { prefixe: `C${f.anneeCloture}-%` });
    for (const r of await qb.getRawMany()) {
      map.set(`${r.clientId}|${r.affaire}`, { heures: Number(r.heures) || 0, valorisation: Number(r.valorisation) || 0 });
    }
    return map;
  }

  private async chargerClients(tenantId: number, f: { clientId?: number; intervenantId?: number }): Promise<ClientRentabilite[]> {
    const qb = this.clientRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.ficheIdentite', 'fi')
      .leftJoinAndSelect('c.directeur', 'directeur')
      .leftJoinAndSelect('c.responsable', 'responsable')
      .leftJoinAndSelect('c.collaborateurOuest', 'collaborateurOuest')
      .where('c.tenantId = :tenantId', { tenantId });
    if (f.clientId) qb.andWhere('c.id = :clientId', { clientId: f.clientId });
    else qb.andWhere('c.isActive = :actif', { actif: true });
    if (f.intervenantId) {
      qb.andWhere('(c.directeurId = :iid OR c.responsableId = :iid OR c.collaborateurOuestId = :iid)', { iid: f.intervenantId });
    }
    return qb.getMany() as Promise<ClientRentabilite[]>;
  }

  /** Affaire « attendue » d'un dossier sans budget ni temps pour l'année : celle qui clôture cette année-là. */
  private affaireAttendue(annee: number, ctx: ContexteAffaire): string {
    const ex = (ctx.exercices ?? []).find(e => e.dateCloture.startsWith(`${annee}-`));
    if (ex) return codeAffaire(ex.dateCloture);
    const mois = /^\d{2}-\d{2}$/.test(ctx.dateClotureExercice ?? '') ? ctx.dateClotureExercice!.slice(0, 2) : '12';
    return `C${annee}-${mois}`;
  }

  private ligne(
    c: ClientRentabilite, ctx: ContexteAffaire, affaire: string,
    budget: BudgetDossier | undefined, conso: { heures: number; valorisation: number } | undefined,
  ): LigneRentabilite {
    const periode = periodeAffaire(affaire, ctx);
    return {
      clientId: c.id,
      client: c.nom,
      site: (c as any).site ?? null,
      intervenants: {
        directeur: nomComplet(c.directeur),
        responsable: nomComplet(c.responsable),
        collaborateurOuest: nomComplet(c.collaborateurOuest),
      },
      affaire,
      etat: etatAffaire(affaire, ctx, aujourdhuiIso()),
      dateOuverture: periode.dateOuverture,
      dateCloture: periode.dateCloture,
      budgetId: budget?.id ?? null,
      ...calculerIndicateurs({
        heuresBudget: budget?.heuresBudget,
        honorairesBudget: budget?.honoraires,
        honorairesFiche: Number(c.ficheIdentite?.honoraires?.comptables) || null,
        prixVenteHoraireManuel: budget?.prixVenteHoraire,
        heuresConsommees: conso?.heures ?? 0,
        valorisation: conso?.valorisation ?? 0,
      }),
    };
  }

  private masquerValorisation<T extends Indicateurs>(l: T): T {
    return { ...l, valorisation: null, margeValorisation: null };
  }

  private peutModifierBudget(c: Client, user: User): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.EXPERT_COMPTABLE) return true;
    return [c.directeurId, c.responsableId, c.collaborateurOuestId].includes(user.id);
  }

  private async notifierDepassement(tenantId: number, clientId: number, affaire: string, seuil: 80 | 100, heures: number, heuresBudget: number) {
    const [client] = await this.chargerClients(tenantId, { clientId });
    if (!client) return;
    const intervenants = [client.directeur, client.responsable, client.collaborateurOuest]
      .filter((u): u is User => !!u && u.isActive !== false);
    const admins = await this.userRepo.find({ where: { tenantId, role: UserRole.ADMIN, isActive: true } });
    const pourcentage = Math.round((heures / heuresBudget) * 100);
    const titre = seuil === 100 ? 'Budget temps dépassé' : `Budget temps consommé à ${pourcentage} %`;
    const message = `${client.nom} — affaire ${affaire} : ${formatHeures(heures)} consommées sur ${formatHeures(heuresBudget)} budgétées (${pourcentage} %).`;

    const destinatairesInApp = new Map<number, User>();
    for (const u of [...intervenants, ...admins]) destinatairesInApp.set(u.id, u);
    for (const id of destinatairesInApp.keys()) {
      await this.notifications.emit(id, {
        type: seuil === 100 ? 'BUDGET_DOSSIER_DEPASSE' : 'BUDGET_DOSSIER_ATTENTION',
        titre, message, clientId,
      });
    }

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:4200';
    const destinatairesMail = new Map<string, User>();
    for (const u of intervenants.length ? intervenants : admins) if (u.email) destinatairesMail.set(u.email, u);
    for (const u of destinatairesMail.values()) {
      await this.mail.sendBudgetDossierAlerte({
        to: u.email, destinataire: nomComplet(u) ?? u.email, dossier: client.nom, affaire, seuil,
        heures: formatHeures(heures), heuresBudget: formatHeures(heuresBudget), pourcentage, appUrl, clientId,
      }).catch(e => this.logger.warn(`Email d'alerte budget non envoyé à ${u.email} : ${e?.message ?? e}`));
    }
  }
}
