/*
  Warnings:

  - Changed the type of `tipoEvento` on the `EventoReproductivo` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoEventoReproductivo" AS ENUM ('CUBRICION', 'INSEMINACION', 'DIAGNOSTICO_GESTACION', 'PARTO', 'ABORTO', 'SECADO', 'BAJA_REPRODUCTIVA', 'REVISION_REPRODUCTIVA');

-- CreateEnum
CREATE TYPE "ResultadoEventoReproductivo" AS ENUM ('POSITIVO', 'NEGATIVO', 'DUDOSO', 'NO_APLICA');

-- AlterTable
ALTER TABLE "EventoReproductivo" ADD COLUMN     "numeroCriasMuertas" INTEGER,
ADD COLUMN     "numeroCriasVivas" INTEGER,
ADD COLUMN     "resultado" "ResultadoEventoReproductivo" NOT NULL DEFAULT 'NO_APLICA',
DROP COLUMN "tipoEvento",
ADD COLUMN     "tipoEvento" "TipoEventoReproductivo" NOT NULL;
