#!/usr/bin/env bash
# Carga en el secreto gasto-secrets del cluster las claves de OCI Object Storage (API compatible
# con S3). Se crean en la consola de OCI: Perfil > Customer secret keys > Generate secret key.
# Las claves se piden por teclado y viajan por SSH en stdin: no quedan en el historial ni en Git.
# Uso: scripts/cargar-credenciales-oci.sh [host-ssh]   (por defecto OCI_VM)
set -euo pipefail

HOST="${1:-OCI_VM}"
REGION="${OCI_REGION:-us-ashburn-1}"
BUCKET="${S3_BUCKET:-gasto-publico-peru}"
NAMESPACE="${OCI_NAMESPACE:-$(oci os ns get --query data --raw-output 2>/dev/null || true)}"
if [ -z "$NAMESPACE" ]; then read -rp "Namespace de Object Storage: " NAMESPACE; fi

read -rp "Access key (columna Access key de la Customer secret key): " KEY
read -rsp "Secret key (se muestra una sola vez al generarla): " SECRET
echo

printf 'S3_ACCESS_KEY_ID=%s\nS3_SECRET_ACCESS_KEY=%s\nS3_ENDPOINT_URL=https://%s.compat.objectstorage.%s.oraclecloud.com\nS3_REGION=%s\nS3_BUCKET=%s\n' \
  "$KEY" "$SECRET" "$NAMESPACE" "$REGION" "$REGION" "$BUCKET" |
  ssh "$HOST" 'set -e; umask 077; f=$(mktemp); trap "rm -f $f" EXIT; cat > "$f"
    kubectl -n gasto-publico create secret generic gasto-secrets --from-env-file="$f" \
      --dry-run=client -o yaml | kubectl apply -f -
    printf "Claves en gasto-secrets: "
    kubectl -n gasto-publico get secret gasto-secrets -o go-template="{{range \$k, \$v := .data}}{{\$k}} {{end}}"
    echo'
