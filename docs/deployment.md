# Despliegue en producción

## Flujo

1. Un push a `main` ejecuta CI y publica las imágenes `pipeline`, `search`, `airflow` y `site` en GHCR solo para ARM64, la arquitectura de la VM. Se construyen en runners ARM nativos de GitHub, sin emulación, y con caché de capas entre ejecuciones.
2. El workflow guarda el digest de cada imagen.
3. El job `promote` ejecuta `scripts/promote.py`, que copia `deploy/k3s` a `apps/peru-budget-data-platform` en `RenzoAL7/K3s-Cortex` y fija los cuatro digests en ambos perfiles. Luego hace un commit directo en `main` de K3s-Cortex, sin PR.
4. Un webhook de GitHub avisa a Argo CD, que sincroniza en segundos. Si el webhook falla, Argo CD revisa el repositorio cada minuto. Para revertir, se revierte ese commit en K3s-Cortex.
5. Site y search se actualizan con `RollingUpdate`: el pod nuevo arranca antes de retirar el viejo, así que el sitio no se corta.

El job necesita el secreto `CORTEX_REPO_TOKEN` en este repositorio: un token con permiso de escritura de contenido sobre `RenzoAL7/K3s-Cortex`. Es el mismo que usa el repositorio portafolio.

Hay dos perfiles: `overlays/2ocpu` para la VM actual y `overlays/4ocpu` para cuando tenga 4 OCPU y 24 GB.

## Secretos

Nunca se guardan en Git. Se crean una vez en el clúster:

```bash
kubectl -n gasto-publico create secret generic gasto-secrets \
  --from-literal=S3_ENDPOINT_URL='https://<namespace>.compat.objectstorage.us-ashburn-1.oraclecloud.com' \
  --from-literal=S3_ACCESS_KEY_ID='<clave>' \
  --from-literal=S3_SECRET_ACCESS_KEY='<secreto>' \
  --from-literal=S3_BUCKET=gasto-publico-peru

kubectl -n gasto-publico create secret generic airflow-secrets \
  --from-literal=postgres-password="$(openssl rand -hex 24)"

kubectl -n gasto-publico create secret generic airflow-env \
  --from-literal=AIRFLOW__DATABASE__SQL_ALCHEMY_CONN='postgresql+psycopg2://airflow:<password>@airflow-postgres/airflow' \
  --from-literal=AIRFLOW__API_AUTH__JWT_SECRET="$(openssl rand -hex 32)"
```

## Primera carga

El histórico se procesa fuera del clúster y se sube al bucket. Los JSON, el índice y el modelo se copian al volumen `gasto-data`.

Antes de activar los DAGs:

1. Agrega las claves S3 a `gasto-secrets`. Sin ellas, los DAGs fallan en su primer paso.
2. Desde la máquina que hizo la carga, sube los manifiestos con `gasto push --layers manifests`. Sin ellos, los DAGs vuelven a descargar los CSV del MEF.
3. Deja al menos 15 GB libres en la VM, además del espacio para bronze (4.4 GB) y silver. Cada CSV anual ocupa hasta 10 GB y llenar el disco afectaría a todo el clúster. El volumen de arranque se amplió a 100 GB el 10 de noviembre de 2026 (`/usr/libexec/oci-growfs -y`, sin reiniciar): quedan unos 60 GB libres.

Cada corrida empieza con `gasto pull --missing-only`, que restaura lo que falte en el volumen sin reemplazar archivos locales. `gasto gold --require-history` falla si falta algún año cerrado en silver, para no publicar un histórico recortado. La ingesta se detiene si una descarga dejaría menos de 5 GB libres.

La interfaz de Airflow no se expone a internet:

```bash
kubectl -n gasto-publico port-forward svc/airflow-api 8080:8080
```

## Acceso público

La página se publica en `https://peru-spend-tracker.renzoaguilar.dev`. Cloudflare administra el DNS y el certificado público, y Traefik envía ese host al pod Nginx, que sirve el sitio en `/`. La IP del balanceador sigue sirviendo la página en `/presupuesto/`. Las rutas `/` de TerraDock y por host de GPath no cambian.

El registro DNS es un `A` llamado `peru-spend-tracker` que apunta a la IP del balanceador, con el proxy de Cloudflare activado.

El balanceador de OCI solo reenvía el puerto 80 a Traefik. Por eso Cloudflare debe usar el modo SSL **Flexible**: termina HTTPS hacia los visitantes y llega a la VM por HTTP, donde lo atiende el Ingress `gasto-site-dominio`. No cambies a **Full (strict)** mientras el balanceador no tenga un listener en el puerto 443, porque el sitio dejaría de responder.

## Consola SQL

La columna derecha del sitio ejecuta DuckDB-WASM en el navegador de cada visitante. `gasto publish` deja los marts en `data/sql/*.parquet` junto con `catalogo.json`, y el navegador los lee por rangos HTTP: una consulta solo descarga las columnas y grupos de filas que usa. Nada se ejecuta en el servidor.

