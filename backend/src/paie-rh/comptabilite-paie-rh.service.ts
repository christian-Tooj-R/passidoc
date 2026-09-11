import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulletinSalarie } from '../entities/bulletin-salarie.entity';
import { RubriquePaieRh } from '../entities/rubrique-paie-rh.entity';

/**
 * V1 (best-effort) — export simple d'écritures comptables AGRÉGÉES par rubrique pour une
 * période. Ceci n'est PAS une intégration comptable réelle (pas de connecteur logiciel de
 * compta, pas de format d'import standard) : simple CSV illustratif, à valider avec un
 * comptable avant tout usage réel. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Injectable()
export class ComptabilitePaieRhService {
  constructor(
    @InjectRepository(BulletinSalarie) private bulletinRepo: Repository<BulletinSalarie>,
    @InjectRepository(RubriquePaieRh) private rubriqueRepo: Repository<RubriquePaieRh>,
  ) {}

  async exportEcrituresCsv(mois: number, annee: number, tenantId: number): Promise<string> {
    const bulletins = await this.bulletinRepo.find({ where: { mois, annee, tenantId } });
    const rubriques = await this.rubriqueRepo.find({ where: { tenantId } });
    const compteParCode = new Map(rubriques.map((r) => [r.code, r.compteComptable]));

    const totauxParRubrique = new Map<string, { libelle: string; totalSalarial: number; totalPatronal: number }>();
    for (const b of bulletins) {
      for (const l of b.detailRubriques) {
        const existante = totauxParRubrique.get(l.code);
        if (existante) {
          existante.totalSalarial += Number(l.montantSalarial);
          existante.totalPatronal += Number(l.montantPatronal);
        } else {
          totauxParRubrique.set(l.code, {
            libelle: l.libelle,
            totalSalarial: Number(l.montantSalarial),
            totalPatronal: Number(l.montantPatronal),
          });
        }
      }
    }

    let csv = '﻿'; // BOM UTF-8 pour Excel
    csv += ['Compte', 'Libellé', 'Montant part salariale', 'Montant part patronale'].join(';') + '\n';
    for (const [code, t] of totauxParRubrique) {
      const compte = compteParCode.get(code) || 'A_DEFINIR';
      csv += [compte, t.libelle, t.totalSalarial.toFixed(2), t.totalPatronal.toFixed(2)].join(';') + '\n';
    }
    const totalNetAPayer = bulletins.reduce((s, b) => s + Number(b.netAPayer), 0);
    csv += ['A_DEFINIR', `Net à payer — dettes salariales ${mois}/${annee}`, totalNetAPayer.toFixed(2), ''].join(';') + '\n';

    return csv;
  }
}
