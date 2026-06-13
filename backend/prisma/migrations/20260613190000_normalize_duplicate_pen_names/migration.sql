DO $$
DECLARE
  rec RECORD;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR rec IN
    SELECT
      id,
      "unidadRegaId",
      nombre,
      TRIM(REGEXP_REPLACE(nombre, '\s+', ' ', 'g')) AS clean_name,
      ROW_NUMBER() OVER (
        PARTITION BY "unidadRegaId", LOWER(TRIM(REGEXP_REPLACE(nombre, '\s+', ' ', 'g')))
        ORDER BY id
      ) AS duplicate_position,
      COUNT(*) OVER (
        PARTITION BY "unidadRegaId", LOWER(TRIM(REGEXP_REPLACE(nombre, '\s+', ' ', 'g')))
      ) AS duplicate_count
    FROM "Corral"
    ORDER BY "unidadRegaId", LOWER(TRIM(REGEXP_REPLACE(nombre, '\s+', ' ', 'g'))), id
  LOOP
    IF rec.duplicate_count = 1 THEN
      candidate := rec.clean_name;
    ELSIF rec.duplicate_position = 1 THEN
      candidate := rec.nombre;
    ELSE
      suffix := rec.duplicate_position;
      candidate := rec.clean_name || ' ' || suffix;

      WHILE EXISTS (
        SELECT 1
        FROM "Corral"
        WHERE "unidadRegaId" = rec."unidadRegaId"
          AND id <> rec.id
          AND nombre = candidate
      ) LOOP
        suffix := suffix + 1;
        candidate := rec.clean_name || ' ' || suffix;
      END LOOP;
    END IF;

    IF rec.nombre IS DISTINCT FROM candidate THEN
      UPDATE "Corral"
      SET nombre = candidate,
          "updatedAt" = NOW()
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
