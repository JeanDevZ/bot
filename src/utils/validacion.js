const CATEGORIAS = [
  'comida', 'transporte', 'vivienda', 'salud',
  'entretenimiento', 'educacion', 'ropa', 'otros',
];

const MAX_MENSAJE = 500;
const MONTO_MAX = 99999999;
const MONTO_MIN = 0.01;

export function esNumeroValido(valor) {
  if (valor === null || valor === undefined) return false;
  if (typeof valor !== 'number') return false;
  if (Number.isNaN(valor)) return false;
  if (!Number.isFinite(valor)) return false;
  if (valor <= 0) return false;
  if (valor > MONTO_MAX) return false;
  return true;
}

export function esTextoValido(texto) {
  if (!texto || typeof texto !== 'string') return false;
  if (texto.trim().length === 0) return false;
  if (texto.length > MAX_MENSAJE) return false;
  return true;
}

export function esCategoriaValida(categoria) {
  return CATEGORIAS.includes(categoria);
}

export function sanitizarJSON(texto) {
  return texto.replace(/```json|```/g, '').trim();
}

export function validarDatosIA(datos) {
  if (!datos || typeof datos !== 'object') return false;
  return true;
}

export function formatearFecha(fecha) {
  if (!fecha) return 'hoy';
  try {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
  } catch {
    return fecha;
  }
}

export function generarTimestamp() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}
