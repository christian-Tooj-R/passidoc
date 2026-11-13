/**
 * Tableau de Bord BP — Matrice de risques (matrice 5 × 5, décompte par zone, registre, formulaire intégré).
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { BpRisquesComponent } from './bp-risques.component';

const risque = (o: Record<string, any>) => ({
  id: 'r', nom: 'Risque', description: '', categorie: 'AUTRE', probabilite: 1, gravite: 1,
  planAction: '', responsable: '', dateCible: '', ...o,
});

const contenuTest = () => ({
  risques: [
    risque({ id: 'a', nom: 'Retard de dépôt TVA', categorie: 'FISCAL', probabilite: 2, gravite: 2 }), // 4 Acceptable
    risque({ id: 'b', nom: 'Perte du client principal', categorie: 'MARCHE', probabilite: 5, gravite: 4,
      planAction: 'Diversifier le portefeuille', responsable: 'Dirigeant', dateCible: '2027-03-31', cle: 'risque.concentration' }), // 20
    risque({ id: 'c', nom: 'Panne informatique', categorie: 'OPERATIONNEL', probabilite: 3, gravite: 4 }), // 12 À traiter
    risque({ id: 'd', nom: 'Inondation', probabilite: 1, gravite: 5 }), // 5 Tolérable
    risque({ id: 'e', nom: 'Fraude en caisse', categorie: 'FRAUDE', probabilite: 4, gravite: 4 }), // 16 Inacceptable
  ],
  ecartees: [] as string[],
});

async function creer(editable: boolean, contenu: any = contenuTest()) {
  await TestBed.configureTestingModule({ imports: [BpRisquesComponent], providers: [provideAnimations()] }).compileComponents();
  const fixture = TestBed.createComponent(BpRisquesComponent);
  fixture.componentRef.setInput('contenu', contenu);
  fixture.componentRef.setInput('editable', editable);
  const emis: any[] = [];
  fixture.componentInstance.contenuChange.subscribe(c => emis.push(c));
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, contenu, emis };
}

const cellule = (el: HTMLElement, p: number, g: number) => el.querySelector(`.rq__cel[data-p="${p}"][data-g="${g}"]`) as HTMLElement;
const pastilles = (cel: HTMLElement) => [...cel.querySelectorAll('.rq__pastille')].map(x => x.textContent?.trim());
const lignes = (el: HTMLElement) => [...el.querySelectorAll('.rq__table tbody tr')] as HTMLTableRowElement[];
const compte = (el: HTMLElement, zone: string) => el.querySelector(`.rq__compte[data-zone="${zone}"] .rq__compte-nb`)?.textContent?.trim();
const bouton = (el: HTMLElement, texte: string) =>
  ([...el.querySelectorAll('button')] as HTMLButtonElement[]).find(b => b.textContent?.includes(texte))!;
const saisir = (champ: HTMLInputElement | HTMLTextAreaElement, valeur: string) => {
  champ.value = valeur;
  champ.dispatchEvent(new Event('input'));
};
const choisir = (select: HTMLSelectElement, index: number) => {
  select.selectedIndex = index;
  select.dispatchEvent(new Event('change'));
};

describe('BpRisquesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('dessine la matrice 5 × 5 colorée par zone de criticité, probabilité 5 en haut', async () => {
    const { el } = await creer(false);
    const cels = [...el.querySelectorAll('.rq__cel')] as HTMLElement[];
    expect(cels.length).toBe(25);
    expect(cels[0].getAttribute('data-p')).toBe('5');
    expect(cels[0].getAttribute('data-g')).toBe('1');
    expect(cellule(el, 1, 1).getAttribute('data-zone')).toBe('ACCEPTABLE');
    expect(cellule(el, 1, 5).getAttribute('data-zone')).toBe('TOLERABLE');
    expect(cellule(el, 2, 5).getAttribute('data-zone')).toBe('A_TRAITER');
    expect(cellule(el, 5, 3).getAttribute('data-zone')).toBe('INACCEPTABLE');
    expect(cellule(el, 5, 5).style.background).toBeTruthy();
    expect(el.querySelector('.rq__matrice')?.textContent).toContain('5 - Continu');
    expect(el.querySelector('.rq__matrice')?.textContent).toContain('5 - Catastrophique');
  });

  it('place chaque risque dans sa cellule avec le numéro du tableau (tri par criticité décroissante)', async () => {
    const { el } = await creer(false);
    expect(pastilles(cellule(el, 5, 4))).toEqual(['1']);
    expect(pastilles(cellule(el, 4, 4))).toEqual(['2']);
    expect(pastilles(cellule(el, 3, 4))).toEqual(['3']);
    expect(pastilles(cellule(el, 1, 5))).toEqual(['4']);
    expect(pastilles(cellule(el, 2, 2))).toEqual(['5']);
    expect(cellule(el, 5, 4).getAttribute('data-zone')).toBe('INACCEPTABLE');
    expect(cellule(el, 5, 4).querySelector('.rq__pastille')?.getAttribute('aria-label')).toBe('Risque 1 : Perte du client principal');

    const ls = lignes(el);
    expect(ls.map(l => l.getAttribute('data-id'))).toEqual(['b', 'e', 'c', 'd', 'a']);
    expect(ls[0].textContent).toContain('Perte du client principal');
    expect(ls[0].textContent).toContain('PASSIDOC');
    expect(ls[0].textContent).toContain('Marché');
    expect(ls[0].textContent).toContain('20');
    expect(ls[0].textContent).toContain('Inacceptable');
    expect(ls[0].textContent).toContain('Diversifier le portefeuille');
    expect(ls[0].textContent).toContain('31/03/2027');
    expect(ls[4].textContent).not.toContain('PASSIDOC');
  });

  it('compte les risques par zone de criticité', async () => {
    const { el } = await creer(false);
    expect(compte(el, 'INACCEPTABLE')).toBe('2');
    expect(compte(el, 'A_TRAITER')).toBe('1');
    expect(compte(el, 'TOLERABLE')).toBe('1');
    expect(compte(el, 'ACCEPTABLE')).toBe('1');
    expect(el.querySelector('.rq__total')?.textContent).toContain('5');
  });

  it('en lecture seule : ni ajout ni formulaire', async () => {
    const { fixture, el } = await creer(false);
    expect(bouton(el, 'Ajouter un risque')).toBeUndefined();
    lignes(el)[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.rq__form')).toBeNull();
  });

  it('refuse un risque sans nom, puis l\'ajoute une fois nommé', async () => {
    const { fixture, el, contenu, emis } = await creer(true, { risques: [], ecartees: [] });
    expect(el.querySelector('.rq__vide')?.textContent).toContain('Aucun risque');
    bouton(el, 'Ajouter un risque').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.rq__form')?.textContent).toContain('Nouveau risque');

    bouton(el, 'Enregistrer').click();
    fixture.detectChanges();
    expect(contenu.risques.length).toBe(0);
    expect(emis.length).toBe(0);
    expect(el.querySelector('.rq__erreur')?.textContent).toContain('Le nom du risque est obligatoire');

    saisir(el.querySelector('.rq__nom-champ') as HTMLInputElement, '  Contrôle fiscal  ');
    choisir(el.querySelector('.rq__proba') as HTMLSelectElement, 3); // 4 - Fréquent
    choisir(el.querySelector('.rq__gravite') as HTMLSelectElement, 4); // 5 - Catastrophique
    choisir(el.querySelector('.rq__categorie') as HTMLSelectElement, 0); // Fiscal
    fixture.detectChanges();
    expect(el.querySelector('.rq__apercu')?.textContent).toContain('20');
    bouton(el, 'Enregistrer').click();
    fixture.detectChanges();

    expect(contenu.risques).toEqual([expect.objectContaining({
      nom: 'Contrôle fiscal', probabilite: 4, gravite: 5, categorie: 'FISCAL', planAction: '', dateCible: '',
    })]);
    expect(contenu.risques[0].id).toBeTruthy();
    expect(emis).toEqual([contenu]);
    expect(el.querySelector('.rq__form')).toBeNull();
    expect(pastilles(cellule(el, 4, 5))).toEqual(['1']);
    expect(compte(el, 'INACCEPTABLE')).toBe('1');
  });

  it('modifie un risque en cliquant sa ligne, annule sans rien changer, supprime', async () => {
    const { fixture, el, contenu, emis } = await creer(true);
    const ligneDe = (id: string) => lignes(el).find(l => l.getAttribute('data-id') === id)!;

    ligneDe('a').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.rq__form-titre')?.textContent).toContain('Modifier le risque n° 5');
    saisir(el.querySelector('.rq__nom-champ') as HTMLInputElement, 'Autre nom');
    bouton(el, 'Annuler').click();
    fixture.detectChanges();
    expect(contenu.risques[0].nom).toBe('Retard de dépôt TVA');
    expect(emis.length).toBe(0);

    ligneDe('a').click();
    fixture.detectChanges();
    await fixture.whenStable();
    choisir(el.querySelector('.rq__proba') as HTMLSelectElement, 4); // 5 × 2 = 10 → À traiter
    bouton(el, 'Enregistrer').click();
    fixture.detectChanges();
    expect(contenu.risques[0].probabilite).toBe(5);
    expect(compte(el, 'A_TRAITER')).toBe('2');
    expect(compte(el, 'ACCEPTABLE')).toBe('0');
    expect(emis.length).toBe(1);

    ligneDe('c').click();
    fixture.detectChanges();
    bouton(el, 'Supprimer').click();
    fixture.detectChanges();
    expect(contenu.risques.map((r: any) => r.id)).toEqual(['a', 'b', 'd', 'e']);
    expect(lignes(el).length).toBe(4);
    expect(emis.length).toBe(2);
  });
});
