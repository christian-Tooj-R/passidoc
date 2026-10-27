import { describe, it, expect } from 'vitest';
import { construireNotePassation, contactLegalNote, textePassation, DonneesNotePassation } from './note-passation.export';
import { itemsAdnSectoriel } from './adn-lecture.util';

const client: any = {
  id: 12, nom: 'Association Lire & Vivre', site: 'EST', createdAt: '2026-08-18T10:00:00Z',
  directeur: { firstName: 'Pierre', lastName: 'Martin' }, responsable: { firstName: 'Marie', lastName: 'Dubois' }, collaborateurOuest: null,
  ficheIdentite: {
    raisonSociale: 'Association Lire & Vivre', formeJuridique: 'Association loi 1901', siret: '12345678900011',
    gerants: [{ nom: 'RIVIERE Jean' }], emailContact: 'president@example.com', approcheClient: 'FORMEL',
    contactOperationnel: { nom: 'Sophie Hoarau', poste: 'Assistante', email: 'compta@example.com' },
    pointsVigilance: 'Dépendance aux subventions', honoraires: { comptables: 4200 },
  },
  fluxMensuels: [{ type: 'PAIE', statut: 'MANQUANT' }], fournisseurs: [{ nom: 'Fournisseur secret' }],
};
const donnees = (c = client): DonneesNotePassation => ({
  cabinet: 'AFYM', client: c, siteLibelle: 'Pôle EST', intervenants: ['Collaborateur Réunion', 'Collaborateur Madagascar'],
  adnGlobal: { mission: 'Faire lire les enfants', visionActivite: 'STABLE' }, secteurLibelle: 'Association',
  itemsSectoriels: itemsAdnSectoriel('ASSOCIATION', { domaine: 'CULTUREL' }),
});
const texte = (d: DonneesNotePassation) => construireNotePassation(d).output();

describe('note de passation (cahier v2 #8)', () => {
  it('contient la fiche d’identité, les deux contacts, l’approche et l’ADN', () => {
    const pdf = texte(donnees());
    for (const t of ['NOTE DE PASSATION', 'Association Lire & Vivre', 'Association loi 1901', 'Contact légal', 'Contact opérationnel',
      'RIVIERE Jean', 'Sophie Hoarau', 'compta@example.com', 'Approche client : Formel', 'Collaborateur Réunion', 'Marie Dubois',
      'ADN entreprise', 'Faire lire les enfants', 'Questionnaire sectoriel', 'Culturel', 'Dépendance aux subventions']) {
      expect(pdf, t).toContain(t);
    }
  });

  it('exclut tout le reste du dossier (flux, fournisseurs, honoraires, temps…)', () => {
    const pdf = texte(donnees());
    for (const t of ['Fournisseur secret', 'ALERTES FLUX', 'ANALYSE FINANCI', 'Score de passation', '4200', '4 200']) expect(pdf).not.toContain(t);
  });

  it('format A4 portrait, une à deux pages', () => {
    const doc = construireNotePassation(donnees());
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(2);
  });

  it('ADN vide : la note le signale au lieu d’afficher des rubriques creuses', () => {
    const pdf = texte({ ...donnees({ ...client, ficheIdentite: { ...client.ficheIdentite, pointsVigilance: null } }), adnGlobal: null, itemsSectoriels: [] });
    expect(pdf).toContain('ADN entreprise non renseign');
  });

  it('contact légal repris du premier gérant si non saisi ; texte compatible avec les polices du PDF', () => {
    expect(contactLegalNote(client)).toMatchObject({ nom: 'RIVIERE Jean', fonction: 'Gérant', email: 'president@example.com' });
    expect(contactLegalNote({ ...client, ficheIdentite: { ...client.ficheIdentite, contactLegalNom: 'Jean R', contactLegalFonction: 'Président' } }))
      .toMatchObject({ nom: 'Jean R', fonction: 'Président' });
    expect(textePassation('1 000 € 🔵 ok')).toBe('1 000 €  ok');
  });
});
