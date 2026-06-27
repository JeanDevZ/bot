import { getFirestore } from '../firebase.js';
import { enviarMensaje } from '../whatsapp.js';
import { chisteVencimiento } from '../utils/chistes.js';

export async function manejarListarRecibos(from, idUsuario) {
  const db = getFirestore();
  try {
    const snapshot = await db.collection('recibos')
      .where('idUsuario', '==', idUsuario)
      .get();

    if (snapshot.empty) {
      await enviarMensaje(from,
        'No tienes recibos registrados 📋\n\n' +
        'Agrega uno: *recibo de luz $800 vence 15/07* 💡'
      );
      return;
    }

    const pendientes = [];
    const pagados = [];
    const ahora = new Date();

    snapshot.forEach(doc => {
      const r = doc.data();
      const item = {
        servicio: r.nombreServicio || '?',
        monto: r.monto || 0,
        vence: r.fechaVencimiento || '?',
        pagado: r.estaPagado === true,
        pendiente: r.estaPendiente !== false,
      };

      if (r.fechaVencimiento) {
        const fechaVen = new Date(r.fechaVencimiento);
        if (!isNaN(fechaVen.getTime())) {
          item.diasRestantes = Math.ceil((fechaVen - ahora) / (1000 * 60 * 60 * 24));
        }
      }

      if (item.pagado) {
        pagados.push(item);
      } else {
        pendientes.push(item);
      }
    });

    if (pendientes.length === 0 && pagados.length === 0) {
      await enviarMensaje(from, 'No encontré recibos 😅');
      return;
    }

    let respuesta = '';

    if (pendientes.length > 0) {
      respuesta += `📋 *Recibos Pendientes (${pendientes.length})*\n`;
      pendientes.sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999));
      pendientes.forEach(r => {
        const estado = r.diasRestantes !== undefined
          ? (r.diasRestantes < 0
              ? `🔴 Vencido hace ${Math.abs(r.diasRestantes)} días`
              : r.diasRestantes === 0
                ? '🔴 Vence HOY'
                : r.diasRestantes <= 3
                  ? `🟡 Vence en ${r.diasRestantes} día${r.diasRestantes > 1 ? 's' : ''}`
                  : `🟢 Vence en ${r.diasRestantes} días`)
          : '⏳ Sin fecha';
        respuesta += `\n${r.servicio}: $${r.monto.toFixed(2)} — ${estado}`;
      });

      const totalPendiente = pendientes.reduce((s, r) => s + r.monto, 0);
      respuesta += `\n\n💰 *Total pendiente: $${totalPendiente.toFixed(2)}*`;
      respuesta += `\n${chisteVencimiento()}`;
    }

    if (pagados.length > 0) {
      respuesta += `\n\n✅ *Pagados (${pagados.length})*\n`;
      pagados.forEach(r => {
        respuesta += `\n${r.servicio}: $${r.monto.toFixed(2)}`;
      });
    }

    await enviarMensaje(from, respuesta);
  } catch (err) {
    console.error('❌ Error al listar recibos:', err.message);
    await enviarMensaje(from, '❌ No pude consultar tus recibos, intenta de nuevo 🙏');
  }
}
