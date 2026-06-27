import 'dotenv/config';
import { inicializarFirebase, getFirestore } from './firebase.js';
import { iniciarCliente, enviarMensaje } from './whatsapp.js';
import { manejarInicio, manejarVinculacion, manejarDesvinculacion, manejarSincronizacion } from './handlers/vinculacion.js';
import { manejarRegistroGasto, manejarRegistroIngreso, manejarRegistroRecibo, manejarRespuestaPendiente } from './handlers/registro.js';
import { manejarListarRecibos } from './handlers/listar_recibos.js';
import { manejarEstablecerPresupuesto, manejarConsultarPresupuestos } from './handlers/presupuesto.js';
import { manejarResumenMensual, manejarPreguntaIA, alternarModoMeme } from './handlers/resumen.js';
import { esTextoValido } from './utils/validacion.js';
import { pendingRegistros, modoMeme } from './utils/estado.js';

inicializarFirebase();

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
  { patron: RegExp(`\\b(s[eé] t[uú] mism[ao]|habla normal|vuelve a la normalidad|s[eé] humano|modo normal|se tu mismo|habla como persona|no seas t[uú] mism[ao]|para de ser t[uú] mism[ao]|deja de ser t[uú] mism[ao]|comportamiento normal|modo asistente|vuelve a ser normal)${FB}`, 'i'), handler: 'toggleMeme' },
  { patron: RegExp(`\\b(vincular)${FB}`, 'i'), handler: 'vincular' },
  { patron: RegExp(`\\b(desvincular|desvincularme)${FB}`, 'i'), handler: 'desvincular' },
  { patron: RegExp(`\\b(sincronizar|importar|migrar|actualizar)${FB}`, 'i'), handler: 'sincronizar' },
  { patron: RegExp(`\\b(hola|buenas|ayuda|comandos|men[úu]|qu[eé] tal|cómo estás|qu[eé] haces|qui[eé]n eres|buen[ao]s? días?|buenas tardes|buenas noches|hey|oye|disculpa)${FB}`, 'i'), handler: 'inicio' },
];

function detectarIntencion(texto) {
  if (!esTextoValido(texto)) return 'preguntaIA';
  for (const intento of INTENCIONES) {
    if (intento.patron.test(texto)) return intento.handler;
  }
  return 'preguntaIA';
}

async function obtenerIdUsuario(from) {
  if (!from) return null;
  try {
    const db = getFirestore();
    const usuarios = await db.collection('usuarios')
      .where('whatsapp', '==', from)
      .get();
    if (usuarios.empty) return null;
    return usuarios.docs[0].id;
  } catch (err) {
    console.error('❌ Error al obtener usuario:', err.message);
    return null;
  }
}

async function manejarMensaje(from, texto) {
  if (!from || !esTextoValido(texto)) return;

  console.log(`📩 De: ${from} - Dice: ${texto}`);
  const idUsuario = await obtenerIdUsuario(from);

  if (!idUsuario) {
    if (texto.toLowerCase().startsWith('vincular') || /^[\w.'%+-]+@[\w.-]+\.\w{2,}$/i.test(texto.trim())) {
      await manejarVinculacion(from, texto);
      return;
    }
    await manejarInicio(from, texto);
    return;
  }

  if (pendingRegistros.has(from)) {
    await manejarRespuestaPendiente(from, texto, idUsuario);
    return;
  }

  const intencion = detectarIntencion(texto);

  try {
    switch (intencion) {
      case 'gasto':
        await manejarRegistroGasto(from, texto, idUsuario);
        break;
      case 'ingreso':
        await manejarRegistroIngreso(from, texto, idUsuario);
        break;
      case 'recibo':
        await manejarRegistroRecibo(from, texto, idUsuario);
        break;
      case 'establecerPresupuesto':
        await manejarEstablecerPresupuesto(from, texto, idUsuario);
        break;
      case 'listarRecibos':
        await manejarListarRecibos(from, idUsuario);
        break;
      case 'presupuestos':
        await manejarConsultarPresupuestos(from, idUsuario);
        break;
      case 'resumen':
        await manejarResumenMensual(from, idUsuario);
        break;
      case 'inicio':
        await manejarInicio(from, texto);
        break;
      case 'desvincular':
        await manejarDesvinculacion(from, idUsuario);
        break;
      case 'sincronizar':
        await manejarSincronizacion(from, idUsuario);
        break;
      case 'toggleMeme':
        await alternarModoMeme(from, idUsuario);
        break;
      case 'preguntaIA':
      default:
        await manejarPreguntaIA(from, texto, idUsuario);
        break;
    }
  } catch (err) {
    console.error(`❌ Error en handler ${intencion}:`, err.message);
    await enviarMensaje(from, '❌ Algo salió mal, intenta de nuevo en un ratito 🙏');
  }
}

console.log('🤖 Iniciando chatbot WhatsApp...');
iniciarCliente(manejarMensaje);
