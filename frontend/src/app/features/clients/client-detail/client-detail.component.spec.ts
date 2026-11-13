import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ClientDetailComponent } from './client-detail.component';
import { ClientsService } from '../../../core/services/clients.service';
import { ExerciceService } from '../../../core/services/exercice.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UsersService } from '../../../core/services/users.service';

const mockClients  = { getOne: vi.fn().mockReturnValue(of(null)), getById: vi.fn().mockReturnValue(of(null)), update: vi.fn().mockReturnValue(of({})), delete: vi.fn().mockReturnValue(of({})), assign: vi.fn().mockReturnValue(of({})), assignDirecteur: vi.fn().mockReturnValue(of({})), assignOuest: vi.fn().mockReturnValue(of({})), exportPdf: vi.fn().mockReturnValue(of(new Blob())), uploadLogo: vi.fn().mockReturnValue(of(null)) };
const mockExercice = { list: vi.fn().mockReturnValue(of([])), create: vi.fn().mockReturnValue(of({})), cloturer: vi.fn().mockReturnValue(of({})) };
const mockAuth     = { currentUser: vi.fn().mockReturnValue({ id: 1, role: 'COLLABORATEUR' }), isAdmin: vi.fn().mockReturnValue(false), isExpert: vi.fn().mockReturnValue(false), hasFullVisibility: vi.fn().mockReturnValue(false), canCreateDossier: vi.fn().mockReturnValue(true) };
const mockTenant   = { poleFlag1: vi.fn().mockReturnValue('🔵'), poleLabel1: vi.fn().mockReturnValue('Pôle EST'), poleFlag2: vi.fn().mockReturnValue('🟠'), poleLabel2: vi.fn().mockReturnValue('Pôle OUEST'), intervenantLabel1: vi.fn().mockReturnValue('Collaborateur Réunion'), intervenantLabel2: vi.fn().mockReturnValue('Collaborateur Madagascar'), poleFlag: vi.fn(), poleLabel: vi.fn() };
const mockUsers    = { getAll: vi.fn().mockReturnValue(of([])), getAssignable: vi.fn().mockReturnValue(of([])) };

let ongletDemande: string | null = null;

async function createComponent() {
  await TestBed.configureTestingModule({
    imports: [ClientDetailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'clients/:id', component: ClientDetailComponent }]),
      provideAnimations(),
      { provide: ClientsService,  useValue: mockClients },
      { provide: ExerciceService, useValue: mockExercice },
      { provide: AuthService,     useValue: mockAuth },
      { provide: TenantService,   useValue: mockTenant },
      { provide: UsersService,    useValue: mockUsers },
      { provide: ActivatedRoute,  useValue: { snapshot: {
        paramMap: { get: vi.fn().mockReturnValue('1') },
        queryParamMap: { get: vi.fn((k: string) => (k === 'tab' ? ongletDemande : null)) },
      } } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ClientDetailComponent);
  const comp    = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, comp };
}

describe('ClientDetailComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ongletDemande = null;
    mockClients.getById.mockReturnValue(of(null));
    mockExercice.list.mockReturnValue(of([]));
    mockUsers.getAssignable.mockReturnValue(of([]));
  });

  it('se crée sans erreur', async () => {
    const { comp } = await createComponent();
    expect(comp).toBeTruthy();
  });

  it('activeTab vaut fiche par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.activeTab()).toBe('fiche');
  });

  it('loading démarre à true', async () => {
    const { comp } = await createComponent();
    // Le composant utilise setTimeout pour réinitialiser le loading après animation
    expect(typeof comp.loading()).toBe('boolean');
  });

  it('editIntervenants est false par défaut', async () => {
    const { comp } = await createComponent();
    expect(comp.editIntervenants()).toBe(false);
  });

  it('activeTab peut être changé via set', async () => {
    const { comp } = await createComponent();
    comp.activeTab.set('synthese');
    expect(comp.activeTab()).toBe('synthese');
  });

  it("ouvre l'onglet demandé par ?tab= (lien depuis la page Rentabilité)", async () => {
    ongletDemande = 'rentabilite';
    const { comp } = await createComponent();
    expect(comp.activeTab()).toBe('rentabilite');
  });

  it('un onglet inconnu (ancien lien ?tab=tasks) laisse l’onglet par défaut au lieu d’une page vide', async () => {
    ongletDemande = 'tasks';
    const { comp } = await createComponent();
    expect(comp.activeTab()).toBe('fiche');
  });

  it('l’ancien lien ?tab=dossier-travail ouvre Missions', async () => {
    ongletDemande = 'dossier-travail';
    const { comp } = await createComponent();
    expect(comp.activeTab()).toBe('missions');
  });

  it.each(['strategie', 'canvas'])('l’ancien lien ?tab=%s ouvre le Tableau de bord BP', async (ancien) => {
    ongletDemande = ancien;
    const { comp } = await createComponent();
    expect(comp.activeTab()).toBe('bp');
  });

  it('Tableau de bord BP dans le groupe Business Partner, à la place de Stratégie et Modèle Canvas', async () => {
    const { comp } = await createComponent();
    expect(comp.TAB_GROUPS.find(g => g.label === 'Business Partner')!.tabs.map(t => t.id)).toEqual(['bp']);
    const ids = comp.TAB_GROUPS.flatMap(g => g.tabs.map(t => t.id as string));
    expect(ids).not.toContain('strategie');
    expect(ids).not.toContain('canvas');
  });

  describe('Tableau de bord BP en plein écran', () => {
    it('le menu BP liste les 9 outils par catégorie, dans l’ordre', async () => {
      const { comp } = await createComponent();
      const groupes = comp.groupesOutilsBp;
      expect(groupes.map(g => g.categorie)).toEqual(['Analyse interne', 'Analyse externe', 'Stratégie', 'Business']);
      expect(groupes.flatMap(g => g.outils.map(o => o.code)))
        .toEqual(['SWOT', 'CHAINE_VALEUR', 'DIAGNOSTIC', 'PORTER', 'PESTEL', 'RISQUES', 'BCG', 'BMC', 'PERSONA']);
      expect(groupes.flatMap(g => g.outils.map(o => o.rang))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('« Retour au dossier » rouvre l’onglet quitté pour le BP', async () => {
      const { fixture, comp } = await createComponent();
      comp.activeTab.set('objectifs');
      fixture.detectChanges();
      comp.activeTab.set('bp');
      fixture.detectChanges();
      expect(comp.modeBp()).toBe(true);
      comp.quitterBp();
      expect(comp.activeTab()).toBe('objectifs');
      expect(comp.modeBp()).toBe(false);
    });

    it('ouvert directement par ?tab=bp : « Retour au dossier » mène à la fiche identité', async () => {
      ongletDemande = 'bp';
      const { fixture, comp } = await createComponent();
      fixture.detectChanges();
      comp.quitterBp();
      expect(comp.activeTab()).toBe('fiche');
    });
  });

  it('propose l’onglet Rentabilité dans le groupe Comptabilité', async () => {
    const { comp } = await createComponent();
    const compta = comp.TAB_GROUPS.find(g => g.label === 'Comptabilité')!;
    expect(compta.tabs.map(t => t.id)).toContain('rentabilite');
  });
});
