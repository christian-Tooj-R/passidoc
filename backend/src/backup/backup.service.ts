import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { Response } from 'express';

/**
 * Tables possédant leur propre colonne `tenantId` — filtrage direct.
 * Vérifié par introspection du schéma (information_schema.columns) le 2026-10-07.
 */
const DIRECT_TENANT_TABLES = [
  'audit_logs', 'balance_mensuelle', 'budgets_missions', 'clients',
  'conges_absences', 'dossier_messages', 'espaces', 'exercices_rh',
  'incoherences_pointage', 'paie_bulletins', 'paie_employes_clients',
  'paie_parametres', 'paie_rh_acomptes', 'paie_rh_activite_jour',
  'paie_rh_bulletins', 'paie_rh_constantes', 'paie_rh_contrats',
  'paie_rh_cycles', 'paie_rh_parametres', 'paie_rh_rubriques',
  'paie_rh_variables', 'paie_rubriques', 'paie_variables_mensuelles',
  'password_reset_token', 'pointages', 'saisies_temps', 'secteurs',
  'soldes_conges', 'taches_recurrentes', 'tasks', 'users',
];

/**
 * Tables sans colonne `tenantId` propre, scopées via une relation vers une
 * table de la liste ci-dessus (ou chaînée sur 2 sauts). Vérifié manuellement
 * table par table contre le schéma réel — voir conversation du 2026-10-07.
 */
const INDIRECT_SCOPE: Record<string, string> = {
  analyses_strategiques:        '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  canvas:                       '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  controle_interne:             '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  conversations_ia:             '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  documents:                    '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  dossiers_travail:             '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  exercices:                    '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  fiche_identite:               '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  flux_mensuels:                '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  fournisseurs:                 '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  missions:                     '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  objectifs_client:             '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  questionnaires_adn_global:    '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  questionnaires_adn_sectoriel: '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  salaries_dossier:             '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  syntheses_cloture:            '"clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1)',
  notes:                        '"userId" IN (SELECT id FROM users WHERE "tenantId" = $1)',
  notifications:                '"userId" IN (SELECT id FROM users WHERE "tenantId" = $1)',
  cycles_revision:              '"dossierTravailId" IN (SELECT id FROM dossiers_travail WHERE "clientId" IN (SELECT id FROM clients WHERE "tenantId" = $1))',
  espace_docs:                  '"espaceId" IN (SELECT id FROM espaces WHERE "tenantId" = $1)',
  pause_pointages:              '"pointageId" IN (SELECT id FROM pointages WHERE "tenantId" = $1)',
  task_comments:                '"taskId" IN (SELECT id FROM tasks WHERE "tenantId" = $1)',
};

/** Tables sans notion de tenant (config partagée par toute l'instance) — exportées en entier. */
const GLOBAL_TABLES = ['role_permissions', 'site_locations'];

/**
 * Ordre d'export respectant les dépendances de clé étrangère (table parente
 * avant ses tables filles) — indispensable pour que le fichier généré soit
 * ré-importable tel quel sans violation de contrainte FK.
 */
