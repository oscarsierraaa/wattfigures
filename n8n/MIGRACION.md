# n8n — copia de seguridad y opciones de migración

> Creado 2026-07-20, cuando se agotó la instancia de prueba de n8n Cloud.
> El contexto funcional del flujo está en `../n8n-guias-CONTEXTO.md`.

## Qué se ha salvado

`wattfigures-guias.workflow.json` — export completo del workflow
**«WattFigures · Guías»** (`l9rnQYGu4sYQbCS7`): **73 nodos, 63 conexiones**,
tomado el 2026-07-20 con la instancia todavía activa (versionId
`00fd228f-29c9-4961-a09d-f9a6b6b335aa`).

**Limitación importante:** n8n redacta las credenciales al exportar, así que el
JSON **no contiene ninguna clave** (bueno para la seguridad, y por eso se puede
commitear). Al reimportarlo hay que volver a asignar a mano las credenciales en
los nodos correspondientes. Los nombres e IDs están en `n8n-guias-CONTEXTO.md`:

| Servicio | Credencial | ID |
|---|---|---|
| Supabase | «Supabase wattfigures» | `wkSyGp9r5xuR2014` |
| Telegram | «Telegram wattfigures» (`@wattfigures_guias_bot`) | `h1UIzBN3OMO8ZArl` |
| GitHub / Gemini | ver el workflow | — |

Lo que **no** depende de n8n y sigue intacto en el repo: el esquema y los datos
de Supabase (`supabase/schema.sql`, `supabase/seed-content.sql`) y las plantillas
de guía (`tools/templates/guide-{en,es}.html.tpl`).

## Qué hacía el flujo

Cada 2 días: coge una idea de la cola en Supabase (`wf_guias_cola`) → la propone
por Telegram para aprobar (✅/👎) → genera la guía EN+ES con Gemini → la pasa por
dos validadores → la publica como commits en `secforge-git/wattfigures` y marca
la fila en Supabase.

## Opciones ahora

### A. n8n autoalojado (Docker)
Software gratis; pagas solo el servidor (un VPS básico ~4-6 €/mes).
Importas el JSON, reasignas credenciales y todo sigue igual.
- **A favor:** recuperas el flujo tal cual; sin límites de plan.
- **En contra:** mantienes tú el servidor (actualizaciones, backups, caídas).

### B. n8n Cloud de pago
~20-25 €/mes el plan de entrada. Importar y reasignar credenciales.
- **A favor:** cero mantenimiento, es volver a lo de antes.
- **En contra:** coste fijo mensual antes de que la web gane un euro.

### C. Reconstruirlo como GitHub Actions ← recomendado
Este repo **ya tiene CI funcionando** (`.github/workflows/build.yml`), así que la
infraestructura ya está. El mapeo es directo:

| Pieza del flujo n8n | Equivalente |
|---|---|
| Cron cada 2 días | `on: schedule:` en un workflow de Actions |
| Cola en Supabase | un JSON en el repo (o seguir con Supabase por REST) |
| Generación con Gemini | script Node + `GEMINI_API_KEY` en GitHub Secrets |
| Validadores EN/ES | los mismos, como script (además testeables) |
| **Aprobación por Telegram** | **abrir un Pull Request** y aprobar = merge |
| Publicar (commits) | el propio merge del PR |

- **A favor:** **0 €/mes**, sin servidor, todo versionado. Y la aprobación mejora:
  en un PR ves el contenido real y puedes editarlo antes de publicar — eso habría
  cazado los dos defectos de la primera guía (comillas escapadas y un enlace
  inventado a una calculadora inexistente).
- **En contra:** hay que reescribir la lógica de los 73 nodos como scripts
  (unos cientos de líneas). Se pierde la comodidad del ✅ en el móvil, aunque la
  app de GitHub permite revisar y hacer merge igual de rápido.

### D. Pausar la automatización
Escribir las guías a mano de momento.
- **A favor:** ahora mismo el riesgo nº 1 para AdSense es que el contenido parezca
  generado y uniforme. Menos guías, mejor escritas, es lo que más ayuda a aprobar.
- **En contra:** no escala.

## Recomendación

**C**, y sin prisa: la web todavía no está publicada, así que no hay ninguna
urgencia por reanudar la publicación automática. Mientras tanto, D es lo más
sensato para el contenido que decide la aprobación de AdSense.

Si se prefiere volver rápido a lo anterior, **A** es la opción barata y **B** la
cómoda; en ambos casos el punto de partida es importar el JSON de esta carpeta.
