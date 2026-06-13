DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoDesparasitanteCatalogo') THEN
    CREATE TYPE "TipoDesparasitanteCatalogo" AS ENUM ('INTERNA', 'EXTERNA', 'MIXTA');
  END IF;
END $$;

ALTER TABLE "CatalogoEnfermedad"
  ADD COLUMN IF NOT EXISTS "gravedadSugerida" TEXT,
  ADD COLUMN IF NOT EXISTS "aliases" JSONB,
  ADD COLUMN IF NOT EXISTS "especieId" INTEGER;

CREATE TABLE IF NOT EXISTS "CatalogoVacuna" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "aliases" JSONB,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "cuentaGanaderaId" INTEGER NOT NULL,
  "especieId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogoVacuna_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogoDesparasitante" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo" "TipoDesparasitanteCatalogo" NOT NULL DEFAULT 'INTERNA',
  "principioActivo" TEXT,
  "aliases" JSONB,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "cuentaGanaderaId" INTEGER NOT NULL,
  "especieId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogoDesparasitante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogoVacuna_cuentaGanaderaId_nombre_key" ON "CatalogoVacuna"("cuentaGanaderaId", "nombre");
CREATE INDEX IF NOT EXISTS "CatalogoVacuna_cuentaGanaderaId_idx" ON "CatalogoVacuna"("cuentaGanaderaId");
CREATE INDEX IF NOT EXISTS "CatalogoVacuna_especieId_idx" ON "CatalogoVacuna"("especieId");

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogoDesparasitante_cuentaGanaderaId_nombre_key" ON "CatalogoDesparasitante"("cuentaGanaderaId", "nombre");
CREATE INDEX IF NOT EXISTS "CatalogoDesparasitante_cuentaGanaderaId_idx" ON "CatalogoDesparasitante"("cuentaGanaderaId");
CREATE INDEX IF NOT EXISTS "CatalogoDesparasitante_especieId_idx" ON "CatalogoDesparasitante"("especieId");

