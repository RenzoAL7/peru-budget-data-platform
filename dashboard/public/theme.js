// Aplica el tema antes de pintar la pagina para evitar un destello del tema equivocado.
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem("pst-tema");
  } catch (error) {
    // Sin almacenamiento local, se usa la preferencia del sistema.
  }
  if (saved !== "claro" && saved !== "oscuro") {
    saved = matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  }
  document.documentElement.dataset.theme = saved;
})();
