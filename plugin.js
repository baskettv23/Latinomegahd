// latinomegahd plugin for Kino
const BASE = "https://www.latinomegahd.net";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": BASE + "/",
};

function cleanText(t) {
  if (!t) return "";
  return t.replace(/\s+/g, " ").replace(/\n|\r/g, " ").trim();
}

function isSeries(url, title) {
  const u = (url || "").toLowerCase();
  const tt = (title || "").toLowerCase();
  if (u.includes("temporada") || u.includes("-serie-") || u.match(/serie/)) return true;
  if (tt.includes("temporada") || tt.includes("serie")) return true;
  return false;
}

function toId(s) {
  if (!s) return "";
  try {
    const u = new URL(s);
    let p = u.pathname.replace(/\/$/, "");
    if (p.startsWith("/")) p = p.slice(1);
    return p.replace(/[^A-Za-z0-9._~-]+/g, "-").slice(0, 128);
  } catch (e) {
    return s.replace(/[^A-Za-z0-9._~-]+/g, "-").slice(0, 128);
  }
}

function extractPoster(chunk) {
  if (!chunk) return "";
  let m = chunk.match(/<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i);
  if (m && m[1] && !m[1].includes("data:image")) return m[1];
  m = chunk.match(/srcset=["']([^"'\s,]+)[^"']*["']/i);
  if (m && m[1] && !m[1].includes("data:image")) return m[1];
  return "";
}

function parseList(html) {
  const items = [];
  const seen = new Set();

  // 1) Carrusel items
  let re = /<div[^>]+class="[^"]*(?:carousel-item|item|movie-item)[^"]*"[^>]*>[\s\S]{0,2500}?<\/div>/gis;
  let m;
  while ((m = re.exec(html)) && items.length < 300) {
    const block = m[0];
    const ha = block.match(/<a[^>]+href="([^"]+)"/i);
    if (!ha) continue;
    const href = ha[1];
    if (!href.includes("latinomegahd.net")) continue;
    if (href.includes("/noticias/") || href.includes("/guia") || href.includes("/tag/") || href.includes("/category/") || href.includes("/author/") || href.includes("/wp-content/")) continue;
    if (href.includes("#") || href.includes("javascript:")) continue;
    const poster = extractPoster(block);
    let title = "";
    const mt = block.match(/alt=["']([^"']+)["']/i) || block.match(/title=["']([^"']+)["']/i);
    if (mt) title = cleanText(mt[1]);
    if (!title) {
      const h2 = block.match(/<h[234][^>]*>(.*?)<\/h[234]>/is);
      if (h2) title = cleanText(h2[1].replace(/<[^>]+>/g, " "));
    }
    if (!title) {
      const pt = block.match(/class="[^"]*(?:post-title|Title|titulo)[^"]*"[^>]*>(.*?)<\/[a-z]>/is);
      if (pt) title = cleanText(pt[1].replace(/<[^>]+>/g, " "));
    }
    if (!title) continue;
    const id = toId(href);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      ref: href,
      title,
      kind: isSeries(href, title) ? "series" : "movie",
      poster,
      backdrop: "",
      year: "",
      overview: "",
      lang: "",
      quality: "",
      originalTitle: "",
      genres: [],
      rating: null,
      runtimeMinutes: 0,
      tmdb: 0,
      imdb: "",
      badges: []
    });
  }

  // 2) Items con movie-poster
  if (items.length < 80) {
    re = /<a[^>]+href="([^"]*latinomegahd\.net\/[^"#?]+\/)"[^>]*>[\s\S]{0,800}?<div[^>]+class="[^"]*movie-poster[^"]*"[^>]*>[\s\S]{0,600}?<\/div>[\s\S]{0,200}?<\/a>/gis;
    while ((m = re.exec(html)) && items.length < 200) {
      const block = m[0];
      const href = m[1];
      if (!href.includes("latinomegahd.net")) continue;
      if (href.includes("/noticias/") || href.includes("/guia") || href.includes("/tag/") || href.includes("/category/")) continue;
      if (href.includes("#") || href.includes("javascript:")) continue;
      const poster = extractPoster(block);
      let title = "";
      const mt = block.match(/alt=["']([^"']+)["']/i) || block.match(/title=["']([^"']+)["']/i);
      if (mt) title = cleanText(mt[1]);
      if (!title) {
        const mt2 = block.match(/class="[^"]*post-title[^"]*"[^>]*>(.*?)<\/a>/is);
        if (mt2) title = cleanText(mt2[1].replace(/<[^>]+>/g, " "));
      }
      if (!title) continue;
      const id = toId(href);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        ref: href,
        title,
        kind: isSeries(href, title) ? "series" : "movie",
        poster,
        backdrop: "",
        year: "",
        overview: "",
        lang: "",
        quality: "",
        originalTitle: "",
        genres: [],
        rating: null,
        runtimeMinutes: 0,
        tmdb: 0,
        imdb: "",
        badges: []
      });
    }
  }

  // 3) post-title
  if (items.length < 40) {
    re = /<a[^>]+href="([^"]*latinomegahd\.net\/[^"#?]+\/)"[^>]*class="[^"]*post-title[^"]*"[^>]*>(.*?)<\/a>/gis;
    while ((m = re.exec(html)) && items.length < 200) {
      const href = m[1];
      if (!href.includes("latinomegahd.net")) continue;
      if (href.includes("/noticias/") || href.includes("/guia") || href.includes("/tag/") || href.includes("/category/")) continue;
      if (href.includes("#") || href.includes("javascript:")) continue;
      const title = cleanText(m[2].replace(/<[^>]+>/g, " "));
      if (!title) continue;
      const near = html.slice(Math.max(0, m.index - 1000), m.index + 200);
      const poster = extractPoster(near);
      const id = toId(href);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        ref: href,
        title,
        kind: isSeries(href, title) ? "series" : "movie",
        poster,
        backdrop: "",
        year: "",
        overview: "",
        lang: "",
        quality: "",
        originalTitle: "",
        genres: [],
        rating: null,
        runtimeMinutes: 0,
        tmdb: 0,
        imdb: "",
        badges: []
      });
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
  let items = parseList(html);
  if (items.length === 0) {
    const r2 = await kino.fetch(BASE + "/peliculas/", { headers: UA });
    if (r2.ok) {
      const html2 = await r2.text();
      items = items.concat(parseList(html2));
    }
  }
  // deduplicate
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
    if (out.length >= 60) break;
  }
  if (out.length === 0) return [];
  return [{ id: "home", title: "Recientes", ref: "home", items: out }];
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
