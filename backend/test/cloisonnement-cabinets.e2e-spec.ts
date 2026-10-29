/**
 * Intégration de bout en bout — cloisonnement des dossiers entre cabinets : une route de
 * dossier (`clients/:clientId/…`, `clients/:id/…`) appelée avec le dossier d'un AUTRE cabinet
 * est refusée, en lecture comme en écriture (DossierCabinetInterceptor).
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

jest.setTimeout(60_000);

describe('Cloisonnement des dossiers entre cabinets (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const stamp = Date.now();
  const tenantIds: number[] = [];
  let T: TenantConfig, X: TenantConfig;
  let cT: Client;
  const tok: Record<string, string> = {};
  const slug: Record<string, string> = {};

  const appel = (who: string, verbe: 'get' | 'post' | 'patch' | 'delete', url: string, body?: any) => {
    const r = request(app.getHttpServer())[verbe](url).set('Authorization', `Bearer ${tok[who]}`).set('x-tenant-slug', slug[who]);
    return body ? r.send(body) : r;
  };

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
    T = await tenants.save(tenants.create({ slug: `zztest-cc-${stamp}`, nomSociete: 'ZZTEST Cabinet', isConfigured: true } as any) as any) as any;
    X = await tenants.save(tenants.create({ slug: `zztest-ccx-${stamp}`, nomSociete: 'ZZTEST Autre', isConfigured: true } as any) as any) as any;
    tenantIds.push(T.id, X.id);

    const users = ds.getRepository(User);
    for (const [nom, t] of [['adminT', T], ['adminX', X]] as const) {
      const u: User = await users.save(users.create({
        email: `zztest-${nom.toLowerCase()}-${stamp}@test.local`, password: 'secret-hash-zz', firstName: 'ZZ', lastName: nom,
        role: UserRole.ADMIN, site: UserSite.EST, tenantId: t.id, isActive: true,
      }));
      tok[nom] = jwt.sign({ sub: u.id, email: u.email, role: u.role, tenantId: u.tenantId });
      slug[nom] = t.slug!;
    }
    cT = await ds.getRepository(Client).save(ds.getRepository(Client).create({ nom: 'ZZ DOSSIER T', site: ClientSite.EST, tenantId: T.id, isActive: true }));
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const t = tenantIds.length ? tenantIds : [0];
      await ds.query(`DELETE FROM clients WHERE "tenantId" = ANY($1)`, [t]);
      await ds.query(`DELETE FROM users WHERE "tenantId" = ANY($1)`, [t]);
      await ds.query(`DELETE FROM tenant_config WHERE id = ANY($1)`, [t]);
    }
    await app?.close();
  });

  // Routes qui ne recevaient pas l'utilisateur (aucun contrôle de cabinet avant le correctif).
  const routes = (): [string, 'get' | 'post' | 'patch' | 'delete', string, any?][] => [
    ['fiche identité', 'get', `/api/clients/${cT.id}/fiche-identite`],
    ['flux mensuels', 'get', `/api/clients/${cT.id}/flux`],
    ['alertes flux', 'get', `/api/clients/${cT.id}/flux/alertes`],
    ['exercices', 'get', `/api/clients/${cT.id}/exercices`],
    ['salariés du client', 'get', `/api/clients/${cT.id}/salaries`],
    ['objectifs (écriture)', 'patch', `/api/clients/${cT.id}/objectifs`, {}],
    ['directeur du dossier (écriture)', 'patch', `/api/clients/${cT.id}/assign-directeur`, { directeurId: null }],
  ];

  it('le dossier d\'un autre cabinet est refusé (403) sur toutes ces routes', async () => {
    for (const [nom, verbe, url, body] of routes()) {
      const r = await appel('adminX', verbe, url, body);
      expect([nom, r.status]).toEqual([nom, 403]);
    }
  });

  it('le cabinet du dossier y accède toujours', async () => {
    for (const [nom, verbe, url] of routes().filter(r => r[1] === 'get')) {
      const r = await appel('adminT', verbe, url);
      // Dossier vierge : la fiche identité n'existe pas encore (404 du service, pas un refus).
      const attendu = nom === 'fiche identité' ? 'Fiche identité introuvable' : 200;
      expect([nom, r.status === 200 ? 200 : r.body.message]).toEqual([nom, attendu]);
    }
  });

  it('dossier inexistant : 404', async () => {
    await appel('adminT', 'get', '/api/clients/999999999/fiche-identite').expect(404);
  });
});
