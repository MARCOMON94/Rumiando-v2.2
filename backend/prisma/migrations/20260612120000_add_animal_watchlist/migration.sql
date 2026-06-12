-- CreateTable
CREATE TABLE "AnimalWatchlistItem" (
    "id" SERIAL NOT NULL,
    "motivoTipo" TEXT,
    "motivoTexto" TEXT,
    "sourceType" TEXT,
    "sourceRef" TEXT,
    "seenAt" TIMESTAMP(3),
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalWatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalWatchlistItem_userId_animalId_key" ON "AnimalWatchlistItem"("userId", "animalId");

-- CreateIndex
CREATE INDEX "AnimalWatchlistItem_cuentaGanaderaId_idx" ON "AnimalWatchlistItem"("cuentaGanaderaId");

-- CreateIndex
CREATE INDEX "AnimalWatchlistItem_animalId_idx" ON "AnimalWatchlistItem"("animalId");

-- AddForeignKey
ALTER TABLE "AnimalWatchlistItem" ADD CONSTRAINT "AnimalWatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalWatchlistItem" ADD CONSTRAINT "AnimalWatchlistItem_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalWatchlistItem" ADD CONSTRAINT "AnimalWatchlistItem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
