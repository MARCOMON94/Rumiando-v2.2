# Separacion entre asistencia veterinaria y acciones de app

## Decision actual de producto
La fase actual prioriza que la asistencia sanitaria previa funcione bien. Las acciones de aplicacion como cambios de corral, cambios de estado, tratamientos, bajas o movimientos masivos quedan preparadas como borrador y pendientes de rutas definitivas.

## Decision de arquitectura IA
De cara al usuario puede existir un unico chat, pero internamente la IA debe dividir la consulta por perfiles:
- veterinary: triaje, sanidad, reproduccion, tratamientos orientativos y manejo animal con prioridad de seguridad.
- management: convivencia entre especies, cama, bioseguridad, cuarentena, humedad, comederos y bebederos.
- app_query: consultas de datos vivos de la app como avisos, dashboard, busqueda por crotal/RFID o ficha.
- app_action: acciones preparables como cambio de corral, estados, movimientos o registros, siempre con confirmacion.
- memory: preguntas sobre lo hablado en la conversacion.

Cada perfil debe consultar solo sus carpetas RAG. Esto evita que una frase sanitaria como "no se mueve" se interprete como comando de movimiento, o que una duda de convivencia active confirmacion de accion.

## Lo que si puede hacer la IA ahora
- Responder dudas de manejo y sanidad con triaje.
- Usar RAG para recuperar documentos internos.
- Usar memoria de conversacion para entender preguntas anteriores.
- Preparar intencion de cambio de corral como borrador si detecta animales, destino y fecha.
- Indicar que la ejecucion requiere confirmacion.

## Lo que no debe decir
- No decir que ha ejecutado cambios reales si solo preparo el borrador.
- No registrar tratamiento como aplicado sin tool segura y confirmacion.
- No confirmar diagnosticos ni prescribir medicacion.
- No prometer rutas definitivas cuando estan pendientes.

## Acciones casi definitivas
- Cambio de corral individual o por lote.
- Estados gestacionales/productivos.
- Registro de caso sanitario.
- Avisos o recordatorios derivados de una consulta.

## Acciones pendientes de rutas definitivas
- Movimiento real en base de datos.
- Cambio masivo por lector RFID.
- Tratamiento con medicamento, dosis y periodo de retirada.
- Baja/muerte.
- Confirmacion oficial de enfermedad regulada.
