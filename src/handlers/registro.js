import { getFirestore } from '../firebase.js';
import { enviarMensaje } from '../whatsapp.js';
import { consultarIA } from '../openrouter.js';
import { sincronizarTransaccion, sincronizarRecibo } from '../utils/sincronizar_backup.js';
import { esNumeroValido, esCategoriaValida, sanitizarJSON, validarDatosIA, formatearFecha, generarTimestamp } from '../utils/validacion.js';
import { chisteGasto, chisteIngreso, chisteVencimiento } from '../utils/chistes.js';
import { pendingRegistros } from '../utils/estado.js';

const CATEGORIAS = [
  'comida', 'transporte', 'vivienda', 'salud',
  'entretenimiento', 'educacion', 'ropa', 'otros',
];

async function parsearConIA(texto, prompt) {
  const ia = await consultarIA(prompt, texto);
  if (!ia || ia === '{}' || ia === 'No pude procesar eso.') return null;

  try {
    const json = sanitizarJSON(ia);
    const datos = JSON.parse(json);
    if (!validarDatosIA(datos)) return null;
    return datos;
  } catch {
    return null;
  }
}

function validarCategoria(categoria) {
  if (!categoria) return 'otros';
  const cat = categoria.toLowerCase();
  if (esCategoriaValida(cat)) return cat;
  for (const c of CATEGORIAS) {
    if (cat.includes(c)) return c;
  }
  if (cat.includes('aliment') || cat.includes('comid')) return 'comida';
  if (cat.includes('transport') || cat.includes('pasaje') || cat.includes('taxi') || cat.includes('bus') || cat.includes('gasolina')) return 'transporte';
  if (cat.includes('vivien') || cat.includes('alquiler') || cat.includes('renta')) return 'vivienda';
  if (cat.includes('salud') || cat.includes('medic') || cat.includes('doctor') || cat.includes('hospital')) return 'salud';
  if (cat.includes('entreten') || cat.includes('cine') || cat.includes('video') || cat.includes('juego')) return 'entretenimiento';
  if (cat.includes('educ') || cat.includes('curso') || cat.includes('clase') || cat.includes('universidad')) return 'educacion';
  if (cat.includes('ropa') || cat.includes('vest') || cat.includes('zapat')) return 'ropa';
  return 'otros';
}

function tieneCategoriaEnTexto(texto) {
  const t = texto.toLowerCase();
  return CATEGORIAS.some(c => t.includes(c)) ||
    /aliment|comid|transport|pasaje|taxi|bus|gasolina|vivien|alquiler|renta|salud|medic|doctor|hospital|entreten|cine|video|juego|educ|curso|clase|universidad|ropa|vest|zapat/i.test(t);
}

async function preguntarCategoria(from, monto, tipo, datos, texto) {
  const etiqueta = tipo === 0 ? 'gastaste' : 'recibiste';
  await enviarMensaje(from,
    `¿En qué ${etiqueta} S/${monto.toFixed(2)}?\n\n` +
    `Categorías: ${CATEGORIAS.join(', ')}`
  );
  pendingRegistros.set(from, { tipo, monto, descripcion: datos.descripcion || null, fecha: datos.fecha || null, texto });
}

