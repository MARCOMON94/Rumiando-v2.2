-- CreateEnum
CREATE TYPE "TipoOperacionMovimiento" AS ENUM ('INDIVIDUAL', 'LOTE', 'CORRAL_COMPLETO');

-- CreateEnum
CREATE TYPE "EstadoProcesoMovimiento" AS ENUM ('PROCESADO', 'DUPLICADO_IGNORADO', 'NO_ENCONTRADO', 'YA_EN_DESTINO', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoCasoSanitario" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoRecordatorio" AS ENUM ('PENDIENTE', 'POSPUESTO', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrigenReglaRecordatorio" AS ENUM ('OVINO', 'CAPRINO', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "TipoExportacion" AS ENUM ('CENSO', 'VETERINARIO');

-- CreateEnum
CREATE TYPE "EstadoEnvioExportacion" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR');

-- CreateTable
CREATE TABLE "CatalogoEnfermedad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "declaracionObligatoria" BOOLEAN NOT NULL DEFAULT false,
    "requiereLazareto" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoEnfermedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoTransaccion" (
    "id" SERIAL NOT NULL,
    "tipoOperacion" "TipoOperacionMovimiento" NOT NULL,
    "motivo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumen" JSONB,
    "unidadRegaId" INTEGER NOT NULL,
    "corralOrigenId" INTEGER,
    "corralDestinoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimientoTransaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoAnimalDetalle" (
    "id" SERIAL NOT NULL,
    "crotalLeido" TEXT,
    "estadoProceso" "EstadoProcesoMovimiento" NOT NULL,
    "observaciones" TEXT,
    "transaccionId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "corralOrigenId" INTEGER,
    "corralDestinoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimientoAnimalDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoSanitario" (
    "id" SERIAL NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "signosClinicos" TEXT,
    "diagnosticoPresuntivo" TEXT,
    "diagnosticoConfirmado" TEXT,
    "gravedad" TEXT,
    "afectaBienestar" BOOLEAN NOT NULL DEFAULT false,
    "lazareto" BOOLEAN NOT NULL DEFAULT false,
    "avisoDeclaracionMostrado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoCasoSanitario" NOT NULL DEFAULT 'ABIERTO',
    "fechaCierre" TIMESTAMP(3),
    "resultado" TEXT,
    "unidadRegaId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "corralId" INTEGER,
    "enfermedadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasoSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TratamientoVeterinario" (
    "id" SERIAL NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "motivo" TEXT,
    "medicamentoProducto" TEXT NOT NULL,
    "principioActivo" TEXT,
    "dosisTexto" TEXT,
    "unidad" TEXT,
    "via" TEXT,
    "frecuencia" TEXT,
    "duracionDias" INTEGER,
    "retirada" TEXT,
    "documentoUrl" TEXT,
    "casoSanitarioId" INTEGER,
    "animalId" INTEGER,
    "corralId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TratamientoVeterinario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacunacion" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vacuna" TEXT NOT NULL,
    "loteVacuna" TEXT,
    "dosisTexto" TEXT,
    "via" TEXT,
    "revacunacionPrevista" BOOLEAN NOT NULL DEFAULT false,
    "fechaRevacunacion" TIMESTAMP(3),
    "reaccion" BOOLEAN NOT NULL DEFAULT false,
    "documentoUrl" TEXT,
    "unidadRegaId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "corralId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vacunacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Desparasitacion" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "principioActivo" TEXT,
    "dosisTexto" TEXT,
    "via" TEXT,
    "motivo" TEXT,
    "proximaDosisPrevista" BOOLEAN NOT NULL DEFAULT false,
    "fechaProximaDosis" TIMESTAMP(3),
    "reaccion" BOOLEAN NOT NULL DEFAULT false,
    "documentoUrl" TEXT,
    "unidadRegaId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "corralId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Desparasitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoReproductivo" (
    "id" SERIAL NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "semanasGestacion" INTEGER,
    "fechaPartoEstimada" TIMESTAMP(3),
    "observaciones" TEXT,
    "animalId" INTEGER NOT NULL,
    "estadoResultanteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoReproductivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recordatorio" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaObjetivo" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoRecordatorio" NOT NULL DEFAULT 'PENDIENTE',
    "pospuestoHasta" TIMESTAMP(3),
    "origenRegla" "OrigenReglaRecordatorio",
    "nota" TEXT,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "corralId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportacionRegistro" (
    "id" SERIAL NOT NULL,
    "tipoExportacion" "TipoExportacion" NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "emailDestino" TEXT NOT NULL,
    "estadoEnvio" "EstadoEnvioExportacion" NOT NULL DEFAULT 'PENDIENTE',
    "urlExcel" TEXT,
    "urlPdf" TEXT,
    "respuestaN8n" JSONB,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "unidadRegaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportacionRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoEnfermedad_cuentaGanaderaId_nombre_key" ON "CatalogoEnfermedad"("cuentaGanaderaId", "nombre");

-- AddForeignKey
ALTER TABLE "CatalogoEnfermedad" ADD CONSTRAINT "CatalogoEnfermedad_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoTransaccion" ADD CONSTRAINT "MovimientoTransaccion_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoTransaccion" ADD CONSTRAINT "MovimientoTransaccion_corralOrigenId_fkey" FOREIGN KEY ("corralOrigenId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoTransaccion" ADD CONSTRAINT "MovimientoTransaccion_corralDestinoId_fkey" FOREIGN KEY ("corralDestinoId") REFERENCES "Corral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoTransaccion" ADD CONSTRAINT "MovimientoTransaccion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoAnimalDetalle" ADD CONSTRAINT "MovimientoAnimalDetalle_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "MovimientoTransaccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoAnimalDetalle" ADD CONSTRAINT "MovimientoAnimalDetalle_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoAnimalDetalle" ADD CONSTRAINT "MovimientoAnimalDetalle_corralOrigenId_fkey" FOREIGN KEY ("corralOrigenId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoAnimalDetalle" ADD CONSTRAINT "MovimientoAnimalDetalle_corralDestinoId_fkey" FOREIGN KEY ("corralDestinoId") REFERENCES "Corral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoSanitario" ADD CONSTRAINT "CasoSanitario_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoSanitario" ADD CONSTRAINT "CasoSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoSanitario" ADD CONSTRAINT "CasoSanitario_corralId_fkey" FOREIGN KEY ("corralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoSanitario" ADD CONSTRAINT "CasoSanitario_enfermedadId_fkey" FOREIGN KEY ("enfermedadId") REFERENCES "CatalogoEnfermedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoVeterinario" ADD CONSTRAINT "TratamientoVeterinario_casoSanitarioId_fkey" FOREIGN KEY ("casoSanitarioId") REFERENCES "CasoSanitario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoVeterinario" ADD CONSTRAINT "TratamientoVeterinario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TratamientoVeterinario" ADD CONSTRAINT "TratamientoVeterinario_corralId_fkey" FOREIGN KEY ("corralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacunacion" ADD CONSTRAINT "Vacunacion_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacunacion" ADD CONSTRAINT "Vacunacion_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacunacion" ADD CONSTRAINT "Vacunacion_corralId_fkey" FOREIGN KEY ("corralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desparasitacion" ADD CONSTRAINT "Desparasitacion_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desparasitacion" ADD CONSTRAINT "Desparasitacion_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desparasitacion" ADD CONSTRAINT "Desparasitacion_corralId_fkey" FOREIGN KEY ("corralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReproductivo" ADD CONSTRAINT "EventoReproductivo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReproductivo" ADD CONSTRAINT "EventoReproductivo_estadoResultanteId_fkey" FOREIGN KEY ("estadoResultanteId") REFERENCES "CatalogoEstadoReproductivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recordatorio" ADD CONSTRAINT "Recordatorio_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recordatorio" ADD CONSTRAINT "Recordatorio_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recordatorio" ADD CONSTRAINT "Recordatorio_corralId_fkey" FOREIGN KEY ("corralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportacionRegistro" ADD CONSTRAINT "ExportacionRegistro_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportacionRegistro" ADD CONSTRAINT "ExportacionRegistro_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE SET NULL ON UPDATE CASCADE;