CREATE INDEX IF NOT EXISTS "CatalogoEnfermedad_especieId_idx" ON "CatalogoEnfermedad"("especieId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogoEnfermedad_especieId_fkey') THEN
    ALTER TABLE "CatalogoEnfermedad" ADD CONSTRAINT "CatalogoEnfermedad_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "CatalogoEspecie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogoVacuna_cuentaGanaderaId_fkey') THEN
    ALTER TABLE "CatalogoVacuna" ADD CONSTRAINT "CatalogoVacuna_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogoVacuna_especieId_fkey') THEN
    ALTER TABLE "CatalogoVacuna" ADD CONSTRAINT "CatalogoVacuna_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "CatalogoEspecie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogoDesparasitante_cuentaGanaderaId_fkey') THEN
    ALTER TABLE "CatalogoDesparasitante" ADD CONSTRAINT "CatalogoDesparasitante_cuentaGanaderaId_fkey" FOREIGN KEY ("cuentaGanaderaId") REFERENCES "CuentaGanadera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogoDesparasitante_especieId_fkey') THEN
    ALTER TABLE "CatalogoDesparasitante" ADD CONSTRAINT "CatalogoDesparasitante_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "CatalogoEspecie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

WITH species_seed(nombre) AS (
  VALUES ('Ovino'), ('Caprino'), ('Equino'), ('Vacuno'), ('Porcino'), ('Otras especies')
)
INSERT INTO "CatalogoEspecie" ("nombre", "activo", "cuentaGanaderaId", "createdAt", "updatedAt")
SELECT species_seed.nombre, true, "CuentaGanadera"."id", NOW(), NOW()
FROM "CuentaGanadera"
CROSS JOIN species_seed
WHERE NOT EXISTS (
  SELECT 1
  FROM "CatalogoEspecie"
  WHERE "CatalogoEspecie"."cuentaGanaderaId" = "CuentaGanadera"."id"
    AND "CatalogoEspecie"."nombre" = species_seed.nombre
);

WITH breed_seed(especie, nombre) AS (
  VALUES
    ('Ovino', 'Manchega'),
    ('Ovino', 'Merina'),
    ('Ovino', 'Canaria'),
    ('Ovino', 'Assaf'),
    ('Ovino', 'Lacaune'),
    ('Ovino', 'Latxa'),
    ('Ovino', 'Segureña'),
    ('Ovino', 'Churra'),
    ('Ovino', 'Castellana'),
    ('Ovino', 'Rasa Aragonesa'),
    ('Ovino', 'Otra raza'),
    ('Caprino', 'Majorera'),
    ('Caprino', 'Murciano-Granadina'),
    ('Caprino', 'Malagueña'),
    ('Caprino', 'Florida'),
    ('Caprino', 'Palmera'),
    ('Caprino', 'Tinerfeña'),
    ('Caprino', 'Payoya'),
    ('Caprino', 'Verata'),
    ('Caprino', 'Blanca Celtibérica'),
    ('Caprino', 'Otra raza'),
    ('Equino', 'Pura Raza Española'),
    ('Equino', 'Hispano-Árabe'),
    ('Equino', 'Caballo de Deporte Español'),
    ('Equino', 'Asturcón'),
    ('Equino', 'Burguete'),
    ('Equino', 'Pottoka'),
    ('Equino', 'Menorquina'),
    ('Equino', 'Árabe'),
    ('Equino', 'Anglo-Árabe'),
    ('Equino', 'Otra raza'),
    ('Vacuno', 'Frisona'),
    ('Vacuno', 'Rubia Gallega'),
    ('Vacuno', 'Retinta'),
    ('Vacuno', 'Asturiana de los Valles'),
    ('Vacuno', 'Asturiana de la Montaña'),
    ('Vacuno', 'Avileña-Negra Ibérica'),
    ('Vacuno', 'Limusina'),
    ('Vacuno', 'Charolesa'),
    ('Vacuno', 'Parda de Montaña'),
    ('Vacuno', 'Lidia'),
    ('Vacuno', 'Pirenaica'),
    ('Vacuno', 'Otra raza'),
    ('Porcino', 'Ibérico'),
    ('Porcino', 'Duroc'),
    ('Porcino', 'Landrace'),
    ('Porcino', 'Large White'),
    ('Porcino', 'Pietrain'),
    ('Porcino', 'Chato Murciano'),
    ('Porcino', 'Gochu Asturcelta'),
    ('Porcino', 'Porco Celta'),
    ('Porcino', 'Euskal Txerria'),
    ('Porcino', 'Negra Canaria'),
    ('Porcino', 'Otra raza'),
    ('Otras especies', 'Otros animales')
)
INSERT INTO "CatalogoRaza" ("nombre", "activo", "cuentaGanaderaId", "especieId", "createdAt", "updatedAt")
SELECT breed_seed.nombre, true, especie."cuentaGanaderaId", especie."id", NOW(), NOW()
FROM breed_seed
JOIN "CatalogoEspecie" especie ON especie."nombre" = breed_seed.especie
WHERE NOT EXISTS (
  SELECT 1
  FROM "CatalogoRaza"
  WHERE "CatalogoRaza"."cuentaGanaderaId" = especie."cuentaGanaderaId"
    AND "CatalogoRaza"."especieId" = especie."id"
    AND "CatalogoRaza"."nombre" = breed_seed.nombre
);

UPDATE "CatalogoEnfermedad"
SET "aliases" = '["mamitis","ubres","ubre mala","mastitis"]'::jsonb,
    "gravedadSugerida" = COALESCE("gravedadSugerida", 'MEDIA')
WHERE "nombre" = 'Mamitis clínica';

UPDATE "CatalogoEnfermedad"
SET "aliases" = '["cojera","cojeras","patas","podredumbre de pezuña","pedero"]'::jsonb,
    "gravedadSugerida" = COALESCE("gravedadSugerida", 'MEDIA')
WHERE "nombre" = 'Pododermatitis / cojeras';

UPDATE "CatalogoEnfermedad"
SET "aliases" = '["coccidios","diarrea de recría","diarrea cria"]'::jsonb,
    "gravedadSugerida" = COALESCE("gravedadSugerida", 'MEDIA')
WHERE "nombre" = 'Coccidiosis';

UPDATE "CatalogoEnfermedad"
SET "aliases" = '["parasitos","lombrices","gusanos","parasitos intestinales"]'::jsonb,
    "gravedadSugerida" = COALESCE("gravedadSugerida", 'LEVE')
WHERE "nombre" = 'Parasitosis gastrointestinal';

UPDATE "CatalogoEnfermedad"
SET "aliases" = '["pulmonia","tos","respiratorio","neumonia"]'::jsonb,
    "gravedadSugerida" = COALESCE("gravedadSugerida", 'GRAVE')
WHERE "nombre" = 'Neumonía';

WITH vaccine_seed(especie, nombre, aliases) AS (
  VALUES
    (NULL, 'Lengua azul', '["lengua azul","btv","blue tongue"]'::jsonb),
    (NULL, 'Clostridial polivalente', '["clostridial","basquilla","enterotoxemia","vacuna de basquilla"]'::jsonb),
    (NULL, 'Agalaxia contagiosa', '["agalaxia","agalaxia contagiosa"]'::jsonb),
    ('Equino', 'Influenza equina', '["gripe equina","influenza"]'::jsonb),
    ('Equino', 'Rinoneumonitis equina', '["rinoneumonitis","herpesvirus equino","ehv"]'::jsonb),
    ('Vacuno', 'IBR/BVD', '["ibr","bvd","rinotraqueitis bovina","diarrea viral bovina"]'::jsonb),
    ('Porcino', 'Parvovirosis porcina', '["parvo","parvovirus"]'::jsonb),
    ('Porcino', 'Mal rojo', '["erisipela","mal rojo"]'::jsonb)
)
INSERT INTO "CatalogoVacuna" ("nombre", "aliases", "activo", "cuentaGanaderaId", "especieId", "createdAt", "updatedAt")
SELECT vaccine_seed.nombre, vaccine_seed.aliases, true, "CuentaGanadera"."id", especie."id", NOW(), NOW()
FROM vaccine_seed
CROSS JOIN "CuentaGanadera"
LEFT JOIN "CatalogoEspecie" especie
  ON especie."nombre" = vaccine_seed.especie
  AND especie."cuentaGanaderaId" = "CuentaGanadera"."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "CatalogoVacuna"
  WHERE "CatalogoVacuna"."cuentaGanaderaId" = "CuentaGanadera"."id"
    AND "CatalogoVacuna"."nombre" = vaccine_seed.nombre
);

