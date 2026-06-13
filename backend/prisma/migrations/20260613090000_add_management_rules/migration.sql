-- CreateEnum
CREATE TYPE "TipoReglaManejo" AS ENUM ('CORRAL_A_REPRODUCCION', 'REPRODUCCION_A_CORRAL');

-- CreateTable
CREATE TABLE "ManagementRule" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoReglaManejo" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "unidadRegaId" INTEGER,
    "triggerCorralId" INTEGER,
    "triggerEstadoReproductivoId" INTEGER,
    "triggerEventoReproductivo" "TipoEventoReproductivo",
    "targetCorralId" INTEGER,
    "targetEstadoReproductivoId" INTEGER,
    "targetEventoReproductivo" "TipoEventoReproductivo",
    "targetResultadoEvento" "ResultadoEventoReproductivo",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagementRule_cuentaGanaderaId_idx" ON "ManagementRule"("cuentaGanaderaId");

-- CreateIndex
CREATE INDEX "ManagementRule_tipo_idx" ON "ManagementRule"("tipo");

-- CreateIndex
CREATE INDEX "ManagementRule_triggerCorralId_idx" ON "ManagementRule"("triggerCorralId");

-- CreateIndex
CREATE INDEX "ManagementRule_targetCorralId_idx" ON "ManagementRule"("targetCorralId");

-- AddForeignKey
ALTER TABLE "ManagementRule" ADD CONSTRAINT "ManagementRule_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRule" ADD CONSTRAINT "ManagementRule_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRule" ADD CONSTRAINT "ManagementRule_triggerCorralId_fkey" FOREIGN KEY ("triggerCorralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRule" ADD CONSTRAINT "ManagementRule_triggerEstadoReproductivoId_fkey" FOREIGN KEY ("triggerEstadoReproductivoId") REFERENCES "CatalogoEstadoReproductivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRule" ADD CONSTRAINT "ManagementRule_targetCorralId_fkey" FOREIGN KEY ("targetCorralId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRule" ADD CONSTRAINT "ManagementRule_targetEstadoReproductivoId_fkey" FOREIGN KEY ("targetEstadoReproductivoId") REFERENCES "CatalogoEstadoReproductivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
