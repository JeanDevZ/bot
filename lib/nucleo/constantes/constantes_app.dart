/// Centraliza todas las URLs, claves, tiempos de espera
/// y valores fijos utilizados en la aplicación.

class ConstantesApp {
  // ─── Información de la Aplicación ────────────────────────
  static const String nombreApp = 'Finanzas Personales';
  static const String versionApp = '1.0.0';

  // ─── URLs de la API ──────────────────────────────────────
  static const String urlBaseApi = 'http://10.0.2.2:3000/api';
  static const String rutaUsuarios = '/usuarios';
  static const String rutaIngresos = '/ingresos';
  static const String rutaGastos = '/gastos';
  static const String rutaRecibos = '/recibos';
  static const String rutaPresupuestos = '/presupuestos';
  static const String rutaConversaciones = '/conversaciones';
  static const String rutaAsistenteIA = '/asistente-ia';

  // ─── Tiempos de Espera (en milisegundos) ─────────────────
  static const int tiempoEsperaConexion = 30000;
  static const int tiempoEsperaRecepcion = 30000;
  static const int tiempoEsperaEnvio = 30000;

  // ─── Claves de Preferencias Compartidas ──────────────────
  static const String claveToken = 'token_jwt';
  static const String claveIdUsuario = 'id_usuario';
  static const String claveCorreoUsuario = 'correo_usuario';
  static const String claveNombreUsuario = 'nombre_usuario';
  static const String claveTemaOscuro = 'tema_oscuro';
  static const String claveRecordarSesion = 'recordar_sesion';
  static const String claveContrasenaGuardada = 'contrasena_guardada';

  // ─── Base de Datos Local ─────────────────────────────────
  static const String nombreBaseDatos = 'finanzas_personales.db';
  static const int versionBaseDatos = 2;

  // ─── Categorías de Ingresos ──────────────────────────────
  static const List<String> categoriasIngreso = [
    'Salario',
    'Freelance',
    'Inversiones',
    'Otros',
  ];

  // ─── Categorías de Gastos ────────────────────────────────
  static const List<String> categoriasGasto = [
    'Comida',
    'Transporte',
    'Ocio',
    'Servicios',
    'Salud',
    'Educación',
    'Otros',
  ];

  // ─── Validaciones ────────────────────────────────────────
  static const int longitudMinimaContrasena = 6;
  static const int longitudMaximaDescripcion = 200;

  // ─── Mensajes de Error ───────────────────────────────────
  static const String errorConexion = 'Error de conexión. Verifica tu internet.';
  static const String errorServidor = 'Error del servidor. Intenta más tarde.';
  static const String errorDesconocido = 'Ocurrió un error inesperado.';
  static const String errorCredencialesInvalidas = 'Correo o contraseña incorrectos.';
  static const String errorCorreoRegistrado = 'Este correo ya está registrado.';
  static const String errorContrasenaDebil = 'La contraseña debe tener al menos 6 caracteres.';

  /// Constructor privado para evitar instanciación.
  ConstantesApp._();
}
