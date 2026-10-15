import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";

export default function NotFound() {
  return (
    <section class="not-found">
      <Title>Página no encontrada · LoRax</Title>
      <HttpStatusCode code={404} />
      <h1>No encontramos esta página</h1>
      <p>Puede que la dirección esté mal escrita o que la página ya no exista.</p>
      <A href="/" class="button-link">Volver al inicio</A>
    </section>
  );
}
