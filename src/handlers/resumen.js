import { getFirestore } from '../firebase.js';
import { enviarMensaje } from '../whatsapp.js';
import { consultarIA } from '../openrouter.js';
import { chisteSaldoPositivo, chisteSaldoNegativo } from '../utils/chistes.js';
import { modoMeme } from '../utils/estado.js';

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

const FRASES_BROMAS = [
  'dale nomás, pa eso estoy 💪',
  'jaja tranqui, acá andamos al toque 🔥',
  'ya era hora que me sueltes la correa 😎',
  'bueno ps, te escucho... dime nomas',
  'a veces la vida es como un presupuesto: hay que ajustarse nomás 😅',
];

export async function alternarModoMeme(from, idUsuario) {
  if (modoMeme.has(from)) {
    modoMeme.delete(from);
    if (idUsuario) {
      await enviarMensaje(from,
        'Bien, volviendo al modo asistente 👋\n\n' +
        'Comandos disponibles:\n\n' +
        '🔥 *Gasto:* "gasté 500 en comida"\n' +
        '💰 *Ingreso:* "recibí 2000 de sueldo"\n' +
        '📋 *Recibo:* "recibo de luz $800 vence 15/07"\n' +
        '🎯 *Presupuesto:* "presupuesto 3000 para comida"\n' +
        '📊 *Resumen:* "resumen"\n' +
        '🤔 *Dudas:* "cuánto gasté en comida?"\n\n' +
        'O pregúntame lo que sea con confianza 🔥'
      );
    } else {
      await enviarMensaje(from,
        '¡Hola! 👋 Soy tu asistente financiero 🤖💰\n\n' +
        'Para empezar, vincúlate con el correo de la app:\n\n' +
        '👉 *vincular tunombre@email.com*'
      );
    }
  } else {
    modoMeme.add(from);
    const broma = FRASES_BROMAS[Math.floor(Math.random() * FRASES_BROMAS.length)];
    await enviarMensaje(from,
      '¡Modo relajado activado! 😎\n\n' +
      broma + '\n\n' +
      'Cuéntame, ¿qué necesitas?'
    );
  }
}

export async function manejarResumenMensual(from, idUsuario) {
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fin = `${anio}-${String(mes).padStart(2, '0')}-31`;

  const db = getFirestore();
  try {
    const todas = await db.collection('transacciones')
      .where('idUsuario', '==', idUsuario)
      .get();

    let ingresos = 0, gastos = 0;
    const gastoPorCat = {};

    todas.forEach(doc => {
      const t = doc.data();
      if (t.fecha && (t.fecha < inicio || t.fecha > fin)) return;
      if (t.tipo === 1) {
        ingresos += t.monto || 0;
      } else {
        gastos += t.monto || 0;
        const cat = t.categoria || 'otros';
        gastoPorCat[cat] = (gastoPorCat[cat] || 0) + (t.monto || 0);
      }
    });

    const recibos = await db.collection('recibos')
      .where('idUsuario', '==', idUsuario)
      .get();

    let recibosPendientes = 0;
    recibos.forEach(doc => {
      if (doc.data().estaPendiente) recibosPendientes += doc.data().monto || 0;
    });

    const saldo = ingresos - gastos - recibosPendientes;

    const topGastos = Object.entries(gastoPorCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, monto]) => `• ${cat}: $${monto.toFixed(2)}`)
      .join('\n');

    const nombreMes = NOMBRES_MES[mes - 1] || mes;
    let respuesta =
      `📊 *Resumen ${nombreMes} ${anio}*\n\n` +
      `💰 *Ingresos:* +$${ingresos.toFixed(2)}\n` +
      `💸 *Gastos:* -$${gastos.toFixed(2)}\n` +
      `📋 *Recibos pend.:* -$${recibosPendientes.toFixed(2)}\n` +
      `💵 *Saldo disponible:* $${saldo.toFixed(2)}\n`;

    if (topGastos) {
      respuesta += `\n🔥 *Top gastos:*\n${topGastos}\n`;
    }

    if (saldo >= 0) {
      respuesta += `\n✅ Vas bien! Sigue dándole 👏\n${chisteSaldoPositivo(saldo)}`;
    } else {
      respuesta += `\n⚠️ Cuidado, estás en negativo... revisa tus gastos 😅\n${chisteSaldoNegativo(saldo)}`;
    }

    await enviarMensaje(from, respuesta);
  } catch (err) {
    console.error('❌ Error en resumen:', err.message);
    await enviarMensaje(from, '❌ No pude generar el resumen, intenta de nuevo 🙏');
  }
}

