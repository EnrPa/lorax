-- Datos existentes al formato normalizado (diseno.md §4 y §7): RUT sin puntos, con guion y dígito
-- verificador en mayúscula; correos en minúsculas. No cambia el esquema.
UPDATE `empresas` SET `rut` = upper(replace(replace(`rut`, '.', ''), ' ', ''));
--> statement-breakpoint
UPDATE `cuentas` SET `correo` = lower(trim(`correo`));
