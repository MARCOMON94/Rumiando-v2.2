ALTER TABLE "Animal"
ADD COLUMN "crotalDefinitivo" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Animal" AS a
SET "crotalDefinitivo" = false
FROM "CatalogoEstadoReproductivo" AS cer
WHERE a."estadoReproductivoId" = cer."id"
  AND a."estadoRegistro" = 'ACTIVO'
  AND (
    LOWER(COALESCE(a."origen", '')) LIKE '%nacimiento%'
    OR LOWER(COALESCE(a."observaciones", '')) LIKE '%parto%'
    OR LOWER(COALESCE(a."observaciones", '')) LIKE '%alta creada desde flujo%'
  )
  AND LOWER(cer."nombre") = 'lactante';
