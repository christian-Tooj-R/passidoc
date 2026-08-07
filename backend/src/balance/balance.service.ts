import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { BalanceMensuelle } from '../entities/balance-mensuelle.entity';
import { Document } from '../entities/document.entity';

export interface MoisBalance {
  mois: number;
  nbFournisseursAttendu: number;
  nbClientsAttendu:      number;
  nbAttentesAttendu:     number;
  nbFournisseursRecu:    number;
  nbClientsRecu:         number;
  nbAttentesRecu:        number;
  tauxFournisseurs: number; // %
  tauxClients:      number; // %
  tauxAttentes:     number; // %
  analyseIA: string | null;
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  private groq: Groq;
  private model: string;

  constructor(
    @InjectRepository(BalanceMensuelle) private repo: Repository<BalanceMensuelle>,
    @InjectRepository(Document) private docRepo: Repository<Document>,
    private config: ConfigService,
  ) {
    this.groq = new Groq({ apiKey: config.get<string>('GROQ_API_KEY') });
    this.model = config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
  }

  async getByAnnee(clientId: number, annee: number, tenantId?: number): Promise<MoisBalance[]> {
    const rows = await this.repo.find({
      where: { clientId, annee, ...(tenantId ? { tenantId } : {}) },
      order: { mois: 'ASC' },
    });

    // Compte les documents taggués par type/mois pour cette année
    const docCounts = await this.docRepo
      .createQueryBuilder('d')
      .select('d.periodeMois', 'mois')
      .addSelect('d.typeDoc', 'typeDoc')
      .addSelect('COUNT(d.id)', 'count')
      .where('d.clientId = :clientId', { clientId })
      .andWhere('d.periodeAnnee = :annee', { annee })
      .andWhere('d.typeDoc IN (:...types)', { types: ['FACTURE_ACHAT', 'FACTURE_VENTE', 'COMPTE_ATTENTE'] })
      .andWhere('d.periodeMois IS NOT NULL')
      .groupBy('d.periodeMois')
      .addGroupBy('d.typeDoc')
      .getRawMany<{ mois: string; typeDoc: string; count: string }>();

    const docMap = new Map<string, number>();
    for (const r of docCounts) {
      docMap.set(`${r.mois}-${r.typeDoc}`, +r.count);
    }

    return Array.from({ length: 12 }, (_, i) => {
      const mois = i + 1;
      const row = rows.find(r => r.mois === mois);
      const nbFournisseursRecu = docMap.get(`${mois}-FACTURE_ACHAT`)   ?? 0;
      const nbClientsRecu      = docMap.get(`${mois}-FACTURE_VENTE`)   ?? 0;
      const nbAttentesRecu     = docMap.get(`${mois}-COMPTE_ATTENTE`)  ?? 0;
      const nbFournisseursAttendu = row?.nbFournisseursAttendu ?? 0;
      const nbClientsAttendu      = row?.nbClientsAttendu      ?? 0;
      const nbAttentesAttendu     = row?.nbAttentesAttendu     ?? 0;
      return {
        mois,
        nbFournisseursAttendu,
        nbClientsAttendu,
        nbAttentesAttendu,
        nbFournisseursRecu,
        nbClientsRecu,
        nbAttentesRecu,
        tauxFournisseurs: nbFournisseursAttendu
          ? Math.round((nbFournisseursRecu / nbFournisseursAttendu) * 100)
          : 0,
        tauxClients: nbClientsAttendu
          ? Math.round((nbClientsRecu / nbClientsAttendu) * 100)
          : 0,
        tauxAttentes: nbAttentesAttendu
          ? Math.round((nbAttentesRecu / nbAttentesAttendu) * 100)
          : 0,
        analyseIA: row?.analyseIA ?? null,
      };
    });
  }

  async resetBalance(clientId: number, annee: number, tenantId?: number): Promise<void> {
    await this.repo.delete({ clientId, annee, ...(tenantId ? { tenantId } : {}) });
  }

