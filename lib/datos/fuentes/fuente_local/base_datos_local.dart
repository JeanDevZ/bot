/// Gestiona la conexión, creación de tablas y operaciones
/// sobre la base de datos local usando sqflite.

import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:flutter/foundation.dart';
import 'package:appmovil/nucleo/constantes/constantes_app.dart';

class BaseDatosLocal {
  static Database? _baseDatos;

  /// Obtiene la instancia de la base de datos (singleton).
  Future<Database> get baseDatos async {
    if (_baseDatos != null) return _baseDatos!;
    _baseDatos = await _inicializarBaseDatos();
    return _baseDatos!;
  }

  /// Inicializa la base de datos y crea las tablas.
  Future<Database> _inicializarBaseDatos() async {
    final rutaBaseDatos = await getDatabasesPath();
    final ruta = join(rutaBaseDatos, ConstantesApp.nombreBaseDatos);

    debugPrint('📦 Inicializando base de datos local en: $ruta');

    return await openDatabase(
      ruta,
      version: ConstantesApp.versionBaseDatos,
      onCreate: _crearTablas,
      onUpgrade: _actualizarTablas,
    );
  }

  /// Crea todas las tablas de la base de datos.
  Future<void> _crearTablas(Database bd, int version) async {
    debugPrint('🔨 Creando tablas de la base de datos...');

    // Tabla de usuarios
    await bd.execute('''
      CREATE TABLE usuarios (
        id_usuario TEXT PRIMARY KEY,
        nombre_completo TEXT NOT NULL,
        correo_electronico TEXT NOT NULL UNIQUE,
        fecha_creacion TEXT NOT NULL,
        esta_activo INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // Tabla de ingresos
    await bd.execute('''
      CREATE TABLE ingresos (
        id_ingreso INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario TEXT NOT NULL,
        monto REAL NOT NULL,
        categoria TEXT NOT NULL,
        descripcion TEXT,
        fecha TEXT NOT NULL,
        fecha_creacion TEXT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      )
    ''');

    // Tabla de gastos
    await bd.execute('''
      CREATE TABLE gastos (
        id_gasto INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario TEXT NOT NULL,
        monto REAL NOT NULL,
        categoria TEXT NOT NULL,
        descripcion TEXT,
        fecha TEXT NOT NULL,
        fecha_creacion TEXT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      )
    ''');

    // Tabla de recibos
    await bd.execute('''
      CREATE TABLE recibos (
        id_recibo INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario TEXT NOT NULL,
        nombre_servicio TEXT NOT NULL,
        monto REAL NOT NULL,
        fecha_vencimiento TEXT NOT NULL,
        esta_pagado INTEGER NOT NULL DEFAULT 0,
        esta_pendiente INTEGER NOT NULL DEFAULT 1,
        fecha_creacion TEXT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      )
    ''');

    // Tabla de presupuestos
    await bd.execute('''
      CREATE TABLE presupuestos (
        id_presupuesto INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario TEXT NOT NULL,
        categoria TEXT NOT NULL,
        monto_limite REAL NOT NULL,
        monto_gastado REAL NOT NULL DEFAULT 0,
        mes INTEGER NOT NULL,
        anio INTEGER NOT NULL,
        fecha_creacion TEXT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      )
    ''');

    // Tabla de conversaciones
    await bd.execute('''
      CREATE TABLE conversaciones (
        id_conversacion INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        es_usuario INTEGER NOT NULL DEFAULT 1,
        fecha_hora TEXT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      )
    ''');

    // Tabla de transacciones
    await bd.execute('''
      CREATE TABLE transacciones (
        id_transaccion INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario TEXT NOT NULL,
        tipo INTEGER NOT NULL,
        monto REAL NOT NULL,
        categoria TEXT NOT NULL,
        descripcion TEXT,
        fecha TEXT NOT NULL,
        fecha_creacion TEXT NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
      )
    ''');

    // Índices para optimización
    await bd.execute(
      'CREATE INDEX idx_ingresos_usuario ON ingresos(id_usuario)',
    );
    await bd.execute(
      'CREATE INDEX idx_ingresos_fecha ON ingresos(fecha)',
    );
    await bd.execute(
      'CREATE INDEX idx_gastos_usuario ON gastos(id_usuario)',
    );
    await bd.execute(
      'CREATE INDEX idx_gastos_fecha ON gastos(fecha)',
    );
    await bd.execute(
      'CREATE INDEX idx_transacciones_usuario ON transacciones(id_usuario)',
    );
    await bd.execute(
      'CREATE INDEX idx_transacciones_fecha ON transacciones(fecha)',
    );
    await bd.execute(
      'CREATE INDEX idx_transacciones_tipo ON transacciones(tipo)',
    );
    await bd.execute(
      'CREATE INDEX idx_recibos_usuario ON recibos(id_usuario)',
    );
    await bd.execute(
      'CREATE INDEX idx_presupuestos_usuario ON presupuestos(id_usuario)',
    );

    debugPrint('✅ Tablas creadas correctamente');
  }

  /// Actualiza las tablas cuando cambia la versión.
  Future<void> _actualizarTablas(
    Database bd,
    int versionAnterior,
    int versionNueva,
  ) async {
    debugPrint(
      '🔄 Actualizando BD de versión $versionAnterior a $versionNueva',
    );

    final tablas = await bd.rawQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%'",
    );
    final nombres = tablas.map((t) => t['name'] as String).toSet();

    if (!nombres.contains('transacciones')) {
      await bd.execute('''
        CREATE TABLE transacciones (
          id_transaccion INTEGER PRIMARY KEY AUTOINCREMENT,
          id_usuario TEXT NOT NULL,
          tipo INTEGER NOT NULL,
          monto REAL NOT NULL,
          categoria TEXT NOT NULL,
          descripcion TEXT,
          fecha TEXT NOT NULL,
          fecha_creacion TEXT NOT NULL,
          FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        )
      ''');
      debugPrint('➕ Tabla transacciones creada en migración');
    }
  }

  /// Cierra la conexión a la base de datos.
  Future<void> cerrar() async {
    final bd = await baseDatos;
    await bd.close();
    _baseDatos = null;
    debugPrint('🔒 Base de datos cerrada');
  }
}
