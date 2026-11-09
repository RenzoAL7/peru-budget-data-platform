export function onRequestGet({ env }) {
  return new Response(null, { status: env.SEARCH_ORIGIN ? 204 : 503 });
}
