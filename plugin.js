// latinomegahd plugin for Kino
const BASE = "https://www.latinomegahd.net";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
};

function cleanText(t) {
  if (!t) return "";
  return t.replace(/\s+/g, " ").replace(/\n|\r/g, " ").trim();
}

function isSeries(url, title) {
  if (!url && !title) return false;
  const u = (url || "").toLowerCase();
  const tt = (title || "").toLowerCase();
  if (u.includes("temporada") || u.includes("/serie") || u.includes("serie-")) return true;
  if (tt.includes("temporada") || tt.includes("serie")) return true;
  return false;
}

function toId(s) {
  if (!s) return "";
  return s.replace(/^https?:\/\//, "").replace(BASE, "").replace(/^\//, "").replace(/\/$/, "").replace(/[^A-Za-z0-9._~-]+/g, "-").slice(0, 120);
}

function parseList(html) {
  const items = [];
  // try common patterns
  const re = /href="([^"]+)"[^>]*class="[^"]*post-title[^"]*"[^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = re.exec(html)) && items.length < 80) {
    const href = m[1];
    if (!href) continue;
    if (href.includes("#") || href.includes("javascript:")) continue;
    if (!href.startsWith("http")) continue;
    if (!href.includes("latinomegahd.net")) continue;
    if (href.includes("/wp-content/") || href.includes("/wp-admin/")) continue;
    if (href.includes("/noticias/") || href.includes("/guia")) continue;
    const title = cleanText(m[2].replace(/<[^>]+>/g, " "));
    if (!title) continue;
    const id = toId(href);
    if (!id) continue;
    // avoid duplicates
    if (items.find(x => x.id === id)) continue;
    items.push({
      id,
      ref: href,
      title,
      kind: isSeries(href, title) ? "series" : "movie",
    });
  }
  // fallback
  if (items.length === 0) {
    const re2 = /<a[^>]+href="([^"]*latinomegahd\.net[^"]+)"[^>]+title="([^"]+)"/gis;
    let m2;
    while ((m2 = re2.exec(html)) && items.length < 80) {
      const href = m2[1];
      const title = cleanText(m2[2]);
      if (!title) continue;
      const id = toId(href);
      if (!id || items.find(x => x.id === id)) continue;
      items.push({ id, ref: href, title, kind: isSeries(href, title) ? "series" : "movie" });
    }
  }
  return items;
}

export async function search(query) {
  await null;
  const q = query.q || "";
  if (!q) return [];
  let url = BASE + "/?s=" + encodeURIComponent(q).replace(/%20/g, "+");
  let r = await kino.fetch(url, { headers: UA });
  if (!r.ok) {
    url = BASE + "/search/" + encodeURIComponent(q).replace(/%20/g, "+") + "/";
    r = await kino.fetch(url, { headers: UA });
  }
  if (r.status === 429) throw kino.error("rate_limited", "demasiadas peticiones");
  if (!r.ok) throw kino.error("unavailable", "el sitio respondió " + r.status);
  const html = await r.text();
  return parseList(html).slice(0, 100);
}

export async function home() {
  await null;
  const r = await kino.fetch(BASE + "/", { headers: UA });
  if (!r.ok) throw kino.error("unavailable", "el sitio respondió " + r.status);
  const html = await r.text();
  const items = parseList(html).slice(0, 60);
  if (items.length === 0) return [];
  return [{ id: "home", title: "Recientes", ref: "home", items }];
}

export async function browse(ref, cursor) {
  await null;
  let url = ref;
  if (!url.startsWith("http")) {
    url = BASE + "/" + ref.replace(/^\//, "");
  }
  if (cursor) {
    try {
      const u = new URL(url);
      u.searchParams.set("page", cursor);
      url = u.toString();
    } catch (e) {
      url = url + (url.includes("?") ? "&" : "?") + "page=" + encodeURIComponent(cursor);
    }
  }
  const r = await kino.fetch(url, { headers: UA });
  if (!r.ok) throw kino.error("unavailable", "el sitio respondió " + r.status);
  const html = await r.text();
  const items = parseList(html).slice(0, 100);
  let next;
  const m = html.match(/page\/(\d+)\//);
  if (m) {
    const p = parseInt(m[1], 10);
    if (p) next = String(p + 1);
  }
  return { items, next };
}

export async function episodes(ref) {
  await null;
  const url = typeof ref === "string" && ref.startsWith("http") ? ref : (ref && ref.url ? ref.url : String(ref));
  const r = await kino.fetch(url, { headers: UA });
  if (!r.ok) throw kino.error("unavailable", "el sitio respondió " + r.status);
  const html = await r.text();
  // try to find season/episode links
  const eps = [];
  const re = /href="([^"]+temporada[^"]+)"[^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = re.exec(html)) && eps.length < 200) {
    const href = m[1];
    if (!href.includes("latinomegahd.net")) continue;
    const title = cleanText(m[2].replace(/<[^>]+>/g, " "));
    if (!title) continue;
    const id = toId(href);
    eps.push({ id, title, ref: href });
  }
  if (eps.length === 0) {
    // sometimes series have episodes listed differently; return single if not found
    return [];
  }
  // group by season simple
  return [{ id: "season1", title: "Temporada 1", episodes: eps }];
}

export async function resolve(ref) {
  await null;
  const url = typeof ref === "string" && ref.startsWith("http") ? ref : String(ref);
  const r = await kino.fetch(url, { headers: UA });
  if (r.status === 404) throw kino.error("not_found", "No se encontró en LatinoMegaHD");
  if (!r.ok) throw kino.error("unavailable", "el sitio respondió " + r.status);
  const html = await r.text();
  // look for iframes/embeds or go links
  let m = html.match(/<iframe[^>]+src="([^"]+)"/i);
  if (m && m[1]) {
    const embed = m[1];
    if (embed.includes("youtube.com")) {
      throw kino.error("unavailable", "Solo trailer disponible");
    }
    // try to fetch embed if same host or allowed? better return as stream if direct
    return { url: embed, mime: "text/html" };
  }
  m = html.match(/href="([^"]*go\.[^"]+)"/i);
  if (m && m[1]) {
    // go links often redirect; kino.fetch will follow redirects
    return { url: m[1], mime: "video/mp4" };
  }
  m = html.match(/href="([^"]*\/go\/[^"]+)"/i);
  if (m && m[1]) {
    return { url: m[1].startsWith("http") ? m[1] : BASE + m[1], mime: "video/mp4" };
  }
  throw kino.error("not_found", "No se encontró enlace reproducible");
}
