import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { FluxMensuel, StatutDepot } from '../entities/flux-mensuel.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { DossierMessage } from '../entities/dossier-message.entity';
import { User, UserRole } from '../entities/user.entity';
import { ClientsService } from '../clients/clients.service';
import { MailService } from '../mail/mail.service';
import { ApprocheClient, approcheDe, contactOperationnel, destinataireCommunication } from '../fiche-identite/relation-client';
import {
  AnalysePieces, DELAI_RELANCE_DEFAUT, FluxLu, Indicateur, LIBELLES_FLUX, PieceManquante, TypeSuivi,
  analyserPieces, joursEntre, redigerRelance,
} from './suivi-pieces.util';
import { EnvoyerRelanceDto } from './dto/relance.dto';

export interface LigneSuivi extends Omit<AnalysePieces, 'indicateur'> {
  clientId: number;
  client: string;
  site: string;
  intervenants: { directeur: string | null; responsable: string | null; collaborateurOuest: string | null };
  /** NON_SUIVI : aucun document mensuel paramétré ni suivi pour ce dossier cette année. */
  indicateur: Indicateur | 'NON_SUIVI';
  approche: ApprocheClient;
  destinataire: { nom: string | null; email: string; role: 'LEGAL' | 'OPERATIONNEL' } | null;
  contactOperationnel: { nom: string | null; telephone: string | null; email: string | null };
}

export interface ApercuRelance {
  clientId: number;
  client: string;
  approche: ApprocheClient;
  destinataire: LigneSuivi['destinataire'];
  manquantes: PieceManquante[];
  objet: string;
  texte: string;
}

