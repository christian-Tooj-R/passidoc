/**
 * Intégration de bout en bout — emails de l'authentification : casse des adresses (saisie
 * « Julie.R@… » des claviers mobiles), unicité globale de l'email et échec d'envoi Gmail.
 *
 * Application complète sur la base de .env (base locale), dans deux tenants temporaires
 * ZZTEST supprimés à la fin. MailService remplacé : aucun email n'est envoyé.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { TenantConfig } from '../src/entities/tenant-config.entity';
import { User, UserRole, UserSite } from '../src/entities/user.entity';

jest.setTimeout(60_000);

describe('Authentification — casse des emails et échec d\'envoi (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const tenantIds: number[] = [];
  let T: TenantConfig, X: TenantConfig;
  let adminT: User, adminX: User;
  let tokAdminT: string;
  const mail = {
    sendEmailVerificationCode: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
  };

  const http = () => request(app.getHttpServer());
  const post = (url: string, body: any, slug = T.slug!) => http().post(url).set('x-tenant-slug', slug).send(body);
  const code = async (email: string) =>
    (await ds.query(`SELECT code FROM password_reset_token WHERE email = $1 AND used = false ORDER BY id DESC LIMIT 1`, [email]))[0]?.code;
  const emailEnBase = async (id: number) => (await ds.query(`SELECT email FROM users WHERE id = $1`, [id]))[0]?.email;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService).useValue(mail)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource);

    const tenants = ds.getRepository(TenantConfig);
    T = await tenants.save(tenants.create({ slug: `zztest-ae-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;
    X = await tenants.save(tenants.create({ slug: `zztest-aex-${stamp}`, nomSociete: 'ZZTEST Autre', isConfigured: true } as any) as any) as any;
    tenantIds.push(T.id, X.id);

    const users = ds.getRepository(User);
    const mk = (nom: string, tenantId: number) => users.save(users.create({
      email: `zztest-${nom}-${stamp}@test.local`, password: 'secret-hash-zz', firstName: 'ZZ', lastName: nom,
      role: UserRole.ADMIN, site: UserSite.EST, tenantId, isActive: true,
    }));
    adminT = await mk('admint', T.id);
    adminX = await mk('adminx', X.id);
    tokAdminT = app.get(JwtService).sign({ sub: adminT.id, email: adminT.email, role: adminT.role, tenantId: T.id });
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const t = tenantIds.length ? tenantIds : [0];
      await ds.query(`DELETE FROM password_reset_token WHERE "tenantId" = ANY($1)`, [t]);
      await ds.query(`DELETE FROM users WHERE "tenantId" = ANY($1)`, [t]);
      await ds.query(`DELETE FROM tenant_config WHERE id = ANY($1)`, [t]);
    }
    await app?.close();
  });

  const saisie = () => `ZZ.Casse-${stamp}@Test.Local`;
  const minuscules = () => saisie().toLowerCase();

  it('inscription « ZZ.Casse@Test.Local » : enregistrée en minuscules, code envoyé', async () => {
    const r = await post('/api/auth/register', { firstName: 'Zz', lastName: 'Casse', email: saisie(), password: 'MotDePasse1!', site: 'EST' }).expect(201);
    expect(r.body.emailSent).toBe(true);
    const [u] = await ds.query(`SELECT email, "isActive" FROM users WHERE "tenantId" = $1 AND "lastName" = 'Casse'`, [T.id]);
    expect(u).toEqual({ email: minuscules(), isActive: false });
  });

  it('réinscription avec une autre casse : 409 « déjà utilisé dans ce cabinet »', async () => {
    const r = await post('/api/auth/register', { firstName: 'Zz', lastName: 'Casse', email: minuscules(), password: 'MotDePasse1!', site: 'EST' }).expect(409);
    expect(r.body.message).toBe('Cet email est déjà utilisé dans ce cabinet');
  });

  it('email déjà pris dans un AUTRE cabinet : 409 clair, plus d\'erreur 500 (email unique sur toute la base)', async () => {
    const r = await post('/api/auth/register', { firstName: 'Zz', lastName: 'Autre', email: adminX.email.toUpperCase(), password: 'MotDePasse1!', site: 'EST' }).expect(409);
    expect(r.body.message).toBe('Cet email est déjà utilisé');
  });

  it('validation du code avec la casse saisie : le compte est bien activé, puis connexion en MAJUSCULES', async () => {
    await post('/api/auth/verify-email', { email: saisie(), code: await code(minuscules()) }).expect(200);
    const [u] = await ds.query(`SELECT "isActive" FROM users WHERE email = $1`, [minuscules()]);
    expect(u.isActive).toBe(true);

    const r = await post('/api/auth/login', { email: saisie().toUpperCase(), password: 'MotDePasse1!' }).expect(200);
    expect(r.body.access_token).toBeTruthy();
  });

  it('compte ancien enregistré avec des majuscules : connexion, mot de passe oublié et réinitialisation', async () => {
    const ancien = `ZZ.Ancien-${stamp}@Test.Local`;
    // Insertion SQL directe : simule un compte créé avant la normalisation des emails.
    await ds.query(
      `INSERT INTO users (email, password, "firstName", "lastName", role, site, "tenantId", "isActive") VALUES ($1, $2, 'Zz', 'Ancien', 'COLLABORATEUR', 'EST', $3, true)`,
      [ancien, await bcrypt.hash('AncienMdp1!', 10), T.id]);

    await post('/api/auth/login', { email: ancien.toLowerCase(), password: 'AncienMdp1!' }).expect(200);

    mail.sendPasswordResetCode.mockClear();
    await post('/api/auth/forgot-password', { email: ancien.toLowerCase() }).expect(200);
    expect(mail.sendPasswordResetCode).toHaveBeenCalledWith(expect.objectContaining({ to: ancien }));

    await post('/api/auth/reset-password', { email: ancien, code: await code(ancien.toLowerCase()), newPassword: 'NouveauMdp1!' }).expect(200);
    await post('/api/auth/login', { email: ancien, password: 'NouveauMdp1!' }).expect(200);
  });

  it('Gmail en échec : « mot de passe oublié » et « renvoyer le code » répondent 503 avec un message clair', async () => {
    mail.sendPasswordResetCode.mockRejectedValueOnce(new Error('invalid_grant'));
    const r1 = await post('/api/auth/forgot-password', { email: adminT.email }).expect(503);
    expect(r1.body.message).toContain('L\'envoi de l\'email a échoué');

    await ds.query(`UPDATE users SET "isActive" = false WHERE email = $1`, [minuscules()]);
    mail.sendEmailVerificationCode.mockRejectedValueOnce(new Error('invalid_grant'));
    const r2 = await post('/api/auth/resend-verification', { email: minuscules() }).expect(503);
    expect(r2.body.message).toContain('L\'envoi de l\'email a échoué');
  });

  it('création par l\'admin : email d\'un autre cabinet → 409 (plus 500), email en majuscules → stocké en minuscules', async () => {
    const admin = (body: any) => http().post('/api/users').set('Authorization', `Bearer ${tokAdminT}`).set('x-tenant-slug', T.slug!).send(body);
    const base = { firstName: 'Zz', lastName: 'Cree', password: 'MotDePasse1!', role: 'COLLABORATEUR', site: 'EST' };

    const r = await admin({ ...base, email: adminX.email }).expect(409);
    expect(r.body.message).toBe('Email déjà utilisé');

    const ok = await admin({ ...base, email: `ZZ.Cree-${stamp}@Test.Local` }).expect(201);
    expect(await emailEnBase(ok.body.id)).toBe(`zz.cree-${stamp}@test.local`);

    // Modification vers l'email d'un collègue : 409 au lieu de la violation d'unicité (500).
    await http().patch(`/api/users/${ok.body.id}`).set('Authorization', `Bearer ${tokAdminT}`).set('x-tenant-slug', T.slug!)
      .send({ email: adminT.email.toUpperCase() }).expect(409);
  });
});
