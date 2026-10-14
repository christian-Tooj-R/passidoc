import { Client } from 'pg';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createDecipheriv } from 'crypto';
import { gunzipSync } from 'zlib';

// TEMPORAIRE : restauration unique du tenant 1 après expiration de l'ancienne base Render.
// À supprimer (ce fichier, son appel dans main.ts, seed-data/ et RESTORE_KEY) une fois confirmée.
export async function runTenant1RestoreIfNeeded(): Promise<void> {
  if ((process.env.DB_TYPE || '').toLowerCase() !== 'postgres') return;
  const connectionString = process.env.DATABASE_URL;
  const keyHex = process.env.RESTORE_KEY;
  if (!connectionString || !keyHex) return;

  let body: string;
  let tables: string[];
  try {
    const blob = await readFile(join(process.cwd(), 'seed-data', 'tenant1-restore.sql.enc'));
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex.trim(), 'hex'), blob.subarray(0, 12));
    decipher.setAuthTag(blob.subarray(12, 28));
    const sql = gunzipSync(Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()])).toString('utf8');
    // L'export contient son propre BEGIN (et parfois pas de COMMIT) : on le remplace par notre transaction.
    const begin = sql.indexOf('\nBEGIN;\n');
    const commit = sql.lastIndexOf('\nCOMMIT;');
    body = sql.slice(begin + '\nBEGIN;\n'.length, commit > begin ? commit : undefined);
    tables = [...new Set([...body.matchAll(/^INSERT INTO "([a-z_]+)"/gm)].map(m => m[1]))];
  } catch (e: any) {
    console.error('[bootstrap-tenant1-restore] Lecture/déchiffrement impossible :', e?.message ?? e);
    return;
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    // Render gratuit redémarre souvent : sans ce garde-fou, chaque redémarrage écraserait les données saisies depuis.
    const { rows: [existing] } = await client.query(
      `SELECT (SELECT COUNT(*) FROM clients WHERE "tenantId" = 1)
            + (SELECT COUNT(*) FROM pointages WHERE "tenantId" = 1)
            + (SELECT COUNT(*) FROM tasks WHERE "tenantId" = 1) AS n`,
    );
    if (Number(existing.n) > 0) {
      console.log('[bootstrap-tenant1-restore] Tenant 1 déjà peuplé — restauration ignorée.');
      return;
    }

    await client.query('BEGIN');
    await client.query(`TRUNCATE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    await client.query(body);
    await client.query('COMMIT');
    console.log(`[bootstrap-tenant1-restore] OK — ${tables.length} tables restaurées.`);
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bootstrap-tenant1-restore] ÉCHEC, base inchangée (démarrage poursuivi) :', e?.message ?? e);
  } finally {
    await client.end().catch(() => {});
  }
}
