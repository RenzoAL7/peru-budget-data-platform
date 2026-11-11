// Editor SQL de la consola: CodeMirror 6 con resaltado, autocompletado del esquema y formato.
// esbuild lo empaqueta en public/vendor/editor/editor.js; la pagina lo carga al abrir la consola.
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import {
  drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { duckdb, formatDialect } from "sql-formatter";

const theme = EditorView.theme({
  "&": { color: "#e7ebf0", backgroundColor: "#161b22", fontSize: "13px", height: "var(--cm-height, 240px)" },
  ".cm-scroller": { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace', lineHeight: "1.55" },
  ".cm-content": { caretColor: "#f2b84b", padding: "10px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f2b84b" },
  "&.cm-focused": { outline: "2px solid #f2b84b", outlineOffset: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#2f3b4d" },
  ".cm-gutters": { backgroundColor: "#161b22", color: "#5c6775", border: "none" },
  ".cm-activeLine": { backgroundColor: "#1c232c" },
  ".cm-activeLineGutter": { backgroundColor: "#1c232c", color: "#a3aebc" },
  ".cm-placeholder": { color: "#5c6775" },
  ".cm-tooltip": { backgroundColor: "#1c222b", border: "1px solid #2b323c", color: "#e7ebf0" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#2f3b4d", color: "#fff" },
  ".cm-completionDetail": { color: "#a3aebc", fontStyle: "normal" },
}, { dark: true });

const colors = HighlightStyle.define([
  { tag: t.keyword, color: "#f2b84b", fontWeight: "600" },
  { tag: [t.string, t.special(t.string)], color: "#9fd18b" },
  { tag: [t.number, t.bool, t.null], color: "#7fb2e5" },
  { tag: t.comment, color: "#7d8896", fontStyle: "italic" },
  { tag: [t.operator, t.punctuation], color: "#c6cfda" },
  { tag: [t.typeName, t.standard(t.name)], color: "#f0667a" },
  { tag: [t.name, t.propertyName], color: "#e7ebf0" },
]);

/** Convierte el catalogo publicado en el esquema que usa el autocompletado. */
function schemaFrom(catalog) {
  const schema = {};
  for (const table of catalog) {
    schema[table.tabla] = table.columnas.map((c) => ({ label: c.nombre, type: "property", detail: c.tipo }));
  }
  return schema;
}

export function createEditor(parent, { doc = "", catalog = [], onRun, onChange, label }) {
  const language = new Compartment();
  const run = () => { onRun?.(); return true; };
  // El editor vive en un Shadow DOM: ahi CodeMirror usa hojas de estilo construidas
  // (adoptedStyleSheets), que la CSP permite, en vez de etiquetas <style> en linea.
  const host = document.createElement("div");
  host.className = "cm-host";
  parent.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const view = new EditorView({
    parent: shadow,
    root: shadow,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ icons: false }),
        highlightActiveLine(),
        placeholder("SELECT * FROM mart_entidad LIMIT 10;"),
        language.of(sql({ dialect: PostgreSQL, schema: schemaFrom(catalog), upperCaseKeywords: true })),
        syntaxHighlighting(colors),
        theme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": label ?? "SQL", spellcheck: "false" }),
        Prec.highest(keymap.of([{ key: "Mod-Enter", run }, { key: "Shift-Enter", run }])),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange?.(update.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    view,
    get value() { return view.state.doc.toString(); },
    set value(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    insert(text) {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    },
    focus() { view.focus(); },
    setCatalog(next) {
      view.dispatch({
        effects: language.reconfigure(sql({ dialect: PostgreSQL, schema: schemaFrom(next), upperCaseKeywords: true })),
      });
    },
  };
}

/** Da formato legible a una consulta (dialecto DuckDB). */
export function formatSql(text) {
  return formatDialect(text, { dialect: duckdb, keywordCase: "upper", tabWidth: 2, linesBetweenQueries: 1 });
}
