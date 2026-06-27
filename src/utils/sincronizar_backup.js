import { getFirestore, admin } from '../firebase.js';

function aSnakeCase(str) {
  return str.replace(/[A-Z]/g, letra => `_${letra.toLowerCase()}`);
}

function objASqlite(obj) {
  const resultado = {};
  for (const [key, val] of Object.entries(obj)) {
    const snakeKey = aSnakeCase(key);
    if (typeof val === 'boolean') {
      resultado[snakeKey] = val ? 1 : 0;
    } else if (val !== undefined) {
      resultado[snakeKey] = val;
    }
  }
  return resultado;
}

function transaccionASqlite(t) {
  const base = objASqlite(t);
  if (base.fecha_creacion && typeof base.fecha_creacion === 'string' && !base.fecha_creacion.includes('T')) {
    base.fecha_creacion = new Date().toISOString();
  }
  return base;
}

function reciboASqlite(r) {
  return objASqlite(r);
}

function presupuestoASqlite(p) {
  return objASqlite(p);
}

export async function sincronizarTransaccion(idUsuario, datos) {
  const db = getFirestore();
  const ref = db.collection('backups').doc(idUsuario);
  const filaSqlite = transaccionASqlite(datos);
  await ref.update({
    transacciones: admin.firestore.FieldValue.arrayUnion(filaSqlite),
  }).catch(async () => {
    await ref.set({
      version: 1,
      backupDate: new Date().toISOString(),
      transacciones: [filaSqlite],
      recibos: [],
      presupuestos: [],
      conversaciones: [],
    });
  });
}

export async function sincronizarRecibo(idUsuario, datos) {
  const db = getFirestore();
  const ref = db.collection('backups').doc(idUsuario);
  const filaSqlite = reciboASqlite(datos);
  await ref.update({
    recibos: admin.firestore.FieldValue.arrayUnion(filaSqlite),
  }).catch(async () => {
    await ref.set({
      version: 1,
      backupDate: new Date().toISOString(),
      transacciones: [],
      recibos: [filaSqlite],
      presupuestos: [],
      conversaciones: [],
    });
  });
}

export async function sincronizarPresupuesto(idUsuario, datos) {
  const db = getFirestore();
  const ref = db.collection('backups').doc(idUsuario);
  const filaSqlite = presupuestoASqlite(datos);
  await ref.update({
    presupuestos: admin.firestore.FieldValue.arrayUnion(filaSqlite),
  }).catch(async () => {
    await ref.set({
      version: 1,
      backupDate: new Date().toISOString(),
      transacciones: [],
      recibos: [],
      presupuestos: [filaSqlite],
      conversaciones: [],
    });
  });
}
