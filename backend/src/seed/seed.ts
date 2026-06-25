import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserSite } from '../entities/user.entity';
import { Client, ClientSite } from '../entities/client.entity';
import { FicheIdentite } from '../entities/fiche-identite.entity';
import { FluxMensuel, TypeFlux, StatutDepot } from '../entities/flux-mensuel.entity';
import { Fournisseur } from '../entities/fournisseur.entity';
import { SyntheseCloture } from '../entities/synthese-cloture.entity';
import { Pointage } from '../entities/pointage.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepo      = app.get<Repository<User>>(getRepositoryToken(User));
  const clientRepo    = app.get<Repository<Client>>(getRepositoryToken(Client));
  const ficheRepo     = app.get<Repository<FicheIdentite>>(getRepositoryToken(FicheIdentite));
  const fluxRepo      = app.get<Repository<FluxMensuel>>(getRepositoryToken(FluxMensuel));
  const fournisseurRepo = app.get<Repository<Fournisseur>>(getRepositoryToken(Fournisseur));
  const syntheseRepo  = app.get<Repository<SyntheseCloture>>(getRepositoryToken(SyntheseCloture));
  const pointageRepo  = app.get<Repository<Pointage>>(getRepositoryToken(Pointage));

  console.log('🌱 Démarrage du seed...\n');

  // ── Utilisateurs ──────────────────────────────────────────────────────────

  const users = [
    {
      email: 'admin@afym.re',
      firstName: 'Thomas',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      site: UserSite.REUNION,
      timezone: 'Indian/Reunion',
      password: 'Admin2024!',
    },
    {
      email: 'expert@afym.re',
      firstName: 'Sophie',
      lastName: 'Martin',
      role: UserRole.EXPERT_COMPTABLE,
      site: UserSite.REUNION,
      timezone: 'Indian/Reunion',
      password: 'Expert2024!',
    },
    {
      email: 'collab@afym.re',
      firstName: 'Jean',
      lastName: 'Dupont',
      role: UserRole.COLLABORATEUR,
      site: UserSite.REUNION,
      timezone: 'Indian/Reunion',
      password: 'Collab2024!',
    },
    {
      email: 'expert@afym.mg',
      firstName: 'Hery',
      lastName: 'Rakoto',
      role: UserRole.EXPERT_COMPTABLE,
      site: UserSite.MADAGASCAR,
      timezone: 'Indian/Antananarivo',
      password: 'Expert2024!',
    },
    {
      email: 'marie@afym.re',
      firstName: 'Marie',
      lastName: 'Lefevre',
      role: UserRole.COLLABORATEUR,
      site: UserSite.REUNION,
      timezone: 'Indian/Reunion',
      password: 'Marie2024!',
    },
    {
      email: 'thomas@afym.re',
      firstName: 'Thomas',
      lastName: 'Berger',
      role: UserRole.EXPERT_COMPTABLE,
      site: UserSite.REUNION,
      timezone: 'Indian/Reunion',
      password: 'Thomas2024!',
    },
    {
      email: 'romuald@afym.mg',
      firstName: 'Romuald',
      lastName: 'Andriamaro',
      role: UserRole.ADMIN,
      site: UserSite.MADAGASCAR,
      timezone: 'Indian/Antananarivo',
      password: 'Romuald2024!',
    },
  ];

  for (const u of users) {
    const exists = await userRepo.findOne({ where: { email: u.email } });
    if (!exists) {
      const hashed = await bcrypt.hash(u.password, 10);
      await userRepo.save(userRepo.create({ ...u, password: hashed }));
      console.log(`✅ User créé : ${u.email} (${u.role}) — password: ${u.password}`);
    } else {
      // Réinitialiser le mot de passe à chaque seed
      const hashed = await bcrypt.hash(u.password, 10);
      await userRepo.update(exists.id, { password: hashed });
      console.log(`⏭  User existant (mdp réinitialisé) : ${u.email}`);
    }
  }

  // ── Données RH complètes ────────────────────────────────────────────────
  console.log('\n👔 Mise à jour des fiches RH...');

  const rhData: Record<string, Partial<User>> = {
    'admin@afym.re': {
      dateNaissance: '1985-03-14',
      lieuNaissance: 'Saint-Denis, La Réunion',
      sexe: 'M',
      nationalite: 'Française',
      situationMatrimoniale: 'Marié(e)',
      nbEnfantsCharge: 2,
      adresse: '12 Allée des Flamboyants',
      codePostal: '97400',
      ville: 'Saint-Denis',
      pays: 'La Réunion',
      telephone: '0692 11 22 33',
      poste: 'Directeur général',
      departement: 'Direction',
      typeContrat: 'CDI',
      dateEntree: '2015-09-01',
      statut: 'CADRE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 39,
      matricule: 'RE-001',
      numeroCIN: '123456789012',
      numeroSS: '1 85 03 974 001 23',
      salaireBase: 4800,
      modePaiement: 'VIREMENT',
      banque: 'Crédit Agricole',
      iban: 'FR76 1820 6004 1700 0000 0000 000',
      devise: 'EUR',
    },
    'expert@afym.re': {
      dateNaissance: '1990-07-22',
      lieuNaissance: 'Saint-Pierre, La Réunion',
      sexe: 'F',
      nationalite: 'Française',
      situationMatrimoniale: 'Célibataire',
      nbEnfantsCharge: 0,
      adresse: '5 Rue du Barachois',
      codePostal: '97410',
      ville: 'Saint-Pierre',
      pays: 'La Réunion',
      telephone: '0692 44 55 66',
      poste: 'Expert-comptable',
      departement: 'Expertise comptable',
      typeContrat: 'CDI',
      dateEntree: '2018-02-15',
      statut: 'CADRE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 39,
      matricule: 'RE-002',
      numeroCIN: '290722974002',
      numeroSS: '2 90 07 974 002 45',
      salaireBase: 3900,
      modePaiement: 'VIREMENT',
      banque: 'BNP Paribas',
      iban: 'FR76 3000 4001 6700 0000 0000 000',
      devise: 'EUR',
    },
    'collab@afym.re': {
      dateNaissance: '1995-11-08',
      lieuNaissance: 'Le Tampon, La Réunion',
      sexe: 'M',
      nationalite: 'Française',
      situationMatrimoniale: 'Célibataire',
      nbEnfantsCharge: 0,
      adresse: '28 Chemin des Letchis',
      codePostal: '97430',
      ville: 'Le Tampon',
      pays: 'La Réunion',
      telephone: '0693 77 88 99',
      poste: 'Collaborateur comptable',
      departement: 'Expertise comptable',
      typeContrat: 'CDI',
      dateEntree: '2021-06-01',
      statut: 'NON_CADRE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 35,
      matricule: 'RE-003',
      numeroCIN: '195118974003',
      numeroSS: '1 95 11 974 003 67',
      salaireBase: 2200,
      modePaiement: 'VIREMENT',
      banque: 'Banque Postale',
      iban: 'FR76 2004 1010 1200 0000 0000 000',
      devise: 'EUR',
    },
    'expert@afym.mg': {
      dateNaissance: '1988-05-30',
      lieuNaissance: 'Antananarivo, Madagascar',
      sexe: 'M',
      nationalite: 'Malgache',
      situationMatrimoniale: 'Marié(e)',
      nbEnfantsCharge: 3,
      adresse: 'Lot IVF 23, Ankadifotsy',
      codePostal: '101',
      ville: 'Antananarivo',
      pays: 'Madagascar',
      telephone: '+261 34 12 345 67',
      poste: 'Expert-comptable',
      departement: 'Expertise comptable',
      typeContrat: 'CDI',
      dateEntree: '2019-01-07',
      statut: 'CADRE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 40,
      matricule: 'MG-001',
      numeroCIN: '101 888 530 007',
      numeroSS: null,
      salaireBase: 1200000,
      modePaiement: 'VIREMENT',
      banque: 'BFV-SG Madagascar',
      iban: 'MG46 0000 0000 0101 0000 000',
      devise: 'MGA',
    },
    'marie@afym.re': {
      dateNaissance: '1992-01-19',
      lieuNaissance: 'Saint-Benoît, La Réunion',
      sexe: 'F',
      nationalite: 'Française',
      situationMatrimoniale: 'Marié(e)',
      nbEnfantsCharge: 1,
      adresse: '7 Impasse des Vacoas',
      codePostal: '97440',
      ville: 'Saint-André',
      pays: 'La Réunion',
      telephone: '0692 33 44 55',
      poste: 'Chargée de dossiers',
      departement: 'Gestion clientèle',
      typeContrat: 'CDI',
      dateEntree: '2020-03-02',
      statut: 'AGENT_MAITRISE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 35,
      matricule: 'RE-004',
      numeroCIN: '292011974004',
      numeroSS: '2 92 01 974 004 89',
      salaireBase: 2600,
      modePaiement: 'VIREMENT',
      banque: 'Crédit Agricole',
      iban: 'FR76 1820 6004 1700 0000 0000 001',
      devise: 'EUR',
    },
    'thomas@afym.re': {
      dateNaissance: '1983-09-05',
      lieuNaissance: 'Lyon, France métropolitaine',
      sexe: 'M',
      nationalite: 'Française',
      situationMatrimoniale: 'Divorcé(e)',
      nbEnfantsCharge: 1,
      adresse: '15 Rue Juliette Dodu',
      codePostal: '97400',
      ville: 'Saint-Denis',
      pays: 'La Réunion',
      telephone: '0692 66 77 88',
      poste: 'Expert-comptable senior',
      departement: 'Expertise comptable',
      typeContrat: 'CDI',
      dateEntree: '2016-11-14',
      statut: 'CADRE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 39,
      matricule: 'RE-005',
      numeroCIN: '183095069005',
      numeroSS: '1 83 09 974 005 12',
      salaireBase: 4200,
      modePaiement: 'VIREMENT',
      banque: 'Société Générale',
      iban: 'FR76 3000 3001 6700 0000 0000 000',
      devise: 'EUR',
    },
    'romuald@afym.mg': {
      dateNaissance: '1980-12-25',
      lieuNaissance: 'Fianarantsoa, Madagascar',
      sexe: 'M',
      nationalite: 'Malgache',
      situationMatrimoniale: 'Marié(e)',
      nbEnfantsCharge: 4,
      adresse: 'Villa Mananara, Ivandry',
      codePostal: '101',
      ville: 'Antananarivo',
      pays: 'Madagascar',
      telephone: '+261 33 98 765 43',
      poste: 'Directeur associé Madagascar',
      departement: 'Direction',
      typeContrat: 'CDI',
      dateEntree: '2017-04-10',
      statut: 'CADRE',
      tempsTravail: 'TEMPS_PLEIN',
      heuresHebdo: 40,
      matricule: 'MG-002',
      numeroCIN: '101 800 252 001',
      numeroSS: null,
      salaireBase: 2500000,
      modePaiement: 'VIREMENT',
      banque: 'BOA Madagascar',
      iban: 'MG46 0000 0000 0101 0001 001',
      devise: 'MGA',
    },
  };

  for (const [email, data] of Object.entries(rhData)) {
    const user = await userRepo.findOne({ where: { email } });
    if (user) {
      await userRepo.update(user.id, data);
      console.log(`✅ Fiche RH mise à jour : ${email}`);
    }
  }

  // ── Résolution des responsables ──────────────────────────────────────────
  const marie  = await userRepo.findOne({ where: { email: 'marie@afym.re' } });
  const thomas = await userRepo.findOne({ where: { email: 'thomas@afym.re' } });
  const hery   = await userRepo.findOne({ where: { email: 'expert@afym.mg' } });

  // ── Clients ────────────────────────────────────────────────────────────────

  const clientsData = [
    {
      nom: 'Boulangerie Du Four à la Planche',
      site: ClientSite.REUNION,
      responsable: marie,
      fiche: {
        raisonSociale: 'SARL Du Four à la Planche',
        siren: '123456789',
        siret: '12345678900014',
        formeJuridique: 'SARL',
        adresse: '12 Rue de la Paix, 97400 Saint-Denis',
        activite: 'Boulangerie-pâtisserie artisanale',
        surfaceCommerciale: 137,
        gerants: [{ nom: 'Marc Lebon', age: 45, situationFamiliale: 'Marié', contratMariage: 'Communauté réduite aux acquêts', nbEnfants: 2 }],
        salaries: [
          { nom: 'Claire Petit', poste: 'Vendeuse', typeContrat: 'CDI' },
          { nom: 'Antoine Gros', poste: 'Boulanger', typeContrat: 'CDI' },
          { nom: 'Lucie Blanc', poste: 'Apprentie', typeContrat: 'Apprentissage' },
        ],
      },
      flux: [
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 2, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 3, annee: 2025, statut: StatutDepot.MANQUANT },
        { type: TypeFlux.RAPPORT_VENTE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RAPPORT_VENTE, mois: 2, annee: 2025, statut: StatutDepot.EN_RETARD },
        { type: TypeFlux.TVA_MENSUELLE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
      ],
      fournisseurs: [
        { nom: 'Grands Moulins de Paris', email: 'commandes@gmp.fr', telephone: '0262112233', categorie: 'Farine' },
        { nom: 'Laiterie de La Réunion', email: 'pro@laiterie-reunion.re', telephone: '0262445566', categorie: 'Produits laitiers' },
        { nom: 'Sucre de La Réunion', email: 'b2b@sucre-reunion.re', categorie: 'Sucre' },
      ],
      synthese: {
        exercice: 2024,
        pointsIS: 'Résultat fiscal 42 000€. IS au taux normal 25%. Acomptes bien versés.',
        pointsEBE: 'EBE à 18% du CA. Progression de 3 points vs N-1. Maîtrise des charges salariales.',
        notesSynthese: 'Dossier stable. Attention au flux espèces en période estivale. Renouvellement matériel four prévu 2025.',
        businessModel: 'Artisan boulanger indépendant. Vente directe en boutique et livraisons hôtels locaux.',
        strategieVente: 'Fidélisation clientèle locale. Développement offre traiteur.',
        zonesExoneration: ['ZFA NG'],
        zonesRisque: ['flux d\'espèces', 'saisonnalité touristique'],
      },
    },
    {
      nom: 'Cabinet Médical Saint-Denis',
      site: ClientSite.REUNION,
      responsable: marie,
      fiche: {
        raisonSociale: 'SCP Docteurs Renard & Moreau',
        siren: '987654321',
        siret: '98765432100021',
        formeJuridique: 'SCP',
        adresse: '5 Avenue de la Victoire, 97400 Saint-Denis',
        activite: 'Cabinet médical libéral',
        surfaceCommerciale: 85,
        gerants: [
          { nom: 'Dr. Paul Renard', age: 52, situationFamiliale: 'Marié', contratMariage: 'Séparation de biens', nbEnfants: 3 },
          { nom: 'Dr. Isabelle Moreau', age: 48, situationFamiliale: 'Divorcée', contratMariage: 'N/A', nbEnfants: 1 },
        ],
        salaries: [
          { nom: 'Nathalie Roy', poste: 'Secrétaire médicale', typeContrat: 'CDI' },
        ],
      },
      flux: [
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 2, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 3, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.TVA_MENSUELLE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.TVA_MENSUELLE, mois: 2, annee: 2025, statut: StatutDepot.DEPOSE },
      ],
      fournisseurs: [
        { nom: 'Mediline Réunion', email: 'pro@mediline.re', telephone: '0262778899', categorie: 'Matériel médical' },
        { nom: 'CPAM La Réunion', email: 'partenaires@cpam-reunion.fr', categorie: 'Organisme de santé' },
      ],
      synthese: {
        exercice: 2024,
        pointsIS: 'Revenus libéraux déclarés 180 000€. Déduction charges professionnelles 45 000€.',
        pointsEBE: 'EBE 75% du CA net. Structure très légère en charges fixes.',
        notesSynthese: 'Dossier sain. Attention à la retraite Dr. Renard prévue 2026 — anticiper la cession.',
        businessModel: 'Cabinet médical généraliste. Secteur 1 et secteur 2.',
        strategieVente: 'Patientèle fidèle. Pas de démarche commerciale active.',
        zonesExoneration: ['ZRR'],
        zonesRisque: ['succession cabinet', 'départ associé'],
      },
    },
    {
      nom: 'Hôtel Le Lagon Bleu',
      site: ClientSite.REUNION,
      responsable: thomas,
      fiche: {
        raisonSociale: 'SA Le Lagon Bleu',
        siren: '456789123',
        siret: '45678912300031',
        formeJuridique: 'SA',
        adresse: '88 Route du Littoral, 97434 Saint-Gilles-les-Bains',
        activite: 'Hôtellerie et restauration',
        surfaceCommerciale: 1200,
        gerants: [{ nom: 'Henri Fontaine', age: 58, situationFamiliale: 'Marié', contratMariage: 'Participation aux acquêts', nbEnfants: 4 }],
        salaries: [
          { nom: 'Vanessa Lim', poste: 'Directrice', typeContrat: 'CDI' },
          { nom: 'Stéphane Hoarau', poste: 'Chef cuisinier', typeContrat: 'CDI' },
          { nom: 'Rosa Payet', poste: 'Réceptionniste', typeContrat: 'CDI' },
        ],
      },
      flux: [
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RAPPORT_VENTE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RAPPORT_VENTE, mois: 2, annee: 2025, statut: StatutDepot.MANQUANT },
        { type: TypeFlux.TVA_MENSUELLE, mois: 1, annee: 2025, statut: StatutDepot.EN_RETARD },
      ],
      fournisseurs: [
        { nom: 'Metro Cash & Carry', email: 'pro.reunion@metro.fr', telephone: '0262556677', categorie: 'Alimentaire' },
        { nom: 'Linge Service Réunion', email: 'hotel@linge-reunion.re', categorie: 'Linge hôtelier' },
      ],
      synthese: {
        exercice: 2024,
        pointsIS: 'Déficit reportable de 25 000€. Pas d\'IS dû cette année.',
        pointsEBE: 'EBE négatif en basse saison. Positif sur juillet-août. CA annuel 1,2M€.',
        notesSynthese: 'Saisonnalité forte. Investissement piscine chauffée prévu S2 2025. Attention trésorerie en basse saison.',
        businessModel: 'Hôtel 3 étoiles 45 chambres. Restaurant ouvert au public.',
        strategieVente: 'Booking.com + Airbnb + agences locales. Développement MICE.',
        zonesExoneration: ['ZFA NG', 'TVA taux réduit restauration'],
        zonesRisque: ['saisonnalité', 'flux espèces bar', 'dépendance plateformes'],
      },
    },
    {
      nom: 'Epicerie Fine Randriantsoa',
      site: ClientSite.MADAGASCAR,
      responsable: hery,
      fiche: {
        raisonSociale: 'SARL Randriantsoa Commerce',
        siren: '321654987',
        siret: undefined,
        formeJuridique: 'SARL',
        adresse: 'Lot II B 45, Antananarivo 101, Madagascar',
        activite: 'Commerce de détail alimentaire spécialisé',
        surfaceCommerciale: 65,
        gerants: [{ nom: 'Fanja Randriantsoa', age: 38, situationFamiliale: 'Mariée', contratMariage: 'Droit malgache', nbEnfants: 2 }],
        salaries: [
          { nom: 'Tiana Rabe', poste: 'Vendeur', typeContrat: 'CDD' },
          { nom: 'Hery Andry', poste: 'Livreur', typeContrat: 'CDI' },
        ],
      },
      flux: [
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
        { type: TypeFlux.RELEVE_BANCAIRE, mois: 2, annee: 2025, statut: StatutDepot.MANQUANT },
        { type: TypeFlux.RAPPORT_VENTE, mois: 1, annee: 2025, statut: StatutDepot.DEPOSE },
      ],
      fournisseurs: [
        { nom: 'SCRIMAD Import', email: 'commandes@scrimad.mg', categorie: 'Import alimentaire' },
        { nom: 'Brasseries STAR', email: 'pro@star.mg', telephone: '+261 20 22 345 67', categorie: 'Boissons' },
      ],
      synthese: {
        exercice: 2024,
        pointsIS: 'Impôt sur les revenus Madagascar 20%. Base imposable 12M Ar.',
        pointsEBE: 'EBE 22% du CA. Bonne maîtrise des coûts locaux.',
        notesSynthese: 'Dossier en développement. Attention aux variations Ariary/Euro pour les imports.',
        businessModel: 'Épicerie fine ciblant expatriés et diaspora à Tana.',
        strategieVente: 'Livraison à domicile + commandes WhatsApp.',
        zonesExoneration: ['Zone franche Madagascar'],
        zonesRisque: ['change Ariary', 'inflation locale', 'approvisionnement'],
      },
    },
  ];

  for (const data of clientsData) {
    const exists = await clientRepo.findOne({ where: { nom: data.nom } });
    if (exists) {
      console.log(`⏭  Client déjà existant : ${data.nom}`);
      continue;
    }

    const client = await clientRepo.save(clientRepo.create({
      nom: data.nom,
      site: data.site,
      responsable: data.responsable ?? undefined,
    }));

    await ficheRepo.save(ficheRepo.create({ ...data.fiche, client }));

    for (const f of data.flux) {
      await fluxRepo.save(fluxRepo.create({
        ...f,
        client,
        dateDepot: f.statut === StatutDepot.DEPOSE ? new Date() : undefined,
      }));
    }

    for (const f of data.fournisseurs) {
      await fournisseurRepo.save(fournisseurRepo.create({ ...f, client }));
    }

    await syntheseRepo.save(syntheseRepo.create({ ...data.synthese, client }));

    console.log(`✅ Client créé : ${data.nom}`);
  }

  // ── Pointages ──────────────────────────────────────────────────────────────
  console.log('\n📅 Ajout des pointages de test...');

  const allUsers = await userRepo.find();
  const uid = (email: string) => allUsers.find(u => u.email === email)!.id;

  const adminId   = uid('admin@afym.re');
  const sophieId  = uid('expert@afym.re');
  const jeanId    = uid('collab@afym.re');
  const heryId    = uid('expert@afym.mg');
  const marieId   = uid('marie@afym.re');
  const thomasId  = uid('thomas@afym.re');
  const romualdId = uid('romuald@afym.mg');

  const addP = async (
    userId: number, date: string,
    arrivee: string, debutPause?: string, finPause?: string, depart?: string,
  ) => {
    const exists = await pointageRepo.findOne({ where: { userId, date } });
    if (exists) return;
    await pointageRepo.save(pointageRepo.create({
      userId, date,
      heureArrivee:    new Date(arrivee),
      heureDebutPause: debutPause ? new Date(debutPause) : undefined,
      heureFinPause:   finPause   ? new Date(finPause)   : undefined,
      heureDepart:     depart     ? new Date(depart)     : undefined,
    }));
  };

  // ── Semaine -2 : 2026-05-04 au 2026-05-08 ────────────────────
  // Thomas Admin
  await addP(adminId,   '2026-05-04', '2026-05-04T07:45:00', '2026-05-04T12:00:00', '2026-05-04T13:30:00', '2026-05-04T17:30:00');
  await addP(adminId,   '2026-05-05', '2026-05-05T07:50:00', '2026-05-05T12:00:00', '2026-05-05T13:15:00', '2026-05-05T17:45:00');
  await addP(adminId,   '2026-05-06', '2026-05-06T08:00:00', '2026-05-06T12:30:00', '2026-05-06T13:30:00', '2026-05-06T18:00:00');
  await addP(adminId,   '2026-05-07', '2026-05-07T07:55:00', '2026-05-07T12:00:00', '2026-05-07T13:00:00', '2026-05-07T17:30:00');
  await addP(adminId,   '2026-05-08', '2026-05-08T08:00:00', '2026-05-08T12:00:00', '2026-05-08T13:00:00', '2026-05-08T17:00:00');
  // Sophie Martin
  await addP(sophieId,  '2026-05-04', '2026-05-04T08:15:00', '2026-05-04T12:30:00', '2026-05-04T13:00:00', '2026-05-04T17:15:00');
  await addP(sophieId,  '2026-05-05', '2026-05-05T08:20:00', '2026-05-05T12:30:00', '2026-05-05T13:00:00', '2026-05-05T17:00:00');
  await addP(sophieId,  '2026-05-06', '2026-05-06T08:15:00', '2026-05-06T12:30:00', '2026-05-06T13:00:00', '2026-05-06T17:30:00');
  // Sophie absente jeudi
  await addP(sophieId,  '2026-05-08', '2026-05-08T08:10:00', '2026-05-08T12:00:00', '2026-05-08T13:00:00', '2026-05-08T17:00:00');
  // Jean Dupont
  await addP(jeanId,    '2026-05-04', '2026-05-04T07:30:00', '2026-05-04T12:30:00', '2026-05-04T13:30:00', '2026-05-04T16:30:00');
  await addP(jeanId,    '2026-05-05', '2026-05-05T07:35:00', '2026-05-05T12:30:00', '2026-05-05T13:30:00', '2026-05-05T16:45:00');
  // Jean absent mercredi
  await addP(jeanId,    '2026-05-07', '2026-05-07T07:30:00', '2026-05-07T12:30:00', '2026-05-07T13:30:00', '2026-05-07T16:30:00');
  await addP(jeanId,    '2026-05-08', '2026-05-08T07:40:00', '2026-05-08T12:00:00', '2026-05-08T13:00:00', '2026-05-08T16:45:00');
  // Marie Lefevre
  await addP(marieId,   '2026-05-04', '2026-05-04T08:30:00', '2026-05-04T12:30:00', '2026-05-04T13:30:00', '2026-05-04T17:30:00');
  await addP(marieId,   '2026-05-05', '2026-05-05T08:45:00', '2026-05-05T12:30:00', '2026-05-05T13:30:00', '2026-05-05T17:45:00');
  await addP(marieId,   '2026-05-06', '2026-05-06T08:30:00', '2026-05-06T12:30:00', '2026-05-06T13:30:00', '2026-05-06T17:30:00');
  // Marie absente jeudi
  await addP(marieId,   '2026-05-08', '2026-05-08T08:30:00', '2026-05-08T12:30:00', '2026-05-08T13:30:00', '2026-05-08T17:00:00');
  // Thomas Berger
  await addP(thomasId,  '2026-05-04', '2026-05-04T08:00:00', '2026-05-04T13:00:00', '2026-05-04T14:00:00', '2026-05-04T18:00:00');
  await addP(thomasId,  '2026-05-05', '2026-05-05T08:00:00', '2026-05-05T13:00:00', '2026-05-05T14:00:00', '2026-05-05T18:30:00');
  await addP(thomasId,  '2026-05-06', '2026-05-06T08:00:00', '2026-05-06T13:00:00', '2026-05-06T14:00:00', '2026-05-06T18:00:00');
  await addP(thomasId,  '2026-05-07', '2026-05-07T08:00:00', '2026-05-07T13:00:00', '2026-05-07T14:00:00', '2026-05-07T18:00:00');
  await addP(thomasId,  '2026-05-08', '2026-05-08T08:00:00', '2026-05-08T12:30:00', '2026-05-08T13:30:00', '2026-05-08T17:30:00');
  // Hery Rakoto
  await addP(heryId,    '2026-05-04', '2026-05-04T08:30:00', '2026-05-04T12:00:00', '2026-05-04T13:00:00', '2026-05-04T17:00:00');
  await addP(heryId,    '2026-05-05', '2026-05-05T08:30:00', '2026-05-05T12:00:00', '2026-05-05T13:00:00', '2026-05-05T17:00:00');
  await addP(heryId,    '2026-05-06', '2026-05-06T08:30:00', '2026-05-06T12:00:00', '2026-05-06T13:00:00', '2026-05-06T17:00:00');
  await addP(heryId,    '2026-05-07', '2026-05-07T08:30:00', '2026-05-07T12:00:00', '2026-05-07T13:00:00', '2026-05-07T17:00:00');
  await addP(heryId,    '2026-05-08', '2026-05-08T08:30:00', '2026-05-08T12:00:00', '2026-05-08T13:00:00', '2026-05-08T17:00:00');
  // Romuald Andriamaro
  await addP(romualdId, '2026-05-04', '2026-05-04T09:00:00', undefined, undefined, '2026-05-04T17:30:00');
  // Romuald absent mardi
  await addP(romualdId, '2026-05-06', '2026-05-06T09:00:00', '2026-05-06T12:30:00', '2026-05-06T13:30:00', '2026-05-06T17:30:00');
  await addP(romualdId, '2026-05-07', '2026-05-07T09:00:00', '2026-05-07T12:30:00', '2026-05-07T13:30:00', '2026-05-07T17:30:00');
  await addP(romualdId, '2026-05-08', '2026-05-08T09:00:00', undefined, undefined, '2026-05-08T17:00:00');

  // ── Semaine -1 : 2026-05-11 au 2026-05-15 ────────────────────
  // Thomas Admin
  await addP(adminId,   '2026-05-11', '2026-05-11T07:45:00', '2026-05-11T12:00:00', '2026-05-11T13:30:00', '2026-05-11T17:30:00');
  await addP(adminId,   '2026-05-12', '2026-05-12T07:50:00', '2026-05-12T12:00:00', '2026-05-12T13:00:00', '2026-05-12T17:45:00');
  await addP(adminId,   '2026-05-13', '2026-05-13T08:00:00', '2026-05-13T12:30:00', '2026-05-13T13:30:00', '2026-05-13T18:00:00');
  await addP(adminId,   '2026-05-14', '2026-05-14T07:55:00', '2026-05-14T12:00:00', '2026-05-14T13:00:00', '2026-05-14T17:30:00');
  await addP(adminId,   '2026-05-15', '2026-05-15T08:00:00', '2026-05-15T12:00:00', '2026-05-15T13:00:00', '2026-05-15T17:00:00');
  // Sophie
  await addP(sophieId,  '2026-05-11', '2026-05-11T08:15:00', '2026-05-11T12:30:00', '2026-05-11T13:00:00', '2026-05-11T17:00:00');
  // Sophie absente mardi
  await addP(sophieId,  '2026-05-13', '2026-05-13T08:20:00', '2026-05-13T12:30:00', '2026-05-13T13:00:00', '2026-05-13T17:15:00');
  await addP(sophieId,  '2026-05-14', '2026-05-14T08:15:00', '2026-05-14T12:30:00', '2026-05-14T13:00:00', '2026-05-14T17:00:00');
  await addP(sophieId,  '2026-05-15', '2026-05-15T08:10:00', '2026-05-15T12:00:00', '2026-05-15T13:00:00', '2026-05-15T17:00:00');
  // Jean
  await addP(jeanId,    '2026-05-11', '2026-05-11T07:30:00', '2026-05-11T12:30:00', '2026-05-11T13:30:00', '2026-05-11T16:30:00');
  await addP(jeanId,    '2026-05-12', '2026-05-12T07:35:00', '2026-05-12T12:30:00', '2026-05-12T13:30:00', '2026-05-12T16:45:00');
  await addP(jeanId,    '2026-05-13', '2026-05-13T07:30:00', '2026-05-13T12:00:00', '2026-05-13T13:00:00', '2026-05-13T16:30:00');
  await addP(jeanId,    '2026-05-14', '2026-05-14T07:40:00', '2026-05-14T12:30:00', '2026-05-14T13:30:00', '2026-05-14T16:30:00');
  // Jean absent vendredi
  // Marie
  await addP(marieId,   '2026-05-11', '2026-05-11T08:30:00', '2026-05-11T12:30:00', '2026-05-11T13:30:00', '2026-05-11T17:30:00');
  await addP(marieId,   '2026-05-12', '2026-05-12T08:45:00', '2026-05-12T12:30:00', '2026-05-12T13:30:00', '2026-05-12T17:45:00');
  await addP(marieId,   '2026-05-13', '2026-05-13T08:30:00', '2026-05-13T12:30:00', '2026-05-13T13:30:00', '2026-05-13T17:30:00');
  await addP(marieId,   '2026-05-14', '2026-05-14T08:30:00', '2026-05-14T12:30:00', '2026-05-14T13:30:00', '2026-05-14T17:30:00');
  await addP(marieId,   '2026-05-15', '2026-05-15T08:30:00', '2026-05-15T12:30:00', '2026-05-15T13:30:00', '2026-05-15T17:00:00');
  // Thomas Berger
  // Absent lundi
  await addP(thomasId,  '2026-05-12', '2026-05-12T08:00:00', '2026-05-12T13:00:00', '2026-05-12T14:00:00', '2026-05-12T18:30:00');
  await addP(thomasId,  '2026-05-13', '2026-05-13T08:00:00', '2026-05-13T13:00:00', '2026-05-13T14:00:00', '2026-05-13T18:00:00');
  await addP(thomasId,  '2026-05-14', '2026-05-14T08:00:00', '2026-05-14T13:00:00', '2026-05-14T14:00:00', '2026-05-14T18:00:00');
  await addP(thomasId,  '2026-05-15', '2026-05-15T08:00:00', '2026-05-15T12:30:00', '2026-05-15T13:30:00', '2026-05-15T17:30:00');
  // Hery
  await addP(heryId,    '2026-05-11', '2026-05-11T08:30:00', '2026-05-11T12:00:00', '2026-05-11T13:00:00', '2026-05-11T17:00:00');
  await addP(heryId,    '2026-05-12', '2026-05-12T08:30:00', '2026-05-12T12:00:00', '2026-05-12T13:00:00', '2026-05-12T17:00:00');
  await addP(heryId,    '2026-05-13', '2026-05-13T08:30:00', '2026-05-13T12:00:00', '2026-05-13T13:00:00', '2026-05-13T17:00:00');
  await addP(heryId,    '2026-05-14', '2026-05-14T08:30:00', '2026-05-14T12:00:00', '2026-05-14T13:00:00', '2026-05-14T17:00:00');
  await addP(heryId,    '2026-05-15', '2026-05-15T08:30:00', '2026-05-15T12:00:00', '2026-05-15T13:00:00', '2026-05-15T17:00:00');
  // Romuald
  await addP(romualdId, '2026-05-11', '2026-05-11T09:00:00', '2026-05-11T12:30:00', '2026-05-11T13:30:00', '2026-05-11T17:30:00');
  await addP(romualdId, '2026-05-12', '2026-05-12T09:00:00', undefined, undefined, '2026-05-12T17:00:00');
  // Romuald absent mercredi
  await addP(romualdId, '2026-05-14', '2026-05-14T09:00:00', '2026-05-14T12:30:00', '2026-05-14T13:30:00', '2026-05-14T17:30:00');
  await addP(romualdId, '2026-05-15', '2026-05-15T09:00:00', undefined, undefined, '2026-05-15T17:00:00');

  // ── Semaine courante : 2026-05-18 au 2026-05-22 ───────────────
  // Lundi 18
  await addP(adminId,   '2026-05-18', '2026-05-18T07:45:00', '2026-05-18T12:00:00', '2026-05-18T13:30:00', '2026-05-18T17:30:00');
  await addP(sophieId,  '2026-05-18', '2026-05-18T08:15:00', '2026-05-18T12:30:00', '2026-05-18T13:00:00', '2026-05-18T17:00:00');
  await addP(jeanId,    '2026-05-18', '2026-05-18T07:30:00', '2026-05-18T12:30:00', '2026-05-18T13:30:00', '2026-05-18T16:30:00');
  await addP(marieId,   '2026-05-18', '2026-05-18T08:30:00', '2026-05-18T12:30:00', '2026-05-18T13:30:00', '2026-05-18T17:30:00');
  await addP(thomasId,  '2026-05-18', '2026-05-18T08:00:00', '2026-05-18T13:00:00', '2026-05-18T14:00:00', '2026-05-18T18:00:00');
  await addP(heryId,    '2026-05-18', '2026-05-18T08:30:00', '2026-05-18T12:00:00', '2026-05-18T13:00:00', '2026-05-18T17:00:00');
  // Romuald absent lundi

  // Mardi 19
  await addP(adminId,   '2026-05-19', '2026-05-19T07:50:00', '2026-05-19T12:00:00', '2026-05-19T13:15:00', '2026-05-19T17:45:00');
  await addP(sophieId,  '2026-05-19', '2026-05-19T08:20:00', '2026-05-19T12:30:00', '2026-05-19T13:00:00', '2026-05-19T17:00:00');
  // Jean absent mardi
  await addP(marieId,   '2026-05-19', '2026-05-19T08:45:00', '2026-05-19T12:30:00', '2026-05-19T13:30:00', '2026-05-19T17:45:00');
  await addP(thomasId,  '2026-05-19', '2026-05-19T08:00:00', '2026-05-19T13:00:00', '2026-05-19T14:00:00', '2026-05-19T18:30:00');
  await addP(heryId,    '2026-05-19', '2026-05-19T08:30:00', '2026-05-19T12:00:00', '2026-05-19T13:00:00', '2026-05-19T17:00:00');
  await addP(romualdId, '2026-05-19', '2026-05-19T09:00:00', '2026-05-19T12:30:00', '2026-05-19T13:30:00', '2026-05-19T17:30:00');

  // Mercredi 20
  await addP(adminId,   '2026-05-20', '2026-05-20T08:00:00', '2026-05-20T12:30:00', '2026-05-20T13:30:00', '2026-05-20T18:00:00');
  await addP(sophieId,  '2026-05-20', '2026-05-20T08:15:00', '2026-05-20T12:30:00', '2026-05-20T13:00:00', '2026-05-20T17:30:00');
  await addP(jeanId,    '2026-05-20', '2026-05-20T07:30:00', '2026-05-20T12:00:00', '2026-05-20T13:00:00', '2026-05-20T16:30:00');
  // Marie absente mercredi
  await addP(thomasId,  '2026-05-20', '2026-05-20T08:00:00', '2026-05-20T13:00:00', '2026-05-20T14:00:00', '2026-05-20T18:00:00');
  await addP(heryId,    '2026-05-20', '2026-05-20T08:30:00', '2026-05-20T12:00:00', '2026-05-20T13:00:00', '2026-05-20T17:00:00');
  await addP(romualdId, '2026-05-20', '2026-05-20T09:00:00', undefined, undefined, '2026-05-20T17:00:00');

  // Jeudi 21
  await addP(adminId,   '2026-05-21', '2026-05-21T07:55:00', '2026-05-21T12:00:00', '2026-05-21T13:00:00', '2026-05-21T17:30:00');
  await addP(sophieId,  '2026-05-21', '2026-05-21T08:15:00', '2026-05-21T12:30:00', '2026-05-21T13:00:00', '2026-05-21T17:00:00');
  await addP(jeanId,    '2026-05-21', '2026-05-21T07:40:00', '2026-05-21T12:30:00', '2026-05-21T13:30:00', '2026-05-21T16:45:00');
  await addP(marieId,   '2026-05-21', '2026-05-21T08:30:00', '2026-05-21T12:30:00', '2026-05-21T13:30:00', '2026-05-21T17:30:00');
  await addP(thomasId,  '2026-05-21', '2026-05-21T08:00:00', '2026-05-21T13:00:00', '2026-05-21T14:00:00', '2026-05-21T18:00:00');
  await addP(heryId,    '2026-05-21', '2026-05-21T08:30:00', '2026-05-21T12:00:00', '2026-05-21T13:00:00', '2026-05-21T17:00:00');
  await addP(romualdId, '2026-05-21', '2026-05-21T09:00:00', '2026-05-21T12:30:00', '2026-05-21T13:30:00', '2026-05-21T17:30:00');

  // Vendredi 22 (aujourd'hui) — états variés
  // Thomas Admin : journée complète (parti)
  await addP(adminId,   '2026-05-22', '2026-05-22T07:45:00', '2026-05-22T12:00:00', '2026-05-22T13:30:00', '2026-05-22T17:30:00');
  // Sophie : en pause (pause commencée, pas encore revenue)
  await addP(sophieId,  '2026-05-22', '2026-05-22T08:15:00', '2026-05-22T12:30:00');
  // Jean : present (arrivé, pas de pause)
  await addP(jeanId,    '2026-05-22', '2026-05-22T07:30:00');
  // Marie : parti (journée complète)
  await addP(marieId,   '2026-05-22', '2026-05-22T08:30:00', '2026-05-22T12:30:00', '2026-05-22T13:30:00', '2026-05-22T17:00:00');
  // Thomas Berger : revenu (pause terminée, encore au travail)
  await addP(thomasId,  '2026-05-22', '2026-05-22T08:00:00', '2026-05-22T13:00:00', '2026-05-22T14:00:00');
  // Hery : parti
  await addP(heryId,    '2026-05-22', '2026-05-22T08:30:00', '2026-05-22T12:00:00', '2026-05-22T13:00:00', '2026-05-22T17:00:00');
  // Romuald : absent

  console.log('✅ Pointages de test ajoutés (3 semaines × 7 employés)');

  console.log('\n✨ Seed terminé avec succès !');
  console.log('\n📋 Comptes disponibles :');
  console.log('   admin@afym.re       → password: Admin2024!   (ADMIN)');
  console.log('   expert@afym.re      → password: Expert2024!  (EXPERT_COMPTABLE)');
  console.log('   collab@afym.re      → password: Collab2024!  (COLLABORATEUR)');
  console.log('   expert@afym.mg      → password: Expert2024!  (EXPERT_COMPTABLE - Madagascar)');
  console.log('   marie@afym.re       → password: Marie2024!   (COLLABORATEUR - scénario démo)');
  console.log('   thomas@afym.re      → password: Thomas2024!  (EXPERT_COMPTABLE - scénario démo)');
  console.log('   romuald@afym.mg     → password: Romuald2024! (ADMIN - scénario démo Madagascar)');

  await app.close();
}

seed().catch((err) => {
  console.error('Erreur seed :', err);
  process.exit(1);
});