  async importFec(clientId: number, annee: number, buffer: Buffer, tenantId?: number): Promise<{ imported: number; annee: number }> {
    // Essayer UTF-8 d'abord, fallback latin1 si le fichier est ISO-8859-1
    const contentUtf8 = buffer.toString('utf-8');
    const content = contentUtf8.includes('�')
      ? buffer.toString('latin1')
      : contentUtf8;
    const parsed = this.parseFec(content);

    let count = 0;
    for (const [period, data] of parsed.entries()) {
      const [yr, mo] = period.split('-').map(Number);

      await this.repo.upsert(
        {
          clientId,
          tenantId,
          annee: yr,
          mois: mo,
          nbFournisseursAttendu: data.fournisseurs,
          nbClientsAttendu:      data.clients,
          nbAttentesAttendu:     data.attentes,
        },
        { conflictPaths: ['clientId', 'annee', 'mois'] },
      );
      count++;
    }

    // Renvoie l'année la plus représentée dans le FEC pour que le frontend navigue dessus
    const years = [...parsed.keys()].map(p => +p.split('-')[0]);
    const dominantYear = years.sort((a, b) =>
      years.filter(y => y === b).length - years.filter(y => y === a).length
    )[0] ?? annee;

    return { imported: count, annee: dominantYear };
  }

  async updateRecu(
    clientId: number,
    annee: number,
    mois: number,
    dto: { nbFournisseursRecu?: number; nbClientsRecu?: number; nbAttentesRecu?: number },
    tenantId?: number,
  ): Promise<void> {
    let row = await this.repo.findOne({ where: { clientId, annee, mois } });
    if (!row) {
      row = this.repo.create({ clientId, tenantId, annee, mois,
        nbFournisseursAttendu: 0, nbClientsAttendu: 0, nbAttentesAttendu: 0,
        nbFournisseursRecu: 0, nbClientsRecu: 0, nbAttentesRecu: 0 });
    }
    if (dto.nbFournisseursRecu !== undefined) row.nbFournisseursRecu = dto.nbFournisseursRecu;
    if (dto.nbClientsRecu      !== undefined) row.nbClientsRecu      = dto.nbClientsRecu;
    if (dto.nbAttentesRecu     !== undefined) row.nbAttentesRecu     = dto.nbAttentesRecu;
    await this.repo.save(row);
  }

