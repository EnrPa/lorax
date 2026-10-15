/// <reference types="@solidjs/start/env" />

declare namespace App {
  interface RequestEventLocals {
    /** Cuenta de la sesión validada por el middleware; `null` si no hay sesión válida. */
    cuenta?: import("~/lib/sesion").CuentaSesion | null;
  }
}
