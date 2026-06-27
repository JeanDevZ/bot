// Script de validación rápida del bot
// Ejecutar: node test_bot.js

import 'dotenv/config';
import { inicializarFirebase } from './src/firebase.js';
import { consultarIA } from './src/openrouter.js';

const ROJO = '\x1b[31m';
const VERDE = '\x1b[32m';
const AMARILLO = '\x1b[33m';
const RESET = '\x1b[0m';

let pasaron = 0;
let fallaron = 0;

function test(nombre, fn) {
  try {
    fn();
    console.log(`${VERDE}✅ ${nombre}${RESET}`);
    pasaron++;
  } catch (e) {
    console.log(`${ROJO}❌ ${nombre}: ${e.message}${RESET}`);
    fallaron++;
  }
}

function asyncTest(nombre, fn) {
  return fn()
    .then(() => {
      console.log(`${VERDE}✅ ${nombre}${RESET}`);
      pasaron++;
    })
    .catch(e => {
      console.log(`${ROJO}❌ ${nombre}: ${e.message}${RESET}`);
      fallaron++;
    });
}

// ─── Pruebas de detección de intención ───

const FB = '(?=[\\s.,!?;]|$)';
const INTENCIONES = [
  { patron: RegExp(`\\b(gast[eé]|gastar|compre?|compr[ée]|pagu[eé])${FB}`, 'i'), handler: 'gasto' },
  { patron: RegExp(`\\b(recib[ióí]|ingreso|cobr[ée])${FB}`, 'i'), handler: 'ingreso' },
  { patron: RegExp(`\\b(presupuesto|limite|límite)${FB}.*\\b(para|de)${FB}`, 'i'), handler: 'establecerPresupuesto' },
  { patron: RegExp(`\\b(mis recibos?|recibos? pendientes?|qu[eé] recibos?|ver recibos?|lista recibos?|mostrar recibos?|recibos? por pagar|cuentas por pagar|facturas pendientes|qu[eé] me falta pagar|qu[eé] debo|qu[eé] tengo que pagar|recibos? sin pagar)${FB}`, 'i'), handler: 'listarRecibos' },
  { patron: RegExp(`\\b(presupuestos?)${FB}`, 'i'), handler: 'presupuestos' },
  { patron: RegExp(`\\b(resumen|resume|cómo voy|cómo estoy|cómo vamos|mi situaci[óo]n|dame un resumen|panorama)${FB}`, 'i'), handler: 'resumen' },
  { patron: RegExp(`\\b(recibos?|servicio)${FB}.*\\b(vence|vencimiento|pagar)${FB}`, 'i'), handler: 'recibo' },
  { patron: /^[\w.'%+-]+@[\w.-]+\.\w{2,}$/i, handler: 'vincular' },
  { patron: RegExp(`\\b(s[eé] t[uú] mism[ao]|habla normal|vuelve a la normalidad|s[eé] humano|modo normal|se tu mismo|habla como persona)${FB}`, 'i'), handler: 'toggleMeme' },
  { patron: RegExp(`\\b(vincular)${FB}`, 'i'), handler: 'vincular' },
  { patron: RegExp(`\\b(desvincular|desvincularme)${FB}`, 'i'), handler: 'desvincular' },
  { patron: RegExp(`\\b(sincronizar|importar|migrar|actualizar)${FB}`, 'i'), handler: 'sincronizar' },
  { patron: RegExp(`\\b(hola|buenas|ayuda|comandos|men[úu]|qu[eé] tal|cómo estás|qu[eé] haces|qui[eé]n eres|buen[ao]s? días?|buenas tardes|buenas noches|hey|oye|disculpa)${FB}`, 'i'), handler: 'inicio' },
];

function detectarIntencion(texto) {
  for (const intento of INTENCIONES) {
    if (intento.patron.test(texto)) return intento.handler;
  }
  return 'preguntaIA';
}

console.log(`\n${AMARILLO}══════ PRUEBAS DE DETECCIÓN DE INTENCIÓN ══════${RESET}\n`);

test('Detectar "gasté 500 en comida" → gasto', () => {
  const r = detectarIntencion('gasté 500 en comida');
  if (r !== 'gasto') throw new Error(`Esperado: gasto, Obtenido: ${r}`);
});

test('Detectar "GASTÉ 500" (mayúsculas) → gasto', () => {
  const r = detectarIntencion('GASTÉ 500 EN COMIDA');
  if (r !== 'gasto') throw new Error(`Esperado: gasto, Obtenido: ${r}`);
});

test('Detectar "recibí 2000 de sueldo" → ingreso', () => {
  const r = detectarIntencion('recibí 2000 de sueldo');
  if (r !== 'ingreso') throw new Error(`Esperado: ingreso, Obtenido: ${r}`);
});

test('Detectar "recibo de luz $800 vence 15/07" → recibo', () => {
  const r = detectarIntencion('recibo de luz $800 vence 15/07');
  if (r !== 'recibo') throw new Error(`Esperado: recibo, Obtenido: ${r}`);
});
test('Detectar "recibos de luz $800 vence mañana" → recibo', () => {
  const r = detectarIntencion('recibos de luz $800 vence mañana');
  if (r !== 'recibo') throw new Error(`Esperado: recibo, Obtenido: ${r}`);
});
test('Detectar "mis recibos" → listarRecibos', () => {
  const r = detectarIntencion('mis recibos');
  if (r !== 'listarRecibos') throw new Error(`Esperado: listarRecibos, Obtenido: ${r}`);
});
test('Detectar "recibos pendientes" → listarRecibos', () => {
  const r = detectarIntencion('recibos pendientes');
  if (r !== 'listarRecibos') throw new Error(`Esperado: listarRecibos, Obtenido: ${r}`);
});
test('Detectar "qué recibos tengo" → listarRecibos', () => {
  const r = detectarIntencion('qué recibos tengo');
  if (r !== 'listarRecibos') throw new Error(`Esperado: listarRecibos, Obtenido: ${r}`);
});
test('Detectar "qué me falta pagar" → listarRecibos', () => {
  const r = detectarIntencion('qué me falta pagar');
  if (r !== 'listarRecibos') throw new Error(`Esperado: listarRecibos, Obtenido: ${r}`);
});
test('Detectar "qué debo" → listarRecibos', () => {
  const r = detectarIntencion('qué debo');
  if (r !== 'listarRecibos') throw new Error(`Esperado: listarRecibos, Obtenido: ${r}`);
});
test('Detectar "recibos por pagar" → listarRecibos', () => {
  const r = detectarIntencion('recibos por pagar');
  if (r !== 'listarRecibos') throw new Error(`Esperado: listarRecibos, Obtenido: ${r}`);
});
test('Detectar "cómo voy" → resumen', () => {
  const r = detectarIntencion('cómo voy');
  if (r !== 'resumen') throw new Error(`Esperado: resumen, Obtenido: ${r}`);
});
test('Detectar "cómo estoy" → resumen', () => {
  const r = detectarIntencion('cómo estoy');
  if (r !== 'resumen') throw new Error(`Esperado: resumen, Obtenido: ${r}`);
});
test('Detectar "qué tal" → inicio', () => {
  const r = detectarIntencion('qué tal');
  if (r !== 'inicio') throw new Error(`Esperado: inicio, Obtenido: ${r}`);
});
test('Detectar "cómo estás" → inicio', () => {
  const r = detectarIntencion('cómo estás');
  if (r !== 'inicio') throw new Error(`Esperado: inicio, Obtenido: ${r}`);
});
test('Detectar "miguel@email.com" (email sin vincular) → vincular', () => {
  const r = detectarIntencion('miguel@email.com');
  if (r !== 'vincular') throw new Error(`Esperado: vincular, Obtenido: ${r}`);
});
test('Detectar "sé tú mismo" → toggleMeme', () => {
  const r = detectarIntencion('sé tú mismo');
  if (r !== 'toggleMeme') throw new Error(`Esperado: toggleMeme, Obtenido: ${r}`);
});
test('Detectar "habla normal" → toggleMeme', () => {
  const r = detectarIntencion('habla normal');
  if (r !== 'toggleMeme') throw new Error(`Esperado: toggleMeme, Obtenido: ${r}`);
});

test('Detectar "presupuesto 3000 para comida" → establecerPresupuesto', () => {
  const r = detectarIntencion('presupuesto 3000 para comida');
  if (r !== 'establecerPresupuesto') throw new Error(`Esperado: establecerPresupuesto, Obtenido: ${r}`);
});

test('Detectar "presupuestos" → presupuestos', () => {
  const r = detectarIntencion('presupuestos');
  if (r !== 'presupuestos') throw new Error(`Esperado: presupuestos, Obtenido: ${r}`);
});

test('Detectar "resumen" → resumen', () => {
  const r = detectarIntencion('resumen');
  if (r !== 'resumen') throw new Error(`Esperado: resumen, Obtenido: ${r}`);
});

test('Detectar "RESUMEN" (mayúsculas) → resumen', () => {
  const r = detectarIntencion('RESUMEN');
  if (r !== 'resumen') throw new Error(`Esperado: resumen, Obtenido: ${r}`);
});

test('Detectar "hola" → inicio', () => {
  const r = detectarIntencion('hola');
  if (r !== 'inicio') throw new Error(`Esperado: inicio, Obtenido: ${r}`);
});

test('Detectar "vincular correo@ejemplo.com" → vincular', () => {
  const r = detectarIntencion('vincular correo@ejemplo.com');
  if (r !== 'vincular') throw new Error(`Esperado: vincular, Obtenido: ${r}`);
});

test('Detectar "desvincular" → desvincular', () => {
  const r = detectarIntencion('desvincular');
  if (r !== 'desvincular') throw new Error(`Esperado: desvincular, Obtenido: ${r}`);
});

test('Detectar "sincronizar" → sincronizar', () => {
  const r = detectarIntencion('sincronizar');
  if (r !== 'sincronizar') throw new Error(`Esperado: sincronizar, Obtenido: ${r}`);
});

test('Detectar "menú" → inicio', () => {
  const r = detectarIntencion('menú');
  if (r !== 'inicio') throw new Error(`Esperado: inicio, Obtenido: ${r}`);
});

test('Fallo a "qué clima hace?" → preguntaIA', () => {
  const r = detectarIntencion('qué clima hace?');
  if (r !== 'preguntaIA') throw new Error(`Esperado: preguntaIA, Obtenido: ${r}`);
});

test('Detectar "compré pan" → gasto', () => {
  const r = detectarIntencion('compré pan');
  if (r !== 'gasto') throw new Error(`Esperado: gasto, Obtenido: ${r}`);
});

test('Detectar "pagué el recibo" → gasto', () => {
  const r = detectarIntencion('pagué el recibo');
  if (r !== 'gasto') throw new Error(`Esperado: gasto, Obtenido: ${r}`);
});

test('Detectar "cobré 500" → ingreso', () => {
  const r = detectarIntencion('cobré 500');
  if (r !== 'ingreso') throw new Error(`Esperado: ingreso, Obtenido: ${r}`);
});

test('Detectar "ayuda" → inicio', () => {
  const r = detectarIntencion('ayuda');
  if (r !== 'inicio') throw new Error(`Esperado: inicio, Obtenido: ${r}`);
});

// ─── Pruebas de JID handling ───

console.log(`\n${AMARILLO}══════ PRUEBAS DE JID & FORMATOS ══════${RESET}\n`);

test('JID con @lid → extrae solo número', () => {
  const jid = '143366276816900@lid';
  const from = jid.replace(/@\w+$/, '');
  if (from !== '143366276816900') throw new Error(`Esperado: 143366276816900, Obtenido: ${from}`);
});

test('JID con @s.whatsapp.net → extrae solo número', () => {
  const jid = '51916055728@s.whatsapp.net';
  const from = jid.replace(/@.*$/, '');
  if (from !== '51916055728') throw new Error(`Esperado: 51916055728, Obtenido: ${from}`);
});

test('JID map para @lid', () => {
  const jidMap = {};
  const remoteJid = '143366276816900@lid';
  const from = remoteJid.replace(/@.*$/, '');
  jidMap[from] = remoteJid;
  const jid = jidMap[from] || `${from}@s.whatsapp.net`;
  if (jid !== '143366276816900@lid') throw new Error(`Esperado: 143366276816900@lid, Obtenido: ${jid}`);
});

// ─── Pruebas de Firestore (si hay conexión) ───

console.log(`\n${AMARILLO}══════ PRUEBAS DE FIRESTORE ══════${RESET}\n`);

async function testFirestore() {
  try {
    inicializarFirebase();
    console.log(`${VERDE}✅ Firebase inicializado correctamente${RESET}`);
    pasaron++;
  } catch (e) {
    console.log(`${ROJO}❌ Firebase init: ${e.message}${RESET}`);
    fallaron++;
  }

  // ─── Pruebas de OpenRouter ───
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'sk-or-v1-...') {
    await asyncTest('OpenRouter API responde', async () => {
      const r = await consultarIA('Responde SOLO "OK"', 'di OK');
      if (!r || r.length === 0) throw new Error('Respuesta vacía');
    });
  } else {
    console.log(`${AMARILLO}⚠️  Saltando OpenRouter (no hay API key)${RESET}`);
  }

  // ─── Resultados ───
  const total = pasaron + fallaron;
  console.log(`\n${AMARILLO}══════ RESULTADOS ══════${RESET}`);
  console.log(`${VERDE}✅ Pasaron: ${pasaron}/${total}${RESET}`);
  if (fallaron > 0) console.log(`${ROJO}❌ Fallaron: ${fallaron}/${total}${RESET}`);
  console.log('');
}

testFirestore();
