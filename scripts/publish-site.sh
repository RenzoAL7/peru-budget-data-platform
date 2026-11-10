#!/bin/sh
# Genera los JSON y Parquet del sitio en el volumen compartido, que el pod Nginx sirve en /data/.
set -eu
exec gasto publish
