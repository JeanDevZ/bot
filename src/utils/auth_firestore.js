import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { getFirestore } from '../firebase.js';

const SESSION_COLLECTION = 'sessions';
const SESSION_DOC = 'whatsapp';

export async function useFirestoreAuthState() {
  const db = getFirestore();
  const docRef = db.collection(SESSION_COLLECTION).doc(SESSION_DOC);

  let creds, keys;
  try {
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data.creds) creds = JSON.parse(data.creds, BufferJSON.reviver);
      if (data.keys) keys = JSON.parse(data.keys, BufferJSON.reviver);
    }
  } catch (e) {
    console.error('Error cargando sesión de Firestore:', e.message);
  }

  if (!creds) {
    creds = initAuthCreds();
    keys = {};
  }

  async function guardar() {
    try {
      await docRef.set({
        creds: JSON.stringify(creds, BufferJSON.replacer),
        keys: JSON.stringify(keys, BufferJSON.replacer),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error guardando sesión en Firestore:', e.message);
    }
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const typeData = keys[type] || {};
          const result = {};
          for (const id of ids) {
            result[id] = typeData[id] ?? null;
          }
          return result;
        },
        set: async (data) => {
          for (const type in data) {
            if (!keys[type]) keys[type] = {};
            Object.assign(keys[type], data[type]);
          }
        },
      },
    },
    saveCreds: guardar,
  };
}

export async function limpiarSesionFirestore() {
  try {
    const db = getFirestore();
    await db.collection(SESSION_COLLECTION).doc(SESSION_DOC).delete();
    console.log('Sesión en Firestore eliminada.');
  } catch (e) {
    console.error('Error limpiando sesión en Firestore:', e.message);
  }
}
