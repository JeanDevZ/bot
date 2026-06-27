import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import { fileURLToPath } from 'url';
import { modoMeme } from './utils/estado.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '..', 'session');
let sock;
let botJid = null;
const jidMap = {};
const grupoMap = {};

const ULTIMA_VEZ = {};
const COOLDOWN_MS = 300;

export async function iniciarCliente(alRecibirMensaje) {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

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
      console.log('🔴 ESCANEA ESTE QR CON WHATSAPP (el que usas normalmente):');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      botJid = sock.user?.id?.replace(/:.*$/, '') || null;
      console.log('✅ WhatsApp conectado exitosamente' + (botJid ? ` como ${botJid}` : ''));
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === 440) {
        console.log('❌ Conflicto de sesión (440). Cerrando sesión anterior y esperando 30s...');
        setTimeout(() => iniciarCliente(alRecibirMensaje), 30000);
      } else if (statusCode === 429) {
        console.log('⏳ Rate limited (429). Esperando 60s...');
        setTimeout(() => iniciarCliente(alRecibirMensaje), 60000);
      } else {
        console.log(`❌ Conexión cerrada (código: ${statusCode || '?'}). Reintentando en 10s...`);
        setTimeout(() => iniciarCliente(alRecibirMensaje), 10000);
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
