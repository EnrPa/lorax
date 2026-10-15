-- Las mediciones son inmutables (RF03.7): se rechaza toda modificación o eliminación.
CREATE TRIGGER `mediciones_sin_update`
BEFORE UPDATE ON `mediciones`
BEGIN
	SELECT RAISE(ABORT, 'Las mediciones no se pueden modificar');
END;
--> statement-breakpoint
CREATE TRIGGER `mediciones_sin_delete`
BEFORE DELETE ON `mediciones`
BEGIN
	SELECT RAISE(ABORT, 'Las mediciones no se pueden eliminar');
END;
