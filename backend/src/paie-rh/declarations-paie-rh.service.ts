import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulletinSalarie } from '../entities/bulletin-salarie.entity';

export interface LigneRecapDeclaration {
  code: string;
  libelle: string;
  imputation: string;
  totalBase: number;
  totalSalarial: number;
  totalPatronal: number;
}

/**
 * V1 (best-effort) — récapitulatif agrégé par rubrique/organisme pour une période, servant
 * de BASE à une future déclaration réelle.
 *
 * ⚠️ Ceci NE GÉNÈRE AUCUN fichier de déclaration officiel (pas de DSN, pas de format CNaPS/
 * OSTIE/FMFP/IRSA réel) — le CDC lui-même précise que ces formats sont juridictionnels,
 * changent régulièrement et doivent être pilotés par un connecteur versionné dédié, hors
 * périmètre de cette v1. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Injectable()
export class DeclarationsPaieRhService {
  constructor(@InjectRepository(BulletinSalarie) private bulletinRepo: Repository<BulletinSalarie>) {}

  async recapPeriode(mois: number, annee: number, tenantId: number) {
    const bulletins = await this.bulletinRepo.find({ where: { mois, annee, tenantId } });

    const parRubrique = new Map<string, LigneRecapDeclaration>();
    for (const b of bulletins) {
      for (const l of b.detailRubriques) {
        const existante = parRubrique.get(l.code);
        if (existante) {
          existante.totalBase += Number(l.base);
          existante.totalSalarial += Number(l.montantSalarial);
          existante.totalPatronal += Number(l.montantPatronal);
        } else {
          parRubrique.set(l.code, {
            code: l.code,
            libelle: l.libelle,
            imputation: l.imputation,
            totalBase: Number(l.base),
            totalSalarial: Number(l.montantSalarial),
            totalPatronal: Number(l.montantPatronal),
          });
        }
      }
    }

    return {
      mois,
      annee,
      nbBulletins: bulletins.length,
      totalBrut: bulletins.reduce((s, b) => s + Number(b.totalBrut), 0),
      totalNetAPayer: bulletins.reduce((s, b) => s + Number(b.netAPayer), 0),
      totalCoutEmployeur: bulletins.reduce((s, b) => s + Number(b.coutEmployeur), 0),
      parRubrique: Array.from(parRubrique.values()),
      avertissement:
        "Récapitulatif agrégé indicatif — ne constitue PAS une déclaration sociale officielle. " +
        'Aucun format DSN (France) ni CNaPS/OSTIE/FMFP/IRSA (Madagascar) réel n\'est généré. ' +
        'Voir Doc/MODULE_PAIE_RH_NOTES.md.',
    };
  }
}
