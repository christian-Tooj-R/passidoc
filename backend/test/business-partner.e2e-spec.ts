/**
 * Intégration de bout en bout — Tableau de Bord BP (« Outils stratégiques PASSIDOC x Business
 * Partner », 6 nov. 2026) : lecture par exercice, reprise N-1 et des anciens onglets, droits
 * d'écriture et de validation (BP+), suggestions tirées du dossier.
 *
 * Application complète sur la base de .env (base locale), dans deux tenants temporaires ZZTEST
 * supprimés à la fin.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { TenantConfig } from '../src/entities/tenant-config.entity';
import { User, UserRole, UserSite } from '../src/entities/user.entity';
import { Client, ClientSite } from '../src/entities/client.entity';
import { Exercice, ExerciceStatut } from '../src/entities/exercice.entity';
import { OutilBp } from '../src/entities/outil-bp.entity';

jest.setTimeout(60_000);

describe('Tableau de Bord BP (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const ids = { tenants: [] as number[], users: [] as number[], clients: [] as number[] };
  const tok: Record<string, string> = {};
  let T: TenantConfig, X: TenantConfig;
  let chefMis: User;
  let c1: Client, c2: Client;
  let ex2025: Exercice, ex2026: Exercice, exC2: Exercice;

  const http = () => request(app.getHttpServer());
  const as = (who: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${tok[who]}`).set('x-tenant-slug', (who === 'adminX' ? X : T).slug!);
  const get = (who: string, url: string) => as(who)(http().get(url));
  const patch = (who: string, url: string, body: any) => as(who)(http().patch(url).send(body));
  const post = (who: string, url: string) => as(who)(http().post(url).send({}));
  const BP = (c: Client, suite = '') => `/api/clients/${c.id}/bp${suite}`;
  const q = (e: Exercice) => `?exerciceId=${e.id}`;
  const outil = (body: any, code: string) => body.outils.find((o: any) => o.outil === code);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService).useValue({})
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource);
    const jwt = app.get(JwtService);

    const tenants = ds.getRepository(TenantConfig);
    T = await tenants.save(tenants.create({ slug: `zztest-bp-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;
    X = await tenants.save(tenants.create({ slug: `zztest-bpx-${stamp}`, nomSociete: 'ZZTEST Autre', isConfigured: true } as any) as any) as any;
    ids.tenants.push(T.id, X.id);

    const users = ds.getRepository(User);
    const mk = async (nom: string, role: UserRole, tenantId: number) => {
      const u = await users.save(users.create({
        email: `zztest-${nom}-${stamp}@test.local`, password: 'secret-hash-zz', firstName: 'ZZ', lastName: nom,
        role, site: UserSite.EST, tenantId, isActive: true, timezone: 'Indian/Reunion',
      }));
      ids.users.push(u.id);
      tok[nom] = jwt.sign({ sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId });
      return u;
    };
    await mk('admin', UserRole.ADMIN, T.id);
    chefMis = await mk('chefMis', UserRole.CHEF_MISSION, T.id);
    const resp = await mk('resp', UserRole.COLLABORATEUR, T.id);
    await mk('chefAnt', UserRole.CHEF_ANTENNE, T.id);
    await mk('etranger', UserRole.COLLABORATEUR, T.id);
    await mk('adminX', UserRole.ADMIN, X.id);

    const clients = ds.getRepository(Client);
    c1 = await clients.save(clients.create({
      nom: 'ZZ BOULANGERIE', site: ClientSite.EST, tenantId: T.id, isActive: true, responsableId: resp.id, directeurId: chefMis.id,
    }));
    c2 = await clients.save(clients.create({ nom: 'ZZ AUTRE DOSSIER', site: ClientSite.EST, tenantId: T.id, isActive: true }));
    ids.clients.push(c1.id, c2.id);

    const exercices = ds.getRepository(Exercice);
    ex2025 = await exercices.save(exercices.create({ clientId: c1.id, annee: 2025, dateOuverture: '2025-01-01', dateCloture: '2025-12-31', statut: ExerciceStatut.CLOTURE }));
    ex2026 = await exercices.save(exercices.create({ clientId: c1.id, annee: 2026, dateOuverture: '2026-01-01', dateCloture: '2026-12-31', statut: ExerciceStatut.OUVERT }));
    exC2 = await exercices.save(exercices.create({ clientId: c2.id, annee: 2026, dateOuverture: '2026-01-01', dateCloture: '2026-12-31', statut: ExerciceStatut.OUVERT }));

    // Anciens onglets « Stratégie » et « Modèle Canvas », PESTEL déjà fait en 2025.
    await ds.query(`INSERT INTO analyses_strategiques ("clientId", "exerciceId", forces, faiblesses, opportunites, menaces, "porterConcurrence")
      VALUES ($1, $2, $3, '[]', '[]', '[]', 'Trois boulangeries')`, [c1.id, ex2026.id, JSON.stringify(['Clientèle fidèle'])]);
    await ds.query(`INSERT INTO canvas ("clientId", "partenairesClés") VALUES ($1, 'Meunier local')`, [c1.id]);
    await ds.getRepository(OutilBp).save({ clientId: c1.id, exerciceId: ex2025.id, outil: 'PESTEL', contenu: { legal: [{ id: 'l1', texte: 'Normes HACCP' }] }, statut: 'VALIDE' });
    // Données du dossier pour les suggestions.
    await ds.query(`INSERT INTO questionnaires_adn_global ("clientId", "valeurCle", "niveauNumerique") VALUES ($1, 'QUALITE', 5)`, [c1.id]);
    await ds.query(`INSERT INTO flux_mensuels ("clientId", type, mois, annee, statut) VALUES ($1, 'TVA_MENSUELLE', 3, 2026, 'MANQUANT')`, [c1.id]);
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const u = ids.users.length ? ids.users : [0];
      const c = ids.clients.length ? ids.clients : [0];
      await ds.query(`DELETE FROM canvas WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM questionnaires_adn_global WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM flux_mensuels WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM analyses_strategiques WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM audit_logs WHERE "tenantId" = ANY($1)`, [ids.tenants.length ? ids.tenants : [0]]);
      await ds.query(`DELETE FROM clients WHERE id = ANY($1)`, [c]);   // outils BP et exercices en cascade
      await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [u]);
      await ds.query(`DELETE FROM tenant_config WHERE id = ANY($1)`, [ids.tenants.length ? ids.tenants : [0]]);
    }
    await app?.close();
  });

  it('lecture : 9 outils + entretien, reprise des anciens onglets et de N-1, droits du collaborateur du dossier', async () => {
    const { body } = await get('resp', BP(c1, q(ex2026))).expect(200);
    expect(body.outils.map((o: any) => o.outil)).toEqual(['SWOT', 'PORTER', 'BMC', 'PESTEL', 'CHAINE_VALEUR', 'DIAGNOSTIC', 'RISQUES', 'PERSONA', 'BCG', 'ENTRETIEN']);
    expect(body.exercice).toEqual({ id: ex2026.id, annee: 2026, cloture: false });
    expect(body.precedent).toMatchObject({ annee: 2025, outils: { PESTEL: { statut: 'VALIDE' } } });
    expect(body.droits).toEqual({ modifier: true, valider: false });

    const swot = outil(body, 'SWOT');
    expect(swot).toMatchObject({ origine: 'REPRISE_ANCIENNE', statut: 'BROUILLON' });
    expect(swot.contenu.forces.map((i: any) => i.texte)).toEqual(['Clientèle fidèle']);
    expect(outil(body, 'PORTER').contenu.forces.concurrence.elements[0].texte).toBe('Trois boulangeries');
    expect(outil(body, 'BMC').contenu.partenaires[0].texte).toBe('Meunier local');
    expect(outil(body, 'PESTEL')).toMatchObject({ origine: 'REPRISE_N1', statut: 'BROUILLON' });
    expect(outil(body, 'PESTEL').contenu.legal[0].texte).toBe('Normes HACCP');
    expect(outil(body, 'RISQUES')).toMatchObject({ origine: 'VIDE', contenu: { risques: [] } });
  });

  it('enregistrement par le collaborateur : contenu nettoyé, brouillon ; validation réservée aux profils BP+', async () => {
    const { body: saved } = await patch('resp', BP(c1, `/swot${q(ex2026)}`), {
      contenu: { forces: [{ texte: 'Clientèle fidèle' }, { texte: 'Pain au levain' }], inconnu: ['x'] },
    }).expect(200);
    expect(saved).toMatchObject({ outil: 'SWOT', statut: 'BROUILLON', origine: 'ENREGISTRE', validePar: null });
    expect(saved.contenu.forces).toHaveLength(2);
    expect(saved.contenu.inconnu).toBeUndefined();

    await post('resp', BP(c1, `/SWOT/valider${q(ex2026)}`)).expect(403);
    const { body: valide } = await post('chefMis', BP(c1, `/SWOT/valider${q(ex2026)}`)).expect(201);
    expect(valide).toMatchObject({ statut: 'VALIDE', validePar: { id: chefMis.id, nom: 'ZZ chefMis' } });
    expect(valide.valideLe).toBeTruthy();

    const { body } = await get('chefMis', BP(c1, q(ex2026))).expect(200);
    expect(body.droits).toEqual({ modifier: true, valider: true });
    expect(outil(body, 'SWOT')).toMatchObject({ origine: 'ENREGISTRE', statut: 'VALIDE' });

    // Toute modification repasse l'outil en brouillon.
    const { body: modifie } = await patch('resp', BP(c1, `/SWOT${q(ex2026)}`), { contenu: { forces: [{ texte: 'Pain au levain' }] } }).expect(200);
    expect(modifie).toMatchObject({ statut: 'BROUILLON', validePar: null, valideLe: null });
  });

  it('valider un outil jamais enregistré : refusé', async () => {
    await post('admin', BP(c1, `/RISQUES/valider${q(ex2026)}`)).expect(400);
  });

  it('non assigné au dossier (chef d’antenne, collaborateur) : lecture seule', async () => {
    const { body } = await get('chefAnt', BP(c1, q(ex2026))).expect(200);
    expect(body.droits).toEqual({ modifier: false, valider: false });
    await patch('chefAnt', BP(c1, `/PESTEL${q(ex2026)}`), { contenu: {} }).expect(403);
    await patch('etranger', BP(c1, `/PESTEL${q(ex2026)}`), { contenu: {} }).expect(403);
    await post('chefAnt', BP(c1, `/SWOT/valider${q(ex2026)}`)).expect(403);
  });

  it('exercice clôturé : lecture seule, même pour l’administrateur', async () => {
    const { body } = await get('admin', BP(c1, q(ex2025))).expect(200);
    expect(body.exercice.cloture).toBe(true);
    expect(body.droits).toEqual({ modifier: false, valider: false });
    expect(outil(body, 'PESTEL')).toMatchObject({ origine: 'ENREGISTRE', statut: 'VALIDE' });
    await patch('admin', BP(c1, `/PESTEL${q(ex2025)}`), { contenu: {} }).expect(403);
  });

  it('exercice d’un autre dossier, autre cabinet, outil inconnu, contenu absent : refusés', async () => {
    await get('admin', BP(c1, q(exC2))).expect(404);
    await patch('admin', BP(c1, `/SWOT${q(exC2)}`), { contenu: {} }).expect(404);
    const autre = await get('adminX', BP(c1, q(ex2026)));
    expect([403, 404]).toContain(autre.status);
    await patch('admin', BP(c1, `/MCKINSEY${q(ex2026)}`), { contenu: {} }).expect(400);
    await patch('admin', BP(c1, `/SWOT${q(ex2026)}`), { autre: 1 }).expect(400);
    await get('admin', BP(c1)).expect(400);
  });

  it('suggestions et profil auto-généré à partir du dossier', async () => {
    const { body } = await get('resp', BP(c1, `/suggestions${q(ex2026)}`)).expect(200);
    const cles = body.suggestions.map((s: any) => s.cle);
    expect(cles).toEqual(expect.arrayContaining(['swot.valeur', 'swot.numerique', 'risque.tva', 'diag.digital']));
    expect(body.suggestions.find((s: any) => s.cle === 'risque.tva')).toMatchObject({ outil: 'RISQUES', risque: { categorie: 'FISCAL' } });
    expect(body.profil).toMatchObject({ maturiteNumerique: 5, nbExercices: 2, disciplinePieces: { enRetard: 1 } });
  });

  it('entretien BP : réponses nettoyées, chaque ligne devient une suggestion dans l’outil prévu', async () => {
    const { body: saved } = await patch('resp', BP(c1, `/ENTRETIEN${q(ex2026)}`), {
      contenu: { date: '2026-11-13', participants: 'M. Hoarau', reponses: { concurrents: 'Boulangerie Dupont\n- Supermarché', inconnue: 'x' }, notes: { numerique: 9 } },
    }).expect(200);
    expect(saved.contenu).toMatchObject({ date: '2026-11-13', participants: 'M. Hoarau', reponses: { concurrents: 'Boulangerie Dupont\n- Supermarché' }, notes: { numerique: 5, satisfaction: 0 } });
    expect(saved.contenu.reponses.inconnue).toBeUndefined();
    const { body } = await get('resp', BP(c1, `/suggestions${q(ex2026)}`)).expect(200);
    const entretien = body.suggestions.filter((s: any) => s.source === 'Entretien BP');
    expect(entretien.map((s: any) => [s.outil, s.zone, s.texte])).toEqual(expect.arrayContaining([
      ['PORTER', 'concurrence', 'Boulangerie Dupont'], ['PORTER', 'concurrence', 'Supermarché'],
      ['DIAGNOSTIC', 'axe:digital', 'Maîtrise du numérique évaluée en entretien : 5/5'],
    ]));
  });

  it('validation avec commentaire du BP ; une modification l’efface', async () => {
    await patch('resp', BP(c1, `/PERSONA${q(ex2026)}`), { contenu: { persona: { age: '45 ans' } } }).expect(200);
    const { body: v } = await as('chefMis')(http().post(BP(c1, `/PERSONA/valider${q(ex2026)}`)).send({ commentaire: '  À revoir en juin  ' })).expect(201);
    expect(v).toMatchObject({ statut: 'VALIDE', commentaire: 'À revoir en juin' });
    const { body: m } = await patch('resp', BP(c1, `/PERSONA${q(ex2026)}`), { contenu: { persona: { age: '46 ans' } } }).expect(200);
    expect(m).toMatchObject({ statut: 'BROUILLON', commentaire: null });
  });

  it('suggestions IA : refusées pour l’entretien ; une activité BCG acceptée garde sa clé', async () => {
    await get('resp', BP(c1, `/suggestions-ia${q(ex2026)}&outil=ENTRETIEN`)).expect(400);
    const { body } = await patch('resp', BP(c1, `/BCG${q(ex2026)}`), {
      contenu: { activites: [{ nom: 'Pain', ca: null, quadrant: 'VACHE', couleur: '#10b981', cle: 'ia.bcg.0123456789' }] },
    }).expect(200);
    expect(body.contenu.activites[0]).toMatchObject({ nom: 'Pain', quadrant: 'VACHE', cle: 'ia.bcg.0123456789' });
  });
});
