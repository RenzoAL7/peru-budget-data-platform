// Reenvia la busqueda al pod del buscador sin exponer su direccion en el navegador.
export async function onRequestGet({ request, env }) {
  if (!env.SEARCH_ORIGIN) {
    return Response.json({ error: "Busqueda no disponible" }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const target = new URL("/buscar", env.SEARCH_ORIGIN);
  for (const name of ["q", "departamento", "limite"]) {
    const value = incoming.searchParams.get(name);
    if (value) target.searchParams.set(name, value);
  }
  const response = await fetch(target, {
    headers: { "X-Search-Token": env.SEARCH_TOKEN ?? "" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}
