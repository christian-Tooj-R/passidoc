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

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const clientRepo = app.get<Repository<Client>>(getRepositoryToken(Client));
  const ficheRepo = app.get<Repository<FicheIdentite>>(getRepositoryToken(FicheIdentite));
  const fluxRepo = app.get<Repository<FluxMensuel>>(getRepositoryToken(FluxMensuel));
  const fournisseurRepo = app.get<Repository<Fournisseur>>(getRepositoryToken(Fournisseur));
  const syntheseRepo = app.get<Repository<SyntheseCloture>>(getRepositoryToken(SyntheseCloture));

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
      console.log(`⏭  User déjà existant : ${u.email}`);
    }
  }

  // ── Résolution des responsables ──────────────────────────────────────────
  const marie = await userRepo.findOne({ where: { email: 'marie@afym.re' } });
  const thomas = await userRepo.findOne({ where: { email: 'thomas@afym.re' } });
  const hery = await userRepo.findOne({ where: { email: 'expert@afym.mg' } });

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

    // Créer le client avec responsable
    const client = await clientRepo.save(clientRepo.create({
      nom: data.nom,
      site: data.site,
      responsable: data.responsable ?? undefined,
    }));

    // Fiche identité
    await ficheRepo.save(ficheRepo.create({ ...data.fiche, client }));

    // Flux mensuels
    for (const f of data.flux) {
      await fluxRepo.save(fluxRepo.create({
        ...f,
        client,
        dateDepot: f.statut === StatutDepot.DEPOSE ? new Date() : undefined,
      }));
    }

    // Fournisseurs
    for (const f of data.fournisseurs) {
      await fournisseurRepo.save(fournisseurRepo.create({ ...f, client }));
    }

    // Synthèse clôture
    await syntheseRepo.save(syntheseRepo.create({ ...data.synthese, client }));

    // Recalculer le score de passation
    const updated = await clientRepo.findOne({
      where: { id: client.id },
      relations: ['ficheIdentite', 'fluxMensuels', 'fournisseurs', 'synthesesCloture', 'documents'],
    });
    let score = 0;
    if (updated) {
      const fiche = updated.ficheIdentite;
      if (fiche?.raisonSociale) score += 15;
      if (fiche?.siren) score += 10;
      if (fiche?.gerants?.length > 0) score += 15;
      if (fiche?.salaries?.length > 0) score += 10;
      if (updated.fluxMensuels?.length > 0) score += 15;
      if (updated.fournisseurs?.length > 0) score += 10;
      if (updated.synthesesCloture?.length > 0) score += 15;
    }
    await clientRepo.update(client.id, { santePassation: Math.min(score, 100) });

    console.log(`✅ Client créé : ${data.nom} (score: ${Math.min(score, 100)}%)`);
  }

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
