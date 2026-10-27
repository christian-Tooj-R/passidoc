/**
 * Intégration de bout en bout — temps passés façon Tempolia, affaires, PV Col figé,
 * rentabilité / boni-mali et alertes de budget (cahier v2 #4/#6).
 *
 * Démarre l'application complète sur la base de .env (base locale de développement) et
 * travaille dans DEUX tenants temporaires créés pour l'occasion (données préfixées ZZTEST),
 * entièrement supprimés à la fin — y compris si un test échoue.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TenantConfig } from '../src/entities/tenant-config.entity';
import { User, UserRole, UserSite } from '../src/entities/user.entity';
import { Client, ClientSite } from '../src/entities/client.entity';
import { FicheIdentite } from '../src/entities/fiche-identite.entity';
import { Exercice, ExerciceStatut } from '../src/entities/exercice.entity';
import { CongeAbsence, StatutConge, TypeConge } from '../src/entities/conge-absence.entity';
import { SaisieTemps } from '../src/entities/saisie-temps.entity';
import { BudgetDossier } from '../src/entities/budget-dossier.entity';
import { AffairesService } from '../src/saisie-temps/affaires.service';

jest.setTimeout(60_000);

describe('Temps passés, affaires et rentabilité (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const ids = { tenants: [] as number[], users: [] as number[], clients: [] as number[] };
  const tok: Record<string, string> = {};
  let T: TenantConfig, X: TenantConfig;
  let admin: User, resp: User, autre: User, expert: User, adminX: User;
  let c1: Client, c2: Client, cx: Client;
  const s: Record<string, number> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string, slug = T.slug) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${tok[who]}`).set('x-tenant-slug', slug!);
  const get = (who: string, url: string) => as(who)(http().get(url));
  const post = (who: string, url: string, body: any) => as(who)(http().post(url).send(body));
  const patch = (who: string, url: string, body: any) => as(who)(http().patch(url).send(body));
  const del = (who: string, url: string) => as(who)(http().delete(url));
  const saisie = async (id: number) => ds.getRepository(SaisieTemps).findOneByOrFail({ id });
  const nbNotifs = async (userId: number, type: string) =>
    Number((await ds.query(`SELECT COUNT(*) n FROM notifications WHERE "userId" = $1 AND type = $2`, [userId, type]))[0].n);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource);
    const jwt = app.get(JwtService);

    const tenants = ds.getRepository(TenantConfig);
    T = await tenants.save(tenants.create({ slug: `zztest-temps-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;
    X = await tenants.save(tenants.create({ slug: `zztest-autre-${stamp}`, nomSociete: 'ZZTEST Autre', isConfigured: true } as any) as any) as any;
    ids.tenants.push(T.id, X.id);

    const users = ds.getRepository(User);
    const mk = async (nom: string, role: UserRole, tenantId: number, extra: Partial<User> = {}) => {
      const u = await users.save(users.create({
        email: `zztest-${nom}-${stamp}@test.local`, password: 'x', firstName: 'ZZ', lastName: nom,
        role, site: UserSite.EST, tenantId, isActive: true, ...extra,
      }));
      ids.users.push(u.id);
      tok[nom] = jwt.sign({ sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId });
      return u;
    };
    admin = await mk('admin', UserRole.ADMIN, T.id);
    resp = await mk('resp', UserRole.COLLABORATEUR, T.id, { heuresHebdo: 35 });
    autre = await mk('autre', UserRole.COLLABORATEUR, T.id);
    expert = await mk('expert', UserRole.EXPERT_COMPTABLE, T.id);
    adminX = await mk('adminX', UserRole.ADMIN, X.id);

    const clients = ds.getRepository(Client);
    c1 = await clients.save(clients.create({ nom: 'ZZ TRANSMAS', site: ClientSite.EST, tenantId: T.id, dateClotureExercice: '09-30', responsableId: resp.id, directeurId: admin.id, isActive: true }));
    c2 = await clients.save(clients.create({ nom: 'ZZ TRANSMASCA', site: ClientSite.EST, tenantId: T.id, dateClotureExercice: '12-31', responsableId: autre.id, isActive: true }));
    cx = await clients.save(clients.create({ nom: 'ZZ AUTRE CABINET', site: ClientSite.EST, tenantId: X.id, isActive: true }));
    ids.clients.push(c1.id, c2.id, cx.id);
    await ds.getRepository(FicheIdentite).save({ client: { id: c1.id }, honoraires: { comptables: 3000 } } as any);
    await ds.getRepository(Exercice).save([
      { clientId: c2.id, annee: 2025, dateOuverture: '2025-01-01', dateCloture: '2025-12-31', statut: ExerciceStatut.OUVERT },
      { clientId: c2.id, annee: 2026, dateOuverture: '2026-01-01', dateCloture: '2026-12-31', statut: ExerciceStatut.OUVERT },
    ]);
    await ds.getRepository(CongeAbsence).save([
      { userId: resp.id, tenantId: T.id, typeConge: TypeConge.CONGES_PAYES, dateDebut: '2026-09-07', dateFin: '2026-09-11', nombreJours: 5, statut: StatutConge.APPROUVEE },
      { userId: resp.id, tenantId: T.id, typeConge: TypeConge.CONGES_PAYES, dateDebut: '2026-11-02', dateFin: '2026-11-03', nombreJours: 2, statut: StatutConge.EN_ATTENTE },
    ]);
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const u = ids.users.length ? ids.users : [0];
      const c = ids.clients.length ? ids.clients : [0];
      await ds.query(`DELETE FROM notifications WHERE "userId" = ANY($1)`, [u]);
      await ds.query(`DELETE FROM budgets_dossiers WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM saisies_temps WHERE "collaborateurId" = ANY($1) OR "clientId" = ANY($2)`, [u, c]);
      await ds.query(`DELETE FROM conges_absences WHERE "userId" = ANY($1)`, [u]);
      await ds.query(`DELETE FROM exercices WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM fiche_identite WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM clients WHERE id = ANY($1)`, [c]);
      await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [u]);
      await ds.query(`DELETE FROM tenant_config WHERE id = ANY($1)`, [ids.tenants.length ? ids.tenants : [0]]);
    }
    await app?.close();
  });

  describe('prix de vente horaire (PV Col)', () => {
    it("réservé à l'ADMIN, montant positif", async () => {
      await patch('autre', `/api/users/${resp.id}/prix-vente`, { prixVenteHoraire: 999 }).expect(403);
      await patch('admin', `/api/users/${resp.id}/prix-vente`, { prixVenteHoraire: -1 }).expect(400);
      const r = await patch('admin', `/api/users/${resp.id}/prix-vente`, { prixVenteHoraire: 50 }).expect(200);
      expect(Number(r.body.prixVenteHoraire)).toBe(50);
    });

    it("un ADMIN d'un autre cabinet ne peut pas modifier le tarif", async () => {
      await as('adminX', X.slug!)(http().patch(`/api/users/${resp.id}/prix-vente`).send({ prixVenteHoraire: 1 })).expect(404);
    });

    it('masqué aux collègues dans /users, visible pour soi', async () => {
      const vuParAutre = (await get('autre', '/api/users').expect(200)).body.find((x: any) => x.id === resp.id);
      expect(vuParAutre.prixVenteHoraire).toBeNull();
      const vuParSoi = (await get('resp', '/api/users').expect(200)).body.find((x: any) => x.id === resp.id);
      expect(Number(vuParSoi.prixVenteHoraire)).toBe(50);
    });
  });

  describe('saisies : affaire automatique et taux figé', () => {
    const creer = async (who: string, body: any) => (await post(who, '/api/saisies-temps', body).expect(201)).body;

    it("attribue l'exercice du dossier, avec la révision post-clôture sur l'exercice clos", async () => {
      s.s1 = (await creer('resp', { date: '2026-02-17', dureeHeures: 2, type: 'FACTURABLE', clientId: c1.id, missionCode: 'TCO', commentaire: 'ZZTEST tenue' })).id;
      s.s2 = (await creer('resp', { date: '2026-10-16', dureeHeures: 3, type: 'FACTURABLE', clientId: c1.id, missionCode: 'REV', commentaire: 'ZZTEST révision' })).id;
      s.s3 = (await creer('resp', { date: '2026-10-16', dureeHeures: 1, type: 'FACTURABLE', clientId: c1.id, missionCode: 'TCO', commentaire: 'ZZTEST tenue N+1' })).id;
      s.s4 = (await creer('resp', { date: '2026-03-05', dureeHeures: 4, type: 'FACTURABLE', clientId: c1.id, missionCode: 'SOC', commentaire: 'ZZTEST paie' })).id;
      s.s5 = (await creer('resp', { date: '2026-03-06', dureeHeures: 2, type: 'NON_FACTURABLE', categorie: 'APPEL_CLIENT', clientId: c1.id })).id;
      s.s6 = (await creer('resp', { date: '2026-03-07', dureeHeures: 1, type: 'NON_FACTURABLE', categorie: 'FORMATION' })).id;
      expect((await saisie(s.s1)).affaire).toBe('C2026-09');
      expect((await saisie(s.s2)).affaire).toBe('C2026-09');
      expect((await saisie(s.s3)).affaire).toBe('C2027-09');
      expect((await saisie(s.s6)).affaire).toBeNull();
      expect((await saisie(s.s1)).tauxHoraire).toBe(50);
    });

    it("reste sur l'exercice PASSIDOC encore ouvert, puis sur celui qui contient la date", async () => {
      s.s7 = (await creer('autre', { date: '2026-03-10', dureeHeures: 1, type: 'FACTURABLE', clientId: c2.id, missionCode: 'TCO' })).id;
      s.s8 = (await creer('autre', { date: '2026-08-01', dureeHeures: 2, type: 'FACTURABLE', clientId: c2.id, missionCode: 'TCO' })).id;
      expect((await saisie(s.s7)).affaire).toBe('C2025-12');
      expect((await saisie(s.s8)).affaire).toBe('C2026-12');
    });

    it('refuse une affaire mal formée', async () => {
      await post('resp', '/api/saisies-temps', { date: '2026-03-01', dureeHeures: 1, type: 'FACTURABLE', clientId: c1.id, affaire: 'C2026-13' }).expect(400);
    });

    it("un changement de tarif ne revalorise pas l'historique", async () => {
      await patch('admin', `/api/users/${resp.id}/prix-vente`, { prixVenteHoraire: 80 }).expect(200);
      s.s9 = (await creer('resp', { date: '2026-04-01', dureeHeures: 1, type: 'FACTURABLE', clientId: c1.id, missionCode: 'TCO', commentaire: 'ZZTEST après hausse' })).id;
      expect((await saisie(s.s1)).tauxHoraire).toBe(50);
      expect((await saisie(s.s9)).tauxHoraire).toBe(80);
    });

    it("modification : garde, recalcule ou applique l'affaire selon le cas", async () => {
      await patch('resp', `/api/saisies-temps/${s.s1}`, { commentaire: 'ZZTEST précision' }).expect(200);
      expect((await saisie(s.s1)).affaire).toBe('C2026-09');
      await patch('resp', `/api/saisies-temps/${s.s3}`, { date: '2026-05-02' }).expect(200);
      expect((await saisie(s.s3)).affaire).toBe('C2026-09');
      await patch('resp', `/api/saisies-temps/${s.s3}`, { affaire: 'C2025-09' }).expect(200);
      expect((await saisie(s.s3)).affaire).toBe('C2025-09');
      await patch('resp', `/api/saisies-temps/${s.s3}`, { affaire: null }).expect(200);
      expect((await saisie(s.s3)).affaire).toBe('C2026-09');
      await patch('autre', `/api/saisies-temps/${s.s1}`, { commentaire: 'pas à moi' }).expect(404);
    });
  });

  describe('rapport « Détail des temps passés »', () => {
    const url = (q: string) => `/api/saisies-temps/rapport/detail?dateDebut=2026-01-01&dateFin=2026-12-31${q}`;

    it('un collaborateur ne voit que ses temps, même en demandant ceux d’un collègue', async () => {
      const { lignes } = (await get('resp', url(`&collaborateurIds=${autre.id}`)).expect(200)).body;
      expect(lignes.length).toBeGreaterThan(0);
      expect(lignes.every((l: any) => l.collaborateurId === resp.id)).toBe(true);
    });

    it("l'ADMIN filtre par collaborateur et par client ; pas d'absence dans un rapport client", async () => {
      const parCollab = (await get('admin', url(`&collaborateurIds=${autre.id}`)).expect(200)).body.lignes;
      expect(parCollab.map((l: any) => l.id).sort()).toEqual([s.s7, s.s8].sort());
      const parClient = (await get('admin', url(`&clientIds=${c1.id}`)).expect(200)).body.lignes;
      expect(parClient.every((l: any) => l.clientId === c1.id && l.source === 'SAISIE')).toBe(true);
    });

    it('valorise chaque ligne au taux figé et libelle Client / TNF', async () => {
      const lignes: any[] = (await get('resp', url('')).expect(200)).body.lignes;
      const l = (id: number) => lignes.find(x => x.source === 'SAISIE' && x.id === id);
      expect(l(s.s1)).toMatchObject({ pv: 100, tauxHoraire: 50, tauxFige: true, affaire: 'C2026-09', affaireEtat: 'O', clientTnf: 'ZZ TRANSMAS' });
      expect(l(s.s9)).toMatchObject({ pv: 80, tauxHoraire: 80 });
      expect(l(s.s5)).toMatchObject({ presence: 'NON_FACTURABLE', clientTnf: 'ZZ TRANSMAS' });
      expect(l(s.s6)).toMatchObject({ presence: 'NON_FACTURABLE', clientTnf: 'Formation', affaire: null });
    });

    it('convertit les absences approuvées en heures, ignore les demandes en attente', async () => {
      const lignes: any[] = (await get('resp', url('')).expect(200)).body.lignes;
      const absences = lignes.filter(x => x.source === 'ABSENCE');
      expect(absences).toHaveLength(1);
      expect(absences[0]).toMatchObject({ presence: 'ABSENCE', dureeHeures: 35, clientTnf: 'Congés payés', pv: 0 });
      const sans = (await get('resp', url('&absences=false')).expect(200)).body.lignes;
      expect(sans.some((x: any) => x.source === 'ABSENCE')).toBe(false);
    });
  });

  describe('affaires et isolation entre cabinets', () => {
    it('liste les affaires du dossier, y compris celles portées par des saisies', async () => {
      const codes = (await get('resp', `/api/saisies-temps/affaires?clientId=${c1.id}`).expect(200)).body.map((a: any) => a.code);
      expect(codes).toEqual(expect.arrayContaining(['C2026-09', 'C2027-09']));
    });

    it("un autre cabinet n'accède ni aux affaires, ni à la rentabilité, ni au budget du dossier", async () => {
      const ax = (r: request.Test) => as('adminX', X.slug!)(r);
      await ax(http().get(`/api/saisies-temps/affaires?clientId=${c1.id}`)).expect(404);
      await ax(http().get(`/api/saisies-temps/rentabilite/dossier/${c1.id}`)).expect(404);
      await ax(http().post(`/api/saisies-temps/rentabilite/dossier/${c1.id}/budget`).send({ affaire: 'C2026-09', heuresBudget: 1 })).expect(404);
      const t = (await ax(http().get('/api/saisies-temps/rentabilite?annee=2026')).expect(200)).body;
      expect(t.lignes.map((l: any) => l.clientId)).toEqual([cx.id]);
    });
  });

  describe('budget, boni/mali et alertes', () => {
    const budgetUrl = () => `/api/saisies-temps/rentabilite/dossier/${c1.id}/budget`;
    const budget = () => ds.getRepository(BudgetDossier).findOneByOrFail({ clientId: c1.id, affaire: 'C2026-09' });

    it('seuls ADMIN, expert-comptable et intervenants posent un budget ; données validées', async () => {
      await post('autre', budgetUrl(), { affaire: 'C2026-09', heuresBudget: 10 }).expect(403);
      await post('resp', budgetUrl(), { affaire: '2026-09', heuresBudget: 10 }).expect(400);
      await post('resp', budgetUrl(), { affaire: 'C2026-09', heuresBudget: 0 }).expect(400);
      await post('expert', budgetUrl(), { affaire: 'C2026-09', heuresBudget: 12 }).expect(201);
      const r = await post('resp', budgetUrl(), { affaire: 'C2026-09', heuresBudget: 10 }).expect(201);
      expect(r.body).toMatchObject({ heuresBudget: 10, honoraires: null, alerte80At: null });
    });

    it('calcule consommation compta, prix de vente horaire et boni (formules du cahier)', async () => {
      const d = (await get('admin', `/api/saisies-temps/rentabilite/dossier/${c1.id}?affaire=C2026-09`).expect(200)).body;
      // compta = s1 2h + s2 3h + s3 1h + s9 1h ; hors budget = SOC 4h + non facturable 2h
      expect(d.indicateurs).toMatchObject({
        heuresConsommees: 7, heuresBudget: 10, honoraires: 3000, honorairesSource: 'FICHE',
        prixVenteHoraire: 300, montantRealise: 2100, boniMali: 900, statut: 'OK',
        valorisation: 380, margeValorisation: 2620,
      });
      expect(d.heuresHorsBudget).toBe(6);
      expect(d.parCollaborateur).toEqual([expect.objectContaining({ collaborateurId: resp.id, heures: 7, valorisation: 380 })]);
    });

    it('masque la valorisation et le détail par collaborateur hors ADMIN', async () => {
      const d = (await get('autre', `/api/saisies-temps/rentabilite/dossier/${c1.id}?affaire=C2026-09`).expect(200)).body;
      expect(d.indicateurs.valorisation).toBeNull();
      expect(d.indicateurs.boniMali).toBe(900);
      expect(d.parCollaborateur).toBeNull();
      expect(d.peutModifierBudget).toBe(false);
    });

    it('alerte une fois à 80 % puis à 100 %, uniquement les intervenants et les ADMIN', async () => {
      const nouvelle = (h: number) => post('resp', '/api/saisies-temps', { date: '2026-04-02', dureeHeures: h, type: 'FACTURABLE', clientId: c1.id, missionCode: 'TCO', commentaire: 'ZZTEST alerte' }).expect(201);
      await nouvelle(1.5); // 8,5 h / 10 h
      expect(await nbNotifs(resp.id, 'BUDGET_DOSSIER_ATTENTION')).toBe(1);
      expect(await nbNotifs(admin.id, 'BUDGET_DOSSIER_ATTENTION')).toBe(1);
      expect(await nbNotifs(autre.id, 'BUDGET_DOSSIER_ATTENTION')).toBe(0);
      expect(await nbNotifs(expert.id, 'BUDGET_DOSSIER_ATTENTION')).toBe(0);
      await nouvelle(0.5); // 9 h : pas de nouvelle alerte
      expect(await nbNotifs(resp.id, 'BUDGET_DOSSIER_ATTENTION')).toBe(1);
      s.s12 = (await nouvelle(2)).body.id; // 11 h : dépassement
      expect(await nbNotifs(resp.id, 'BUDGET_DOSSIER_DEPASSE')).toBe(1);
      expect(await nbNotifs(admin.id, 'BUDGET_DOSSIER_DEPASSE')).toBe(1);
      expect((await budget()).alerte100At).not.toBeNull();
    });

    it('réarme les seuils quand la consommation redescend', async () => {
      await del('resp', `/api/saisies-temps/${s.s12}`).expect(200);
      expect((await budget()).alerte100At).toBeNull();
      expect((await budget()).alerte80At).not.toBeNull();
      await post('resp', budgetUrl(), { affaire: 'C2026-09', heuresBudget: 50 }).expect(201);
      expect((await budget()).alerte80At).toBeNull();
    });

    it('tableau de bord : périmètre par profil et affaire attendue sans données', async () => {
      const parAdmin = (await get('admin', '/api/saisies-temps/rentabilite?annee=2026').expect(200)).body;
      expect(parAdmin.lignes.map((l: any) => `${l.clientId}|${l.affaire}`).sort()).toEqual([`${c1.id}|C2026-09`, `${c2.id}|C2026-12`].sort());
      expect(parAdmin.voirValorisation).toBe(true);
      const parResp = (await get('resp', `/api/saisies-temps/rentabilite?annee=2026&collaborateurId=${autre.id}`).expect(200)).body;
      expect(parResp.lignes.map((l: any) => l.clientId)).toEqual([c1.id]);
      expect(parResp.totaux.valorisation).toBeNull();
      const en2025 = (await get('admin', '/api/saisies-temps/rentabilite?annee=2025').expect(200)).body;
      expect(en2025.lignes.map((l: any) => l.affaire).sort()).toEqual(['C2025-09', 'C2025-12']);
    });

    it('suppression du budget réservée aux mêmes profils', async () => {
      await del('autre', `${budgetUrl()}/C2026-09`).expect(403);
      await del('resp', `${budgetUrl()}/C2026-09`).expect(200);
      expect(await ds.getRepository(BudgetDossier).countBy({ clientId: c1.id })).toBe(0);
    });
  });

  describe('démarrage et sauvegarde', () => {
    it('rattrape les saisies sans affaire au démarrage', async () => {
      await ds.getRepository(SaisieTemps).update({ id: In([s.s2, s.s7]) }, { affaire: null });
      await app.get(AffairesService).onApplicationBootstrap();
      expect((await saisie(s.s2)).affaire).toBe('C2026-09');
      expect((await saisie(s.s7)).affaire).toBe('C2025-12');
    });

    it("l'export SQL du cabinet est complet et inclut les budgets de dossier", async () => {
      await post('resp', `/api/saisies-temps/rentabilite/dossier/${c1.id}/budget`, { affaire: 'C2026-09', heuresBudget: 20 }).expect(201);
      const r = await get('admin', '/api/backup/export-sql').buffer(true).parse((res, cb) => {
        let data = ''; res.on('data', (c: Buffer) => (data += c.toString())); res.on('end', () => cb(null, data));
      }).expect(200);
      const sql = r.body as string;
      expect(sql).toContain('INSERT INTO "budgets_dossiers"');
      expect(sql).toContain('"affaire"');
      expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    });
  });
});
