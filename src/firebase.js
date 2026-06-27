import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;

export function inicializarFirebase() {
  if (admin.apps.length) return admin.firestore();

  const ruta = resolve(__dirname, '..', process.env.FIREBASE_CREDENTIALS_PATH || './firebase-credentials.json');
  const credenciales = JSON.parse(readFileSync(ruta, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(credenciales),
  });

  db = admin.firestore();
  console.log('✅ Firebase inicializado');
  return db;
}

export function getFirestore() {
  if (!db) inicializarFirebase();
  return db;
}

export { admin };
