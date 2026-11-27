/**
 * The one page shell of the orchestrate pages: the document, the header with
 * when the page was built and how to rebuild it, an optional banner, and the
 * small script that shows one page at a time by its hash. The past-runs
 * dashboard uses it now; the live board uses it later, with the same
 * stylesheet (`shared.css`, beside this file).
 *
 * Pages are `<section class="page" id="<route>">` blocks. Everything is
 * static HTML: the script only shows, filters, copies and downloads, so the
 * page works offline and holds no credential.
 */

import { readFileSync } from "node:fs";

export const STYLE = readFileSync(new URL("./shared.css", import.meta.url), "utf8");

/** Escape text for HTML, attribute values included. */
export const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * The page id an address's hash names: decoded, then through `aliases` (a route prefix to the
 * prefix it stands for). The home page when the hash names none, or does not decode.
 * It runs in the page as written: it must use nothing outside itself.
 */
export function routeOf(hash, { home = null, aliases = {} } = {}) {
  let id = "";
  try {
    id = decodeURIComponent(String(hash).replace(/^#/, ""));
  } catch {
    id = "";
  }
  id = id || home || "/";
  for (const [from, to] of Object.entries(aliases))
    if (id === from || id.startsWith(from + "/")) return to + id.slice(from.length);
  return id;
}

/**
 * The Repository switcher's option a page belongs to: the repository's page or a page under it,
 * never another repository whose name only begins the same. A page outside every repository's
 * route (a run's tabs, its Delegation and step pages) names its `owner` option instead.
 * Null when none is. It runs in the page as written: it must use nothing outside itself.
 */
export function switcherFor(pageId, values, owner = null) {
  const under = values.find((v) => v !== "/" && (pageId === v || pageId.startsWith(v + "/")));
  return under ?? (owner && owner !== "/" && values.includes(owner) ? owner : null);
}

const SCRIPT = `
(() => {
  const root = document.documentElement;
  const pages = [...document.querySelectorAll("section.page")];
  const byId = (id) => pages.find((p) => p.id === id);
  const routeOf = ${routeOf};
  const switcherFor = ${switcherFor};
  let aliases = {};
  try { aliases = JSON.parse(document.body.dataset.aliases || "{}"); } catch {}
  const route = () => {
    const id = routeOf(location.hash, { home: document.body.dataset.home, aliases });
    const page = byId(id) || byId(id + "/summary") || byId("/");
    pages.forEach((p) => p.classList.toggle("on", p === page));
    const switcher = document.getElementById("repo-switch");
    if (switcher) {
      const mine = switcherFor(page.id, [...switcher.options].map((o) => o.value), page.dataset.repo);
      switcher.value = mine ? mine : page.id === "/" ? "/" : switcher.value;
    }
    if (!id.startsWith("open=")) window.scrollTo(0, 0);
  };
  addEventListener("hashchange", route);
  route();
  try { const t = localStorage.getItem("orchestrate-theme"); if (t) root.dataset.theme = t; } catch {}
  document.getElementById("theme")?.addEventListener("click", () => {
    const dark = getComputedStyle(root).getPropertyValue("--bg").trim() === "#131416";
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("orchestrate-theme", root.dataset.theme); } catch {}
  });
  const text = (id) => document.getElementById(id)?.textContent ?? "";
  document.addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) navigator.clipboard?.writeText(text(copy.dataset.copy));
    const down = e.target.closest("[data-download]");
    if (down) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text(down.dataset.download)], { type: "text/plain" }));
      a.download = down.dataset.filename || "log.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "repo-switch") location.hash = "#" + e.target.value;
    const range = e.target.closest("select[data-range-select]");
    if (range) {
      range.closest("section").querySelectorAll(".ranged").forEach((d) => { d.hidden = d.dataset.range !== range.value; });
      range.closest("section").querySelectorAll("select[data-range-select]").forEach((s) => { s.value = range.value; });
      return;
    }
    const select = e.target.closest("select[data-filter]");
    if (!select) return;
    const table = select.closest("section").querySelector("table[data-filterable]");
    const wanted = Object.fromEntries([...select.closest(".filters").querySelectorAll("select[data-filter]")].map((s) => [s.dataset.filter, s.value]));
    table.querySelectorAll("tbody tr").forEach((row) => {
      row.hidden = Object.entries(wanted).some(([k, v]) => v && row.dataset[k] !== v);
    });
  });
})();
`;

/**
 * @param {{title: string, brand?: string, head?: string, mainAttributes?: string, script?: string, builtAt: string, rebuild: string, banner?: string | null, nav: {href: string, label: string}[], switcher?: string, home?: string | null, aliases?: Record<string, string>, pages: {id: string, html: string}[]}} options
 *   `rebuild` is HTML (already escaped), shown after "Rebuild:". `switcher` is HTML
 *   (already escaped) for the header; `home` is the page id the document opens on
 *   when its address names none. `aliases` maps a route prefix to the one it stands for.
 */
export function shell({
  title,
  builtAt,
  rebuild,
  banner = null,
  nav,
  switcher = "",
  home = null,
  aliases = {},
  pages,
  brand = title,
  head = "",
  mainAttributes = "",
  script = "",
}) {
  return `<!doctype html>
<html lang="en" class="js-off">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style>
${head ? `${head}\n` : ""}</head>
<body${home ? ` data-home="${esc(home)}"` : ""}${Object.keys(aliases).length ? ` data-aliases="${esc(JSON.stringify(aliases))}"` : ""}>
${banner ? `<div class="banner" role="note">${esc(banner)}</div>\n` : ""}<header class="top">
  <a class="brand" href="#/">${esc(brand)}</a>
  ${nav.map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join("\n  ")}
  ${switcher ? `${switcher}\n  ` : ""}<span class="grow"></span>
  <span class="built">Built ${esc(builtAt)}. Rebuild: ${rebuild}</span>
  <button id="theme" type="button" title="Light or dark">◐</button>
</header>
<main class="main"${mainAttributes ? ` ${mainAttributes}` : ""}>
${pages.map((p) => p.html).join("\n")}
</main>
<script>document.documentElement.classList.remove("js-off");${SCRIPT}</script>\n${script ? `<script>${script}</script>\n` : ""}
</body>
</html>
`;
}
