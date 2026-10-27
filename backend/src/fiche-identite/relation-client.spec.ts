import { approcheDe, contactLegal, contactOperationnel, destinataireCommunication } from './relation-client';

const fiche = (f: any) => f as any;

describe('relation client (cahier v2 #2 / #3)', () => {
  it("approche : valeur enregistrée, « Professionnel » par défaut ou si inconnue", () => {
    expect(approcheDe(fiche({ approcheClient: 'FORMEL' }))).toBe('FORMEL');
    expect(approcheDe(fiche({}))).toBe('PROFESSIONNEL');
    expect(approcheDe(null)).toBe('PROFESSIONNEL');
    expect(approcheDe(fiche({ approcheClient: 'SYMPA' }))).toBe('PROFESSIONNEL');
  });

  it('contact légal : saisi, à défaut le premier gérant repris de Pappers', () => {
    expect(contactLegal(fiche({ contactLegalNom: 'Jean Rivière', contactLegalFonction: 'Président', emailContact: ' p@x.re ', telephoneContact: '' })))
      .toEqual({ nom: 'Jean Rivière', fonction: 'Président', email: 'p@x.re', telephone: null });
    expect(contactLegal(fiche({ gerants: [{ nom: '' }, { nom: 'DUPONT Paul' }] })))
      .toEqual({ nom: 'DUPONT Paul', fonction: 'Gérant', email: null, telephone: null });
    expect(contactLegal(null)).toEqual({ nom: null, fonction: null, email: null, telephone: null });
  });

  it('contact opérationnel : champs nettoyés', () => {
    expect(contactOperationnel(fiche({ contactOperationnel: { nom: ' Sophie ', poste: 'Assistante', email: 'c@x.re' } })))
      .toEqual({ nom: 'Sophie', fonction: 'Assistante', email: 'c@x.re', telephone: null });
  });

  it('destinataire : échanges courants → opérationnel, juridique → légal, avec repli sur l’autre', () => {
    const f = fiche({ emailContact: 'gerant@x.re', contactLegalNom: 'Paul', contactOperationnel: { nom: 'Sophie', email: 'compta@x.re' } });
    expect(destinataireCommunication(f, 'COURANTE')).toMatchObject({ email: 'compta@x.re', role: 'OPERATIONNEL', nom: 'Sophie' });
    expect(destinataireCommunication(f, 'JURIDIQUE')).toMatchObject({ email: 'gerant@x.re', role: 'LEGAL', nom: 'Paul' });
    expect(destinataireCommunication(fiche({ emailContact: 'gerant@x.re' }), 'COURANTE')).toMatchObject({ role: 'LEGAL' });
    expect(destinataireCommunication(fiche({ contactOperationnel: { nom: 'Sans mail' } }), 'COURANTE')).toBeNull();
  });
});