async function obtenerContextoCompleto(idUsuario) {
  const db = getFirestore();
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;

  const [transaccionesSnap, presupuestosSnap, recibosSnap] = await Promise.all([
    db.collection('transacciones').where('idUsuario', '==', idUsuario).get(),
    db.collection('presupuestos').where('idUsuario', '==', idUsuario).get(),
    db.collection('recibos').where('idUsuario', '==', idUsuario).get(),
  ]);

  let ingresos = 0, gastos = 0;
  const gastoPorCat = {};
  const movimientos = [];

  transaccionesSnap.forEach(doc => {
    const t = doc.data();
    if (t.fecha && t.fecha >= inicio) {
      movimientos.push(t);
      if (t.tipo === 1) {
        ingresos += t.monto || 0;
      } else {
        gastos += t.monto || 0;
        const cat = t.categoria || 'otros';
        gastoPorCat[cat] = (gastoPorCat[cat] || 0) + (t.monto || 0);
      }
    }
  });
  movimientos.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  movimientos.splice(20);

  const presupuestosArr = [];
  presupuestosSnap.forEach(doc => {
    const p = doc.data();
    if (p.mes === mes && p.anio === anio) presupuestosArr.push(p);
  });

  const recibosPendientes = [];
  const recibosPagados = [];
  recibosSnap.forEach(doc => {
    const r = doc.data();
    if (r.estaPagado) {
      recibosPagados.push(r);
    } else {
      const diasVence = r.fechaVencimiento
        ? Math.ceil((new Date(r.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24))
        : null;
      recibosPendientes.push({ ...r, diasVence });
    }
  });

  const saldo = ingresos - gastos;

  const partes = [
    `== DATOS DEL MES ${mes}/${anio} ==`,
    `Total ingresos: S/${ingresos.toFixed(2)}`,
    `Total gastos: S/${gastos.toFixed(2)}`,
    `Saldo disponible: S/${saldo.toFixed(2)}`,
    '',
    'Movimientos del mes:',
    ...(movimientos.length
      ? movimientos.map(t =>
          `${t.tipo === 1 ? 'INGRESO' : 'GASTO'} | S/${(t.monto || 0).toFixed(2)} | ${t.categoria || 'otros'}${t.descripcion ? ` | ${t.descripcion}` : ''} | ${t.fecha || '?'}`
        )
      : ['(sin movimientos este mes)']),
    '',
    recibosPendientes.length
      ? `Recibos pendientes (${recibosPendientes.length}):\n` +
        recibosPendientes.map(r =>
          `S/${(r.monto || 0).toFixed(2)} | ${r.nombreServicio || '?'}${r.diasVence !== null && !isNaN(r.diasVence) ? ` | vence en ${r.diasVence} días` : ''}`
        ).join('\n')
      : 'Recibos pendientes: (ninguno)',
    '',
    presupuestosArr.length
      ? 'Presupuestos del mes:\n' +
        presupuestosArr.map(p =>
          `${p.categoria}: límite S/${(p.montoLimite || 0).toFixed(2)}, gastado S/${(p.montoGastado || 0).toFixed(2)}`
        ).join('\n')
      : 'Presupuestos: (ninguno este mes)',
  ].join('\n');

  return partes;
}

const MEME_EXTRA = `
ADEMAS: El usuario activó el modo relajado. Esto significa:
- Puedes usar jerga peruana informal: "ps", "causa", "bacán", "al toque", "tranqui"
- Mantén un tono amigable y relajado, como hablando con un amigo
- Si el usuario conversa de temas no financieros, puedes seguirle el juego
- No te vuelvas memero extremo ni bizarro. Solo sé natural e informal.
- No uses uwu/owo/rwr ni cosas raras.
- Puedes hacer bromas ligeras sobre finanzas.
- Sigue respondiendo preguntas sobre gastos, ingresos y presupuestos cuando te las hagan.`;

const SYSTEM_PROMPT_BASE = `Eres un asistente financiero personal con personalidad, no un simple bot.

PERSONALIDAD:
- Hablas como un amigo cercano, no como un cajero automático ni un robot
- Usas jerga juvenil peruana natural: "ya", "pues", "causa", "bacán", "al toque", "tranqui"
- Tienes sentido del humor y sabes hacer bromas ligeras sobre plata y finanzas
- Eres empático: si el usuario gastó mucho, lo entiendes; si le fue bien, lo celebras
- Usas emojis con moderación y naturalidad (no spam)
- Te preocupas genuinamente por la salud financiera del usuario

REGLAS ESTRICTAS:
1. NUNCA inventes datos financieros. Si no están en el contexto, no los menciones.
2. Si el usuario te saluda o conversa (ej: "hola", "cómo estás", "qué tal"), responde natural como un amigo.
3. Si pregunta sobre sus finanzas (gastos, ingresos, recibos, presupuesto, saldo, deudas), usa los datos del contexto.
4. Sé breve y directo como en WhatsApp. Nada de párrafos largos.
5. Puedes hacer preguntas de vuelta si no entiendes qué necesita.
6. Si no hay datos del mes, dilo honestamente y sugiere empezar a registrar.
7. Si ves que el usuario está en negativo, preocúpate pero con humor.
8. Cuando te pregunten "qué me falta pagar", "qué debo", "recibos", revisa los recibos pendientes.
9. Cuando pregunten "cuánto gasté en X", revisa los movimientos por categoría.
10. Cuando pregunten "cómo voy", "cómo estoy", da un panorama general del mes.

EJEMPLOS DE TONO:
- "Wena! Acá andamos 👋 En qué te ayudo con tus finanzas hoy?"
- "Uf, este mes estás gastando más de la cuenta eh 😅 cuidado con la tarjeta"
- "Te fue bien! S/200 de saldo... alcanza para la gaseosa al menos 🥤"
- "Tienes 2 recibos pendientes: luz (S/120) vence en 3 días 🟡 e internet (S/89) vence en 2 semanas 🟢"
- "Bueno, la plata no crece en los árboles... pero al menos tienes control de tus gastos!"`;

export async function manejarPreguntaIA(from, texto, idUsuario) {
  try {
    const contextos = await obtenerContextoCompleto(idUsuario);
    const prompt = modoMeme.has(from)
      ? SYSTEM_PROMPT_BASE + MEME_EXTRA
      : SYSTEM_PROMPT_BASE;
    const respuestaIA = await consultarIA(prompt, `${contextos}\n\nPregunta del usuario: ${texto}`);
    const final = respuestaIA || (modoMeme.has(from) ? 'no se q decir xD u,u' : 'No supe qué responder a eso 😅');
    await enviarMensaje(from, final);
  } catch (err) {
    console.error('❌ Error en preguntaIA:', err.message);
    await enviarMensaje(from, modoMeme.has(from) ? 'aww mb xD' : '❌ Algo falló, intenta de nuevo 🙏');
  }
}