- **Dependencias:** `dashboard/package.json` fija DuckDB-WASM, esbuild y las fuentes. La imagen del sitio corre `node vendor.mjs` en una etapa de Node y copia el resultado a `vendor/`. Esa carpeta no se versiona.
- **Extensión Parquet:** DuckDB-WASM la descarga de `extensions.duckdb.org`, pero la CSP solo permite el mismo origen. Por eso `vendor.mjs` la descarga al construir la imagen, verifica su SHA-256 y la sirve desde el sitio. Al subir la versión de `@duckdb/duckdb-wasm`, actualiza `DUCKDB_CORE` y el hash en `vendor.mjs`, y la ruta que revisa `images.yml`.
- **Peso:** el motor pesa unos 8 MB comprimido y el editor unos 150 KB. Ninguno se descarga hasta abrir la consola (botón **SQL** o cualquier **Ver SQL**). En pantallas anchas se recuerda si quedó abierta.
- **Editor:** CodeMirror con autocompletado de tablas y columnas (`catalogo.json`) y formato con `sql-formatter`. Vive dentro de un Shadow DOM: así CodeMirror usa hojas de estilo construidas, que la CSP permite, en vez de etiquetas `<style>` en línea.
- **Funciones:** ejemplos con CTE, `LAG`, `RANK`, `QUALIFY` y `JOIN`; historial en el navegador; `EXPLAIN`; gráfico automático del resultado; orden y paginación; descarga en CSV; copia en Markdown; enlaces compartibles (`?sql=` en base64url); un reto distinto cada día; y el linaje de cada mart enlazado a su modelo en GitHub.
- **Divisor:** en pantallas anchas la línea entre la página y la consola se arrastra (de 360 px al 60 % de la pantalla). Arrastrarla hasta el borde derecho cierra la consola. También responde a las flechas del teclado.
- **Seguridad:** la CSP agrega `'wasm-unsafe-eval'`, que permite compilar WebAssembly pero no habilita `eval()`. `connect-src` solo permite el propio sitio y la analítica sin cookies de Cloudflare, así que una consulta no puede leer URLs de otros sitios.

Para probar el sitio en local, la imagen arma `vendor/` sola. Para servir `dashboard/public` sin Docker, antes corre `cd dashboard && npm ci && npm run vendor`.

```sh
docker build -f docker/site.Dockerfile -t site .
docker run --rm -p 8088:8080 -v "$DATA_DIR/published:/data/published:ro" site
```

## Página

- **Nombre del año:** silver guarda la columna como `ano` (no se reprocesa). La macro `silver()` la renombra a `year` al leer, así que todos los marts y las tablas de la consola usan `year` (y `first_year` / `last_year` en `mart_entidad`). Los JSON internos de la página siguen usando `ano`.
- **Datos sin copias viejas:** `meta.json` se revalida en cada visita y el resto de `/data/` se pide con `?v=<fecha de publicación>`, así una actualización se ve de inmediato.

- **Rutas:** `/`, `/obras`, `/ranking`, `/como-funciona` y `/entidad/<id>-<nombre>`. nginx sirve `index.html` en esas rutas; cualquier otra da 404. Los enlaces antiguos con `#/` se redirigen en el navegador. El estado de cada vista va en la URL: `?ano=`, `?mapa=habitante`, `?dep=&prov=&dist=`, `?lang=en` y `?sql=`.
- **Por la IP:** la página usa `<base href="/">` y nginx lo cambia por `/presupuesto/` en esa ruta, así los mismos archivos sirven en ambos lugares.
- **Idiomas:** español e inglés en `dashboard/public/i18n.js`. Los nombres de entidades y lugares no se traducen; las funciones del MEF sí.
- **Buscadores y redes:** `robots.txt` apunta a `data/sitemap.xml`, que `gasto publish` genera con todas las fichas (`SITE_URL`). Cada vista actualiza el título, la descripción y la URL canónica. `og.png` es la imagen al compartir; su plantilla está en `scripts/og.html`.
- **Caché:** HTML, JS, CSS y las rutas de la página se revalidan en cada visita. Las URLs de CSS, JS, el editor y DuckDB llevan la versión del commit (`?v=dev` en el código, reemplazado al construir la imagen), así ningún navegador mezcla versiones. En Cloudflare, **Browser Cache TTL** debe quedar en **Respect Existing Headers**.
- **Mapa:** `dashboard/public/mapa-peru.json` sale de geoBoundaries (PER ADM1, dominio público) con `scripts/build_map.py`.
- **Población:** `dbt/seeds/poblacion_inei.csv` sale del cuadro del INEI "Población total proyectada al 30 de junio, 2018-2026" con `scripts/build_poblacion.py`. `mart_entidad_territorio` asigna a cada municipalidad su distrito o provincia por similitud de nombres (Jaro-Winkler) dentro del departamento; la prueba `cobertura_poblacion_municipal` avisa si baja del 95 %.
- **Obras:** cada tarjeta enlaza a su ficha en el Sistema de Seguimiento de Inversiones del MEF (`ofi5.mef.gob.pe/ssi/Ssi/Index?codigo=<CUI>&tipo=2`).

## Monitoreo y alertas

- **Sitio:** `.github/workflows/monitor.yml` revisa cada 3 horas la portada, `/obras`, la búsqueda, el catálogo de la consola y que `data/meta.json` tenga menos de 3 días. Si algo falla, abre o actualiza un issue (GitHub lo notifica por correo) y lo cierra cuando todo vuelve a responder.
- **DAGs:** si una ejecución falla, `notify_failure` envía un aviso a `ALERT_WEBHOOK_URL`, guardada en el secreto `airflow-env`. Sirve un tema privado de [ntfy.sh](https://ntfy.sh) (notificaciones en el celular), un webhook de Slack o uno de Discord. Sin esa variable no se envía nada.
- **Disponibilidad:** `gasto-site` y `gasto-search` corren con dos réplicas y `RollingUpdate`. La cuota del namespace deja margen de memoria para que un despliegue coincida con un pod del pipeline.

## Búsqueda semántica

En el clúster, Nginx reenvía la búsqueda al pod `gasto-search` y una NetworkPolicy impide cualquier otro acceso. Sin buscador disponible, la página funciona y oculta esa casilla.
