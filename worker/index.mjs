const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const headings = {
  promos: "Promokod",
  videos: "Videoqo‘llanma",
  missions: "Missiya videosi",
  links: "Jamoa havolasi",
  news: "Yangilik",
};
const kinds = Object.keys(headings);
const origin = "https://nte-uzb-fan.copperwave513.chatgpt.site";

function canEdit(request, env) {
  if (env.netlify) return true;
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const allowed = (env.NTE_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((item) => item.trim());
  return Boolean(userId && email && allowed.includes(email));
}

const adminCookie = "__Host-nteuzb_admin";
const sessionSeconds = 8 * 60 * 60;

async function matchesAdminPassword(input, password) {
  const encode = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all(
    [input, password].map(async (value) =>
      new Uint8Array(await crypto.subtle.digest("SHA-256", encode.encode(value))))
  );
  let difference = 0;
  for (let index = 0; index < actualHash.length; index++) {
    difference |= actualHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

function adminLogin(message = "", status = 200) {
  return render("/admin.html", '<form class="admin-login" method="post" action="/admin">' +
    '<h2>Admin paneliga kirish</h2>' +
    (message ? '<p role="alert">' + htmlEscape(message) + '</p>' : '') +
    '<input type="hidden" name="action" value="login">' +
    '<label for="admin-password">Parol</label><div class="admin-password-row">' +
    '<input id="admin-password" name="password" type="password" autocomplete="current-password" required maxlength="256">' +
    '<button class="button secondary" type="button" id="admin-password-toggle" aria-controls="admin-password" hidden>Ko‘rsatish</button>' +
    '</div><button class="button primary" type="submit">Kirish</button></form>', status);
}

function adminRedirect(session = "", maxAge = 0) {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin",
      "set-cookie": adminCookie + "=" + session + "; Path=/; Max-Age=" + maxAge + "; Secure; HttpOnly; SameSite=Strict",
    },
  });
}

async function adminRequest(request, env, url) {
  if (!canEdit(request, env)) {
    return new Response("Bu panelga kirish uchun administrator huquqi kerak.", {status: 403});
  }
  if (!env.NTE_ADMIN_PASSWORD || !env.BUCKET) {
    return render("/admin.html", "<p>Admin panelining kirish sozlamalari tayyorlanmagan.</p>", 503);
  }
  if (!["GET", "HEAD", "POST"].includes(request.method)) return new Response(null, {status: 405});

  const subject = env.netlify ? "netlify" : request.headers.get("oai-authenticated-user-id");
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-nteuzb_admin=([a-f0-9-]{36})(?=;|$)/)?.[1];
  const key = token ? "admin-sessions/" + token : null;
  const session = key ? await env.BUCKET.get(key) : null;
  const entry = session ? await session.json() : null;
  const signedIn = entry?.subject === subject && entry.expires > Date.now();
  if (entry && entry.expires <= Date.now()) await env.BUCKET.delete(key);

  if (request.method !== "POST") {
    return signedIn ? adminPage(env, url.searchParams.has("saved") ? "O‘zgarish saqlandi." : "") : adminLogin();
  }
  const form = await readAdminForm(request, env, url);
  if (form instanceof Response) return form;
  const action = form.get("action");
  if (action === "login") {
    if (signedIn) return adminRedirect(token, Math.max(0, Math.floor((entry.expires - Date.now()) / 1000)));
    const password = form.get("password") ?? "";
    if (!password || password.length > 256 || !(await matchesAdminPassword(password, env.NTE_ADMIN_PASSWORD))) {
      return adminLogin("Parol noto‘g‘ri. Qayta urinib ko‘ring.", 401);
    }
    const id = crypto.randomUUID();
    await env.BUCKET.put("admin-sessions/" + id,
      JSON.stringify({subject, expires: Date.now() + sessionSeconds * 1000}));
    return adminRedirect(id, sessionSeconds);
  }
  if (!signedIn) return adminLogin("Davom etish uchun parolni kiriting.", 401);
  if (action === "logout") {
    await env.BUCKET.delete(key);
    return adminRedirect();
  }
  return adminWrite(form, env);
}

function render(template, markup, status = 200) {
  return new Response(assets[template][1].replace("<!-- CONTENT -->", () => markup), {
    status,
    headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff"},
  });
}

