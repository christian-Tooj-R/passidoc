import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Passidoc API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('doit rejeter une requête sans body (400)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .expect(400);
    });

    it('doit rejeter un email invalide (400)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'pasunemail', password: 'test123' })
        .expect(400);
    });

    it('doit rejeter des identifiants inconnus (401)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'inconnu@test.com', password: 'wrongpass123' })
        .expect(401);
    });
  });

  // ── Endpoints protégés sans token ─────────────────────────────────────────

  describe('Endpoints JWT protégés', () => {
    it('GET /api/clients doit renvoyer 401 sans token', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .expect(401);
    });

    it('GET /api/users doit renvoyer 401 sans token', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .expect(401);
    });

    it('GET /api/auth/me doit renvoyer 401 sans token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });
  });

  // ── Validation DTOs ───────────────────────────────────────────────────────

  describe('Validation des DTOs', () => {
    it('doit rejeter un login avec mot de passe trop court (400)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'ab' })
        .expect(400);
    });
  });

  // ── Routes inexistantes ───────────────────────────────────────────────────

  describe('Routes', () => {
    it('doit renvoyer 404 pour une route inexistante', () => {
      return request(app.getHttpServer())
        .get('/api/route-inexistante')
        .expect(404);
    });
  });
});
