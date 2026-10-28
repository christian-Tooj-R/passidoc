/**
 * Intégration de bout en bout — module Missions (CDC_MODULE_MISSIONS_PASSIDOC, 19/10/2026) et
 * saisie automatique du temps d'une tâche terminée (module Travail).
 *
 * Application complète sur la base de .env (base locale), dans deux tenants temporaires
 * ZZTEST supprimés à la fin.
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
import { Mission, TypeMission } from '../src/entities/mission.entity';
import { Pointage } from '../src/entities/pointage.entity';
import { MissionsScheduler } from '../src/missions/missions.scheduler';
import { aujourdhuiIso } from '../src/saisie-temps/affaires.service';
import { ajouterJoursIso } from '../src/missions/missions.util';

jest.setTimeout(60_000);

describe('Module Missions + saisie automatique des tâches terminées (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const ids = { tenants: [] as number[], users: [] as number[], clients: [] as number[] };
  const tok: Record<string, string> = {};
  let T: TenantConfig, X: TenantConfig;
  let admin: User, expert: User, chefAnt: User, chefMis: User, resp: User, gerant: User, etranger: User, adminX: User;
  let c1: Client, c2: Client, cx: Client;
  let ex2025: Exercice, ex2026: Exercice;
  const AUJ = aujourdhuiIso();

  const http = () => request(app.getHttpServer());
  const as = (who: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${tok[who]}`).set('x-tenant-slug', (who === 'adminX' ? X : T).slug!);
  const get = (who: string, url: string) => as(who)(http().get(url));
  const post = (who: string, url: string, body: any) => as(who)(http().post(url).send(body));
    const patch = (who: string, url: string, body: any) => as(who)(http().patch(url).send(body));
  const del = (who: string, url: string) => as(who)(http().delete(url));
  const M = (c: Client) => `/api/clients/${c.id}/missions`;

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
    T = await tenants.save(tenants.create({ slug: `zztest-mi-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;
    X = await tenants.save(tenants.create({ slug: `zztest-mix-${stamp}`, nomSociete: 'ZZTEST Autre', isConfigured: true } as any) as any) as any;
    ids.tenants.push(T.id, X.id);

    const users = ds.getRepository(User);
    const mk = async (nom: string, role: UserRole, tenantId: number, extra: Partial<User> = {}) => {
      const u = await users.save(users.create({
        email: `zztest-${nom}-${stamp}@test.local`, password: 'secret-hash-zz', firstName: 'ZZ', lastName: nom,
        role, site: UserSite.EST, tenantId, isActive: true, timezone: 'Indian/Reunion', ...extra,
      }));
      ids.users.push(u.id);
      tok[nom] = jwt.sign({ sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId });
      return u;
    };
    admin = await mk('admin', UserRole.ADMIN, T.id);
    expert = await mk('expert', UserRole.EXPERT_COMPTABLE, T.id);
    chefAnt = await mk('chefAnt', UserRole.CHEF_ANTENNE, T.id, { antenne: 'EST' as any });
    chefMis = await mk('chefMis', UserRole.CHEF_MISSION, T.id);
    resp = await mk('resp', UserRole.COLLABORATEUR, T.id, { referentId: chefMis.id });
    gerant = await mk('gerant', UserRole.GERANT_OUEST, T.id, { site: UserSite.OUEST });
    etranger = await mk('etranger', UserRole.COLLABORATEUR, T.id);
    adminX = await mk('adminX', UserRole.ADMIN, X.id);

    const clients = ds.getRepository(Client);
    c1 = await clients.save(clients.create({
      nom: 'ZZ SOCIETE A', site: ClientSite.EST, tenantId: T.id, isActive: true, secteurActivite: 'ZZ_TRANSPORT',
      responsableId: resp.id, directeurId: chefMis.id, collaborateurOuestId: gerant.id,
    }));
    c2 = await clients.save(clients.create({ nom: 'ZZ SOCIETE OUEST', site: ClientSite.OUEST, tenantId: T.id, isActive: true, responsableId: admin.id }));
    cx = await clients.save(clients.create({ nom: 'ZZ AUTRE CABINET', site: ClientSite.EST, tenantId: X.id, isActive: true }));
    ids.clients.push(c1.id, c2.id, cx.id);

    const exercices = ds.getRepository(Exercice);
    ex2025 = await exercices.save(exercices.create({ clientId: c1.id, annee: 2025, dateOuverture: '2024-10-01', dateCloture: '2025-09-30', statut: ExerciceStatut.CLOTURE }));
    ex2026 = await exercices.save(exercices.create({ clientId: c1.id, annee: 2026, dateOuverture: '2025-10-01', dateCloture: '2026-09-30', statut: ExerciceStatut.OUVERT }));
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const u = ids.users.length ? ids.users : [0];
      const c = ids.clients.length ? ids.clients : [0];
      await ds.query(`DELETE FROM notifications WHERE "userId" = ANY($1)`, [u]);
      await ds.query(`DELETE FROM saisies_temps WHERE "collaborateurId" = ANY($1) OR "clientId" = ANY($2)`, [u, c]);
      await ds.query(`DELETE FROM incoherences_pointage WHERE "collaborateurId" = ANY($1)`, [u]);
      await ds.query(`DELETE FROM pointages WHERE "userId" = ANY($1)`, [u]);
      await ds.query(`DELETE FROM tasks WHERE "tenantId" = ANY($1)`, [ids.tenants.length ? ids.tenants : [0]]);
      await ds.query(`DELETE FROM clients WHERE id = ANY($1)`, [c]);   // missions, historique, recommandations, exercices en cascade
      await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [u]);
      await ds.query(`DELETE FROM tenant_config WHERE id = ANY($1)`, [ids.tenants.length ? ids.tenants : [0]]);
    }
    await app?.close();
  });

  describe('Onglet « Par cycle » et pipeline du dossier', () => {
    let mCli: any;

    it('le collaborateur du dossier crée une mission depuis un cycle : « Proposée », historisée', async () => {
      const { body } = await post('resp', M(c1), {
        titre: 'Analyse concentration clients', cycle: 'CLI', exerciceId: ex2026.id,
        honoraires: 2500, dateRelance: '2026-11-15', responsableId: resp.id,
      }).expect(201);
      mCli = body;
      expect(body).toMatchObject({ statut: 'PROPOSEE', cycle: 'CLI', exerciceId: ex2026.id, annee: 2026, type: 'DETECTEE', honoraires: 2500 });
      expect(body.responsable).toEqual({ id: resp.id, firstName: 'ZZ', lastName: 'resp' });
      expect(body.responsable.password).toBeUndefined();
      const h = await get('resp', `${M(c1)}/${body.id}/historique`).expect(200);
      expect(h.body).toHaveLength(1);
      expect(h.body[0]).toMatchObject({ ancienStatut: null, nouveauStatut: 'PROPOSEE', auteurNom: 'ZZ resp' });
    });

    it('validation : intitulé obligatoire, cycle et statut connus', async () => {
      await post('resp', M(c1), { cycle: 'CLI' }).expect(400);
      await post('resp', M(c1), { titre: 'X', cycle: 'A' }).expect(400);
      await post('resp', M(c1), { titre: 'X', cycle: 'CLI', statut: 'GAGNEE' }).expect(400);
    });

    it('pipeline : mission hors cycle par le chef de mission, refusée au collaborateur (lecture seule)', async () => {
      await post('resp', M(c1), { titre: 'Audit prévoyance' }).expect(403);
      const { body } = await post('chefMis', M(c1), { titre: 'Audit prévoyance', honoraires: 1800, statut: 'EN_DISCUSSION' }).expect(201);
      expect(body.cycle).toBeNull();
      // Le collaborateur ne modifie pas non plus une mission hors cycle…
      await patch('resp', `${M(c1)}/${body.id}`, { statut: 'ACCEPTEE' }).expect(403);
      // … ni ne fait passer une mission de cycle hors cycle.
      await patch('resp', `${M(c1)}/${mCli.id}`, { cycle: null }).expect(403);
    });

    it('gérant de pôle : lecture seule ; non-intervenant et autre cabinet : refusés', async () => {
      await get('gerant', M(c1)).expect(200);
      await post('gerant', M(c1), { titre: 'X', cycle: 'TRE' }).expect(403);
      await patch('gerant', `${M(c1)}/${mCli.id}`, { statut: 'SANS_SUITE' }).expect(403);
      await post('etranger', M(c1), { titre: 'X', cycle: 'TRE' }).expect(403);
      await get('adminX', M(c1)).expect(403);
    });

    it('R4 : chaque changement de statut est historisé (date + auteur)', async () => {
      const { body } = await patch('resp', `${M(c1)}/${mCli.id}`, { statut: 'EN_DISCUSSION' }).expect(200);
      expect(body.statut).toBe('EN_DISCUSSION');
      await patch('admin', `${M(c1)}/${mCli.id}`, { statut: 'ACCEPTEE', honoraires: 2600 }).expect(200);
      await patch('admin', `${M(c1)}/${mCli.id}`, { honoraires: 2500 }).expect(200);   // sans changement de statut
      const h = await get('admin', `${M(c1)}/${mCli.id}/historique`).expect(200);
      expect(h.body.map((x: any) => `${x.ancienStatut}>${x.nouveauStatut}:${x.auteurNom}`))
        .toEqual(['EN_DISCUSSION>ACCEPTEE:ZZ admin', 'PROPOSEE>EN_DISCUSSION:ZZ resp', 'null>PROPOSEE:ZZ resp']);
    });

    it('une mission d’un autre dossier est introuvable par ce dossier', async () => {
      await patch('admin', `${M(c2)}/${mCli.id}`, { statut: 'REFUSEE' }).expect(404);
      await del('admin', `${M(c2)}/${mCli.id}`).expect(404);
    });

    it('R7 : suppression si Proposée / Sans suite, sinon archivage seulement', async () => {
      await del('admin', `${M(c1)}/${mCli.id}`).expect(400);
      const arch = await patch('admin', `${M(c1)}/${mCli.id}`, { archivee: true }).expect(200);
      expect(arch.body.archivee).toBe(true);
      await patch('admin', `${M(c1)}/${mCli.id}`, { archivee: false }).expect(200);
      const { body } = await post('resp', M(c1), { titre: 'À supprimer', cycle: 'STK', exerciceId: ex2026.id }).expect(201);
      await del('resp', `${M(c1)}/${body.id}`).expect(200);
    });

    it('recommandations par cycle et par exercice ; exercice clôturé en lecture seule', async () => {
      const txt = 'Risque de concentration clients élevé. Engager une réflexion sur la diversification.';
      await patch('resp', `${M(c1)}/cycles/CLI/recommandation`, { exerciceId: ex2026.id, texte: txt }).expect(200);
      await patch('resp', `${M(c1)}/cycles/CLI/recommandation`, { exerciceId: ex2026.id, texte: txt + ' (bis)' }).expect(200);
      await patch('resp', `${M(c1)}/cycles/CLI/recommandation`, { exerciceId: ex2025.id, texte: 'X' }).expect(403);
      await patch('resp', `${M(c1)}/cycles/XYZ/recommandation`, { exerciceId: ex2026.id, texte: 'X' }).expect(400);
      await post('resp', M(c1), { titre: 'Sur un exercice clos', cycle: 'TRE', exerciceId: ex2025.id }).expect(403);
      const { body } = await get('gerant', `${M(c1)}/cycles?exerciceId=${ex2026.id}`).expect(200);
      expect(body.cycles).toHaveLength(10);
      expect(body.recommandations.CLI.texte).toBe(txt + ' (bis)');
      expect(Object.keys(body.recommandations)).toEqual(['CLI']);
    });

    it('R5 : une mission refusée l’an passé réapparaît « pour mémoire » jusqu’à ce qu’elle soit reproposée', async () => {
      const refusee = await ds.getRepository(Mission).save({
        clientId: c1.id, titre: 'Grille salariale', type: TypeMission.DETECTEE, statut: 'REFUSEE', cycle: 'SOC',
        exerciceId: ex2025.id, annee: 2025, honoraires: 2200,
      } as any);
      let { body } = await get('resp', `${M(c1)}/cycles?exerciceId=${ex2026.id}`).expect(200);
      expect(body.dejaRefusees.map((m: any) => [m.id, m.anneeRefus])).toEqual([[refusee.id, 2025]]);
      // Pas dans l'exercice où elle a été refusée.
      ({ body } = await get('resp', `${M(c1)}/cycles?exerciceId=${ex2025.id}`).expect(200));
      expect(body.dejaRefusees).toEqual([]);

      await post('resp', M(c1), { titre: 'Grille salariale', cycle: 'SOC', exerciceId: ex2026.id, repriseDeId: refusee.id }).expect(201);
      ({ body } = await get('resp', `${M(c1)}/cycles?exerciceId=${ex2026.id}`).expect(200));
      expect(body.dejaRefusees).toEqual([]);
    });

    it('bandeau KPI du dossier', async () => {
      const { body } = await get('resp', `${M(c1)}/synthese`).expect(200);
      // Acceptée 2 500 + En discussion 1 800 + Proposée (reprise, sans montant) ; la refusée (2 200) hors potentiel.
      expect(body).toMatchObject({
        total: 4, potentiel: 4300, acceptees: { nombre: 1, montant: 2500 }, enDiscussion: { nombre: 1, montant: 1800 },
        proposees: { nombre: 1, montant: 0 }, refusees: 1, tauxConversion: 33,
      });
    });
  });

  describe('Vue globale cabinet', () => {
    beforeAll(async () => {
      await post('admin', M(c2), { titre: 'Plan de trésorerie', cycle: 'TRE', honoraires: 6000, responsableId: chefMis.id }).expect(201);
      await post('admin', M(c2), { titre: 'Mission en retard', honoraires: 500, dateRelance: ajouterJoursIso(AUJ, -2), responsableId: resp.id }).expect(201);
      await post('adminX', `/api/clients/${cx.id}/missions`, { titre: 'Autre cabinet', cycle: 'CLI' }).expect(201);
    });

    it('ADMIN : tout le cabinet (jamais un autre tenant), modifiable ; secteur du dossier', async () => {
      const { body } = await get('admin', '/api/missions').expect(200);
      expect(body.peutModifier).toBe(true);
      const titres = body.missions.map((m: any) => m.titre);
      expect(titres).toEqual(expect.arrayContaining(['Analyse concentration clients', 'Plan de trésorerie', 'Mission en retard']));
      expect(titres).not.toContain('Autre cabinet');
      const m = body.missions.find((x: any) => x.titre === 'Analyse concentration clients');
      expect(m.client).toEqual({ id: c1.id, nom: 'ZZ SOCIETE A', secteur: null });
      expect(m.secteur).toBe('ZZ_TRANSPORT');
      expect(body.kpi.aRelancer).toBe(1);
      expect(body.responsables.map((r: any) => r.nom)).toEqual(['ZZ chefMis', 'ZZ resp']);
    });

    it('filtres : statuts multiples, hors cycle, relance en retard, montant (« false » n’active pas le filtre)', async () => {
      let { body } = await get('expert', '/api/missions?statuts=PROPOSEE,ACCEPTEE&cycle=HORS_CYCLE').expect(200);
      expect(body.missions.map((m: any) => m.titre)).toEqual(['Mission en retard']);
      ({ body } = await get('expert', '/api/missions?relance=RETARD').expect(200));
      expect(body.missions.map((m: any) => m.titre)).toEqual(['Mission en retard']);
      ({ body } = await get('expert', '/api/missions?tranche=PLUS_5000').expect(200));
      expect(body.missions.map((m: any) => m.titre)).toEqual(['Plan de trésorerie']);
      const tous = (await get('expert', '/api/missions').expect(200)).body.missions.length;
      ({ body } = await get('expert', '/api/missions?avecMontant=false').expect(200));
      expect(body.missions).toHaveLength(tous);
      expect(body.peutModifier).toBe(false);
      await get('expert', '/api/missions?statuts=GAGNEE').expect(400);
    });

    it("chef d'antenne : son antenne ; collaborateur : ses missions ; gérant : refusé", async () => {
      const ant = (await get('chefAnt', '/api/missions').expect(200)).body.missions.map((m: any) => m.client.nom);
      expect(new Set(ant)).toEqual(new Set(['ZZ SOCIETE A']));
      const mes = (await get('resp', '/api/missions').expect(200)).body.missions.map((m: any) => m.titre);
      expect(mes.sort()).toEqual(['Analyse concentration clients', 'Mission en retard']);
      await get('gerant', '/api/missions').expect(403);
    });
  });

  describe('R8 — notifications de relance (J-3 / J0)', () => {
    it('J-3 au responsable, puis J0 au responsable, à son chef de mission et au chef d’antenne — une seule fois', async () => {
      const { body: m } = await post('admin', M(c1), {
        titre: 'Renégociation bancaire', cycle: 'EMP', exerciceId: ex2026.id, dateRelance: ajouterJoursIso(AUJ, 2), responsableId: resp.id,
      }).expect(201);
      const scheduler = app.get(MissionsScheduler);
      const notifs = async () => ds.query(
        `SELECT "userId", message FROM notifications WHERE type = 'MISSION_RELANCE' AND "userId" = ANY($1) AND titre = $2 ORDER BY id`,
        [ids.users, 'Renégociation bancaire'],
      );

      const modifieLe = async () => (await ds.query(`SELECT "updatedAt" FROM missions WHERE id = $1`, [m.id]))[0].updatedAt.getTime();
      const avant = await modifieLe();

      await scheduler.notifierRelances(AUJ);
      await scheduler.notifierRelances(AUJ);   // pas de doublon
      let n = await notifs();
      expect(n.map((x: any) => x.userId)).toEqual([resp.id]);
      expect(n[0].message).toContain('Relance prévue le');
      expect(await modifieLe()).toBe(avant);   // une notification ne change pas « Dernière modif. »

      await scheduler.notifierRelances(ajouterJoursIso(AUJ, 2));
      await scheduler.notifierRelances(ajouterJoursIso(AUJ, 3));
      n = await notifs();
      expect(n.slice(1).map((x: any) => x.userId).sort()).toEqual([chefAnt.id, chefMis.id, resp.id].sort());
      expect(n[1].message).toContain("À relancer aujourd'hui");

      // Mission acceptée : plus de relance, même avec une nouvelle date.
      await patch('admin', `${M(c1)}/${m.id}`, { statut: 'ACCEPTEE', dateRelance: ajouterJoursIso(AUJ, 3) }).expect(200);
      await scheduler.notifierRelances(ajouterJoursIso(AUJ, 3));
      expect(await notifs()).toHaveLength(n.length);
    });
  });

  describe('Module Travail — tâche terminée → saisie des temps', () => {
    const T_ = (c: Client) => `/api/clients/${c.id}/tasks`;
    const JOUR = '2025-03-04';   // aucun pointage du collaborateur ce jour-là

    it('le temps chronométré est saisi pour le collaborateur assigné, une seule fois', async () => {
      const { body: t } = await post('chefMis', T_(c1), { titre: 'Révision stock', type: 'DR', assigneeId: resp.id }).expect(201);
      await patch('resp', `${T_(c1)}/${t.id}`, { statut: 'EN_COURS' }).expect(200);
      await ds.query(`UPDATE tasks SET "tempsTotalSecondes" = 5400 WHERE id = $1`, [t.id]);

      const fin = await patch('chefMis', `${T_(c1)}/${t.id}`, { statut: 'TERMINEE', dateFinLocale: JOUR, heureFinLocale: '17:00' }).expect(200);
      expect(fin.body.statut).toBe('TERMINEE');
      expect(fin.body.saisieAuto).toMatchObject({ creee: true, dureeHeures: 1.5, date: JOUR, collaborateurId: resp.id, collaborateur: 'ZZ resp' });
      const [s] = await ds.query(`SELECT * FROM saisies_temps WHERE "taskId" = $1`, [t.id]);
      expect(s).toMatchObject({
        collaborateurId: resp.id, clientId: c1.id, type: 'FACTURABLE', missionCode: 'REV', dureeHeures: 1.5,
        heureDebut: '15:30', heureFin: '17:00', commentaire: `Révision stock (tâche ${t.taskId})`,
      });

      await patch('resp', `${T_(c1)}/${t.id}`, { statut: 'A_FAIRE' }).expect(200);
      const re = await patch('resp', `${T_(c1)}/${t.id}`, { statut: 'TERMINEE', dateFinLocale: JOUR, heureFinLocale: '17:10' }).expect(200);
      expect(re.body.saisieAuto).toMatchObject({ creee: false, motif: 'DEJA_SAISI' });
      expect(await ds.query(`SELECT id FROM saisies_temps WHERE "taskId" = $1`, [t.id])).toHaveLength(1);
    });

    it('le temps déjà saisi depuis le minuteur de la tâche est déduit', async () => {
      const { body: t } = await post('resp', T_(c1), { titre: 'TVA', type: 'TVA', assigneeId: resp.id }).expect(201);
      await ds.query(`UPDATE tasks SET "tempsTotalSecondes" = 7200, statut = 'EN_PAUSE' WHERE id = $1`, [t.id]);
      await post('resp', '/api/saisies-temps', { date: JOUR, dureeHeures: 1.25, type: 'FACTURABLE', clientId: c1.id, taskId: t.id }).expect(201);
      const { body } = await patch('resp', `${T_(c1)}/${t.id}`, { statut: 'TERMINEE', dateFinLocale: JOUR, heureFinLocale: '18:00' }).expect(200);
      expect(body.saisieAuto).toMatchObject({ creee: true, dureeHeures: 0.75 });
    });

    it('refus du contrôle de pointage : la tâche est terminée quand même, le motif est renvoyé', async () => {
      const jour = '2025-03-05';
      await ds.getRepository(Pointage).save({
        userId: resp.id, tenantId: T.id, date: jour,
        heureArrivee: new Date(`${jour}T05:00:00Z`), heureDepart: new Date(`${jour}T06:00:00Z`),
      } as any);
      const { body: t } = await post('resp', T_(c1), { titre: 'Longue tâche', assigneeId: resp.id }).expect(201);
      await ds.query(`UPDATE tasks SET "tempsTotalSecondes" = 10800 WHERE id = $1`, [t.id]);
      const { body } = await patch('resp', `${T_(c1)}/${t.id}`, { statut: 'TERMINEE', dateFinLocale: jour, heureFinLocale: '12:00' }).expect(200);
      expect(body.statut).toBe('TERMINEE');
      expect(body.saisieAuto).toMatchObject({ creee: false, motif: 'REFUSEE' });
      expect(body.saisieAuto.message).toContain('Vous ne pouvez pas saisir plus de');
    });

    it('tâche sans dossier (route globale) : saisie non facturable ; heure de fin validée', async () => {
      const { body: t } = await post('resp', '/api/tasks', { titre: 'Veille réglementaire', assigneeId: resp.id }).expect(201);
      await ds.query(`UPDATE tasks SET "tempsTotalSecondes" = 1800 WHERE id = $1`, [t.id]);
      await patch('resp', `/api/tasks/${t.id}`, { statut: 'TERMINEE', heureFinLocale: '25:00' }).expect(400);
      const { body } = await patch('resp', `/api/tasks/${t.id}`, { statut: 'TERMINEE', dateFinLocale: JOUR, heureFinLocale: '09:00' }).expect(200);
      expect(body.saisieAuto).toMatchObject({ creee: true, dureeHeures: 0.5 });
      const [s] = await ds.query(`SELECT type, categorie, "clientId" FROM saisies_temps WHERE "taskId" = $1`, [t.id]);
      expect(s).toEqual({ type: 'NON_FACTURABLE', categorie: 'AUTRE', clientId: null });
    });
  });
});