async function records(bucket, kind) {
  const result = [];
  let cursor;
  do {
    const page = await bucket.list({prefix: kind + "/", cursor, limit: 100});
    for (const item of page.objects) {
      const entry = await bucket.get(item.key);
      if (entry) result.push(await entry.json());
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return result.sort((a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id));
}

function safeUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function localDate() {
  return new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Tashkent"}).format(new Date());
}

function promoPage(items) {
  const today = localDate();
  const cards = items.map((item) => {
    const expired = item.expiry && item.expiry < today;
    return '<article class="promo-item"><h2><code>' + htmlEscape(item.title) + '</code></h2>' +
      '<p>' + (expired ? 'Muddati tugagan' : item.expiry ? 'Amal qilish muddati ' + htmlEscape(item.expiry) + ' · Toshkent vaqti' : 'Amal qilish muddati ko‘rsatilmagan') + '</p>' +
      '<div class="actions">' + (expired ? '' : '<button type="button" class="button primary" data-copy="' + htmlEscape(item.title) + '">Koddan nusxa olish</button>') +
      '<a class="button secondary" href="' + htmlEscape(item.url) + '">Manbani ochish</a></div></article>';
  });
  return '<p>NTE uchun e’lon qilingan kodlar va ularning manbalari.</p><div role="status" id="copy-status"></div>' +
    (cards.length ? cards.join("") : '<p class="admin-note">Hozircha e’lon qilingan promokod yo‘q.</p>');
}

function form(kind, item) {
  const value = (key) => htmlEscape(item?.[key] ?? "");
  const title = kind === "promos" ? "Kod" : kind === "missions" ? "O‘yindagi missiya nomi" : "Nomi";
  return '<form method="post" action="/admin" class="edit-form">' +
    '<input type="hidden" name="kind" value="' + kind + '">' +
    '<input type="hidden" name="id" value="' + value("id") + '">' +
    '<label>' + title + '<input name="title" required maxlength="' + (kind === "promos" ? '64' : '120') + '" value="' + value("title") + '"></label>' +
    '<label>' + (kind === "promos" ? "Manba havolasi" : "Havola") + '<input name="url" type="url" maxlength="2048" required value="' + value("url") + '"></label>' +
    (kind === "promos"
      ? '<label>Oxirgi sana (Toshkent vaqti)<input name="expiry" type="date" value="' + value("expiry") + '"></label>'
      : '<label>Qisqa izoh<input name="description" maxlength="240" value="' + value("description") + '"></label>') +
    '<div class="actions"><button class="button primary" name="action" value="save">Saqlash</button>' +
    (item ? '<button class="button secondary" name="action" value="delete" formnovalidate>O‘chirish</button>' : '') +
    '</div></form>';
}

async function adminPage(env, message = "", status = 200) {
  const sections = await Promise.all(kinds.map(async (kind) => {
    const entries = await records(env.BUCKET, kind);
    const list = entries.map((item) => '<details><summary>' + htmlEscape(item.title) + '</summary>' + form(kind, item) + '</details>');
    return '<section class="admin-group"><h2>' + headings[kind] + '</h2>' + form(kind) + list.join("") + '</section>';
  }));
  return render("/admin.html", (message ? '<p role="status" class="admin-note">' + htmlEscape(message) + '</p>' : '') + '<form method="post" action="/admin" class="admin-logout"><button class="button secondary" name="action" value="logout">Chiqish</button></form>' + sections.join(""), status);
}

async function readAdminForm(request, env, url) {
  const allowedOrigins = env.netlify ? [url.origin] : [url.origin, origin];
  if (!allowedOrigins.includes(request.headers.get("origin"))) {
    return new Response("So‘rov rad etildi.", {status: 403});
  }
  const contentType = request.headers.get("content-type") ?? "";
  const length = Number(request.headers.get("content-length"));
  if (!contentType.startsWith("application/x-www-form-urlencoded") || length > 8192) {
    return new Response("So‘rov formati qabul qilinmadi.", {status: 415});
  }
  const formBody = new Uint8Array(8192);
  const reader = request.body?.getReader();
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        if (size + value.byteLength > formBody.byteLength) {
          await reader.cancel();
          return new Response("So‘rov juda katta.", {status: 413});
        }
        formBody.set(value, size);
        size += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
  }
  const body = new TextDecoder().decode(formBody.subarray(0, size));
  return new URLSearchParams(body);
}

async function adminWrite(form, env) {
  const kind = form.get("kind");
  const id = form.get("id");
  const action = form.get("action");
  if (!kinds.includes(kind) || (id && !/^[a-f0-9-]{36}$/.test(id)) || !["save", "delete"].includes(action)) {
    return new Response("So‘rov xato.", {status: 400});
  }

  const key = kind + "/" + (id || crypto.randomUUID());
  const previous = id ? await env.BUCKET.get(key) : null;
  if (id && !previous) return adminPage(env, "Yozuv topilmadi.", 404);
  if (action === "delete") {
    if (!id) return new Response("So‘rov xato.", {status: 400});
    await env.BUCKET.delete(key);
  } else {
    const title = form.get("title")?.trim() ?? "";
    const target = safeUrl(form.get("url") ?? "");
    const description = form.get("description")?.trim() ?? "";
    const expiry = form.get("expiry") ?? "";
    const validDate = !expiry || (/^\d{4}-\d{2}-\d{2}$/.test(expiry) &&
      !Number.isNaN(Date.parse(expiry)) && new Date(expiry).toISOString().startsWith(expiry));
    const validTitle = kind === "promos" ? /^[A-Za-z0-9_-]{1,64}$/.test(title) : title.length > 0 && title.length <= 120;
    if (!validTitle || !target || target.length > 2048 || !validDate || description.length > 240) {
      return adminPage(env, "Nom yoki kodni, HTTPS havolani va sanani tekshiring.", 400);
    }
    const created = previous ? (await previous.json()).created : new Date().toISOString();
    await env.BUCKET.put(key, JSON.stringify({
      id: key.split("/")[1], created, title, url: target, description, expiry,
    }));
  }
  return new Response(null, {status: 303, headers: {location: "/admin?saved=1"}});
}

function linkedEntries(items, title) {
  if (!items.length) return "";
  return '<section class="shell section management"><h2>' + title + '</h2><div class="social">' +
    items.map((item) => '<a href="' + htmlEscape(item.url) + '"><strong>' + htmlEscape(item.title) +
      '</strong>' + (item.description ? '<span>' + htmlEscape(item.description) + '</span>' : '') + '</a>').join("") +
    '</div></section>';
}

async function loadNews(env) {
  let updates = [];
  if (env.BUCKET) {
    try {
      updates = await records(env.BUCKET, "news");
    } catch (error) {
      console.error("News storage unavailable", error);
    }
  }
  const local = updates.map((item) => ({
    ...item,
    date: new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Tashkent"}).format(new Date(item.created)),
    label: "Jamoa",
    source: "Manbani ochish",
  }));
  const unique = new Map();
  for (const item of [...local, ...curatedNews]) {
    if (!unique.has(item.url)) unique.set(item.url, item);
  }
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function newsCards(news) {
  return '<div class="news-grid">' + news.map((item) => {
    const date = item.date.split("-").reverse().join(".");
    const cover = item.image || "/assets/city.webp";
    return '<article class="news-card" data-catalog-item data-location-category="' + htmlEscape(item.label) +
      '"><img class="news-cover" src="' + htmlEscape(cover) + '" alt="" loading="lazy" decoding="async">' +
      '<div class="news-card-body"><div class="news-meta"><span>' + htmlEscape(item.label) + '</span> <time datetime="' + htmlEscape(item.date) + '">' +
      htmlEscape(date) + '</time></div><h3>' + htmlEscape(item.title) + '</h3><p>' + htmlEscape(item.description || "") +
      '</p><a class="text-link" href="' + htmlEscape(item.url) + '">' + htmlEscape(item.source) + '</a></div></article>';
  }).join("") + '</div>';
}

async function homeTemplate(env) {
  const news = await loadNews(env);
  const featured = news.find((item) => item.label === "Yangilanish");
  const highlight = featured ? '<article class="news-highlight">' +
    (featured.image ? '<img src="' + htmlEscape(featured.image) + '" alt="" width="970" height="546" loading="lazy">' : '') +
    '<div><p class="eyebrow">So‘nggi versiya</p><h3>' + htmlEscape(featured.title) + '</h3><p>' +
    htmlEscape(featured.description) + '</p><a class="button secondary" href="' + htmlEscape(featured.url) +
    '">Yangilanish tafsilotlari</a></div></article>' : "";
  return assets["/index.html"][1].replace("<!-- HOME_NEWS -->",
    () => highlight + newsCards(news.filter((item) => item !== featured).slice(0, 4)));
}

function normalizeSearch(text) {
  return text.toLowerCase().replace(/[‘’ʻʼ']/g, "").normalize("NFKD")
    .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function searchGroup(entries, query) {
  const unique = new Map();
  for (const item of entries) {
    let score = 0;
    for (const value of [item.title, ...(item.aliases ?? [])]) {
      const name = normalizeSearch(value);
      if (name === query) score = Math.max(score, 3);
      else if (name.startsWith(query)) score = Math.max(score, 2);
      else if (query.split(" ").every((word) => name.includes(word))) score = Math.max(score, 1);
    }
    if (!score) continue;
    const key = normalizeSearch(item.title);
    if (!unique.has(key) || unique.get(key).score < score) unique.set(key, {...item, score});
  }
  return [...unique.values()].sort((one, two) =>
    two.score - one.score || one.title.length - two.title.length).slice(0, 5);
}

async function searchHome(rawQuery, env) {
  const input = rawQuery.slice(0, 120).trim();
  const query = normalizeSearch(input);
  const template = (await homeTemplate(env)).replace('placeholder="Masalan, Adler, Umbrella yoki Record Shop" value=""',
    () => 'placeholder="Masalan, Adler, Umbrella yoki Record Shop" value="' + htmlEscape(input) + '"');
  const fallback = "/missiyalar.html?q=" + encodeURIComponent(input);
  let markup = '<p role="status">Qidirish uchun personaj, Arc yoki missiya nomini yozing.</p>';
  if (query) {
    let communityVideos = [];
    if (env.BUCKET) {
      try {
        communityVideos = await records(env.BUCKET, "missions");
      } catch (error) {
        console.error("Mission search library unavailable", error);
      }
    }
    const missionItems = [...searchIndex.guides, ...communityVideos, ...searchIndex.videos, ...searchIndex.quests]
      .map((item) => ({...item, url: "/missiyalar.html?q=" + encodeURIComponent(item.title)}));
    const groups = [
      ["Personajlar", searchGroup(searchIndex.characters, query)],
      ["Arclar", searchGroup(searchIndex.weapons, query)],
      ["Missiyalar va yechimlar", searchGroup(missionItems, query)],
    ];
    markup = groups.filter(([, items]) => items.length).map(([title, items]) =>
      '<section class="home-result-group"><h3>' + title + '</h3><ul>' +
      items.map((item) => '<li><a class="text-link" href="' + htmlEscape(item.url) + '">' +
        htmlEscape(item.title) + '</a></li>').join("") + '</ul></section>').join("");
    if (!markup) markup = '<p role="status">Mos natija topilmadi. Nomning qisqaroq yoki inglizcha yozilishini sinab ko‘ring.</p>';
    markup += '<p><a class="text-link" href="' + htmlEscape(fallback) + '">Missiya qidiruvida davom etish</a></p>';
  }
  return new Response(template.replace("<!-- HOME_SEARCH_RESULTS -->", () => '<div id="home-results" class="home-results">' + markup + '</div>'), {
    headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff"},
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isAdmin = ["/admin", "/admin/", "/admin.html"].includes(path);
  if (isAdmin) return adminRequest(request, env, url);

  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, {status: 405});
  if (["/", "/index.html"].includes(path)) {
    if (request.method === "HEAD") return new Response(null, {headers: {"content-type": "text/html; charset=utf-8"}});
    if (url.searchParams.has("q")) return searchHome(url.searchParams.get("q"), env);
    return new Response(await homeTemplate(env), {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
  }
  if (path === "/yangiliklar.html") {
    if (request.method === "HEAD") return new Response(null, {headers: {"content-type": "text/html; charset=utf-8"}});
    return render("/yangiliklar.html", newsCards(await loadNews(env)));
  }

  if (path === "/missiya-videolari.json") {
    if (!env.BUCKET) return Response.json([], {status: 503});
    const items = (await records(env.BUCKET, "missions"))
      .map(({title, url, description}) => ({title, url, description}));
    return new Response(request.method === "HEAD" ? null : JSON.stringify(items), {
      headers: {"content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff"},
    });
  }
  if (["/promokodlar", "/promokodlar/", "/promokodlar.html"].includes(path)) {
    if (!env.BUCKET) return render("/promokodlar.html", "<p>Promokodlarni hozir yuklab bo‘lmadi.</p>", 503);
    return render("/promokodlar.html", promoPage(await records(env.BUCKET, "promos")));
  }

  if (!["/videolar.html", "/jamoa.html"].includes(path) || !env.BUCKET) {
    const file = Object.hasOwn(assets, path === "/" ? "/index.html" : path) ? assets[path === "/" ? "/index.html" : path] : null;
    if (!file) return new Response("Sahifa topilmadi.", {status: 404});
    const [type, data] = file;
    const body = type.includes("charset") ? data : Uint8Array.from(atob(data), (value) => value.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : body, {headers: {"content-type": type, "x-content-type-options": "nosniff"}});
  }

  const video = path === "/videolar.html";
  const content = linkedEntries(await records(env.BUCKET, video ? "videos" : "links"), video ? "O‘zbekcha videoqo‘llanmalar" : "Jamoaning boshqa havolalari");
  return new Response(request.method === "HEAD" ? null : assets[path][1].replace("</main>", () => content + "</main>"), {
    headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
  });
}

const contentPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-src https://nte.th.gl",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

export default {
  async fetch(request, env) {
    const response = await handleRequest(request, env);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set("Strict-Transport-Security", "max-age=31536000");

    const path = new URL(request.url).pathname;
    const admin = ["/admin", "/admin/", "/admin.html"].includes(path);
    if (admin) {
      headers.set("Cache-Control", "no-store");
      headers.set("X-Frame-Options", "DENY");
    }
    if (headers.get("content-type")?.startsWith("text/html")) {
      headers.set("Content-Security-Policy", contentPolicy + (admin ? "; frame-ancestors 'none'" : ""));
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers,
    });
  },
};
