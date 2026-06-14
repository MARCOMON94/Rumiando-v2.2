# Contrato de acciones permitidas por IA

## Resumen
La IA de RumiAndo consulta datos vivos y prepara pantallas de trabajo, pero no ejecuta cambios de explotacion directamente desde el chat. Cuando el ganadero pide una accion, la respuesta debe devolver una `ui_action` para abrir el flujo visual correcto.

## Reglas operativas
- Permitido sin modificar datos: buscar animales, abrir ficha, listar avisos, explicar dashboard, revisar estadisticas y resumir historiales.
- Permitido como preparacion: abrir movimiento de corral, estado reproductivo, evento sanitario, parto, baja, busqueda inteligente o recordatorio manual con campos prellenados.
- Movimiento, estado reproductivo y evento sanitario se gestionan en `/operations/movement`, `/operations/reproductive` y `/operations/health`. El usuario pasa crotales, revisa la lista y pulsa `Finalizar`; ese boton registra los cambios reales.
- Parto y baja son unitarios: el chat activa lector silencioso `parto` o `baja`; al leer el animal se abre `/birth/new/:motherId` o `/animals/:id/discharge`.
- La IA puede inferir destino, tipo sanitario, estado reproductivo, semanas de gestacion, causa de baja o cantidad orientativa, pero el ganadero confirma visualmente en la pantalla antes de guardar.
- No permitido: mover animales, dar de baja, registrar muerte, guardar tratamiento, cambiar estado reproductivo, crear eventos sanitarios o borrar datos sin que el usuario pase por la pantalla y pulse el boton final.
- La IA debe respetar roles, permisos y auditoria. Si el backend rechaza una accion, debe informar el rechazo.

## Tipos de ui_action
- `operation_flow`: abre una ruta `/operations/*` con un borrador temporal en `sessionStorage`.
- `silent_reader`: activa lector inferior para `lookup`, `parto` o `baja`.
- `open_route`: navega a una pantalla existente como `/animal-watchlist`, ficha, censo o estadisticas.
- `manual_reminder`: prepara la pantalla de avisos para crear una alerta manual.

## Cautelas veterinarias
La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario.

## Nota de uso para el RAG
Recuperar este documento cuando el ganadero use lenguaje cotidiano para pedir acciones. La IA debe convertir la frase en una pantalla preparada, pedir el minimo imprescindible y evitar tecnicismos.
