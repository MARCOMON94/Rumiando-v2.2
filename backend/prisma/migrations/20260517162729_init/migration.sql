-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPERARIO');

-- CreateEnum
CREATE TYPE "SexoAnimal" AS ENUM ('MACHO', 'HEMBRA', 'CASTRADO', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "EstadoRegistroAnimal" AS ENUM ('ACTIVO', 'BAJA');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'OPERARIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaGanadera" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "titularNombre" TEXT,
    "nifCif" TEXT,
    "telefono" TEXT,
    "emailContacto" TEXT,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaGanadera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadRega" (
    "id" SERIAL NOT NULL,
    "codigoRega" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "municipio" TEXT,
    "provincia" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "especiePrincipalId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadRega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoEspecie" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoEspecie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoRaza" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoRaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoEstadoReproductivo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaGanaderaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoEstadoReproductivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corral" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoFuncional" TEXT,
    "capacidad" INTEGER,
    "aplicarEstadoAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "unidadRegaId" INTEGER NOT NULL,
    "estadoReproductivoSugeridoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Corral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" SERIAL NOT NULL,
    "crotal" TEXT NOT NULL,
    "numeroInterno" TEXT,
    "sexo" "SexoAnimal" NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "fechaEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" TEXT,
    "estadoRegistro" "EstadoRegistroAnimal" NOT NULL DEFAULT 'ACTIVO',
    "fechaSalida" TIMESTAMP(3),
    "destinoSalida" TEXT,
    "observaciones" TEXT,
    "unidadRegaId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "razaId" INTEGER,
    "corralActualId" INTEGER,
    "estadoReproductivoId" INTEGER,
    "madreId" INTEGER,
    "padreId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadRega_cuentaGanaderaId_codigoRega_key" ON "UnidadRega"("cuentaGanaderaId", "codigoRega");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoEspecie_cuentaGanaderaId_nombre_key" ON "CatalogoEspecie"("cuentaGanaderaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoRaza_cuentaGanaderaId_especieId_nombre_key" ON "CatalogoRaza"("cuentaGanaderaId", "especieId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoEstadoReproductivo_cuentaGanaderaId_nombre_key" ON "CatalogoEstadoReproductivo"("cuentaGanaderaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Corral_unidadRegaId_nombre_key" ON "Corral"("unidadRegaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_unidadRegaId_crotal_key" ON "Animal"("unidadRegaId", "crotal");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadRega" ADD CONSTRAINT "UnidadRega_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadRega" ADD CONSTRAINT "UnidadRega_especiePrincipalId_fkey" FOREIGN KEY ("especiePrincipalId") REFERENCES "CatalogoEspecie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoEspecie" ADD CONSTRAINT "CatalogoEspecie_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoRaza" ADD CONSTRAINT "CatalogoRaza_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoRaza" ADD CONSTRAINT "CatalogoRaza_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "CatalogoEspecie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoEstadoReproductivo" ADD CONSTRAINT "CatalogoEstadoReproductivo_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Corral" ADD CONSTRAINT "Corral_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Corral" ADD CONSTRAINT "Corral_estadoReproductivoSugeridoId_fkey" FOREIGN KEY ("estadoReproductivoSugeridoId") REFERENCES "CatalogoEstadoReproductivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_unidadRegaId_fkey" FOREIGN KEY ("unidadRegaId") REFERENCES "UnidadRega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "CatalogoEspecie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_razaId_fkey" FOREIGN KEY ("razaId") REFERENCES "CatalogoRaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_corralActualId_fkey" FOREIGN KEY ("corralActualId") REFERENCES "Corral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_estadoReproductivoId_fkey" FOREIGN KEY ("estadoReproductivoId") REFERENCES "CatalogoEstadoReproductivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_madreId_fkey" FOREIGN KEY ("madreId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
