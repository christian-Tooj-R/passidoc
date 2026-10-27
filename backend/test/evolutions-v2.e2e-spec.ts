/**
 * Intégration de bout en bout — évolutions v2 du cahier AFYM :
 *  #1 pièces manquantes et relances clients · #2 double contact · #3 approche client
 *  #5 pôle de travail des saisies · #7 intitulés des intervenants
 * + correctifs de sécurité trouvés en route (agenda des collègues, alertes globales).
 *
 * Application complète sur la base de .env (base locale), dans deux tenants temporaires
 * ZZTEST supprimés à la fin. Le service d'e-mail est remplacé par un double : aucun envoi réel.
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
import { FicheIdentite } from '../src/entities/fiche-identite.entity';
import { FluxMensuel, StatutDepot } from '../src/entities/flux-mensuel.entity';
import { SaisieTemps } from '../src/entities/saisie-temps.entity';
import { SuiviPiecesService } from '../src/suivi-pieces/suivi-pieces.service';

jest.setTimeout(60_000);

describe('Évolutions v2 — contacts, approche, pôle de travail, pièces manquantes (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const ids = { tenants: [] as number[], users: [] as number[], clients: [] as number[] };
  const tok: Record<string, string> = {};
  let T: TenantConfig, X: TenantConfig;
  let admin: User, resp: User, ouest: User, adminX: User;
  let c1: Client, c2: Client, cx: Client;
  const ANNEE = new Date().getFullYear() - 2; // année entièrement échue : tests indépendants de la date du jour
  const mail = { sendRelancePiecesClient: jest.fn().mockResolvedValue(undefined) };

  const http = () => request(app.getHttpServer());
  const as = (who: string, slug = T.slug) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${tok[who]}`).set('x-tenant-slug', slug!);
  const get = (who: string, url: string) => as(who)(http().get(url));
  const post = (who: string, url: string, body: any) => as(who)(http().post(url).send(body));
  const patch = (who: string, url: string, body: any) => as(who)(http().patch(url).send(body));

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService).useValue(mail)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource);
    const jwt = app.get(JwtService);

    const tenants = ds.getRepository(TenantConfig);
    T = await tenants.save(tenants.create({ slug: `zztest-v2-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;
    X = await tenants.save(tenants.create({ slug: `zztest-v2x-${stamp}`, nomSociete: 'ZZTEST Autre', isConfigured: true } as any) as any) as any;
    ids.tenants.push(T.id, X.id);

    const users = ds.getRepository(User);
    const mk = async (nom: string, role: UserRole, tenantId: number, site = UserSite.EST) => {
      const u = await users.save(users.create({
        email: `zztest-${nom}-${stamp}@test.local`, password: 'secret-hash-zz', firstName: 'ZZ', lastName: nom,
        role, site, tenantId, isActive: true,
      }));
      ids.users.push(u.id);
      tok[nom] = jwt.sign({ sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId });
      return u;
    };
    admin = await mk('admin', UserRole.ADMIN, T.id);
    resp = await mk('resp', UserRole.COLLABORATEUR, T.id);
    ouest = await mk('ouest', UserRole.COLLABORATEUR, T.id, UserSite.OUEST);
    adminX = await mk('adminX', UserRole.ADMIN, X.id);

    const clients = ds.getRepository(Client);
    c1 = await clients.save(clients.create({
      nom: 'ZZ TRANSMAS', site: ClientSite.EST, tenantId: T.id, responsableId: resp.id, directeurId: admin.id,
      isActive: true, typesFluxActifs: ['RELEVE_BANCAIRE'] as any,
    }));
    c2 = await clients.save(clients.create({ nom: 'ZZ SANS SUIVI', site: ClientSite.OUEST, tenantId: T.id, responsableId: ouest.id, isActive: true }));
    cx = await clients.save(clients.create({ nom: 'ZZ AUTRE CABINET', site: ClientSite.EST, tenantId: X.id, isActive: true }));
    ids.clients.push(c1.id, c2.id, cx.id);
    await ds.getRepository(FicheIdentite).save([
      { client: { id: c1.id }, raisonSociale: 'ZZ TRANSMAS', gerants: [{ nom: 'DUPONT Paul' }] } as any,
      { client: { id: c2.id } } as any,
    ]);
    // Relevés bancaires de l'année : janvier → octobre déposés, novembre absent, décembre en retard.
    const flux = ds.getRepository(FluxMensuel);
    await flux.save([
      ...Array.from({ length: 10 }, (_, i) => flux.create({ type: 'RELEVE_BANCAIRE', mois: i + 1, annee: ANNEE, statut: StatutDepot.DEPOSE, client: { id: c1.id } as any })),
      flux.create({ type: 'RELEVE_BANCAIRE', mois: 12, annee: ANNEE, statut: StatutDepot.EN_RETARD, client: { id: c1.id } as any }),
      flux.create({ type: 'PAIE', mois: 3, annee: ANNEE, statut: StatutDepot.MANQUANT, client: { id: cx.id } as any }),
    ]);
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const u = ids.users.length ? ids.users : [0];
      const c = ids.clients.length ? ids.clients : [0];
      await ds.query(`DELETE FROM dossier_messages WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM flux_mensuels WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM notifications WHERE "userId" = ANY($1)`, [u]);
      await ds.query(`DELETE FROM saisies_temps WHERE "collaborateurId" = ANY($1) OR "clientId" = ANY($2)`, [u, c]);
      await ds.query(`DELETE FROM fiche_identite WHERE "clientId" = ANY($1)`, [c]);
      await ds.query(`DELETE FROM clients WHERE id = ANY($1)`, [c]);
      await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [u]);
      await ds.query(`DELETE FROM tenant_config WHERE id = ANY($1)`, [ids.tenants.length ? ids.tenants : [0]]);
    }
    await app?.close();
  });

  beforeEach(() => mail.sendRelancePiecesClient.mockClear());

  describe('#2 / #3 — contacts et approche client (fiche identité)', () => {
    it('une fiche sans réglage a l’approche « Professionnel » par défaut', async () => {
      const { body } = await get('admin', `/api/clients/${c2.id}/fiche-identite`).expect(200);
      expect(body.approcheClient).toBe('PROFESSIONNEL');
      expect(body.contactOperationnel).toBeNull();
    });

    it('enregistre le contact légal, le contact opérationnel et l’approche', async () => {
      await patch('resp', `/api/clients/${c1.id}/fiche-identite`, {
        contactLegalNom: 'DUPONT Paul', contactLegalFonction: 'Gérant', emailContact: 'gerant@zztest.local',
        contactOperationnel: { nom: 'Sophie Hoarau', poste: 'Assistante', telephone: '0262 11 22 33', email: 'compta@zztest.local' },
        approcheClient: 'FORMEL',
      }).expect(200);
      const { body } = await get('resp', `/api/clients/${c1.id}/fiche-identite`).expect(200);
      expect(body).toMatchObject({
        contactLegalNom: 'DUPONT Paul', contactLegalFonction: 'Gérant', emailContact: 'gerant@zztest.local', approcheClient: 'FORMEL',
        contactOperationnel: { nom: 'Sophie Hoarau', poste: 'Assistante', telephone: '0262 11 22 33', email: 'compta@zztest.local' },
      });
    });

    it('refuse une approche inconnue, un e-mail opérationnel invalide ou un champ non prévu', async () => {
      await patch('resp', `/api/clients/${c1.id}/fiche-identite`, { approcheClient: 'SYMPA' }).expect(400);
      await patch('resp', `/api/clients/${c1.id}/fiche-identite`, { contactOperationnel: { email: 'pas-un-mail' } }).expect(400);
      await patch('resp', `/api/clients/${c1.id}/fiche-identite`, { contactOperationnel: { fax: '0262' } }).expect(400);
    });

    it('un collaborateur non intervenant ne peut pas modifier les contacts', async () => {
      await patch('ouest', `/api/clients/${c1.id}/fiche-identite`, { approcheClient: 'AMICAL' }).expect(403);
    });
  });

  describe('#7 — intitulés des intervenants', () => {
    it('le cabinet a des libellés de rôle distincts des libellés de pôle', async () => {
      const { body } = await as('admin')(http().get('/api/tenant/config')).expect(200);
      expect(body).toMatchObject({
        poleLabel1: 'Pôle EST', poleLabel2: 'Pôle OUEST',
        intervenantLabel1: 'Collaborateur Réunion', intervenantLabel2: 'Collaborateur Madagascar',
      });
    });
  });

  describe('#5 — pôle de travail des saisies', () => {
    let idEst: number;

    it('par défaut : le site du collaborateur (Est / Ouest)', async () => {
      const est = await post('resp', '/api/saisies-temps', { date: '2026-03-02', dureeHeures: 2, type: 'FACTURABLE', clientId: c1.id }).expect(201);
      const oue = await post('ouest', '/api/saisies-temps', { date: '2026-03-02', dureeHeures: 1, type: 'NON_FACTURABLE', categorie: 'AUTRE' }).expect(201);
      expect(est.body.lieuTravail).toBe('EST');
      expect(oue.body.lieuTravail).toBe('OUEST');
      idEst = est.body.id;
    });

    it('choix explicite « Hors bureau », valeur inconnue refusée', async () => {
      const { body } = await post('resp', '/api/saisies-temps', { date: '2026-03-03', dureeHeures: 3, type: 'FACTURABLE', clientId: c1.id, lieuTravail: 'HORS_BUREAU' }).expect(201);
      expect(body.lieuTravail).toBe('HORS_BUREAU');
      await post('resp', '/api/saisies-temps', { date: '2026-03-03', dureeHeures: 1, type: 'FACTURABLE', lieuTravail: 'MARS' }).expect(400);
    });

    it('modification : changé si fourni, conservé sinon', async () => {
      await patch('resp', `/api/saisies-temps/${idEst}`, { lieuTravail: 'OUEST' }).expect(200);
      await patch('resp', `/api/saisies-temps/${idEst}`, { commentaire: 'ZZTEST' }).expect(200);
      expect((await ds.getRepository(SaisieTemps).findOneByOrFail({ id: idEst })).lieuTravail).toBe('OUEST');
    });

    it('le rapport « Détail des temps » expose le pôle de chaque ligne', async () => {
      const { body } = await get('admin', `/api/saisies-temps/rapport/detail?dateDebut=2026-03-01&dateFin=2026-03-31`).expect(200);
      const lieux = body.lignes.filter((l: any) => l.source === 'SAISIE').map((l: any) => l.lieuTravail).sort();
      expect(lieux).toEqual(['HORS_BUREAU', 'OUEST', 'OUEST']);
    });

    it('sécurité : l’agenda d’un collègue ne renvoie que son identité (ni mot de passe, ni données RH)', async () => {
      const { body } = await get('ouest', `/api/saisies-temps/tenant?debut=2026-03-01&fin=2026-03-31&collaborateurId=${resp.id}`).expect(200);
      expect(body.length).toBeGreaterThan(0);
      for (const s of body) {
        expect(Object.keys(s.collaborateur).sort()).toEqual(['firstName', 'id', 'lastName', 'site']);
        if (s.client) expect(Object.keys(s.client).sort()).toEqual(['id', 'nom', 'site']);
      }
      expect(JSON.stringify(body)).not.toContain('secret-hash-zz');
    });
  });

  describe('#1 — pièces manquantes et relances', () => {
    it('tableau de bord : complétude, pièces manquantes et indicateur par dossier', async () => {
      const { body } = await get('admin', `/api/suivi-pieces?annee=${ANNEE}`).expect(200);
      expect(body).toMatchObject({ annee: ANNEE, delaiJours: 15, relanceAutoActive: false });
      const l1 = body.lignes.find((l: any) => l.clientId === c1.id);
      expect(l1).toMatchObject({ indicateur: 'ROUGE', attendus: 12, deposes: 10, taux: 83, approche: 'FORMEL' });
      expect(l1.manquantes.map((p: any) => [p.mois, p.statut])).toEqual(expect.arrayContaining([[11, 'MANQUANT'], [12, 'EN_RETARD']]));
      expect(l1.destinataire).toEqual({ nom: 'Sophie Hoarau', email: 'compta@zztest.local', role: 'OPERATIONNEL' });
      expect(body.lignes.find((l: any) => l.clientId === c2.id).indicateur).toBe('NON_SUIVI');
      expect(body.lignes.some((l: any) => l.clientId === cx.id)).toBe(false);
    });

    it('un collaborateur ne voit que ses dossiers, un autre cabinet aucun', async () => {
      const r = await get('ouest', `/api/suivi-pieces?annee=${ANNEE}`).expect(200);
      expect(r.body.lignes.map((l: any) => l.clientId)).toEqual([c2.id]);
      const x = await as('adminX', X.slug)(http().get(`/api/suivi-pieces?annee=${ANNEE}`)).expect(200);
      expect(x.body.lignes.map((l: any) => l.clientId)).toEqual([cx.id]);
    });

    it('aperçu : relance rédigée selon l’approche du client', async () => {
      const formel = await get('resp', `/api/clients/${c1.id}/suivi-pieces/relance?annee=${ANNEE}`).expect(200);
      expect(formel.body.objet).toContain('Documents comptables manquants');
      expect(formel.body.texte).toMatch(/^Madame, Monsieur,/);
      expect(formel.body.texte).toContain('Relevés bancaires');
      expect(formel.body.texte).toContain('salutations distinguées');

      await patch('resp', `/api/clients/${c1.id}/fiche-identite`, { approcheClient: 'INFORMEL' }).expect(200);
      const informel = await get('resp', `/api/clients/${c1.id}/suivi-pieces/relance?annee=${ANNEE}`).expect(200);
      expect(informel.body.texte).toMatch(/^Bonjour Sophie,/);
      expect(informel.body.texte).toContain('ta compta');
    });

    it('envoi : e-mail au contact opérationnel, relance notée sur la grille et dans le fil du dossier', async () => {
      const { body } = await post('resp', `/api/clients/${c1.id}/suivi-pieces/relance?annee=${ANNEE}`, { texte: 'Bonjour Sophie,\n\nTexte relu ZZTEST' }).expect(201);
      expect(body).toMatchObject({ envoyeA: 'compta@zztest.local', nbPieces: 2 });
      expect(mail.sendRelancePiecesClient).toHaveBeenCalledWith(expect.objectContaining({
        to: 'compta@zztest.local', texte: 'Bonjour Sophie,\n\nTexte relu ZZTEST', cabinet: 'ZZTEST Cabinet',
      }));
      const lignes = await ds.query(
        `SELECT mois, statut, "dateRelance" FROM flux_mensuels WHERE "clientId" = $1 AND annee = $2 AND mois IN (11, 12) ORDER BY mois`, [c1.id, ANNEE]);
      expect(lignes.map((l: any) => [l.mois, l.statut, !!l.dateRelance])).toEqual([[11, 'MANQUANT', true], [12, 'EN_RETARD', true]]);
      const msg = await ds.query(`SELECT contenu FROM dossier_messages WHERE "clientId" = $1`, [c1.id]);
      expect(msg[0].contenu).toContain('compta@zztest.local');
    });

    it('refus : dossier sans adresse e-mail, ou dossier d’un autre cabinet', async () => {
      await ds.getRepository(Client).update(c2.id, { typesFluxActifs: ['PAIE'] as any });
      const r = await post('ouest', `/api/clients/${c2.id}/suivi-pieces/relance?annee=${ANNEE}`, {}).expect(400);
      expect(r.body.message).toContain('contact opérationnel');
      await as('adminX', X.slug)(http().post(`/api/clients/${c1.id}/suivi-pieces/relance`).send({})).expect(403);
      expect(mail.sendRelancePiecesClient).not.toHaveBeenCalled();
    });

    it('relance automatique : seulement si activée, et au plus une fois par délai', async () => {
      const svc = app.get(SuiviPiecesService);
      const destinatairesAuto = async () => {
        mail.sendRelancePiecesClient.mockClear();
        await svc.relancesAutomatiques();
        return mail.sendRelancePiecesClient.mock.calls.map(c => c[0].to);
      };
      // Année en cours : relevé de janvier manquant (échu depuis le 1er février).
      const annee = new Date().getFullYear();
      await ds.getRepository(FluxMensuel).save({ type: 'RELEVE_BANCAIRE', mois: 1, annee, statut: StatutDepot.MANQUANT, client: { id: c1.id } } as any);
      expect(await destinatairesAuto()).not.toContain('compta@zztest.local'); // désactivée par défaut
      await ds.getRepository(TenantConfig).update(T.id, { relanceAutoActive: true, relanceDelaiJours: 1 });
      try {
        if (new Date() >= new Date(annee, 1, 3)) {
          expect(await destinatairesAuto()).toContain('compta@zztest.local');
          expect(await destinatairesAuto()).not.toContain('compta@zztest.local'); // déjà relancé aujourd'hui
        }
      } finally {
        await ds.getRepository(TenantConfig).update(T.id, { relanceAutoActive: false });
      }
    });

    it('sécurité : les alertes globales ne montrent que les dossiers du cabinet', async () => {
      const { body } = await get('admin', '/api/alertes').expect(200);
      expect(body.some((f: any) => f.client?.id === cx.id)).toBe(false);
      const x = await as('adminX', X.slug)(http().get('/api/alertes')).expect(200);
      expect(x.body.every((f: any) => f.client?.tenantId === X.id)).toBe(true);
      expect(x.body.some((f: any) => f.client?.id === cx.id)).toBe(true);
    });
  });
});