export async function manejarRespuestaPendiente(from, texto, idUsuario) {
  const pendiente = pendingRegistros.get(from);
  pendingRegistros.delete(from);

  const ia = await parsearConIA(texto,
    `Extrae solo la categoría del texto. Categorías válidas: ${CATEGORIAS.join(', ')}. Responde SOLO JSON: { categoria: string }`
  );

  let categoria = pendiente.tipo === 0 ? 'otros' : 'otros';
  if (ia && ia.categoria) {
    categoria = validarCategoria(ia.categoria);
  } else {
    const catEnTexto = validarCategoria(texto);
    if (catEnTexto !== 'otros') categoria = catEnTexto;
  }

  const fecha = pendiente.fecha || new Date().toISOString().split('T')[0];

  const db = getFirestore();
  try {
    await db.collection('transacciones').add({
      idUsuario, tipo: pendiente.tipo, monto: pendiente.monto,
      categoria, descripcion: pendiente.descripcion,
      fecha, fechaCreacion: new Date().toISOString(),
    });

    sincronizarTransaccion(idUsuario, {
      idUsuario, tipo: pendiente.tipo, monto: pendiente.monto,
      categoria, descripcion: pendiente.descripcion,
      fecha, fechaCreacion: new Date().toISOString(),
    }).catch(e => console.error('❌ Error sync backup:', e.message));

    const signo = pendiente.tipo === 0 ? '💸' : '💰';
    const label = pendiente.tipo === 0 ? 'Gasto' : 'Ingreso';
    const chiste = pendiente.tipo === 0 ? chisteGasto(pendiente.monto) : chisteIngreso(pendiente.monto);
    await enviarMensaje(from,
      `✅ ¡${label} registrado! ${signo}\n` +
      `S/${pendiente.monto.toFixed(2)} en ${categoria}` +
      (pendiente.descripcion ? `\n📝 ${pendiente.descripcion}` : '') +
      `\n📅 ${formatearFecha(fecha)} ⏰ ${generarTimestamp()}\n${chiste}`
    );
  } catch (err) {
    console.error('❌ Error al guardar:', err.message);
    await enviarMensaje(from, '❌ No pude guardar, intenta de nuevo 🙏');
  }
}

export async function manejarRegistroGasto(from, texto, idUsuario) {
  const datos = await parsearConIA(texto,
    `Eres un asistente financiero. Extrae monto, categoría (${CATEGORIAS.join(', ')}), descripción y fecha (YYYY-MM-DD o null) del texto. Responde SOLO JSON: { monto: number, categoria: string, descripcion: string|null, fecha: string|null }`
  );

  if (!datos || !esNumeroValido(datos.monto)) {
    await enviarMensaje(from,
      'No capté bien 😅\n\nEj: *gasté 500 en comida*\nO: *compré 30 de pasaje* 🚌'
    );
    return;
  }

  if ((!datos.categoria || validarCategoria(datos.categoria) === 'otros') && !tieneCategoriaEnTexto(texto)) {
    await preguntarCategoria(from, datos.monto, 0, datos, texto);
    return;
  }

  const categoria = validarCategoria(datos.categoria);
  const fecha = datos.fecha || new Date().toISOString().split('T')[0];

  const db = getFirestore();
  try {
    await db.collection('transacciones').add({
      idUsuario, tipo: 0, monto: datos.monto,
      categoria, descripcion: datos.descripcion || null,
      fecha, fechaCreacion: new Date().toISOString(),
    });

    sincronizarTransaccion(idUsuario, {
      idUsuario, tipo: 0, monto: datos.monto,
      categoria, descripcion: datos.descripcion || null,
      fecha, fechaCreacion: new Date().toISOString(),
    }).catch(e => console.error('❌ Error sync backup:', e.message));

    const gastoMsg = chisteGasto(datos.monto);
    await enviarMensaje(from,
      `✅ ¡Registrado! 🎯\n` +
      `💸 S/${datos.monto.toFixed(2)} en ${categoria}` +
      (datos.descripcion ? `\n📝 ${datos.descripcion}` : '') +
      `\n📅 ${formatearFecha(fecha)} ⏰ ${generarTimestamp()}\n${gastoMsg}`
    );
  } catch (err) {
    console.error('❌ Error al guardar gasto:', err.message);
    await enviarMensaje(from, '❌ No pude guardar el gasto, intenta de nuevo 🙏');
  }
}

