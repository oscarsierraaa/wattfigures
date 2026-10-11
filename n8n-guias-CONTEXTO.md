# WattFigures · Flujo n8n de guías — CONTEXTO

> Documento de traspaso para trabajar con Claude Code. Léelo entero antes de
> tocar el workflow. Última actualización: 2026-07-19 — **workflow ACTIVO**.

## Qué es

Un workflow de n8n (**"WattFigures · Guías"**, instancia `breachfolio.app.n8n.cloud`)
que publica una guía de ahorro energético **cada 2 días** en EN+ES, con
**aprobación previa por Telegram**. Es la adaptación de los carriles 5–7 del
workflow de breachfolio "Breachfolio · Contenido" (`yoUXqoUhRxOnYr1s`), pero
**solo guías — este sitio no tiene noticias**.

- Workflow ID: **`l9rnQYGu4sYQbCS7`** (https://secforge.app.n8n.cloud/workflow/l9rnQYGu4sYQbCS7)
- Repo destino: `secforge-git/wattfigures` (branch `main`)
- Supabase: proyecto dedicado **`wattfigures`** (ref **`tskkemvglgecvdiuxxcf`**),
  **esquema y contenido ya aplicados** — ver [Supabase](#supabase-proyecto-wattfigures).
  Credencial n8n `supabaseApi` **"Supabase wattfigures"** (`wkSyGp9r5xuR2014`)
  cableada en los 7 nodos Supabase.
- Telegram: bot propio **`@wattfigures_guias_bot`**, credencial n8n `telegramApi`
  **"Telegram wattfigures"** (`h1UIzBN3OMO8ZArl`), en el grupo **propio**
  **«WattFigures»** = **`-1004483603363`**.

> ✅ **ESTADO: ACTIVO** desde 2026-07-19, **probado end-to-end**. La primera guía
> publicada por el flujo es `heat-pump-vs-gas-boiler-running-cost` (EN+ES):
> 4 commits en GitHub (2 páginas + 2 tarjetas de índice) y 2 filas en Supabase.

### Calidad del contenido generado: qué falló en la primera publicación

La primera guía salió con dos defectos que **ya no pueden repetirse** (hay
validación que los bloquea), pero conviene saberlos:

1. **Borrador corto** (965 palabras, mínimo 1000). Los LLM no saben contar
   palabras, así que pedir "1300-1700" no funciona. El prompt ahora fija la
   longitud **por estructura**: 5-6 `<h2>`, cada uno con ≥3 párrafos de 60-90
   palabras. Eso sí lo puede cumplir.
2. **Comillas escapadas y un enlace inventado.** Gemini emitió
   `href=\"https://www.idae.es\"` (barras invertidas visibles en la página) y
   enlazó a `/calculators/heat-pump-vs-boiler/`, que no existe — el slug real es
   `heat-pump-vs-gas`. Lo copió de la nota de la fila en `wf_guias_cola`, que
   tenía el slug mal. **Revisa las notas de la cola**: si sugieren una ruta,
   tiene que ser una ruta real.

Ambos defectos se corrigieron a mano en las páginas publicadas y ahora los
validadores EN y ES los rechazan: uno detecta `\"` en el cuerpo, y el otro
comprueba cada enlace interno a `/calculators/` y `/guides/` contra una lista
blanca de slugs reales. **Al añadir una calculadora o una guía nueva al sitio hay
que añadir su slug a `VALID_CALC` / `VALID_GUIDES`** en los dos nodos
`Validar guia {EN,ES}`, o el flujo rechazará enlaces legítimos.

### Separación estricta respecto a breachfolio

Los dos sitios comparten instancia de n8n y **no deben mezclarse**:

| | WattFigures | Breachfolio |
|---|---|---|
| Bot Telegram | `@wattfigures_guias_bot` (`h1UIzBN3OMO8ZArl`) | `@secforge_alerts_bot` (`AlxvZcELjIdbrArs`) |
| Grupo | «WattFigures» `-1004483603363` | «SecForge Alerts» `-1004318171372` |
| Supabase | `wkSyGp9r5xuR2014` (ref `tskkemvglgecvdiuxxcf`) | `VgRn3xBneYNXOsWC` |
| Prefijo de callbacks | `wfguia:` | `guiaidea:` / `recap_` |

GitHub (`up7TAJXCRgFxN1CZ`), Gemini (`HaIf3YVk31bQwVLK`) y SMTP (`PqKUdnofGFTRcT22`)
**sí se comparten a propósito**: son la misma cuenta para ambos sitios.

> ⚠️ **Por qué importa el bot propio.** Telegram permite **un solo webhook por
> bot**. El 2026-07-19 este workflow se activó con la credencial Telegram de
> breachfolio auto-asignada y **secuestró su webhook**: durante unas horas los
> callbacks de breachfolio (incluido un "✅ Publicar seleccionadas") llegaron a
> este flujo, que los descartó silenciosamente. No los publicó nadie. Si vuelves
> a ver ejecuciones de este workflow con `callback_data` que empiece por `recap_`
> o `guiaidea:`, es que ha vuelto a pasar.

### Trampas de n8n aprendidas a base de golpes

1. **La API no devuelve las credenciales de los nodos.** `get_workflow_details`
   siempre muestra `credentials: {}`, incluso en nodos que funcionan. **No sirve
   para auditar.** Lo que sí las expone: el payload de una ejecución **con
   error** (`get_execution` → `error.node.credentials`). Verifica por ahí, o
   mirando la UI.
2. **`update_workflow` no re-registra el webhook de Telegram.** Si cambias la
   credencial o los `updates` del Telegram Trigger, hay que **desactivar y
   reactivar** el workflow para que el cambio surta efecto.
3. **El Telegram Trigger escucha solo `callback_query`.** Los mensajes normales
   (incluido `/start`) no lo disparan — es intencionado. Si necesitas capturar
   un `chat.id`, añade `message` temporalmente a `updates`, reactiva, captura, y
   **vuelve a dejarlo solo en `callback_query`**.
4. **Un bot restringido en el grupo da `400 chat not found`**, igual que si no
   estuviera. Si aparece ese error con un chatId correcto, revisa que el bot esté
   dentro y sin restricciones (lo más simple: hacerlo administrador).
5. **No hay herramienta MCP para editar filas de una Data Table.** Se pueden
   crear tablas y añadir filas, pero no actualizar ni borrar: eso es a mano en la
   UI. Por eso el flujo se autogestiona el estado de la cola (ver abajo).

### Recuperación ante fallos

Si falla la validación EN/ES o falla Gemini, el nodo
`Devolver tema a la cola (Data Table)` devuelve la fila a `status=pending`
automáticamente. Sin él, el tema se quedaba atascado en `en_progreso` (no lo
recoge ni la lectura de cola, que busca `pending`, ni el chequeo de idea
pendiente, que busca `idea_enviada`) y había que rescatarlo a mano en la UI.

Igualmente, `ultima_ejecucion_guias` solo se marca **después** de que Telegram
confirme el envío, así que un fallo de entrega ya no consume el día.

## Arquitectura (3 carriles)

1. **Idea del día** — Cron diario 08:30 Europe/Madrid → lee `wf_config`
   (`frecuencia_guias_dias=2`, `ultima_ejecucion_guias`) → si no toca, corta →
   si hay una idea ya enviada sin responder, **reenvía recordatorio**; si no,
   coge el primer tema `pending` + `in_scope=true` de la Data Table
   `wf_guias_cola` (orden por `relevancia`) → manda la idea al grupo de Telegram
   con botones ✅ (`wfguia:go:<rowId>`) / 👎 (`wfguia:skip:<rowId>`) →
   **y solo entonces** marca `ultima_ejecucion_guias`.
   - `Actualizar ultima ejecucion (guias)` cuelga de `Enviar idea (Telegram)`, no
     del principio del carril: si el envío falla, el día **no** se consume y el
     cron reintenta al día siguiente. Toma la fecha con
     `{{ $('Toca hoy (guias)').first().json.todayISO }}`, así no depende de su
     posición en la cadena.
2. **Redacción** — El Telegram Trigger del bot recibe el callback (solo prefijo
   `wfguia:`). Skip → marca `descartada`. Go → marca `in_progress` → Gemini
   redacta la guía EN (JSON estructurado: title, description, slug, keywords,
   headline, lead, breadcrumb_name, body_html 1300–1700 palabras, faq_items) →
   validación por código (palabras, whitelist de tags, FAQ, slug) → ídem ES →
   relacionados por idioma desde Supabase `articles` → borrador a la Data
   Table `wf_guias_borradores`.
   - **Relacionados = 2 guías + 2 calculadoras.** Por idioma se encadenan dos
     consultas: `Relacionados {EN,ES} (Supabase)` (`section=guides`, limit 2,
     las más recientes) y `Calculadoras {EN,ES} (Supabase)`
     (`section=calculators`, limit 8); el nodo Code `Adjuntar relacionados
     {EN,ES}` coge las 2 guías y **sortea 2 calculadoras al azar** de las 8, y
     las mezcla. Así cada guía nueva empuja tráfico a las herramientas
     interactivas y no siempre a las mismas. `relatedItems()` en `Rellenar
     plantillas (Code)` corta a 4 — si algún día quieres más enlaces, hay que
     subir ese `slice(0, 4)` también.
   - **Alerta de pool bajo**: en paralelo a leer la cola, un nodo
     `Contar cola pendiente (Data Table)` cuenta cuántos temas `pending` +
     `in_scope=true` quedan (sin límite); si son ≤20, `Pool bajo (IF)` dispara
     `Avisar pool bajo (Telegram)` avisando al grupo para añadir más temas.
     Nodo creado **desactivado** (n8n le auto-asignó la credencial Telegram de
     breachfolio al crearlo) — activar y cablear junto con el resto de nodos
     Telegram cuando exista el bot propio.
3. **Publicación** — Lee las plantillas del repo
   [tools/templates/guide-en.html.tpl](tools/templates/guide-en.html.tpl) y
   [tools/templates/guide-es.html.tpl](tools/templates/guide-es.html.tpl), rellena los
   tokens `{{...}}`, crea `guides/<slug>/index.html` y
   `es/guides/<slug>/index.html` vía GitHub API, inserta la card tras
   `<!-- CARDS:START -->` en ambos índices y regenera el ItemList
   (`data-itemlist`), registra las 2 filas en Supabase `articles`, marca la cola
   como `publicada` y confirma por Telegram + email.

## Data Tables de n8n (proyecto secforge)

| Tabla | ID | Columnas | Uso |
|---|---|---|---|
| `wf_config` | `24SbrRt5l7wAeDfo` | key, value | `frecuencia_guias_dias` (2), `ultima_ejecucion_guias` (YYYY-MM-DD) |
| `wf_guias_cola` | `FyBrpvZFofxp3dK7` | topic, keyword, category, notes, relevancia, status, in_scope, idea_sent_at | Cola de temas (sembrada con 20). `status`: pending → idea_enviada → en_progreso → publicada / descartada |
| `wf_guias_borradores` | `wApHEkt17bpE3HDX` | draft_json, status, created_at | Borradores ensamblados antes de publicar |

Para cambiar la cadencia: edita `frecuencia_guias_dias` en `wf_config` (no hace
falta tocar el workflow). Para añadir temas: filas nuevas en `wf_guias_cola`
con `status=pending`, `in_scope=true`.

## Convenciones importantes

- **Rutas ES**: las guías ES viven en `/es/guides/<slug>/` (NO `/es/guias/` —
  eso es breachfolio). Profundidad de assets: EN `../../`, ES `../../../`.
- **Un solo slug por guía**: el mismo slug se usa en EN y ES (como las 4 guías
  hechas a mano); el hreflang cruza ambas versiones.
- **og:image** fija: `https://wattfigures.com/assets/img/og-default.png`
  (mejora futura: pool de imágenes como `imagenes_pool_100` de breachfolio).
- **Callbacks Telegram** con prefijo `wfguia:` para no chocar con los
  `guiaidea:` de breachfolio (comparten grupo).
- **Bot Telegram propio obligatorio**: Telegram solo permite un webhook por
  bot, y el bot de breachfolio ya lo tiene ocupado por su Telegram Trigger.
- **Enlaces internos** en `body_html`: rutas absolutas (`/calculators/...`,
  `/es/appliances/...`) con `class="ul-link"`.

## Tokens de las plantillas guide-{en,es}.html.tpl

> **Extensión `.tpl` a propósito.** Son plantillas con tokens `{{...}}`, no
> páginas. Con extensión `.html` acababan indexadas por Pagefind y salían en el
> buscador del sitio como resultados llenos de `{{PLACEHOLDER}}`. Si las
> renombras, actualiza el `filePath` de los nodos `Obtener plantilla {EN,ES}
> (GitHub)` del workflow.

`{{TITLE}} {{DESCRIPTION}} {{KEYWORDS}} {{CANONICAL_URL}} {{HREFLANG_EN_URL}}
{{HREFLANG_ES_URL}} {{OG_IMAGE}} {{HEADLINE}} {{LEAD}} {{DATE_PUBLISHED}}
{{BREADCRUMB_NAME}} {{BODY_HTML}} {{FAQ_JSONLD}} {{FAQ_VISIBLE}}
{{RELATED_ITEMS}} {{CANONICAL_URL_ENC}} {{OG_IMAGE_ENC}} {{HEADLINE_ENC}}`

- `FAQ_JSONLD`: array JSON de Question/Answer (schema.org).
- `FAQ_VISIBLE`: bloques `<details class="faq-item"><summary>…</summary><p>…</p></details>`.
- `RELATED_ITEMS`: `<li><a class="ul-link" href="…">…</a></li>` × 4 (2 guías + 2 calculadoras).
- `*_ENC`: encodeURIComponent para la share-row.

## Supabase (proyecto `wattfigures`)

> **Para qué sirve realmente.** El sitio publicado **no consulta Supabase**: es
> HTML 100% estático y la CSP (`connect-src 'self'` en `.htaccess` y `_headers`)
> bloquearía la llamada aunque existiera. Supabase se usa **solo en tiempo de
> generación**, por n8n, para elegir los enlaces "Related reading" que quedan
> incrustados en el HTML de cada guía nueva. Dicho de otro modo: esta BD no
> puede romper la web en vivo; lo que gobierna es **hacia dónde enlazan las
> guías nuevas**.

**Conexión** (ref `tskkemvglgecvdiuxxcf`): usar el **session pooler**
`aws-0-eu-west-1.pooler.supabase.com:5432` con usuario
`postgres.tskkemvglgecvdiuxxcf`. La conexión directa
(`db.<ref>.supabase.co`) solo resuelve por **IPv6** y falla desde redes IPv4.

**Ficheros** (aplicar en este orden; ambos son idempotentes y re-ejecutables):

| Fichero | Qué es |
|---|---|
| [supabase/schema.sql](supabase/schema.sql) | Solo DDL + la fila de `sites`. Tablas `sites` y `articles`, índices, RLS. |
| [supabase/seed-content.sql](supabase/seed-content.sql) | **Generado** — las 84 filas de contenido del sitio. No editar a mano. |

**Contenido sembrado**: 84 filas = 42 páginas × 2 idiomas — 4 guías, 8
calculadoras y 30 electrodomésticos. Quedan fuera a propósito `legal/`,
`/estimator/`, `/electricity-prices/` y las home: nunca deberían aparecer como
"relacionados".

**Regenerar el seed** cuando añadas o retitules páginas:

```
npm run build:seed          # reescribe supabase/seed-content.sql desde el HTML en disco
```

`tools/gen-supabase-seed.mjs` escanea las secciones de `site.config.json` y saca
slug/título/descripción/canonical del HTML real, igual que hacen
`generate-rss.mjs` y `generate-sitemap.mjs` (el sitio construido es la fuente de
verdad; no hay manifiesto que mantener). Luego aplica el SQL al proyecto.

**Clave única = `(site_id, section, lang, slug)`** — con `section` dentro a
propósito. Una guía y un electrodoméstico pueden compartir slug porque viven en
URLs distintas (`/guides/refrigerator/` vs `/appliances/refrigerator/`). Con la
clave antigua `(site_id, lang, slug)`, una guía nueva con un slug ya usado por un
electrodoméstico fallaba al insertar **después** de que n8n hubiera creado los
ficheros en GitHub, dejando la publicación a medias. `schema.sql` incluye el
`drop constraint if exists` que migra proyectos antiguos.

**RLS**: lectura pública solo de `status='published'`; las escrituras solo con la
service_role key desde n8n (el service_role se salta RLS).

**Ojo free tier**: el proyecto se pausa tras ~1 semana sin actividad. Con
cadencia de 2 días hay tráfico de sobra, pero si paras el workflow mucho tiempo,
revisa que el proyecto siga activo antes de reactivarlo.

## Build automático tras publicar (antes era manual)

n8n crea las páginas y actualiza los índices vía GitHub API, pero **no ejecuta
`npm run build`**: sitemap.xml, feed.xml y el índice de Pagefind no sabían nada
de la guía nueva. La guía quedaba online pero **invisible para el buscador del
sitio** hasta que alguien reconstruía en su portátil.

Lo resuelve `.github/workflows/build.yml`: en cada push a `main` reconstruye los
artefactos y los commitea. Ya no hay que hacer nada a mano.

Detalles que importan si tocas ese workflow:

- **No entra en bucle.** Los push hechos con `GITHUB_TOKEN` no disparan
  workflows (protección de GitHub). El `paths-ignore` es un cinturón extra por
  si alguna vez se cambia a un PAT, que sí re-dispararía.
- **`concurrency` con `cancel-in-progress`.** n8n hace 4 commits seguidos por
  publicación; sin esto se lanzarían 4 builds compitiendo por el push.
- **Reintento con rebase** en el push, por si n8n commitea mientras corre el
  build.
- **Borra `_pagefind/` antes de construir.** Pagefind nombra los fragmentos por
  hash, así que los de páginas retituladas se quedan para siempre. El repo ya
  arrastraba 2 duplicados (`/guides/` y `/es/guides/` indexados dos veces); el
  primer run limpio los eliminó.

**Consecuencia práctica:** el bot commitea sobre `main`, así que haz `git pull`
antes de ponerte a trabajar en local o chocarás al pushear.

### Por qué el build en CI sale más limpio que en local

`graphify-out/` está en `.gitignore` pero vive dentro de la raíz del sitio, así
que un `npm run build` local **mete `graphify-out/graph.html` en el buscador**.
En CI el checkout no lo incluye. Si construyes en local, no commitees el
`_pagefind/` resultante: deja que lo genere el workflow.

## Credenciales n8n usadas

| Credencial | ID | Tipo | Ámbito |
|---|---|---|---|
| Telegram wattfigures | `h1UIzBN3OMO8ZArl` | `telegramApi` | **solo WattFigures** (12 nodos) |
| Supabase wattfigures | `wkSyGp9r5xuR2014` | `supabaseApi` | **solo WattFigures** (7 nodos) |
| GitHub account | `up7TAJXCRgFxN1CZ` | `githubApi` | compartida (misma cuenta, ambos repos) |
| Google Gemini(PaLM) | `HaIf3YVk31bQwVLK` | `googlePalmApi` | compartida |
| SMTP account | `PqKUdnofGFTRcT22` | `smtp` | compartida |

Las de breachfolio (`AlxvZcELjIdbrArs` Telegram, `VgRn3xBneYNXOsWC` Supabase)
**no deben aparecer nunca** en este workflow. Al añadir un nodo nuevo, n8n
**auto-asigna** una credencial existente del mismo tipo si no le pasas una
explícitamente — así es como entró la de breachfolio. Pasa siempre la credencial
al crear el nodo.

## Referencia

El workflow hermano de breachfolio y su doc
(`breachfolio/n8n-recap-semanal-CONTEXTO.md`, `breachfolio/STATE.md`) son la
implementación de referencia de todos estos patrones.
