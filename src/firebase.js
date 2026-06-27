import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;

export function inicializarFirebase() {
  if (admin.apps.length) return admin.firestore();

  let credenciales;

  if (process.env.FIREBASE_CREDENTIALS_JSON) {
    credenciales = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credenciales = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  } else {
    const ruta = resolve(__dirname, '..', process.env.FIREBASE_CREDENTIALS_PATH || './firebase-credentials.json');
    credenciales = JSON.parse(readFileSync(ruta, 'utf8'));
  }

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