WITH deworming_seed(nombre, tipo, principio, aliases) AS (
  VALUES
    ('Ivermectina', 'MIXTA'::"TipoDesparasitanteCatalogo", 'Ivermectina', '["ivermectina","ivomec"]'::jsonb),
    ('Albendazol', 'INTERNA'::"TipoDesparasitanteCatalogo", 'Albendazol', '["albendazol","alben"]'::jsonb),
    ('Fenbendazol', 'INTERNA'::"TipoDesparasitanteCatalogo", 'Fenbendazol', '["fenbendazol"]'::jsonb),
    ('Closantel', 'INTERNA'::"TipoDesparasitanteCatalogo", 'Closantel', '["closantel"]'::jsonb),
    ('Levamisol', 'INTERNA'::"TipoDesparasitanteCatalogo", 'Levamisol', '["levamisol"]'::jsonb),
    ('Moxidectina', 'MIXTA'::"TipoDesparasitanteCatalogo", 'Moxidectina', '["moxidectina"]'::jsonb),
    ('Eprinomectina', 'MIXTA'::"TipoDesparasitanteCatalogo", 'Eprinomectina', '["eprinomectina"]'::jsonb)
)
INSERT INTO "CatalogoDesparasitante" ("nombre", "tipo", "principioActivo", "aliases", "activo", "cuentaGanaderaId", "createdAt", "updatedAt")
SELECT deworming_seed.nombre, deworming_seed.tipo, deworming_seed.principio, deworming_seed.aliases, true, "CuentaGanadera"."id", NOW(), NOW()
FROM deworming_seed
CROSS JOIN "CuentaGanadera"
WHERE NOT EXISTS (
  SELECT 1
  FROM "CatalogoDesparasitante"
  WHERE "CatalogoDesparasitante"."cuentaGanaderaId" = "CuentaGanadera"."id"
    AND "CatalogoDesparasitante"."nombre" = deworming_seed.nombre
);
