/**
 * Module Missions du dossier — onglets « Par cycle » / « Pipeline missions » et droits (CDC §7).
 */
import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NEVER, of } from 'rxjs';
import { MissionsTabComponent } from './missions-tab.component';
import { MissionsService } from '../../../../../core/services/missions.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../core/services/confirm.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { Mission } from '../../../../../core/models/mission.model';

const mission = (o: Partial<Mission>): Mission => ({
  id: 1, titre: 'M', honoraires: null, statut: 'PROPOSEE', cycle: null, exerciceId: null, dateRelance: null,
  responsableId: null, responsable: null, archivee: false, aRelancer: false, createdAt: '', updatedAt: '', ...o,
});

const MISSIONS = [
  mission({ id: 1, titre: 'Analyse concentration clients', cycle: 'CLI', exerciceId: 40, honoraires: 2500, statut: 'EN_DISCUSSION' }),
  mission({ id: 2, titre: 'Tableau de bord', cycle: null, honoraires: 1300, statut: 'ACCEPTEE' }),
  mission({ id: 3, titre: 'Autre exercice', cycle: 'CLI', exerciceId: 39, statut: 'PROPOSEE' }),
];
const SYNTHESE = {
  total: 3, potentiel: 3800, proposees: { nombre: 1, montant: 0 }, enDiscussion: { nombre: 1, montant: 2500 },
  acceptees: { nombre: 1, montant: 1300 }, refusees: 0, sansSuite: 0, aRelancer: 0, tauxConversion: 33,
};
const CYCLES = {
  cycles: [], recommandations: { CLI: { texte: 'Diversifier le portefeuille.\nSuivre la concentration.', updatedAt: '2026-10-27T10:00:00Z' } },
  dejaRefusees: [{ ...mission({ id: 9, titre: 'Grille salariale', cycle: 'SOC', statut: 'REFUSEE', honoraires: 2200 }), anneeRefus: 2025 }],
};

const svc = {
  getAll: vi.fn(), synthese: vi.fn(), cycles: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn(),
  historique: vi.fn().mockReturnValue(of([])), enregistrerRecommandation: vi.fn(),
};
const dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined) }) };
let role = 'ADMIN';
const auth = { isGerantOuest: () => role === 'GERANT_OUEST', isCollaborateur: () => role === 'COLLABORATEUR', currentUser: () => ({ id: 1, role }) };

