import { APIRequestContext } from '@playwright/test';
import { TEST_TENANT, TEST_EMAIL, TEST_PASS, API_URL, CLIENT_ID } from './auth';

let _token: string | null = null;

export async function getToken(api: APIRequestContext): Promise<string> {
  if (_token) return _token;
  const res = await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TEST_TENANT },
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  const body = await res.json();
  _token = body.access_token;
  return _token!;
}

export function authHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'x-tenant-slug': TEST_TENANT,
  };
}

/** Importe le fichier FEC de test et retourne le nombre de périodes importées. */
export async function importFec(api: APIRequestContext, token: string): Promise<{ imported: number; annee: number }> {
  const fecContent = Buffer.from(`JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|PieceRef|PieceDate|EcritureLib|Debit|Credit
AC|ACHATS|FAC001|20240115|401FOUR001|Fournisseur 1|FINV-001|20240115|Facture achat Jan|1000.00|0.00
AC|ACHATS|FAC002|20240120|401FOUR002|Fournisseur 2|FINV-002|20240120|Facture achat Jan|500.00|0.00
VT|VENTES|VTE001|20240118|411CLI001|Client 1|VINV-001|20240118|Facture vente Jan|0.00|2000.00
AC|ACHATS|FAC003|20240215|401FOUR001|Fournisseur 1|FINV-003|20240215|Facture achat Fev|800.00|0.00
VT|VENTES|VTE002|20240220|411CLI002|Client 2|VINV-002|20240220|Facture vente Fev|0.00|1500.00
`, 'utf-8');

  const res = await api.post(
    `${API_URL}/clients/${CLIENT_ID}/balance/import-fec?annee=2024`,
    {
      headers: authHeaders(token),
      multipart: {
        fec: { name: 'test.txt', mimeType: 'text/plain', buffer: fecContent },
      },
    },
  );
  return res.json();
}

/** Upload un document taggué et retourne son id. */
export async function uploadTaggedDoc(
  api: APIRequestContext,
  token: string,
  opts: { typeDoc: string; periodeMois: number; periodeAnnee: number },
): Promise<number> {
  const content = Buffer.from(`Facture test ${opts.typeDoc} ${opts.periodeMois}/${opts.periodeAnnee}`, 'utf-8');
  const res = await api.post(
    `${API_URL}/clients/${CLIENT_ID}/documents/upload`,
    {
      headers: authHeaders(token),
      multipart: {
        file: { name: 'facture.txt', mimeType: 'text/plain', buffer: content },
        typeDoc: opts.typeDoc,
        periodeMois: String(opts.periodeMois),
        periodeAnnee: String(opts.periodeAnnee),
      },
    },
  );
  const body = await res.json();
  return body.id;
}

/** Récupère la balance pour une année. */
export async function getBalance(
  api: APIRequestContext,
  token: string,
  annee: number,
): Promise<any[]> {
  const res = await api.get(
    `${API_URL}/clients/${CLIENT_ID}/balance?annee=${annee}`,
    { headers: authHeaders(token) },
  );
  return res.json();
}

/** Réinitialise les données de test (balance + documents). */
export async function resetTestData(api: APIRequestContext, token: string) {
  // Supprime les documents de test du client
  const docsRes = await api.get(`${API_URL}/clients/${CLIENT_ID}/documents`, {
    headers: authHeaders(token),
  });
  const docs = await docsRes.json();
  for (const doc of docs) {
    await api.delete(`${API_URL}/clients/${CLIENT_ID}/documents/${doc.id}`, {
      headers: authHeaders(token),
    });
  }
}
