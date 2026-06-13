-- AlterTable
ALTER TABLE "UnidadRega" ADD COLUMN "razaPrincipalId" INTEGER;

-- AddForeignKey
ALTER TABLE "UnidadRega" ADD CONSTRAINT "UnidadRega_razaPrincipalId_fkey" FOREIGN KEY ("razaPrincipalId") REFERENCES "CatalogoRaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;