async function creer(opts: { canEdit?: boolean; statut?: 'OUVERT' | 'CLOTURE' } = {}) {
  await TestBed.configureTestingModule({
    imports: [MissionsTabComponent],
    providers: [
      provideHttpClient(), provideHttpClientTesting(), provideAnimations(),
      { provide: MissionsService, useValue: svc },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: ConfirmService, useValue: { confirm: vi.fn().mockReturnValue(of(true)) } },
      { provide: AuthService, useValue: auth },
      { provide: MatDialog, useValue: dialog },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MissionsTabComponent);
  fixture.componentRef.setInput('clientId', 60);
  fixture.componentRef.setInput('exercice', { id: 40, annee: 2026, statut: opts.statut ?? 'OUVERT' } as any);
  fixture.componentRef.setInput('canEdit', opts.canEdit ?? true);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

/** Texte normalisé : toLocaleString('fr-FR') sépare les milliers par une espace fine insécable. */
const txt = (n: Element | null | undefined) => (n?.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');
const textes = (el: HTMLElement, sel = 'button') => [...el.querySelectorAll(sel)].map(b => b.textContent?.trim() ?? '');
const ouvrirCycle = (el: HTMLElement, nom: string) =>
  ([...el.querySelectorAll('.cy-h')] as HTMLButtonElement[]).find(b => b.textContent?.includes(nom))!.click();

describe('MissionsTabComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    role = 'ADMIN';
    svc.getAll.mockReturnValue(of(MISSIONS));
    svc.synthese.mockReturnValue(of(SYNTHESE));
    svc.cycles.mockReturnValue(of(structuredClone(CYCLES)));
    svc.update.mockReturnValue(of({}));
  });

  it("charge missions, KPI et cycles de l'exercice affiché", async () => {
    await creer();
    expect(svc.getAll).toHaveBeenCalledWith(60);
    expect(svc.synthese).toHaveBeenCalledWith(60);
    expect(svc.cycles).toHaveBeenCalledWith(60, 40);
  });

  it('« Par cycle » : 10 cycles, résumé replié (recommandations, missions de l’exercice, montant, statut)', async () => {
    const { fixture, el } = await creer();
    fixture.detectChanges();
    expect(el.querySelectorAll('.cy')).toHaveLength(10);
    const cli = ([...el.querySelectorAll('.cy-h')] as HTMLElement[]).find(h => h.textContent?.includes('CLI'))!;
    expect(txt(cli)).toContain('2 recommandations');
    expect(txt(cli)).toContain('1 mission');          // la mission d'un autre exercice n'est pas comptée
    expect(txt(cli)).toContain('2 500 €');
    expect(txt(cli)).toContain('1 en discussion');
    // Onglet : compteur des missions de cycle de l'exercice.
    expect(textes(el, '.mt-tab')[0]).toContain('1');
  });

  it('cycle ouvert : zone A, zone B, mission déjà refusée et bouton d’ajout', async () => {
    const { fixture, el } = await creer();
    fixture.detectChanges();
    ouvrirCycle(el, 'Social');
    fixture.detectChanges();
    expect(el.textContent).toContain('Déjà refusée en 2025');
    expect(textes(el)).toContain('Reproposer');
    ouvrirCycle(el, 'Clients');
    fixture.detectChanges();
    await fixture.whenStable();   // ngModel écrit la valeur de façon asynchrone
    expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toContain('Diversifier');
    expect(textes(el).some(t => t.includes('Ajouter une mission'))).toBe(true);
  });

  it('« Ajouter une mission » ouvre la saisie avec le cycle figé ; « Reproposer » reprend la mission refusée', async () => {
    const { fixture, el } = await creer();
    fixture.detectChanges();
    ouvrirCycle(el, 'Social');
    fixture.detectChanges();
    (([...el.querySelectorAll('button')] as HTMLButtonElement[]).find(b => b.textContent?.includes('Ajouter une mission'))!).click();
    expect(dialog.open.mock.calls[0][1].data).toMatchObject({ cycle: 'SOC', exerciceId: 40, annee: 2026, peutEcrire: true, cycleModifiable: false });
    (([...el.querySelectorAll('button')] as HTMLButtonElement[]).find(b => b.textContent?.includes('Reproposer'))!).click();
    expect(dialog.open.mock.calls[1][1].data).toMatchObject({ cycle: 'SOC', prefill: { titre: 'Grille salariale', honoraires: 2200, repriseDeId: 9 } });
  });

  it('pipeline : KPI, toutes les missions, statut modifiable en ligne', async () => {
    const { fixture, comp, el } = await creer();
    comp.vue.set('pipeline');
    fixture.detectChanges();
    expect(txt(el.querySelector('.kpis'))).toContain('3 800 €');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(textes(el).some(t => t.includes('Nouvelle mission'))).toBe(true);
    comp.changerStatut(MISSIONS[0], 'ACCEPTEE');
    expect(svc.update).toHaveBeenCalledWith(60, 1, { statut: 'ACCEPTEE' });
  });

  it('statut changé en ligne : la fiche ouverte avant la réponse du serveur montre déjà le nouveau statut', async () => {
    const { comp } = await creer();
    svc.update.mockReturnValue(NEVER);   // réponse pas encore arrivée, liste pas encore rechargée
    comp.changerStatut(MISSIONS[0], 'ACCEPTEE');
    const m = comp.missions().find(x => x.id === 1)!;
    expect(m.statut).toBe('ACCEPTEE');
    comp.ouvrir(m, false);
    expect(dialog.open.mock.calls.at(-1)![1].data.mission.statut).toBe('ACCEPTEE');
  });

  it('collaborateur : « Par cycle » en écriture, pipeline en lecture seule', async () => {
    role = 'COLLABORATEUR';
    const { fixture, comp, el } = await creer();
    expect(comp.peutEcrireCycles()).toBe(true);
    expect(comp.peutEcrirePipeline()).toBe(false);
    comp.vue.set('pipeline');
    fixture.detectChanges();
    expect(textes(el).some(t => t.includes('Nouvelle mission'))).toBe(false);
    expect(el.querySelector('tbody select')).toBeNull();
  });

  it('gérant de pôle, non-intervenant : lecture seule partout', async () => {
    role = 'GERANT_OUEST';
    let { comp } = await creer();
    expect(comp.lectureSeule()).toBe(true);
    TestBed.resetTestingModule();
    role = 'ADMIN';
    ({ comp } = await creer({ canEdit: false }));
    expect(comp.lectureSeule()).toBe(true);
  });

  it('exercice clôturé : consultation seule (cycles et pipeline), comme le reste du dossier', async () => {
    const { fixture, comp, el } = await creer({ statut: 'CLOTURE' });
    expect(comp.peutEcrireCycles()).toBe(false);
    expect(comp.peutEcrirePipeline()).toBe(false);
    expect(comp.lectureSeule()).toBe(true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Exercice clôturé');
    ouvrirCycle(el, 'Clients');
    fixture.detectChanges();
    await fixture.whenStable();   // ngModel applique [disabled] de façon asynchrone
    expect(textes(el).some(t => t.includes('Ajouter une mission'))).toBe(false);
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('mission pré-remplie depuis le Contrôle interne : ouvre la saisie hors cycle dans le pipeline', async () => {
    const { fixture, comp } = await creer();
    const used = vi.fn();
    comp.prefillUsed.subscribe(used);
    fixture.componentRef.setInput('prefill', { titre: 'Mission CI', type: 'DETECTEE', description: 'Risques', arguments: 'A' });
    fixture.detectChanges();
    expect(comp.vue()).toBe('pipeline');
    expect(dialog.open.mock.calls.at(-1)![1].data).toMatchObject({ cycle: null, cycleModifiable: true, prefill: { titre: 'Mission CI', description: 'Risques', arguments: 'A' } });
    expect(used).toHaveBeenCalled();
  });
});
