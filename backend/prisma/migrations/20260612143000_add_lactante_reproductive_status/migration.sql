INSERT INTO "CatalogoEstadoReproductivo" ("nombre", "orden", "activo", "cuentaGanaderaId", "createdAt", "updatedAt")
SELECT 'Lactante', 3, true, "CuentaGanadera"."id", NOW(), NOW()
FROM "CuentaGanadera"
WHERE NOT EXISTS (
  SELECT 1
  FROM "CatalogoEstadoReproductivo"
  WHERE "CatalogoEstadoReproductivo"."cuentaGanaderaId" = "CuentaGanadera"."id"
    AND "CatalogoEstadoReproductivo"."nombre" = 'Lactante'
);
