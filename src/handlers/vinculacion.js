import { getFirestore, admin } from '../firebase.js';
import { enviarMensaje } from '../whatsapp.js';

function esSimpleSaludo(texto) {
  return /^(hola|buenas|hey|oye|buen[ao]|qu[eé] tal|cómo estás|qu[eé] haces|buenos días|buenas tardes|buenas noches)\b/i.test(texto);
}

export async function manejarInicio(from, texto) {
  try {
    const db = getFirestore();
    const usuarioVinculado = await db.collection('usuarios')
      .where('whatsapp', '==', from)
      .get();

    if (!usuarioVinculado.empty) {
      const user = usuarioVinculado.docs[0].data();

      if (texto && esSimpleSaludo(texto)) {
        const saludos = [
          `¡Hola! 👋 Acá andamos, al pendiente de tus finanzas. ¿Qué necesitas?`,
          `¡Qué tal! Todo tranqui por acá, ¿en qué te ayudo?`,
          `¡Hey! Acá listo para lo que necesites, dime nomás 💪`,
          `¡Hola! Acá andamos, cuéntame 👋`,
        ];
        await enviarMensaje(from, saludos[Math.floor(Math.random() * saludos.length)]);
      } else {
        await enviarMensaje(from,
          '¡Hola de nuevo! 👋\n\n' +
          'Comandos disponibles:\n\n' +
          '🔥 *Gasto:* "gasté 500 en comida"\n' +
          '💰 *Ingreso:* "recibí 2000 de sueldo"\n' +
          '📋 *Recibo:* "recibo de luz $800 vence 15/07"\n' +
          '🎯 *Presupuesto:* "presupuesto 3000 para comida"\n' +
          '📊 *Resumen:* "resumen"\n' +
          '🤔 *Dudas:* "cuánto gasté en comida?"\n\n' +
          'O pregúntame lo que sea con confianza 🔥'
        );
      }
      return user.idUsuario;
    }
  } catch (err) {
    console.error('❌ Error en manejarInicio:', err.message);
  }

  await enviarMensaje(from,
    '¡Hola! 👋 Soy tu asistente financiero 🤖💰\n\n' +
    'Para empezar, vincúlate con el correo de la app:\n\n' +
    '👉 *vincular tunombre@email.com*'
  );
  return null;
}

export async function manejarDesvinculacion(from, idUsuario) {
  try {
    const db = getFirestore();
    const doc = await db.collection('usuarios').doc(idUsuario).get();
    if (!doc.exists) {
      await enviarMensaje(from, 'No encontré tu cuenta vinculada 🤔');
      return;
    }
    await db.collection('usuarios').doc(idUsuario).update({
      whatsapp: ''
    });
    await enviarMensaje(from,
      '✅ Listo, desvinculé tu WhatsApp 🔌\n\n' +
      'Si quieres conectar otra cuenta:\n' +
      '*vincular correo@ejemplo.com*'
    );
  } catch (err) {
    console.error('❌ Error en manejarDesvinculacion:', err.message);
    await enviarMensaje(from, '❌ No pude desvincularte, intenta de nuevo 🙏');
  }
}

