CREATE TABLE `alertas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medicion_id` integer NOT NULL,
	`criterio_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text NOT NULL,
	`mensaje` text NOT NULL,
	`descripcion` text,
	`estado` text DEFAULT 'VIGENTE' NOT NULL,
	`leida` integer DEFAULT false NOT NULL,
	`fecha` integer NOT NULL,
	`fecha_resolucion` integer,
	FOREIGN KEY (`medicion_id`) REFERENCES `mediciones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criterio_id`) REFERENCES `criterios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "alertas_estado_valido" CHECK("alertas"."estado" IN ('VIGENTE', 'RESUELTA'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alertas_vigente_por_criterio_unica` ON `alertas` (`criterio_id`) WHERE estado = 'VIGENTE';--> statement-breakpoint
CREATE INDEX `alertas_criterio_idx` ON `alertas` (`criterio_id`);--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cargo` text,
	`empresa_id` integer NOT NULL,
	`cuenta_id` integer NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_cuenta_unica` ON `clientes` (`cuenta_id`);--> statement-breakpoint
CREATE TABLE `criterios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_id` integer NOT NULL,
	`severidad` text DEFAULT 'ADVERTENCIA' NOT NULL,
	`umbral` real NOT NULL,
	`condicion` text NOT NULL,
	`canales` text DEFAULT '' NOT NULL,
	`habilitado` integer DEFAULT true NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`fecha_eliminacion` integer,
	FOREIGN KEY (`sensor_id`) REFERENCES `sensores`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "criterios_severidad_valida" CHECK("criterios"."severidad" IN ('ADVERTENCIA', 'CRITICA')),
	CONSTRAINT "criterios_condicion_valida" CHECK("criterios"."condicion" IN ('SUPERA', 'DESCIENDE'))
);
--> statement-breakpoint
CREATE INDEX `criterios_sensor_idx` ON `criterios` (`sensor_id`);--> statement-breakpoint
CREATE TABLE `cuentas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`correo` text NOT NULL,
	`nombre` text NOT NULL,
	`apellido` text NOT NULL,
	`telefono` text,
	`contrasena_hash` text,
	`rol` text NOT NULL,
	`habilitada` integer DEFAULT true NOT NULL,
	CONSTRAINT "cuentas_rol_valido" CHECK("cuentas"."rol" IN ('ADMINISTRADOR', 'PRODUCTOR'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cuentas_correo_unico` ON `cuentas` (lower("correo"));--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`rut` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empresas_rut_unico` ON `empresas` (`rut`);--> statement-breakpoint
CREATE TABLE `estaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`terreno_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`modelo` text NOT NULL,
	`numero_serie` text NOT NULL,
	`latitud` real NOT NULL,
	`longitud` real NOT NULL,
	`habilitada` integer DEFAULT true NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`fecha_ultima_actualizacion` integer NOT NULL,
	FOREIGN KEY (`terreno_id`) REFERENCES `terrenos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `estaciones_numero_serie_unico` ON `estaciones` (`numero_serie`);--> statement-breakpoint
CREATE INDEX `estaciones_terreno_idx` ON `estaciones` (`terreno_id`);--> statement-breakpoint
CREATE TABLE `eventos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer,
	`tipo` text NOT NULL,
	`entidad` text,
	`entidad_id` integer,
	`motivo` text,
	`detalle` text,
	`fecha` integer NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `eventos_tipo_fecha_idx` ON `eventos` (`tipo`,`fecha`);--> statement-breakpoint
CREATE TABLE `mediciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_id` integer NOT NULL,
	`valor` real NOT NULL,
	`fecha` integer NOT NULL,
	`payload` text NOT NULL,
	`nota` text,
	FOREIGN KEY (`sensor_id`) REFERENCES `sensores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mediciones_sensor_fecha_unico` ON `mediciones` (`sensor_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `notificaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alerta_id` integer NOT NULL,
	`canal` text NOT NULL,
	`estado` text DEFAULT 'PENDIENTE' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`fecha_ultimo_intento` integer,
	`error` text,
	FOREIGN KEY (`alerta_id`) REFERENCES `alertas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notificaciones_canal_valido" CHECK("notificaciones"."canal" IN ('PLATAFORMA', 'CORREO', 'SMS', 'WHATSAPP')),
	CONSTRAINT "notificaciones_estado_valido" CHECK("notificaciones"."estado" IN ('PENDIENTE', 'ENVIADA', 'FALLIDA'))
);
--> statement-breakpoint
CREATE INDEX `notificaciones_alerta_idx` ON `notificaciones` (`alerta_id`);--> statement-breakpoint
CREATE TABLE `sensores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`estacion_id` integer NOT NULL,
	`codigo` text NOT NULL,
	`tipo` text NOT NULL,
	`modelo` text,
	`unidad` text NOT NULL,
	`rango_minimo` real NOT NULL,
	`rango_maximo` real NOT NULL,
	`intervalo_medicion` integer DEFAULT 900 NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`fecha_ultima_lectura` integer,
	FOREIGN KEY (`estacion_id`) REFERENCES `estaciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sensores_estacion_codigo_unico` ON `sensores` (`estacion_id`,`codigo`);--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`fecha_expiracion` integer NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sesiones_token_hash_unico` ON `sesiones` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sesiones_cuenta_idx` ON `sesiones` (`cuenta_id`);--> statement-breakpoint
CREATE TABLE `terrenos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`latitud` real NOT NULL,
	`longitud` real NOT NULL,
	`superficie` real,
	`dimensiones` text,
	`tipo_cultivo` text,
	`fecha_ultima_actualizacion` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `terrenos_cliente_idx` ON `terrenos` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `tokens_recuperacion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`fecha_expiracion` integer NOT NULL,
	`utilizado` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_recuperacion_token_hash_unico` ON `tokens_recuperacion` (`token_hash`);--> statement-breakpoint
CREATE INDEX `tokens_recuperacion_cuenta_idx` ON `tokens_recuperacion` (`cuenta_id`);