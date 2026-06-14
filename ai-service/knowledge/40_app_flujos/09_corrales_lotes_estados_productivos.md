# Catalogo revisable de corrales, lotes y estados

## Objetivo
Este documento ayuda a la IA a distinguir ubicacion fisica, lote de manejo y estado del animal. Tambien sirve como listado revisable de nombres que el producto puede cambiar antes del modelo final.

## Conceptos
- Corral fisico: donde esta el animal ahora.
- Lote de manejo: grupo con el que se gestiona.
- Estado productivo/reproductivo/sanitario: situacion actual del animal.
- Caso sanitario: evento o seguimiento clinico, no equivalente a corral.
- Movimiento: cambio de ubicacion, no diagnostico.

## Catalogo base actual de RumiAndo
Estos nombres tienen prioridad sobre sugerencias antiguas cuando la IA hable de la app:

### Corrales base
- Lactancia
- Reposicion/Cebo
- Produccion
- Lazareto
- Secado
- Gestacion
- Vacio
- Paridas
- Machos

### Estados reproductivos base
- No aplica
- No reproductor
- Vacia
- Productora
- Cubierta / Inseminada
- Gestante
- Parida
- Abortada
- Problema reproductivo
- Macho

### Regla de cambio de corral
Un corral puede tener `estadoReproductivoSugerido` y `aplicarEstadoAutomaticamente`.
Si el usuario confirma un cambio de corral, la app debe preguntar si aplica el estado sugerido.
Si el corral tiene automatico activado, la casilla aparece marcada por defecto. Si no, aparece como sugerencia.

## Corrales fisicos sugeridos
- General
- Nave 1, Nave 2, Nave 3
- Patio exterior
- Corral de machos
- Corral de hembras
- Paridera
- Preparto
- Posparto
- Lactacion
- Crias/corderos/cabritos
- Recria
- Reposicion
- Cebo
- Secado
- Gestantes
- Cubricion
- Lazareto/enfermeria
- Observacion
- Cuarentena
- Aislamiento contagioso
- Tratamiento
- Recuperacion
- Desvieje
- Salida/venta pendiente
- Baja temporal administrativa
- Corral de aves
- Zona de patos/ocas
- Zona de perros
- Zona de gatos controlados
- Zona de equinos

## Lotes de manejo sugeridos
- Lote general
- Lote de cubricion
- Lote de gestacion temprana
- Lote de gestacion avanzada
- Lote de preparto
- Lote de paridas
- Lote de lactacion
- Lote de secado
- Lote de recria
- Lote de reposicion
- Lote de cebo
- Lote sanitario en observacion
- Lote de tratamiento
- Lote de retirada de leche/carne
- Lote vacunacion pendiente
- Lote desparasitacion pendiente
- Lote revision podal
- Lote cuarentena entrada
- Lote salida/venta

## Estados reproductivos sugeridos
- Vacia/no gestante
- Cubierta
- Inseminada
- Monta natural
- Gestacion no confirmada
- Gestante confirmada
- Gestacion temprana
- Gestacion media
- Gestacion avanzada
- Proxima a parto
- En parto
- Parida
- Lactante
- Secado
- Aborto sospechado
- Aborto confirmado por veterinario
- Problema posparto
- Retencion de placenta
- Prolapso sospechado
- Infertil/repetidora
- Macho reproductor activo
- Macho en descanso

## Estados productivos sugeridos
- Produccion leche
- Produccion carne
- Mixto
- Cebo
- Recria
- Reposicion
- Desvieje
- Venta pendiente
- No productivo temporal
- Baja productiva

## Estados sanitarios sugeridos
- Sano/sin incidencias
- En observacion
- Caso sanitario abierto
- Urgencia veterinaria
- Aislamiento preventivo
- Sospecha contagiosa
- Sospecha enfermedad regulada
- Tratamiento activo
- Periodo de retirada
- Recuperacion
- Cronico
- Cojera
- Diarrea
- Respiratorio
- Ubre/mastitis sospechada
- Herida/trauma
- Reproductivo sanitario
- Neurologico
- Digestivo/timpanismo
- Parasitario
- Piel/ectoparasitos
- Fallecido pendiente de registro
- Baja confirmada

## Enfermedades o grupos para revisar nombres
- Lengua azul
- Brucelosis
- Paratuberculosis
- Scrapie/tembladera
- Ectima contagioso/orf/mal de boca
- Mamitis/mastitis
- Neumonia/respiratorio
- Clostridiosis/basquilla orientativa
- Coccidiosis
- Pedero/mal de pezuna
- Sarna
- Parasitos internos
- Parasitos externos
- Timpanismo
- Acidosis/intoxicacion alimentaria
- Abortos infecciosos
- Influenza aviar/gripe aviar
- Newcastle
- Colico equino
- Absceso por mordedura en gato
- Intoxicacion en perro/gato

## Reglas para la IA
- No convertir un corral en diagnostico. Estar en lazareto no significa tener una enfermedad concreta.
- No convertir una ubicacion en estado reproductivo sin confirmacion. Mover a paridera no confirma parto.
- Si una accion afecta a estado, corral, tratamiento, baja o retirada, debe pedir confirmacion.
- Si el usuario pregunta por nombres, proponer alternativas y marcar que el catalogo es revisable.
- Para lector RFID, usar el texto pegado como identificadores dentro de las pantallas `/operations/movement`, `/operations/reproductive` y `/operations/health`.
- Movimiento y estado reproductivo trabajan por lista de crotales; evento sanitario permite lista o corral completo.
- Finalizar lectura solo prepara resumen; Confirmar registra el endpoint real.
