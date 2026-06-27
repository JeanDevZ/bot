import { getFirestore } from '../firebase.js';
import { enviarMensaje } from '../whatsapp.js';
import { consultarIA } from '../openrouter.js';
import { sincronizarPresupuesto } from '../utils/sincronizar_backup.js';
import { esNumeroValido, validarDatosIA, sanitizarJSON, esCategoriaValida } from '../utils/validacion.js';

const CATEGORIAS = [
  'comida', 'transporte', 'vivienda', 'salud',
  'entretenimiento', 'educacion', 'ropa', 'otros',
];

export async function manejarEstablecerPresupuesto(from, texto, idUsuario) {
  const ia = await consultarIA(
    `Eres un asistente financiero. Extrae categoría (${CATEGORIAS.join(', ')}) y monto límite del texto. Responde SOLO JSON: { categoria: string, montoLimite: number }`,
    texto
  );

  let datos;
  try {
    const json = sanitizarJSON(ia);
    datos = JSON.parse(json);
    if (!validarDatosIA(datos)) throw new Error('Datos inválidos');
  } catch {
    await enviarMensaje(from,
      '😬 No entendí, ayúdame con un ejemplo:\n\n' +
      '*presupuesto 2000 para comida este mes* 🎯\n' +
      '*limite 1500 para transporte* 🚌'
    );
    return;
  }

  if (typeof datos.categoria !== 'string' || !esNumeroValido(datos.montoLimite)) {
    await enviarMensaje(from,
      'Faltó categoría o monto. Ej:\n' +
      '*presupuesto 1500 para transporte*'
    );
    return;
  }

  const categoria = datos.categoria.toLowerCase().trim();
  if (!esCategoriaValida(categoria)) {
    await enviarMensaje(from,
      `Categoría no válida 🤨\nLas que tengo: ${CATEGORIAS.join(', ')}`
    );
    return;
  }

  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();

  const db = getFirestore();
  try {
    const todos = await db.collection('presupuestos')
      .where('idUsuario', '==', idUsuario)
      .get();

    let existente = null;
    todos.forEach(doc => {
      const p = doc.data();
      if (p.categoria === categoria && p.mes === mes && p.anio === anio) {
        existente = { ref: doc.ref, data: p };
      }
    });

    const datosPresupuesto = {
      idUsuario, categoria,
      montoLimite: datos.montoLimite, montoGastado: 0,
      mes, anio, fechaCreacion: new Date().toISOString(),
    };

    if (existente) {
      await existente.ref.update({ montoLimite: datos.montoLimite });
    } else {
      await db.collection('presupuestos').add(datosPresupuesto);
    }

    sincronizarPresupuesto(idUsuario, datosPresupuesto)
      .catch(e => console.error('❌ Error sync backup presupuesto:', e.message));

    await enviarMensaje(from,
      `✅ ¡Presupuesto listo! 🎯\n` +
      `${categoria}: $${datos.montoLimite.toFixed(2)} para ${mes}/${anio}`
    );
  } catch (err) {
    console.error('❌ Error al guardar presupuesto:', err.message);
    await enviarMensaje(from, '❌ No pude guardar el presupuesto, intenta de nuevo 🙏');
  }
}

export async function manejarConsultarPresupuestos(from, idUsuario) {
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();

  const db = getFirestore();
  try {
    const todas = await db.collection('transacciones')
      .where('idUsuario', '==', idUsuario)
      .get();

    const gastosPorCategoria = {};
    todas.forEach(doc => {
      const d = doc.data();
      if (d.tipo !== 0) return;
      if (d.fecha < `${anio}-${String(mes).padStart(2, '0')}-01`) return;
      if (d.fecha > `${anio}-${String(mes).padStart(2, '0')}-31`) return;
      gastosPorCategoria[d.categoria] = (gastosPorCategoria[d.categoria] || 0) + d.monto;
    });

    const todosPresup = await db.collection('presupuestos')
      .where('idUsuario', '==', idUsuario)
      .get();

    const presupuestosArr = [];
    todosPresup.forEach(doc => {
      const p = doc.data();
      if (p.mes === mes && p.anio === anio) presupuestosArr.push(p);
    });

    if (presupuestosArr.length === 0) {
      await enviarMensaje(from,
        'No tienes presupuestos este mes 🤷\n\n' +
        'Crea uno: *presupuesto 2000 para comida* 🎯'
      );
      return;
    }

    let respuesta = '📊 *Presupuestos del mes:*\n';
    let algunRojo = false;
    presupuestosArr.forEach(p => {
      const gastado = gastosPorCategoria[p.categoria] || 0;
      const pct = p.montoLimite > 0 ? ((gastado / p.montoLimite) * 100) : 0;
      const emoji = pct > 100 ? '🔴' : pct > 80 ? '🟡' : '🟢';
      if (pct > 100) algunRojo = true;
      respuesta += `\n${emoji} *${p.categoria}*: $${gastado.toFixed(0)} / $${p.montoLimite.toFixed(0)} (${Math.round(pct)}%)`;
    });

    if (algunRojo) {
      respuesta += '\n\n🔴 *Te pasaste en algunos... revisa tus gastos* 😅';
    } else {
      respuesta += '\n\n✅ *Vas bien, sigue así!* 👏';
    }

    await enviarMensaje(from, respuesta);
  } catch (err) {
    console.error('❌ Error al consultar presupuestos:', err.message);
    await enviarMensaje(from, '❌ No pude consultar los presupuestos 🙏');
  }
}