export async function manejarSincronizacion(from, idUsuario) {
  const db = getFirestore();
  await enviarMensaje(from, '🔄 DAME UN TOQUE, estoy importando datos desde la nube... ☁️');

  try {
    const doc = await db.collection('backups').doc(idUsuario).get();
    if (!doc.exists) {
      await enviarMensaje(from,
        '❌ No encontré respaldo en la nube 😅\n\n' +
        'Primero abre la app, ve a *Respaldos* y presiona *Subir a la nube*,\n' +
        'luego vuelve y escribe *sincronizar* ✅'
      );
      return;
    }

    const data = doc.data();
    let importados = 0;

    for (const t of (data.transacciones || [])) {
      if (!t.monto || !t.tipo) continue;
      await db.collection('transacciones').add({
        idUsuario,
        tipo: t.tipo,
        monto: t.monto,
        categoria: t.categoria || 'otros',
        descripcion: t.descripcion || null,
        fecha: t.fecha || new Date().toISOString().split('T')[0],
        fechaCreacion: t.fecha_creacion || new Date().toISOString(),
      });
      importados++;
    }

    for (const r of (data.recibos || [])) {
      if (!r.monto || !r.nombre_servicio) continue;
      await db.collection('recibos').add({
        idUsuario,
        nombreServicio: r.nombre_servicio,
        monto: r.monto,
        fechaVencimiento: r.fecha_vencimiento || new Date().toISOString().split('T')[0],
        estaPagado: r.esta_pagado === 1,
        estaPendiente: r.esta_pendiente === 1,
        fechaCreacion: r.fecha_creacion || new Date().toISOString(),
      });
    }

    for (const p of (data.presupuestos || [])) {
      if (!p.categoria || !p.monto_limite) continue;
      const todos = await db.collection('presupuestos')
        .where('idUsuario', '==', idUsuario)
        .get();
      let existe = false;
      todos.forEach(pDoc => {
        const d = pDoc.data();
        if (d.categoria === p.categoria && d.mes === p.mes && d.anio === p.anio) existe = true;
      });
      if (!existe) {
        await db.collection('presupuestos').add({
          idUsuario,
          categoria: p.categoria,
          montoLimite: p.monto_limite,
          montoGastado: p.monto_gastado || 0,
          mes: p.mes || new Date().getMonth() + 1,
          anio: p.anio || new Date().getFullYear(),
          fechaCreacion: p.fecha_creacion || new Date().toISOString(),
        });
      }
    }

    await enviarMensaje(from,
      `✅ ¡Importación completada! ${importados} transacciones sincronizadas ✅\n\n` +
      `Ahora escribe *resumen* para ver todo 📊`
    );

    if (importados === 0 && (data.recibos?.length || data.presupuestos?.length)) {
      await enviarMensaje(from, '(También importé recibos y presupuestos sin transacciones 👍)');
    }
  } catch (err) {
    console.error('❌ Error al sincronizar:', err.message);
    await enviarMensaje(from, '❌ Error al importar datos. Intenta de nuevo más tarde 🙏');
  }
}

export async function manejarVinculacion(from, texto) {
  const email = texto
    .replace(/^vincular\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '');

  if (!email || !email.includes('@') || !email.includes('.')) {
    await enviarMensaje(from, 'Ese correo no me cuadra 🤔\nEj: *vincular miguel@email.com*');
    return;
  }

  if (email.length > 100) {
    await enviarMensaje(from, 'Correo muy largo 🤨 mándame uno más cortito');
    return;
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const db = getFirestore();

    const vinculacionExistente = await db.collection('usuarios')
      .where('whatsapp', '==', from)
      .get();

    if (!vinculacionExistente.empty) {
      await enviarMensaje(from, 'Este WhatsApp ya está vinculado a una cuenta. Si quieres cambiarlo, escribe *desvincular* primero.');
      return;
    }

    await db.collection('usuarios').doc(userRecord.uid).set({
      idUsuario: userRecord.uid,
      nombreCompleto: userRecord.displayName || 'Usuario',
      correoElectronico: userRecord.email,
      whatsapp: from,
      fechaVinculacion: new Date().toISOString(),
    }, { merge: true });

    await enviarMensaje(from,
      `✅ ¡Vinculación exitosa! 🎉 ${userRecord.displayName || ''}\n\n` +
      `Ahora puedes manejar tus finanzas desde acá:\n` +
      `• "gasté 500 en comida" 🍔\n` +
      `• "resumen" 📊\n` +
      `• "presupuesto 2000 para transporte" 🚌`
    );
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      await enviarMensaje(from,
        '❌ No encontré usuario con ese correo en la app 😕\n\n' +
        '¿Ya creaste tu cuenta en la aplicación móvil? 📱\n' +
        'Pásame el mismo correo que usaste para registrarte.'
      );
    } else {
      console.error('❌ Error en vinculación:', err.message);
      await enviarMensaje(from, '❌ Algo falló al verificar tu correo. Intenta de nuevo más tarde 🙏');
    }
  }
}
