# Inventario de limpieza frontend

Fecha: 2026-06-14

## Estados
- `activo`: pantalla o componente usado por el flujo actual.
- `legacy`: flujo antiguo sustituido por otro.
- `duplicado`: funcionalidad ya cubierta en otra pantalla nueva.
- `solo backend`: frontend puede ocultarse, pero los endpoints siguen vivos.
- `candidato a comentar`: puede desactivarse temporalmente para verificar.
- `candidato a borrar despues`: solo borrar tras varios builds/tests y prueba manual.

## Activos claros
- `HomePage`: menu principal, configuracion, lector silencioso y accesos a flujos.
- `AppLayout`: barra inferior, lector silencioso global, badge de avisos y navegacion protegida.
- `AiChatPage`: chat IA con `ui_action`, abre flujos reales.
- `OperationFlowPage`: movimiento, estado reproductivo y evento sanitario por lector/lista.
- `AnimalWatchlistPage`: Busqueda inteligente persistente por usuario.
- `AnimalDetailPage`: ficha, busqueda inteligente, alerta manual, parto/baja.
- `AnimalsPage`: censo con filtros, alerta, busqueda inteligente y ficha.
- `BirthNewPage` y `AnimalDischargePage`: parto y baja desde lector.
- `DashboardPage`: estadisticas, graficas, listado y exportaciones.
- `RemindersPage`: avisos automaticos y acciones sobre animales.
- Paneles de configuracion: cuenta, usuario, corrales, avisos, automatizaciones y anadir animales.

## Legacy o duplicado
- `OperationSessionProvider`: legacy; desactivado en `main.jsx` con comentario `CLEANUP-CANDIDATE`.
- `OperationSessionPanel`: legacy; no debe importarse desde chat ni Home.
- `operationConfig`: legacy ligado a `OperationSessionPanel`.
- `AnimalReaderPanel`: legacy usado por `CreateMovementPage` y `OperationSessionPanel`.
- `CreateMovementPage`: legacy; ruta `/movements/new` redirige a `/operations/movement`.

## Rutas a auditar antes de ocultar
- `/movements`: puede seguir como historico/listado; conservar por ahora.
- `/pens`: listado simple; posible duplicado con Configuracion > Corrales. Mantener hasta confirmar que el panel nuevo cubre todo.
- `/health`: listado simple de casos sanitarios; posible duplicado con ficha/censo/estadisticas. Mantener hasta decidir vista historica.
- `/automation`: resumen de avisos automaticos; posible duplicado con Avisos. Mantener hasta revisar si aporta datos no visibles.

## Backend que no debe borrarse
- `pens`, `movements`, `health-cases`, `vaccinations`, `dewormings`, `reproductive-events`, `automation`, `analytics`, `animal-watchlist`, `management-rules`, `alert-settings`.
- Aunque una ruta frontend se oculte, las operaciones nuevas y la IA siguen usando estos endpoints.

## Protocolo para borrar despues
1. Dejar el archivo o ruta comentado una tanda completa.
2. Ejecutar lint, build, tests backend y pruebas IA.
3. Probar manualmente Home, lector, Busqueda inteligente, operaciones, parto, baja, censo, avisos, configuracion y chat.
4. Solo entonces borrar archivo/import/ruta y actualizar este inventario.