const EXPORT_ORDER = [
  'tenant_config', 'role_permissions', 'site_locations', 'users', 'clients',
  'paie_employes_clients', 'dossiers_travail', 'espaces', 'pointages', 'tasks',
  'fiche_identite', 'analyses_strategiques', 'canvas', 'controle_interne',
  'conversations_ia', 'documents', 'exercices', 'flux_mensuels', 'fournisseurs',
  'missions', 'objectifs_client', 'questionnaires_adn_global',
  'questionnaires_adn_sectoriel', 'salaries_dossier', 'syntheses_cloture',
  'taches_recurrentes', 'saisies_temps', 'conges_absences', 'dossier_messages',
  'exercices_rh', 'incoherences_pointage', 'secteurs', 'soldes_conges',
  'audit_logs', 'balance_mensuelle', 'budgets_missions', 'notes',
  'notifications', 'password_reset_token', 'paie_bulletins', 'paie_parametres',
  'paie_rh_acomptes', 'paie_rh_activite_jour', 'paie_rh_bulletins',
  'paie_rh_constantes', 'paie_rh_contrats', 'paie_rh_cycles',
  'paie_rh_parametres', 'paie_rh_rubriques', 'paie_rh_variables',
  'paie_rubriques', 'paie_variables_mensuelles',
  'cycles_revision', 'espace_docs', 'pause_pointages', 'task_comments',
];

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private config: ConfigService,
  ) {}

  /**
   * Exporte toutes les données du tenant courant en un fichier .sql (INSERT
   * uniquement — pas de schéma), streamé directement dans la réponse HTTP.
   *
   * Portée volontairement limitée au tenant de l'admin qui appelle
   * l'endpoint : jamais d'export cross-tenant, même par un ADMIN (même règle
   * que partout ailleurs dans l'app — RH, congés, saisies de temps...).
   * Une table nouvellement ajoutée au schéma et absente des listes ci-dessus
   * est explicitement EXCLUE (avec un commentaire dans le fichier) plutôt que
   * silencieusement exportée sans filtre — fail-closed par sécurité.
   */
  async exportSql(tenantId: number, res: Response): Promise<void> {
    const write = (s: string) => res.write(s);
    const selfRefUpdates: { id: number; referentId: number }[] = [];

    write(`-- Export Passidoc — tenant ${tenantId} — ${new Date().toISOString()}\n`);
    write(`-- Export de DONNÉES uniquement (pas de schéma) — à restaurer sur une base\n`);
    write(`-- Passidoc déjà initialisée (schéma créé via l'app elle-même).\n\n`);
    write('BEGIN;\n\n');

    const allTables = await this.dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const knownTables = new Set(['tenant_config', ...DIRECT_TENANT_TABLES, ...Object.keys(INDIRECT_SCOPE), ...GLOBAL_TABLES]);
    const unknownTables: string[] = allTables
      .map((t: any) => t.tablename)
      .filter((t: string) => !knownTables.has(t));

    for (const table of EXPORT_ORDER) {
      const { whereSql, params } = this.getScope(table, tenantId);
      const count = await this.dumpTable(table, whereSql, params, write, selfRefUpdates);
      this.logger.log(`[Export SQL] ${table} : ${count} ligne(s)`);
    }

    if (selfRefUpdates.length) {
      write(`\n-- Rétablissement des hiérarchies (users.referentId)\n`);
      for (const u of selfRefUpdates) {
        write(`UPDATE users SET "referentId" = ${u.referentId} WHERE id = ${u.id};\n`);
      }
    }

    if (unknownTables.length) {
      write(`\n-- ATTENTION : ${unknownTables.length} table(s) absente(s) de la liste de portée tenant, exclue(s) de cet export par sécurité :\n`);
      for (const t of unknownTables) write(`--   - ${t}\n`);
    }

    write('\nCOMMIT;\n');
    res.end();
  }

  private getScope(table: string, tenantId: number): { whereSql: string | null; params: any[] } {
    if (table === 'tenant_config') return { whereSql: 'id = $1', params: [tenantId] };
    if (DIRECT_TENANT_TABLES.includes(table)) return { whereSql: '"tenantId" = $1', params: [tenantId] };
    if (INDIRECT_SCOPE[table]) return { whereSql: INDIRECT_SCOPE[table], params: [tenantId] };
    return { whereSql: null, params: [] };
  }

  /**
   * Clone les données du tenant directement dans une AUTRE base Postgres
   * (ex: migration vers une nouvelle instance avant expiration de l'hébergement
   * gratuit) — sans fichier intermédiaire. Crée le schéma sur la cible (via
   * TypeORM synchronize, mêmes entités que l'app) puis copie les données avec
   * la même portée tenant et le même ordre de dépendances que exportSql.
   *
   * ssl.rejectUnauthorized=false : même réglage que la connexion principale
   * de l'app (app.module.ts) — nécessaire pour les certificats Postgres
   * fournis par Render.
   */
  async cloneToTarget(tenantId: number, targetUrl: string): Promise<{ tables: Record<string, number>; unknownTables: string[] }> {
    const useSSL = this.config.get<string>('NODE_ENV') === 'production';
    const targetDataSource = new DataSource({
      type: 'postgres',
      url: targetUrl,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      connectTimeoutMS: 15000,
      extra: { connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000 },
    });

    await targetDataSource.initialize();
    this.logger.log('[Clone] Schéma créé/vérifié sur la base cible');

    const tables: Record<string, number> = {};
    const selfRefUpdates: { id: number; referentId: number }[] = [];

    try {
      const allTables = await this.dataSource.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      );
      const knownTables = new Set(['tenant_config', ...DIRECT_TENANT_TABLES, ...Object.keys(INDIRECT_SCOPE), ...GLOBAL_TABLES]);
      const unknownTables: string[] = allTables
        .map((t: any) => t.tablename)
        .filter((t: string) => !knownTables.has(t));

      for (const table of EXPORT_ORDER) {
        const { whereSql, params } = this.getScope(table, tenantId);
        const sql = whereSql ? `SELECT * FROM "${table}" WHERE ${whereSql}` : `SELECT * FROM "${table}"`;
        const rows = await this.dataSource.query(sql, params);
        tables[table] = rows.length;
        if (!rows.length) continue;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertSql = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

        for (const row of rows) {
          if (table === 'users' && row.referentId != null) {
            selfRefUpdates.push({ id: row.id, referentId: row.referentId });
          }
          const values = columns.map(c => {
            if (table === 'users' && c === 'referentId') return null;
            const v = row[c];
            if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
            return v;
          });
          await targetDataSource.query(insertSql, values);
        }

        if (columns.includes('id')) {
          await targetDataSource.query(
            `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`,
          );
        }
        this.logger.log(`[Clone] ${table} : ${rows.length} ligne(s)`);
      }

      for (const u of selfRefUpdates) {
        await targetDataSource.query(`UPDATE users SET "referentId" = $1 WHERE id = $2`, [u.referentId, u.id]);
      }

      return { tables, unknownTables };
    } finally {
      await targetDataSource.destroy();
    }
  }

  private async dumpTable(
    table: string,
    whereSql: string | null,
    params: any[],
    write: (s: string) => void,
    selfRefUpdates: { id: number; referentId: number }[],
  ): Promise<number> {
    const sql = whereSql ? `SELECT * FROM "${table}" WHERE ${whereSql}` : `SELECT * FROM "${table}"`;
    const rows = await this.dataSource.query(sql, params);

    write(`\n-- ${table} (${rows.length} ligne(s))\n`);
    if (!rows.length) return 0;

    const columns = Object.keys(rows[0]);
    for (const row of rows) {
      if (table === 'users' && row.referentId != null) {
        selfRefUpdates.push({ id: row.id, referentId: row.referentId });
      }
      const values = columns.map(c => {
        if (table === 'users' && c === 'referentId') return 'NULL';
        return this.sqlValue(row[c]);
      });
      write(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`);
    }

    if (columns.includes('id')) {
      write(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true);\n`);
    }

    return rows.length;
  }

  private sqlValue(v: any): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    if (Buffer.isBuffer(v)) return `'\\x${v.toString('hex')}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }
}
