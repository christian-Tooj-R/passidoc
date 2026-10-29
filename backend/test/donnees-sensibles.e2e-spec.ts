/**
 * Intégration de bout en bout — données sensibles des utilisateurs dans les réponses de l'API :
 * secrets (hash du mot de passe, secret 2FA) jamais renvoyés, paie (salaire, banque, IBAN,
 * tarif de vente) réservée à l'ADMIN et à l'intéressé (politique RH), état civil jamais
 * renvoyé pour un utilisateur imbriqué (assignee d'une tâche…).
 *
 * Application complète sur la base de .env (base locale), dans un tenant temporaire ZZTEST
 * supprimé à la fin.
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
import { Task } from '../src/entities/task.entity';

jest.setTimeout(60_000);

const PAIE = ['salaireBase', 'modePaiement', 'banque', 'iban', 'prixVenteHoraire'];
const SECRETS = ['password', 'twoFactorSecret'];
const ETAT_CIVIL = ['numeroSS', 'numeroCIN', 'numeroFiscal', 'dateNaissance', 'adresse'];

describe('Données sensibles des utilisateurs dans les réponses (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  let T: TenantConfig;
  let admin: User, collab: User, collegue: User;
  const tok: Record<string, string> = {};

  const get = (who: string, url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${tok[who]}`).set('x-tenant-slug', T.slug!);

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
    T = await tenants.save(tenants.create({ slug: `zztest-ds-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;

    const users = ds.getRepository(User);
    const mk = async (nom: string, role: UserRole, site: UserSite) => {
      const u: User = await users.save(users.create({
        email: `zztest-${nom}-${stamp}@test.local`, password: 'secret-hash-zz', twoFactorSecret: 'ZZSECRET2FA',
        firstName: 'ZZ', lastName: nom, role, site, tenantId: T.id, isActive: true,
        salaireBase: 3210, modePaiement: 'VIREMENT', banque: 'ZZ Banque', iban: 'FR7600000000000000000000000',
        prixVenteHoraire: 95, numeroSS: '1990199999999', numeroCIN: 'ZZCIN', numeroFiscal: 'ZZFISC',
        dateNaissance: '1990-01-01', adresse: '1 rue ZZ',
      } as Partial<User>));
      tok[nom] = jwt.sign({ sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId });
      return u;
    };
    admin = await mk('admin', UserRole.ADMIN, UserSite.EST);
    collab = await mk('collab', UserRole.COLLABORATEUR, UserSite.EST);
    // Pôle opposé : c'est l'équipe que `assignable` renvoie au collaborateur.
    collegue = await mk('collegue', UserRole.COLLABORATEUR, UserSite.OUEST);

    const tasks = ds.getRepository(Task);
    await tasks.save(tasks.create({
      titre: 'ZZ tâche', tenantId: T.id, assignee: collab, createdBy: admin, heureDebut: new Date(),
    } as any));
  });

  afterAll(async () => {
    if (ds?.isInitialized && T) {
      await ds.query(`DELETE FROM tasks WHERE "tenantId" = $1`, [T.id]);
      await ds.query(`DELETE FROM users WHERE "tenantId" = $1`, [T.id]);
      await ds.query(`DELETE FROM tenant_config WHERE id = $1`, [T.id]);
    }
    await app?.close();
  });

  const fiche = (liste: any[], u: User) => liste.find(x => x.id === u.id);
  const absents = (o: any, champs: string[]) => champs.filter(c => o?.[c] != null);

  it.each(['/api/users', '/api/users/org-chart', '/api/users/assignable'])(
    '%s vu par un collaborateur : paie des collègues masquée, la sienne visible, aucun secret', async (url) => {
      const r = await get('collab', url).expect(200);
      const autre = fiche(r.body, url.endsWith('assignable') ? collegue : admin);
      expect(autre).toBeTruthy();
      expect(absents(autre, [...PAIE, ...SECRETS])).toEqual([]);
      const moi = fiche(r.body, collab);
      expect(Number(moi.salaireBase)).toBe(3210);
      expect(absents(moi, SECRETS)).toEqual([]);
    });

  it('/api/users vu par l\'ADMIN : la paie de chacun reste visible', async () => {
    const r = await get('admin', '/api/users').expect(200);
    expect(fiche(r.body, collab)).toMatchObject({ salaireBase: '3210.00', iban: 'FR7600000000000000000000000' });
  });

  it('utilisateur imbriqué (assignee / createdBy d\'une tâche) : identité seulement', async () => {
    const r = await get('admin', '/api/tasks').expect(200);
    const t = r.body.find((x: any) => x.titre === 'ZZ tâche');
    for (const u of [t.assignee, t.createdBy]) {
      expect(u).toMatchObject({ firstName: 'ZZ' });
      expect(absents(u, [...SECRETS, ...PAIE, ...ETAT_CIVIL])).toEqual([]);
    }
  });
});
