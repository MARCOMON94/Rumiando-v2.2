CREATE TABLE "AlertSettings" (
  "id" SERIAL NOT NULL,
  "preset" TEXT NOT NULL DEFAULT 'ovino',
  "values" JSONB NOT NULL,
  "scopeKey" TEXT NOT NULL DEFAULT 'default',
  "cuentaGanaderaId" INTEGER NOT NULL,
  "unidadRegaId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertSettings_cuentaGanaderaId_scopeKey_key"
ON "AlertSettings"("cuentaGanaderaId", "scopeKey");

CREATE INDEX "AlertSettings_unidadRegaId_idx"
ON "AlertSettings"("unidadRegaId");

ALTER TABLE "AlertSettings"
ADD CONSTRAINT "AlertSettings_cuentaGanaderaId_fkey"
FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlertSettings"
ADD CONSTRAINT "AlertSettings_unidadRegaId_fkey"
FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
