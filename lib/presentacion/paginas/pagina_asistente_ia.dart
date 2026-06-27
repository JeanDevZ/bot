import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:appmovil/presentacion/bloc/autenticacion/bloc_autenticacion.dart';
import 'package:appmovil/presentacion/bloc/autenticacion/estado_autenticacion.dart';
import 'package:appmovil/presentacion/bloc/asistente_ia/bloc_asistente_ia.dart';
import 'package:appmovil/presentacion/bloc/asistente_ia/evento_asistente_ia.dart';
import 'package:appmovil/presentacion/bloc/asistente_ia/estado_asistente_ia.dart';
import 'package:appmovil/presentacion/widgets/burbuja_chat.dart';
import 'package:appmovil/presentacion/widgets/campo_consulta_ia.dart';
import 'package:appmovil/presentacion/widgets/indicador_escribiendo.dart';
import 'package:appmovil/presentacion/widgets/boton_sugerencia_ia.dart';

class PaginaAsistenteIA extends StatefulWidget {
  const PaginaAsistenteIA({super.key});

  @override
  State<PaginaAsistenteIA> createState() => _PaginaAsistenteIAState();
}

class _PaginaAsistenteIAState extends State<PaginaAsistenteIA> {
  final ScrollController _scrollController = ScrollController();
  late String _idUsuario;

  @override
  void initState() {
    super.initState();
    final estadoAuth = context.read<BlocAutenticacion>().state;
    _idUsuario = estadoAuth is EstadoAutenticacionAutenticado ? estadoAuth.usuario.idUsuario : '';
    context.read<BlocAsistenteIa>().add(EventoCargarHistorial(_idUsuario));
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _enviarPregunta(String pregunta) {
    context.read<BlocAsistenteIa>().add(
          EventoEnviarPregunta(idUsuario: _idUsuario, pregunta: pregunta),
        );
    Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
  }

  void _seleccionarSugerencia(String sugerencia) {
    context.read<BlocAsistenteIa>().add(
          EventoSeleccionarSugerencia(idUsuario: _idUsuario, sugerencia: sugerencia),
        );
    Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente Financiero'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: 'Limpiar conversación',
            onPressed: () {
              context.read<BlocAsistenteIa>().add(EventoLimpiarHistorial(_idUsuario));
            },
          ),
          IconButton(
            icon: const Icon(Icons.chat),
            tooltip: 'Chat por WhatsApp',
            onPressed: () async {
              final uri = Uri.parse(
                'https://wa.me/51916055728?text=${Uri.encodeComponent("Hola, quiero consultar mis finanzas")}',
              );
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
          ),
        ],
      ),
      body: BlocConsumer<BlocAsistenteIa, EstadoAsistenteIa>(
        listener: (context, state) {
          if (state is EstadoAsistenteIaHistorialCargado ||
              state is EstadoAsistenteIaMensajeEnviado ||
              state is EstadoAsistenteIaEscribiendo ||
              state is EstadoAsistenteIaRespuestaRecibida) {
            Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
          }
          if (state is EstadoAsistenteIaError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.mensaje)),
            );
          }
        },
        builder: (context, state) {
          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(8),
                  itemCount: state.historial.length + (state is EstadoAsistenteIaEscribiendo ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == state.historial.length) {
                      return const IndicadorEscribiendo();
                    }
                    final mensaje = state.historial[index];
                    return BurbujaChat(
                      mensaje: mensaje.mensaje,
                      esUsuario: mensaje.esUsuario,
                      fechaHora: mensaje.fechaHora,
                    );
                  },
                ),
              ),
              _construirSugerencias(),
              CampoConsultaIa(
                onEnviar: _enviarPregunta,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _construirSugerencias() {
    final sugerencias = [
      "¿Cuánto me queda?",
      "¿Puedo gastar en X?",
      "Recibos próximos",
      "Resumen del mes",
      "¿Cómo va mi presupuesto?",
    ];

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: sugerencias.length,
        itemBuilder: (context, index) {
          return BotonSugerenciaIa(
            sugerencia: sugerencias[index],
            onTap: () => _seleccionarSugerencia(sugerencias[index]),
          );
        },
      ),
    );
  }
}
