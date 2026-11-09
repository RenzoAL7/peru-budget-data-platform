# Despliegue en producción

## Flujo

1. Un push a `main` ejecuta CI y publica las imágenes `pipeline`, `search` y `airflow` en GHCR para ARM64 y AMD64.
2. El workflow guarda el digest de cada imagen.
3. Una Pull Request en `RenzoAL7/K3s-Cortex` copia `deploy/k3s` a `apps/peru-budget-data-platform` y fija esos digests.
4. Argo CD aplica el cambio. Para revertir, se restaura el digest anterior en Git.

Hay dos perfiles: `overlays/2ocpu` para la VM actual y `overlays/4ocpu` para cuando tenga 4 OCPU y 24 GB.

## Secretos

Nunca se guardan en Git. Se crean una vez en el clúster:

```bash
kubectl -n gasto-publico create secret generic gasto-secrets \
  --from-literal=S3_ENDPOINT_URL='https://<namespace>.compat.objectstorage.us-ashburn-1.oraclecloud.com' \
  --from-literal=S3_ACCESS_KEY_ID='<clave>' \
  --from-literal=S3_SECRET_ACCESS_KEY='<secreto>' \
  --from-literal=CLOUDFLARE_ACCOUNT_ID='<cuenta>' \
  --from-literal=CLOUDFLARE_API_TOKEN='<token solo para Pages>' \
  --from-literal=SEARCH_TOKEN="$(openssl rand -hex 32)"

kubectl -n gasto-publico create secret generic airflow-secrets \
  --from-literal=postgres-password="$(openssl rand -hex 24)"

kubectl -n gasto-publico create secret generic airflow-env \
  --from-literal=AIRFLOW__DATABASE__SQL_ALCHEMY_CONN='postgresql+psycopg2://airflow:<password>@airflow-postgres/airflow' \
  --from-literal=AIRFLOW__API_AUTH__JWT_SECRET="$(openssl rand -hex 32)"
```

## Primera carga

El histórico se carga una vez y se sube al bucket. Después, un pod puede ejecutar `gasto pull` para llenar el volumen del clúster.

La interfaz de Airflow no se expone a internet:

```bash
kubectl -n gasto-publico port-forward svc/airflow-api 8080:8080
```

## Analítica de visitas

Se activa en Cloudflare: Pages > el proyecto > Metrics > Web Analytics. No usa cookies, y `_headers` ya permite su script.

## Búsqueda semántica

La función `dashboard/functions/api/buscar.js` necesita dos variables en Cloudflare Pages: `SEARCH_ORIGIN`, con una dirección HTTPS que llegue al servicio `gasto-search`, y `SEARCH_TOKEN`. Sin ellas, la página funciona y oculta el buscador de obras.