  async analyserAvecIA(clientId: number, annee: number, tenantId?: number): Promise<string> {
    const balance = await this.getByAnnee(clientId, annee, tenantId);
    const moisActifs = balance.filter(m => m.nbFournisseursAttendu > 0 || m.nbClientsAttendu > 0);

    if (moisActifs.length === 0) {
      return 'Aucune donnée de balance importée pour cette année. Importez un fichier FEC pour activer l\'analyse.';
    }

    const tableauTexte = moisActifs.map(m => {
      const nomMois = new Date(annee, m.mois - 1).toLocaleString('fr-FR', { month: 'long' });
      return `- ${nomMois} : Achats ${m.nbFournisseursRecu}/${m.nbFournisseursAttendu} (${m.tauxFournisseurs}%) | Ventes ${m.nbClientsRecu}/${m.nbClientsAttendu} (${m.tauxClients}%) | Attentes 471 ${m.nbAttentesRecu}/${m.nbAttentesAttendu} (${m.tauxAttentes}%)`;
    }).join('\n');

    const prompt = `Tu es un assistant expert-comptable analysant la complétude des pièces comptables pour un dossier client.

Voici le tableau de complétude factures pour l'année ${annee} :
${tableauTexte}

(Format : reçu/attendu en nombre de pièces, suivi du taux de complétude)

Fournis une analyse concise (5-8 phrases maximum) couvrant :
1. Les mois critiques où la complétude est insuffisante (< 80%)
2. Les types de flux les plus en retard (achats ou ventes)
3. Une recommandation prioritaire pour les relances
4. Si des données sont manquantes (0/0), signale les mois non encore alimentés

Réponds directement en français, sans titres ni puces, de façon professionnelle.`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      });
      const analyse = completion.choices[0]?.message?.content ?? 'Analyse indisponible.';

      // Persiste l'analyse sur les lignes de cette année
      await this.repo.update({ clientId, annee }, { analyseIA: analyse });

      return analyse;
    } catch (err) {
      this.logger.error('Erreur analyse IA balance', err);
      return 'Analyse IA temporairement indisponible.';
    }
  }

  // ── Parseur FEC ────────────────────────────────────────────────────────────
  private parseFec(content: string): Map<string, { fournisseurs: number; clients: number; attentes: number }> {
    const result = new Map<string, { fournisseurs: number; clients: number; attentes: number }>();

    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return result;

    const sep = lines[0].includes('|') ? '|' : ';';
    const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/^﻿/, ''));

    // Normaliser pour comparaison insensible aux accents et à la casse
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normH = rawHeaders.map(norm);

    // ── Détection du format ──────────────────────────────────────────
    // Format FEC standard : colonnes EcritureDate + CompteNum
    let idxDate   = normH.findIndex(h => h === 'ecrituredate');
    let idxCompte = normH.findIndex(h => h === 'comptenum');
    let idxPiece  = normH.findIndex(h => h === 'pieceref');
    let idxEcrit  = normH.findIndex(h => h === 'ecriturenum');
    let isGrandLivre = false;

    // Format grand livre (ex: export Sage) : Date + N° Compte Auxiliaire + N° Compte (colonne 0)
    let idxCompteNum = -1; // colonne "N° Compte" (compte général, ex: 40100000)
    if (idxDate < 0 || idxCompte < 0) {
      idxDate      = normH.findIndex(h => h === 'date');
      idxCompte    = normH.findIndex(h => h.includes('auxiliaire'));
      idxCompteNum = normH.findIndex(h => norm(rawHeaders[0]) === norm(h) && !h.includes('auxiliaire'));
      if (idxCompteNum < 0) idxCompteNum = 0; // fallback : première colonne
      idxPiece     = normH.findIndex(h => h.includes('piece') || h.includes('pice'));
      isGrandLivre = true;
    }

    if (idxDate < 0 || idxCompte < 0) return result;

    const fournisseurs = new Map<string, Set<string>>();
    const clients      = new Map<string, Set<string>>();
    const attentes     = new Map<string, Set<string>>();

    for (let i = 1; i < lines.length; i++) {
      const fields      = lines[i].split(sep);
      const compteAux   = fields[idxCompte]?.trim() ?? '';
      // Pour les 471 : l'auxiliaire est vide → on utilise le compte général (colonne 0)
      const compteNum   = isGrandLivre && idxCompteNum >= 0
        ? fields[idxCompteNum]?.trim() ?? ''
        : '';
      const compte      = compteAux || compteNum; // auxiliaire en priorité, sinon compte général
      const dateStr     = fields[idxDate]?.trim() ?? '';

      if (!compte || dateStr.length < 6) continue;

      const isFourn   = compte.startsWith('401');
      const isClient  = compte.startsWith('411');
      // 471 détecté via le compte général (47100000) car l'auxiliaire est vide
      const isAttente = compteNum.startsWith('471') || compteAux.startsWith('471');
      if (!isFourn && !isClient && !isAttente) continue;

      // Parse date : YYYYMMDD | YYYY-MM-DD | DD/MM/YYYY
      let annee = '', mois = '';
      if (/^\d{8}$/.test(dateStr)) {
        annee = dateStr.slice(0, 4); mois = dateStr.slice(4, 6);
      } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        annee = dateStr.slice(0, 4); mois = dateStr.slice(5, 7);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        annee = dateStr.slice(6, 10); mois = dateStr.slice(3, 5);
      } else continue;

      const period = `${annee}-${mois}`;

      // Grand livre → 401/411 : clé = compte auxiliaire (1 auxiliaire = 1 tiers distinct)
      //              → 471    : pas d'auxiliaire, clé = ligne (1 ligne = 1 mouvement)
      // FEC standard → clé = numéro de pièce (1 pièce = 1 facture)
      let key: string;
      if (isGrandLivre) {
        key = compteAux || `line-${i}`; // 471 : pas d'auxiliaire → on compte chaque mouvement
      } else {
        key = (idxPiece >= 0 ? fields[idxPiece]?.trim() : '') ||
              (idxEcrit >= 0 ? fields[idxEcrit]?.trim() : '') ||
              `line-${i}`;
      }

      const map = isFourn ? fournisseurs : isClient ? clients : attentes;
      if (!map.has(period)) map.set(period, new Set());
      map.get(period)!.add(key);
    }

    const allPeriods = new Set([...fournisseurs.keys(), ...clients.keys(), ...attentes.keys()]);
    for (const period of allPeriods) {
      result.set(period, {
        fournisseurs: fournisseurs.get(period)?.size ?? 0,
        clients:      clients.get(period)?.size ?? 0,
        attentes:     attentes.get(period)?.size ?? 0,
      });
    }

    return result;
  }
}