export async function manejarRegistroIngreso(from, texto, idUsuario) {
  const datos = await parsearConIA(texto,
    `Eres un asistente financiero. Extrae monto, categoría (${CATEGORIAS.join(', ')}), descripción y fecha del texto. Responde SOLO JSON: { monto: number, categoria: string, descripcion: string|null, fecha: string|null }`
  );

  if (!datos || !esNumeroValido(datos.monto)) {
    await enviarMensaje(from,
      'No pillé bien 😅\n\nEj: *recibí 2000 de sueldo* 💰\n*Cobré 500 de freelance*'
    );
    return;
  }

  if ((!datos.categoria || validarCategoria(datos.categoria) === 'otros') && !tieneCategoriaEnTexto(texto)) {
    await preguntarCategoria(from, datos.monto, 1, datos, texto);
    return;
  }

  const categoria = validarCategoria(datos.categoria);
  const fecha = datos.fecha || new Date().toISOString().split('T')[0];

  const db = getFirestore();
  try {
    await db.collection('transacciones').add({
      idUsuario, tipo: 1, monto: datos.monto,
      categoria, descripcion: datos.descripcion || null,
      fecha, fechaCreacion: new Date().toISOString(),
    });

    sincronizarTransaccion(idUsuario, {
      idUsuario, tipo: 1, monto: datos.monto,
      categoria, descripcion: datos.descripcion || null,
      fecha, fechaCreacion: new Date().toISOString(),
    }).catch(e => console.error('❌ Error sync backup:', e.message));

    const ingresoMsg = chisteIngreso(datos.monto);
    await enviarMensaje(from,
      `✅ ¡Registrado! 🤑\n` +
      `💰 +S/${datos.monto.toFixed(2)} en ${categoria}` +
      (datos.descripcion ? `\n📝 ${datos.descripcion}` : '') +
      `\n📅 ${formatearFecha(fecha)} ⏰ ${generarTimestamp()}\n${ingresoMsg}`
    );
  } catch (err) {
    console.error('❌ Error al guardar ingreso:', err.message);
    await enviarMensaje(from, '❌ Falló el registro del ingreso, intenta otra vez 🙏');
  }
}

export async function manejarRegistroRecibo(from, texto, idUsuario) {
  const datos = await parsearConIA(texto,
    `Eres un asistente financiero. Extrae nombre del servicio, monto y fecha de vencimiento (YYYY-MM-DD) del texto. Responde SOLO JSON: { servicio: string, monto: number, fechaVencimiento: string }`
  );

  if (!datos || !esNumeroValido(datos.monto) || !datos.servicio) {
    await enviarMensaje(from,
      'No entendí bien 😬\n\nEj: *recibo de luz S/800 vence 15/07* 💡\n*recibo de internet S/1200 vence 10/07* 🌐'
    );
    return;
  }

  const fechaVen = datos.fechaVencimiento || new Date().toISOString().split('T')[0];

  const db = getFirestore();
  try {
    await db.collection('recibos').add({
      idUsuario, nombreServicio: datos.servicio,
      monto: datos.monto, fechaVencimiento: fechaVen,
      estaPagado: false, estaPendiente: true,
      fechaCreacion: new Date().toISOString(),
    });

    sincronizarRecibo(idUsuario, {
      idUsuario, nombreServicio: datos.servicio,
      monto: datos.monto, fechaVencimiento: fechaVen,
      estaPagado: false, estaPendiente: true,
      fechaCreacion: new Date().toISOString(),
    }).catch(e => console.error('❌ Error sync backup:', e.message));

    const reciboMsg = chisteVencimiento();
    await enviarMensaje(from,
      `✅ ¡Recibo guardado! 📋\n` +
      `${datos.servicio}: S/${datos.monto.toFixed(2)}` +
      `\n📅 Vence: ${fechaVen}` +
      `\n⏰ ${generarTimestamp()}\n${reciboMsg}`
    );
  } catch (err) {
    console.error('❌ Error al guardar recibo:', err.message);
    await enviarMensaje(from, '❌ No pude guardar el recibo, intenta de nuevo 🙏');
  }
}
