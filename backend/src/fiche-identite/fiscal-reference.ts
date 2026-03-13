export const FISCAL_REFERENCE = {
  REUNION: {
    zonesExoneration: [
      'ZFA NG (Zone Franche Active Nouvelle Génération)',
      'Exonération DOM — IS réduit (taux 15%)',
      'Exonération DOM — TVA non collectée',
      'Dispositif LODEOM — exonération charges patronales',
      'CIOM (Crédit Impôt Outre-Mer)',
      'Abattement 1/3 sur bénéfices imposables',
    ],
    zonesRisque: [
      'Flux d\'espèces importants (risque fiscal)',
      'Prix de transfert intragroupe',
      'TVA déductible sur importations',
      'Contrôle URSSAF renforcé DOM',
      'Revenus de gérance non déclarés',
    ],
    reglementations: [
      'Loi Raffarin (commerce)',
      'Règlement UE 852/2004 (hygiène alimentaire)',
      'Normes ERP (établissement recevant du public)',
      'Code du travail adapté DOM',
      'LODEOM (Loi pour le développement économique des outre-mer)',
    ],
  },
  MADAGASCAR: {
    zonesExoneration: [
      'Zone Économique Spéciale (ZES)',
      'Exonération IR Entreprise — Zone franche exportation',
      'Franchise TVA à l\'importation',
      'Régime Entreprise Franche d\'Exportation (EFE)',
      'Crédit d\'impôt investissement',
    ],
    zonesRisque: [
      'Risque de change Ariary / Euro',
      'Obligation de rapatriement des devises',
      'TVA sur services importés (reverse charge)',
      'Impôt Synthétique (régime PME)',
      'IRSA (Impôt sur les Revenus Salariaux et Assimilés)',
      'Déclaration douanière à l\'exportation',
    ],
    reglementations: [
      'Code General des Impôts Madagascar (CGI)',
      'Loi sur les zones franches',
      'Code du travail malgache',
      'Réglementation des changes (BOT)',
      'Normes OHADA (en cours d\'adoption)',
    ],
  },
};

export type SiteFiscal = keyof typeof FISCAL_REFERENCE;
