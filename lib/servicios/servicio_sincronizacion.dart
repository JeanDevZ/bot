import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:appmovil/datos/modelos/transaccion.dart';
import 'package:appmovil/datos/modelos/recibo.dart';
import 'package:appmovil/datos/modelos/presupuesto.dart';
import 'package:appmovil/datos/fuentes/fuente_local/preferencias_compartidas.dart';

class ServicioSincronizacion {
  static ServicioSincronizacion? _instancia;
  final FirebaseFirestore _firestore;

  ServicioSincronizacion._internal()
      : _firestore = FirebaseFirestore.instance;

  static ServicioSincronizacion get instance {
    _instancia ??= ServicioSincronizacion._internal();
    return _instancia!;
  }

  Future<void> _guardarTimestamp() async {
    final now = DateTime.now();
    final fecha = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')} ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    await PreferenciasCompartidas().guardarUltimaSincronizacion(fecha);
  }

  Future<void> sincronizarTransaccion(Transaccion t) async {
    try {
      await _firestore.collection('transacciones').add({
        'idUsuario': t.idUsuario,
        'tipo': t.tipo,
        'monto': t.monto,
        'categoria': t.categoria,
        'descripcion': t.descripcion,
        'fecha': t.fecha.toIso8601String().split('T')[0],
        'fechaCreacion': (t.fechaCreacion ?? DateTime.now()).toIso8601String(),
      });
      await _guardarTimestamp();
      debugPrint('☁️ [${DateTime.now().toString().substring(0, 19)}] Transacción sincronizada ✅');
    } catch (e) {
      debugPrint('⚠️ [${DateTime.now().toString().substring(0, 19)}] Sync transacción pendiente (offline): $e');
    }
  }

  Future<void> sincronizarRecibo(Recibo r) async {
    try {
      await _firestore.collection('recibos').add({
        'idUsuario': r.idUsuario,
        'nombreServicio': r.nombreServicio,
        'monto': r.monto,
        'fechaVencimiento': r.fechaVencimiento.toIso8601String().split('T')[0],
        'estaPagado': r.estaPagado,
        'estaPendiente': r.estaPendiente,
        'fechaCreacion': (r.fechaCreacion ?? DateTime.now()).toIso8601String(),
      });
      await _guardarTimestamp();
      debugPrint('☁️ [${DateTime.now().toString().substring(0, 19)}] Recibo sincronizado ✅');
    } catch (e) {
      debugPrint('⚠️ [${DateTime.now().toString().substring(0, 19)}] Sync recibo pendiente (offline): $e');
    }
  }

  Future<void> sincronizarPresupuesto(Presupuesto p) async {
    try {
      await _firestore.collection('presupuestos').add({
        'idUsuario': p.idUsuario,
        'categoria': p.categoria,
        'montoLimite': p.montoLimite,
        'montoGastado': p.montoGastado,
        'mes': p.mes,
        'anio': p.anio,
        'fechaCreacion': (p.fechaCreacion ?? DateTime.now()).toIso8601String(),
      });
      await _guardarTimestamp();
      debugPrint('☁️ [${DateTime.now().toString().substring(0, 19)}] Presupuesto sincronizado ✅');
    } catch (e) {
      debugPrint('⚠️ [${DateTime.now().toString().substring(0, 19)}] Sync presupuesto pendiente (offline): $e');
    }
  }

  Future<void> sincronizarTodo(String idUsuario) async {
    try {
      final db = FirebaseFirestore.instance;
      final doc = await db.collection('backups').doc(idUsuario).get();
      if (!doc.exists) return;

      final data = doc.data()!;

      final [existentesTrans, existentesRec, existentesPres] = await Future.wait([
        db.collection('transacciones').where('idUsuario', isEqualTo: idUsuario).get(),
        db.collection('recibos').where('idUsuario', isEqualTo: idUsuario).get(),
        db.collection('presupuestos').where('idUsuario', isEqualTo: idUsuario).get(),
      ]);

      if (existentesTrans.docs.isNotEmpty || existentesRec.docs.isNotEmpty || existentesPres.docs.isNotEmpty) {
        debugPrint('☁️ Datos ya sincronizados, omitiendo sincronización completa');
        return;
      }

      final batch = db.batch();

      for (final t in (data['transacciones'] as List? ?? [])) {
        final map = Map<String, dynamic>.from(t as Map);
        final ref = db.collection('transacciones').doc();
        batch.set(ref, {
          'idUsuario': map['id_usuario'],
          'tipo': map['tipo'],
          'monto': (map['monto'] as num).toDouble(),
          'categoria': map['categoria'],
          'descripcion': map['descripcion'],
          'fecha': map['fecha'],
          'fechaCreacion': map['fecha_creacion'] ?? DateTime.now().toIso8601String(),
        });
      }

      for (final r in (data['recibos'] as List? ?? [])) {
        final map = Map<String, dynamic>.from(r as Map);
        final ref = db.collection('recibos').doc();
        batch.set(ref, {
          'idUsuario': map['id_usuario'],
          'nombreServicio': map['nombre_servicio'],
          'monto': (map['monto'] as num).toDouble(),
          'fechaVencimiento': map['fecha_vencimiento'],
          'estaPagado': map['esta_pagado'] == 1,
          'estaPendiente': map['esta_pendiente'] == 1,
          'fechaCreacion': map['fecha_creacion'] ?? DateTime.now().toIso8601String(),
        });
      }

      for (final p in (data['presupuestos'] as List? ?? [])) {
        final map = Map<String, dynamic>.from(p as Map);
        final ref = db.collection('presupuestos').doc();
        batch.set(ref, {
          'idUsuario': map['id_usuario'],
          'categoria': map['categoria'],
          'montoLimite': (map['monto_limite'] as num).toDouble(),
          'montoGastado': (map['monto_gastado'] as num?)?.toDouble() ?? 0.0,
          'mes': map['mes'],
          'anio': map['anio'],
          'fechaCreacion': map['fecha_creacion'] ?? DateTime.now().toIso8601String(),
        });
      }

      await batch.commit();
      await _guardarTimestamp();
      debugPrint('☁️ Sincronización completa desde backup ✅');
    } catch (e) {
      debugPrint('⚠️ Error en sincronización completa: $e');
    }
  }
}
