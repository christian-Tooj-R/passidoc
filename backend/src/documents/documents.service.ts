import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, TypeDoc } from '../entities/document.entity';
import { FluxMensuel, StatutDepot, TypeFlux } from '../entities/flux-mensuel.entity';
import { MinioService } from '../storage/minio.service';
import { User } from '../entities/user.entity';

const BUCKET = 'passidoc-documents';

// Types de documents qui correspondent à une ligne du tableau de pilotage
const FLUX_TYPES = new Set<string>(Object.values(TypeFlux));

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private repo: Repository<Document>,
    @InjectRepository(FluxMensuel) private fluxRepo: Repository<FluxMensuel>,
    private minio: MinioService,
  ) {}

  async upload(
    clientId: number,
    file: Express.Multer.File,
    user: User,
    meta?: { typeDoc?: TypeDoc; periodeMois?: number; periodeAnnee?: number },
  ) {
    const objectName = `clients/${clientId}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    await this.minio.uploadFile(BUCKET, objectName, file.buffer, file.mimetype);
    const doc = this.repo.create({
      nom: file.originalname,
      storagePath: objectName,
      mimeType: file.mimetype,
      taille: file.size,
      client: { id: clientId },
      uploadePar: user,
      typeDoc:      meta?.typeDoc     ?? null,
      periodeMois:  meta?.periodeMois ?? null,
      periodeAnnee: meta?.periodeAnnee ?? null,
    });
    const saved = await this.repo.save(doc);

    // Synchronisation automatique avec le tableau de pilotage
    await this.syncFluxAfterUpload(clientId, meta);

    return saved;
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
    const { typeDoc, periodeMois, periodeAnnee } = doc;
    await this.minio.deleteFile(BUCKET, doc.storagePath);
    await this.repo.delete(id);

    // Synchronisation : si plus aucun doc de ce type/période → repasser à MANQUANT
    await this.syncFluxAfterDelete(clientId, typeDoc, periodeMois, periodeAnnee);

    return { message: 'Document supprimé' };
  }

  /** Compte les factures tagguées par type et période pour un client */
  async countByTypePeriode(
    clientId: number,
    annee: number,
  ): Promise<{ mois: number; typeDoc: TypeDoc; count: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('d')
      .select('d.periodeMois', 'mois')
      .addSelect('d.typeDoc', 'typeDoc')
      .addSelect('COUNT(d.id)', 'count')
      .where('d.clientId = :clientId', { clientId })
      .andWhere('d.periodeAnnee = :annee', { annee })
      .andWhere('d.typeDoc IN (:...types)', { types: ['FACTURE_ACHAT', 'FACTURE_VENTE'] })
      .andWhere('d.periodeMois IS NOT NULL')
      .groupBy('d.periodeMois')
      .addGroupBy('d.typeDoc')
      .getRawMany();

    return rows.map(r => ({
      mois: +r.mois,
      typeDoc: r.typeDoc as TypeDoc,
      count: +r.count,
    }));
  }

  // ── Logique de synchronisation ──────────────────────────────────────────────

  private async syncFluxAfterUpload(
    clientId: number,
    meta?: { typeDoc?: TypeDoc; periodeMois?: number; periodeAnnee?: number },
  ) {
    if (!meta?.typeDoc || !FLUX_TYPES.has(meta.typeDoc)) return;

    const type = meta.typeDoc as unknown as TypeFlux;
    const annee = meta.periodeAnnee;
    if (!annee) return;

    // TVA_ANNUELLE → mois 12 ; autres → mois fourni
    const mois = type === TypeFlux.TVA_ANNUELLE ? 12 : meta.periodeMois;
    if (!mois) return;

    // Upsert : créer ou mettre à jour le flux en DEPOSE
    let flux = await this.fluxRepo.findOne({
      where: { client: { id: clientId }, type, mois, annee },
    });

    if (!flux) {
      flux = this.fluxRepo.create({
        client: { id: clientId } as any,
        type,
        mois,
        annee,
        statut: StatutDepot.DEPOSE,
        dateDepot: new Date(),
      });
    } else {
      flux.statut = StatutDepot.DEPOSE;
      if (!flux.dateDepot) flux.dateDepot = new Date();
    }

    await this.fluxRepo.save(flux);
  }

  private async syncFluxAfterDelete(
    clientId: number,
    typeDoc: TypeDoc | null,
    periodeMois: number | null,
    periodeAnnee: number | null,
  ) {
    if (!typeDoc || !FLUX_TYPES.has(typeDoc)) return;

    const type = typeDoc as unknown as TypeFlux;
    const annee = periodeAnnee;
    if (!annee) return;

    const mois = type === TypeFlux.TVA_ANNUELLE ? 12 : periodeMois;
    if (!mois) return;

    // Compter les docs restants du même type/période pour ce client
    const remaining = await this.repo.count({
      where: {
        client: { id: clientId },
        typeDoc,
        periodeMois: mois,
        periodeAnnee: annee,
      },
    });

    if (remaining === 0) {
      const flux = await this.fluxRepo.findOne({
        where: { client: { id: clientId }, type, mois, annee },
      });
      if (flux && flux.statut === StatutDepot.DEPOSE) {
        flux.statut = StatutDepot.MANQUANT;
        flux.dateDepot = null as any;
        await this.fluxRepo.save(flux);
      }
    }
  }
}
