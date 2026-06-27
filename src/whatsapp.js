import makeWASocket, { makeCacheableSignalKeyStore, Browsers, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { modoMeme } from './utils/estado.js';
import { useFirestoreAuthState, limpiarSesionFirestore } from './utils/auth_firestore.js';

let sock;
let botJid = null;
const jidMap = {};
const grupoMap = {};
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 8;

const ULTIMA_VEZ = {};
const COOLDOWN_MS = 300;

function limpiarSession() {
  limpiarSesionFirestore();
  console.log('Sesión eliminada.');
}

export async function iniciarCliente(alRecibirMensaje) {
  let state, saveCreds;
  try {
    ({ state, saveCreds } = await useFirestoreAuthState());
  } catch (err) {
    console.error('Error al cargar estado de autenticación:', err.message);
    console.log('Limpiando sesión corrupta...');
    limpiarSession();
    ({ state, saveCreds } = await useFirestoreAuthState());
  }

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    browser: Browsers.windows('Desktop'),
    logger: pino({ level: 'error' }),
    printQRInTerminal: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    retryRequestDelayMs: 5000,
    maxRetries: 2,
    fireInitQueries: false,
    shouldSyncHistoryMessage: () => false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      console.log('📱 ESCANEA ESTE QR CON WHATSAPP (el que usas normalmente):');
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`;
      console.log(`🔗 Abre este link en tu navegador y escanea: ${url}`);
      qrcode.generate(qr, { small: true });
      reconnectAttempts = 0;
    }

    if (connection === 'open') {
      botJid = sock.user?.id?.replace(/:.*$/, '') || null;
      console.log('✅ WhatsApp conectado exitosamente' + (botJid ? ` como ${botJid}` : ''));
      reconnectAttempts = 0;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || '';

      console.log(`❌ Conexión cerrada (código: ${statusCode || '?'}, motivo: ${reason}). Intento #${reconnectAttempts + 1}`);

      switch (statusCode) {
        case DisconnectReason.restartRequired: // 515 - Baileys pide reinicio
          console.log('🔄 Baileys solicita reinicio (515). Reintentando en 3s...');
          setTimeout(() => iniciarCliente(alRecibirMensaje), 3000);
          break;

        case DisconnectReason.connectionReplaced: // 440 - conflicto de sesión
          console.log('🔄 Conflicto de sesión (440). Esperando 30s...');
          reconnectAttempts = 0;
          setTimeout(() => iniciarCliente(alRecibirMensaje), 30000);
          break;

        case DisconnectReason.connectionClosed: // 428 - cierre normal
        case DisconnectReason.connectionLost: // 408 - timeout
        case DisconnectReason.timedOut:
          reconnectAttempts++;
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log('🚨 Muchos errores de conexión seguidos. Limpiando sesión...');
            limpiarSession();
            reconnectAttempts = 0;
            setTimeout(() => iniciarCliente(alRecibirMensaje), 5000);
          } else {
            const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
            console.log(`🔄 Reintentando en ${delay / 1000}s... (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => iniciarCliente(alRecibirMensaje), delay);
          }
          break;

        case DisconnectReason.badSession: // 500 - sesión corrupta
          console.log('🚨 Sesión inválida (500). Limpiando y forzando nuevo QR...');
          limpiarSession();
          reconnectAttempts = 0;
          setTimeout(() => iniciarCliente(alRecibirMensaje), 3000);
          break;

        case DisconnectReason.loggedOut: // 401 - cerraron sesión
          console.log('🚨 Sesión cerrada remotamente (401). Limpiando y forzando nuevo QR...');
          limpiarSession();
          reconnectAttempts = 0;
          setTimeout(() => iniciarCliente(alRecibirMensaje), 3000);
          break;

        case DisconnectReason.unavailableService: // 503 - servicio no disponible
          console.log('⏳ Servicio no disponible (503). Esperando 60s...');
          setTimeout(() => iniciarCliente(alRecibirMensaje), 60000);
          break;

        default:
          reconnectAttempts++;
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log('🚨 Demasiados errores seguidos. Limpiando sesión...');
            limpiarSession();
            reconnectAttempts = 0;
            setTimeout(() => iniciarCliente(alRecibirMensaje), 5000);
          } else {
            const delay = Math.min(10000 * Math.pow(1.3, reconnectAttempts - 1), 30000);
            console.log(`🔄 Error desconocido. Reintentando en ${delay / 1000}s...`);
            setTimeout(() => iniciarCliente(alRecibirMensaje), delay);
          }
          break;
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid;
        const esGrupo = remoteJid.endsWith('@g.us');

        if (!esGrupo) {
          const from = remoteJid.replace(/@.*$/, '');
          jidMap[from] = remoteJid;

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            '';

          if (!text.trim()) continue;

          const ahora = Date.now();
          if (ULTIMA_VEZ[from] && (ahora - ULTIMA_VEZ[from]) < COOLDOWN_MS) continue;
          ULTIMA_VEZ[from] = ahora;

          console.log(`📩 De: ${from} - Dice: ${text.trim()}`);

          await sock.sendPresenceUpdate('composing', remoteJid);
          await alRecibirMensaje(from, text.trim());
        } else {
          const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (!botJid || !mentioned.includes(botJid)) continue;

          const participante = msg.key.participant || remoteJid;
          const from = participante.replace(/@.*$/, '');
          jidMap[from] ||= participante;
          grupoMap[from] = remoteJid;
          modoMeme.add(from);

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            '';

          const textoSinMencion = text.replace(/@\S+/g, '').trim();
          if (!textoSinMencion) continue;

          const ahora = Date.now();
          if (ULTIMA_VEZ[`g:${from}`] && (ahora - ULTIMA_VEZ[`g:${from}`]) < COOLDOWN_MS) continue;
          ULTIMA_VEZ[`g:${from}`] = ahora;

          console.log(`📩 Grupo: ${remoteJid.replace(/@.*$/, '')} - ${from}: ${textoSinMencion}`);

          await sock.sendPresenceUpdate('composing', remoteJid);
          await alRecibirMensaje(from, textoSinMencion);
        }
      } catch (err) {
        console.error(`❌ Error al procesar mensaje:`, err.message);
      }
    }
  });

  return sock;
}

export async function enviarMensaje(to, texto) {
  if (!sock) {
    console.warn('⚠️ WhatsApp no conectado, no se puede enviar mensaje');
    return;
  }

  const grupoJid = grupoMap[to];

  if (grupoJid) {
    const mencion = jidMap[to] || `${to}@s.whatsapp.net`;
    try {
      await sock.sendMessage(grupoJid, {
        text: `👤 *@${to}* ${texto}`,
        mentions: [mencion],
      });
    } catch (err) {
      console.error(`❌ Error al enviar a grupo ${grupoJid}:`, err.message);
    }
    return;
  }

  const jid = jidMap[to] || `${to}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text: texto });
  } catch (err) {
    console.error(`❌ Error al enviar mensaje a ${to}:`, err.message);
  }
}

export async function enviarBotones(to, texto, botones) {
  await enviarMensaje(to, `${texto}\n\n${botones.map((b, i) => `${i + 1}. ${b}`).join('\n')}`);
}