const nom = (u?: User | null) => (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null : null);
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@Injectable()
export class SuiviPiecesService {
  private readonly logger = new Logger(SuiviPiecesService.name);

  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(FluxMensuel) private fluxRepo: Repository<FluxMensuel>,
    @InjectRepository(TenantConfig) private tenantRepo: Repository<TenantConfig>,
    @InjectRepository(DossierMessage) private messageRepo: Repository<DossierMessage>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private clientsService: ClientsService,
    private mail: MailService,
  ) {}

  /** Tableau de bord des pièces manquantes : tous les dossiers (ADMIN / expert-comptable), sinon les siens. */
  async tableauDeBord(user: User, annee = new Date().getFullYear()) {
    const config = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    const delai = config?.relanceDelaiJours ?? DELAI_RELANCE_DEFAUT;
    const voitTout = user.role === UserRole.ADMIN || user.role === UserRole.EXPERT_COMPTABLE;
    const clients = await this.chargerClients(user.tenantId, voitTout ? {} : { intervenantId: user.id });
    const flux = await this.chargerFlux(clients.map(c => c.id), annee);
    const jour = aujourdhui();
    const lignes = clients.map(c => this.ligne(c, flux.get(c.id) ?? [], annee, jour, delai))
      .sort((a, b) => ordre(a.indicateur) - ordre(b.indicateur) || b.plusAncienRetard - a.plusAncienRetard || a.client.localeCompare(b.client));
    const compte = (i: LigneSuivi['indicateur']) => lignes.filter(l => l.indicateur === i).length;
    return {
      annee,
      delaiJours: delai,
      relanceAutoActive: !!config?.relanceAutoActive,
      sourceDonnees: 'PASSIDOC' as const,
      lignes,
      totaux: {
        dossiers: lignes.length, rouge: compte('ROUGE'), orange: compte('ORANGE'), vert: compte('VERT'), nonSuivi: compte('NON_SUIVI'),
        piecesManquantes: lignes.reduce((s, l) => s + l.manquantes.length, 0),
      },
    };
  }

  async apercuRelance(clientId: number, user: User, annee = new Date().getFullYear()): Promise<ApercuRelance> {
    await this.clientsService.assertCanEdit(clientId, user);
    const [client] = await this.chargerClients(user.tenantId, { clientId });
    const config = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    const ligne = this.ligne(client, (await this.chargerFlux([clientId], annee)).get(clientId) ?? [], annee, aujourdhui(),
      config?.relanceDelaiJours ?? DELAI_RELANCE_DEFAUT);
    const { objet, texte } = redigerRelance({
      approche: ligne.approche, contactNom: ligne.destinataire?.nom ?? null, dossier: client.nom,
      cabinet: config?.nomSociete ?? 'Le cabinet', signataire: nom(user) ?? '', manquantes: ligne.manquantes,
    });
    return { clientId, client: client.nom, approche: ligne.approche, destinataire: ligne.destinataire, manquantes: ligne.manquantes, objet, texte };
  }

  /** Envoie la relance relue par le collaborateur au contact opérationnel (repli : contact légal). */
  async envoyerRelance(clientId: number, user: User, dto: EnvoyerRelanceDto, annee = new Date().getFullYear()) {
    const apercu = await this.apercuRelance(clientId, user, annee);
    if (!apercu.destinataire) {
      throw new BadRequestException("Aucune adresse e-mail pour ce dossier : renseignez le contact opérationnel dans la fiche d'identité.");
    }
    if (!apercu.manquantes.length) throw new BadRequestException('Aucune pièce manquante à relancer pour ce dossier.');
    const config = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    const objet = dto.objet?.trim() || apercu.objet;
    const texte = dto.texte?.trim() || apercu.texte;
    await this.mail.sendRelancePiecesClient({ to: apercu.destinataire.email, objet, texte, cabinet: config?.nomSociete ?? 'Passidoc' });
    const date = await this.tracerRelance(clientId, user.tenantId, user.id, apercu.destinataire, apercu.manquantes, false);
    return { envoyeA: apercu.destinataire.email, destinataire: apercu.destinataire, nbPieces: apercu.manquantes.length, dateRelance: date };
  }

  /**
   * Relance automatique (jours ouvrés, 8 h) — uniquement pour les cabinets qui l'ont activée :
   * dossiers ayant une pièce manquante depuis plus que le délai, sans relance depuis ce délai.
   */
  @Cron('0 8 * * 1-5')
  async relancesAutomatiques(): Promise<number> {
    let envoyees = 0;
    const tenants = await this.tenantRepo.find({ where: { relanceAutoActive: true } });
    for (const t of tenants) {
      const delai = t.relanceDelaiJours ?? DELAI_RELANCE_DEFAUT;
      const annee = new Date().getFullYear();
      const jour = aujourdhui();
      const clients = await this.chargerClients(t.id, {});
      const flux = await this.chargerFlux(clients.map(c => c.id), annee);
      for (const c of clients) {
        try {
          const l = this.ligne(c, flux.get(c.id) ?? [], annee, jour, delai);
          if (l.indicateur !== 'ROUGE' || !l.destinataire) continue;
          if (l.derniereRelance && joursEntre(l.derniereRelance.slice(0, 10), jour) < delai) continue;
          const auteur = c.responsable ?? c.directeur ?? await this.userRepo.findOne({ where: { tenantId: t.id, role: UserRole.ADMIN } });
          const { objet, texte } = redigerRelance({
            approche: l.approche, contactNom: l.destinataire.nom, dossier: c.nom, cabinet: t.nomSociete,
            signataire: nom(auteur) ?? `L'équipe ${t.nomSociete}`, manquantes: l.manquantes,
          });
          await this.mail.sendRelancePiecesClient({ to: l.destinataire.email, objet, texte, cabinet: t.nomSociete });
          if (auteur) await this.tracerRelance(c.id, t.id, auteur.id, l.destinataire, l.manquantes, true);
          envoyees++;
        } catch (e: any) {
          this.logger.error(`Relance automatique impossible pour le dossier ${c.id} : ${e?.message ?? e}`);
        }
      }
    }
    if (envoyees) this.logger.log(`${envoyees} relance(s) automatique(s) de pièces manquantes envoyée(s).`);
    return envoyees;
  }

  // ── Interne ──

  private ligne(c: Client, flux: FluxLu[], annee: number, jour: string, delai: number): LigneSuivi {
    const types = this.typesSuivis(c, flux, annee);
    const analyse = analyserPieces({ types, flux, annee, aujourdhui: jour, delaiJours: delai });
    const dest = destinataireCommunication(c.ficheIdentite, 'COURANTE');
    const oper = contactOperationnel(c.ficheIdentite);
    return {
      clientId: c.id,
      client: c.nom,
      site: c.site,
      intervenants: { directeur: nom(c.directeur), responsable: nom(c.responsable), collaborateurOuest: nom(c.collaborateurOuest) },
      ...analyse,
      indicateur: types.length ? analyse.indicateur : 'NON_SUIVI',
      approche: approcheDe(c.ficheIdentite),
      destinataire: dest ? { nom: dest.nom, email: dest.email, role: dest.role } : null,
      contactOperationnel: { nom: oper.nom, telephone: oper.telephone, email: oper.email },
    };
  }

  /**
   * Documents suivis : ceux paramétrés sur le dossier (types actifs + types personnalisés) ;
   * à défaut, ceux déjà présents dans sa grille de l'année — jamais « tous les types » par
   * défaut, pour ne pas réclamer à un client des déclarations qui ne le concernent pas.
   */
  private typesSuivis(c: Client, flux: FluxLu[], annee: number): TypeSuivi[] {
    const perso = (c.customFluxTypes ?? []).filter(t => t?.key);
    const libelle = (k: string) => LIBELLES_FLUX[k] ?? perso.find(t => t.key === k)?.label ?? k;
    const cles = c.typesFluxActifs?.length || perso.length
      ? [...(c.typesFluxActifs ?? []), ...perso.map(t => t.key)]
      : [...new Set(flux.filter(f => f.annee === annee).map(f => f.type))];
    return [...new Set(cles)].filter(Boolean).map(k => ({ key: k, label: libelle(k) }));
  }

  private async chargerClients(tenantId: number, f: { clientId?: number; intervenantId?: number }): Promise<Client[]> {
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
    return qb.getMany();
  }

  private async chargerFlux(clientIds: number[], annee: number): Promise<Map<number, FluxLu[]>> {
    const parClient = new Map<number, FluxLu[]>();
    if (!clientIds.length) return parClient;
    const rows = await this.fluxRepo.createQueryBuilder('f')
      .select(['f.id', 'f.type', 'f.mois', 'f.annee', 'f.statut', 'f.dateRelance'])
      .addSelect('f.clientId', 'clientId')
      .where('f.clientId IN (:...ids)', { ids: clientIds })
      .andWhere('f.annee = :annee', { annee })
      .getRawAndEntities();
    rows.entities.forEach((f, i) => {
      const id = Number((rows.raw[i] as any).clientId);
      parClient.set(id, [...(parClient.get(id) ?? []), f]);
    });
    return parClient;
  }

  /** Date de relance sur les pièces concernées (créées « manquantes » si absentes) + trace dans le fil du dossier. */
  private async tracerRelance(
    clientId: number, tenantId: number, auteurId: number,
    dest: NonNullable<LigneSuivi['destinataire']>, manquantes: PieceManquante[], auto: boolean,
  ): Promise<Date> {
    const date = new Date();
    const existants = await this.fluxRepo.find({
      where: { client: { id: clientId }, annee: In([...new Set(manquantes.map(p => p.annee))]) },
    });
    for (const p of manquantes) {
      const f = existants.find(x => x.type === p.type && x.mois === p.mois && x.annee === p.annee);
      if (f) await this.fluxRepo.update(f.id, { dateRelance: date });
      else await this.fluxRepo.save(this.fluxRepo.create({
        type: p.type, mois: p.mois, annee: p.annee, statut: StatutDepot.MANQUANT, dateRelance: date, client: { id: clientId } as any,
      }));
    }
    const qui = dest.nom ? `${dest.nom} (${dest.email})` : dest.email;
    await this.messageRepo.save(this.messageRepo.create({
      clientId, tenantId, userId: auteurId,
      contenu: `${auto ? '[Relance automatique] ' : ''}Relance « pièces manquantes » envoyée à ${qui} — ${manquantes.length} pièce(s).`,
    }));
    return date;
  }
}

function ordre(i: LigneSuivi['indicateur']): number {
  return { ROUGE: 0, ORANGE: 1, VERT: 2, NON_SUIVI: 3 }[i];
}
