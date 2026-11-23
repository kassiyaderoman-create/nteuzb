const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const headings = {
  promos: "Promokod",
  videos: "Videoqo‘llanma",
  missions: "Missiya videosi",
  links: "Jamoa havolasi",
  news: "Yangilik",
  profiles: "Personaj yoki Arc profili",
  banners: "Banner yoki tadbir",
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

function form(kind, item, profiles = []) {
  const value = (key) => htmlEscape(item?.[key] ?? "");
  const title = kind === "promos" ? "Kod" : kind === "missions" ? "O‘yindagi missiya nomi" : "Nomi";
  let fields;
  if (kind === "profiles") {
    const selected = item?.catalogKey;
    const options = profiles.map(({key, title}) =>
      '<option value="' + htmlEscape(key) + '"' + (key === selected ? ' selected' : '') + '>' + htmlEscape(title) + '</option>');
    fields = '<label>Personaj yoki Arc<select name="catalogKey" required><option value="">Tanlang</option>' +
      options.join("") + '</select></label>' +
      '<label>Jangdagi roli<input name="role" maxlength="80" value="' + value("role") + '"></label>' +
      '<label>O‘zbekcha hikoya<textarea name="story" rows="4" maxlength="1000">' + value("story") + '</textarea></label>' +
      '<label>Yig‘ma va kuchaytirish tavsiyasi<textarea name="build" rows="4" maxlength="1000">' + value("build") + '</textarea></label>';
  } else {
    fields = '<label>' + title + '<input name="title" required maxlength="' + (kind === "promos" ? '64' : '120') + '" value="' + value("title") + '"></label>' +
      '<label>' + (kind === "promos" || kind === "banners" ? "Manba havolasi" : "Havola") +
      '<input name="url" type="url" maxlength="2048" required value="' + value("url") + '"></label>' +
      (kind === "promos"
        ? '<label>Oxirgi sana (Toshkent vaqti)<input name="expiry" type="date" value="' + value("expiry") + '"></label>'
        : '<label>Qisqa izoh<input name="description" maxlength="240" value="' + value("description") + '"></label>');
    if (kind === "banners") {
      fields += '<label>Boshlanishi (Toshkent vaqti)<input name="start" type="datetime-local" required value="' +
        value("start") + '"></label><label>Tugashi (Toshkent vaqti)<input name="end" type="datetime-local" required value="' +
        value("end") + '"></label>';
    }
  }
  return '<form method="post" action="/admin" class="edit-form">' +
    '<input type="hidden" name="kind" value="' + kind + '">' +
    '<input type="hidden" name="id" value="' + value("id") + '">' + fields +
    '<div class="actions"><button class="button primary" name="action" value="save">Saqlash</button>' +
    (item ? '<button class="button secondary" name="action" value="delete" formnovalidate>O‘chirish</button>' : '') +
    '</div></form>';
}

async function editableProfiles(env) {
  const groups = await Promise.all(Object.keys(catalogRoutes).map(async kind =>
    (await loadCatalog(env, kind)).map(item => ({
      key: profileKey(kind, item),
      title: (kind === "characters" ? "Personaj · " : "Arc · ") + item.title,
    }))));
  return groups.flat();
}

function parseTashkentTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const plain = new Date(value + "Z");
  if (!Number.isFinite(plain.getTime()) || plain.toISOString().slice(0, 16) !== value) return NaN;
  return Date.parse(value + "+05:00");
}

async function adminPage(env, message = "", status = 200) {
  const profiles = await editableProfiles(env);
  const sections = await Promise.all(kinds.map(async (kind) => {
    const entries = await records(env.BUCKET, kind);
    const list = entries.map((item) => '<details><summary>' + htmlEscape(item.title) + '</summary>' + form(kind, item, profiles) + '</details>');
    return '<section class="admin-group"><h2>' + headings[kind] + '</h2>' + form(kind, null, profiles) + list.join("") + '</section>';
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
    const fields = await adminFields(kind, form, env, id);
    if (typeof fields === "string") return adminPage(env, fields, 400);
    const created = previous ? (await previous.json()).created : new Date().toISOString();
    await env.BUCKET.put(key, JSON.stringify({id: key.split("/")[1], created, ...fields}));
  }
  return new Response(null, {status: 303, headers: {location: "/admin?saved=1"}});
}

async function adminFields(kind, form, env, id) {
  if (kind === "profiles") {
    const catalogKey = form.get("catalogKey");
    const role = form.get("role")?.trim() ?? "";
    const story = form.get("story")?.trim() ?? "";
    const build = form.get("build")?.trim() ?? "";
    const entry = (await editableProfiles(env)).find((profile) => profile.key === catalogKey);
    if (!entry || (!role && !story && !build) || role.length > 80 || story.length > 1000 || build.length > 1000) {
      return "Profilni tanlang va rol, hikoya yoki tavsiya yozing.";
    }
    if ((await records(env.BUCKET, "profiles")).some(item => item.catalogKey === catalogKey && item.id !== id)) {
      return "Bu profil uchun yozuv bor. Uni ro‘yxatdan tahrirlang.";
    }
    return {catalogKey, title: entry.title, role, story, build};
  }
  const title = form.get("title")?.trim() ?? "";
  const target = safeUrl(form.get("url") ?? "");
  const description = form.get("description")?.trim() ?? "";
  const expiry = form.get("expiry") ?? "";
  const validDate = !expiry || Number.isFinite(parseTashkentTime(expiry + "T00:00"));
  const validTitle = kind === "promos" ? /^[A-Za-z0-9_-]{1,64}$/.test(title) : title.length > 0 && title.length <= 120;
  if (!validTitle || !target || target.length > 2048 || !validDate || description.length > 240) {
    return "Nom yoki kodni, HTTPS havolani va sanani tekshiring.";
  }
  if (kind === "banners") {
    const start = form.get("start");
    const end = form.get("end");
    if (!(parseTashkentTime(start) < parseTashkentTime(end))) {
      return "Bannerning tugash vaqti boshlanishidan keyin bo‘lishi kerak.";
    }
    return {title, url: target, description, start, end};
  }
  return {title, url: target, description, expiry};
}

async function optionalRecords(env, kind) {
  if (!env.BUCKET) return [];
  try {
    return await records(env.BUCKET, kind);
  } catch (error) {
    console.error("Yozuvlarni yuklab bo‘lmadi:", kind, error);
    return [];
  }
}

async function bannerCalendar(env) {
  const now = Date.now();
  const manual = await optionalRecords(env, "banners");
  const overridden = new Set(manual.map(item => normalizeSearch(item.title)));
  const seedByTitle = new Map(bannerSeed.map(item => [normalizeSearch(item.title), item]));
  const entries = [...manual.map(item => ({...seedByTitle.get(normalizeSearch(item.title)), ...item})),
    ...bannerSeed.filter(item => !overridden.has(normalizeSearch(item.title)))];
  const banners = entries.map(item => {
    const start = parseTashkentTime(item.start);
    const end = parseTashkentTime(item.end);
    return {...item, start, end, status: now < start ? "Tez orada" : now < end ? "Faol" : "Tugagan"};
  }).filter(item => item.start < item.end);
  const statusOrder = {"Faol": 0, "Tez orada": 1, "Tugagan": 2};
  banners.sort((a,b) => statusOrder[a.status] - statusOrder[b.status] ||
    (a.status === "Tugagan" ? b.end - a.end : a.start - b.start));
  const format = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const date = value => '<time datetime="' + new Date(value).toISOString() + '">' + htmlEscape(format.format(value)) + '</time>';
  const cards = banners.slice(0, 8).map(item => '<article class="panel banner-card">' +
    (item.image ? '<img class="banner-art" src="' + htmlEscape(item.image) + '" alt="' + htmlEscape(item.imageAlt) +
      '" loading="lazy" decoding="async">' : '') + '<p class="banner-state">' + item.status +
    '</p><h3>' + htmlEscape(item.title) + '</h3><p>' + htmlEscape(item.description) +
    '</p><dl><dt>Boshlanishi</dt><dd>' + date(item.start) + '</dd><dt>Tugashi</dt><dd>' + date(item.end) +
    '</dd></dl><a class="text-link" href="' + htmlEscape(item.url) + '">E’lonni ochish</a></article>');
  return cards.length
    ? '<p>Toshkent vaqti</p><div class="cards banner-grid">' + cards.join("") + '</div>'
    : '<p>Taqvimga tasdiqlangan banner yoki tadbir qo‘shilganda vaqti shu yerda ko‘rinadi.</p>';
}

function linkedEntries(items, title) {
  if (!items.length) return "";
  return '<section class="shell section management"><h2>' + title + '</h2><div class="social">' +
    items.map((item) => '<a href="' + htmlEscape(item.url) + '"' +
      (item.newTab ? ' target="_blank" rel="noopener noreferrer"' : '') + '><strong>' + htmlEscape(item.title) +
      '</strong>' + (item.description ? '<span>' + htmlEscape(item.description) + '</span>' : '') + '</a>').join("") +
    '</div></section>';
}

async function readNewsFeed(bucket, name) {
  try {
    const entry = await bucket.get("feed/" + name);
    const feed = entry ? await entry.json() : [];
    return Array.isArray(feed) ? feed : [];
  } catch {
    console.error("Yangilik lentasini o‘qib bo‘lmadi:", name);
    return [];
  }
}

async function loadNews(env) {
  let updates = [];
  let automatic = [];
  if (env.BUCKET) {
    try {
      updates = await records(env.BUCKET, "news");
    } catch (error) {
      console.error("News storage unavailable", error);
    }
    automatic = (await Promise.all(["official", "telegram"].map((name) => readNewsFeed(env.BUCKET, name)))).flat();
  }
  const local = updates.map((item) => ({
    ...item,
    date: new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Tashkent"}).format(new Date(item.created)),
    label: "Jamoa",
    source: "Manbani ochish",
  }));
  const unique = new Map();
  for (const item of [...local, ...curatedNews, ...automatic]) {
    if (!unique.has(item.url)) unique.set(item.url, item);
  }
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function newsCards(news) {
  return '<div class="news-grid">' + news.map((item) => {
    const date = item.date.split("-").reverse().join(".");
    const cover = item.image || "/assets/city.webp";
    const target = item.newTab ? ' target="_blank" rel="noopener noreferrer"' : "";
    return '<article class="news-card" data-catalog-item data-location-category="' + htmlEscape(item.label) +
      '"><img class="news-cover" src="' + htmlEscape(cover) + '" alt="" loading="lazy" decoding="async">' +
      '<div class="news-card-body"><div class="news-meta"><span>' + htmlEscape(item.label) + '</span> <time datetime="' + htmlEscape(item.date) + '">' +
      htmlEscape(date) + '</time></div><h3>' + htmlEscape(item.title) + '</h3><p>' + htmlEscape(item.description || "") +
      '</p><a class="text-link" href="' + htmlEscape(item.url) + '"' + target + '>' + htmlEscape(item.source) + '</a></div></article>';
  }).join("") + '</div>';
}

async function homeTemplate(env) {
  const [news, calendar] = await Promise.all([loadNews(env), bannerCalendar(env)]);
  const featured = news.find((item) => item.label === "Yangilanish");
  const highlight = featured ? '<article class="news-highlight">' +
    (featured.image ? '<img src="' + htmlEscape(featured.image) + '" alt="" width="970" height="546" loading="lazy">' : '') +
    '<div><p class="eyebrow">So‘nggi versiya</p><h3>' + htmlEscape(featured.title) + '</h3><p>' +
    htmlEscape(featured.description) + '</p><a class="button secondary" href="' + htmlEscape(featured.url) +
    '">Yangilanish tafsilotlari</a></div></article>' : "";
  return assets["/index.html"][1].replace("<!-- HOME_NEWS -->",
    () => highlight + newsCards(news.filter((item) => item !== featured).slice(0, 4)))
    .replace("<!-- BANNER_CALENDAR -->", () => calendar);
}

function normalizeSearch(text) {
  return text.toLowerCase().replace(/[‘’ʻʼ']/g, "").normalize("NFKD")
    .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const catalogRoutes = {characters: "/personajlar.html", arcs: "/arclar.html"};

async function loadCatalog(env, kind) {
  const fresh = env.BUCKET ? await readNewsFeed(env.BUCKET, "catalog-" + kind) : [];
  const curated = catalogCurated[kind];
  const ids = new Set(curated.map((item) => item.id));
  const titles = new Set(curated.map((item) => normalizeSearch(item.title)));
  const items = [...curated];
  for (const record of fresh.length ? fresh : catalogSeed[kind]) {
    if (typeof record?.id !== "string" || !/^[a-z0-9_]{1,90}$/i.test(record.id) ||
        typeof record.title !== "string" || !record.title.trim() || record.title.length > 120 ||
        ids.has(record.id) || titles.has(normalizeSearch(record.title))) continue;
    ids.add(record.id);
    titles.add(normalizeSearch(record.title));
    items.push({
      id: record.id, title: record.title, icon: record.icon,
      url: "/katalog.html?tur=" + kind + "&id=" + encodeURIComponent(record.id),
    });
  }
  return items;
}

function catalogIcon(icon) {
  if (!/^https:\/\/cdn\.th\.gl\/neverness-to-everness\/icons\/icons\.[a-f0-9]+\.webp$/.test(icon?.sprite ?? "") ||
      !Number.isInteger(icon.x) || !Number.isInteger(icon.y)) return "";
  return '<span class="catalog-icon" aria-hidden="true" style="background-image:url(' +
    htmlEscape(icon.sprite) + ');background-position:' + icon.x + 'px ' + icon.y + 'px"></span>';
}

function profileKey(kind, item) {
  const variant = kind === "characters" && /^(Male|Female) Zero$/.test(item.title) ? "/" + item.url.slice(1, -5) : "";
  return kind + "/" + item.id + variant;
}

async function profileData(env) {
  const [facts, local] = await Promise.all([
    env.BUCKET ? readNewsFeed(env.BUCKET, "catalog-facts") : [],
    optionalRecords(env, "profiles"),
  ]);
  return {
    facts: new Map(facts.map(item => [item.kind + "/" + item.id, item])),
    local: new Map(local.map(item => [item.catalogKey, item])),
  };
}

function profileDetails(kind, item, data) {
  const facts = data.facts.get(kind + "/" + item.id);
  const local = data.local.get(profileKey(kind, item));
  const fields = {
    rank: "Darajasi", element: "Elementi", hp: "Jon", atk: "Hujum kuchi", def: "Himoya",
    critRate: "Tanqidiy zarba ehtimoli", critDamage: "Tanqidiy zarba zarari",
  };
  const values = Object.entries(fields).filter(([key]) => facts?.[key]).map(([key, label]) =>
    '<dt>' + label + '</dt><dd>' + htmlEscape(facts[key]) + '</dd>');
  const materials = facts?.materialsUrl === "https://nte.th.gl/ascension-planner/" + item.id
    ? '<p><a class="text-link" href="' + htmlEscape(facts.materialsUrl) + '" target="_blank" rel="noopener noreferrer">Kuchaytirish materiallari hisoblagichi</a></p>' : "";
  const imported = values.length || materials ? '<section><h3>Katalogdagi ko‘rsatkichlar</h3>' +
    (values.length ? '<dl class="profile-facts">' + values.join("") + '</dl>' : '') + materials +
    '<p><a class="text-link" href="https://nte.th.gl/db/' + kind + '/' + encodeURIComponent(item.id) +
    '" target="_blank" rel="noopener noreferrer">The Hidden Gaming Lair manbasi</a></p></section>' : "";
  const notes = local ? '<section><h3>nteuzb izohlari</h3>' +
    (local.role ? '<p><strong>Jangdagi roli</strong> ' + htmlEscape(local.role) + '</p>' : '') +
    (local.story ? '<h4>O‘zbekcha hikoya</h4><p class="profile-notes-text">' + htmlEscape(local.story) + '</p>' : '') +
    (local.build ? '<h4>Yig‘ma va kuchaytirish</h4><p class="profile-notes-text">' + htmlEscape(local.build) + '</p>' : '') +
    '</section>' : "";
  return imported || notes ? '<div class="profile-extra">' + imported + notes + '</div>' : "";
}

async function curatedCharacterPage(path, env) {
  const item = catalogCurated.characters.find(entry => entry.url === path);
  if (!item || !assets[path]) return new Response("Personaj topilmadi.", {status: 404});
  const details = profileDetails("characters", item, await profileData(env));
  const html = assets[path][1].replace("</main>", () =>
    (details ? '<div class="shell section">' + details + '</div>' : '') + '</main>');
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}

function renderCatalogItem(item, kind, data) {
  if (item.markup) {
    return kind === "arcs" ? item.markup.replace("</details>", () =>
      profileDetails(kind, item, data) + "</details>") : item.markup;
  }
  const title = htmlEscape(item.title);
  const icon = catalogIcon(item.icon);
  const link = '<a href="' + htmlEscape(item.url) + '">';
  if (kind === "characters") {
    return '<a class="card wiki-card roster-card" data-catalog-item href="' + htmlEscape(item.url) + '">' +
      '<span class="catalog-art">' + icon + '</span><div class="card-body"><h2>' + title +
      '</h2><p>Manba va qisqa profil</p></div></a>';
  }
  const rank = data.facts.get(kind + "/" + item.id)?.rank;
  return '<li data-catalog-item data-catalog-label="' + title + '"' +
    (rank ? ' data-location-category="' + htmlEscape(rank) + '"' : '') + ' class="arc-new-item">' +
    link + icon + '<span class="arc-name">' + title + '</span></a></li>';
}

async function catalogPage(kind, env) {
  const items = await loadCatalog(env, kind);
  const data = kind === "arcs" ? await profileData(env) : null;
  const html = assets[catalogRoutes[kind]][1].replace("<!-- CATALOG_ENTRIES -->",
    () => items.map((item) => renderCatalogItem(item, kind, data)).join("\n"));
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
}

async function catalogProfile(url, env) {
  const kind = url.searchParams.get("tur");
  if (!Object.hasOwn(catalogRoutes, kind)) return new Response("Yozuv topilmadi.", {status: 404});
  const id = url.searchParams.get("id");
  const item = (await loadCatalog(env, kind)).find((entry) => entry.id === id);
  if (!item) return new Response("Yozuv topilmadi.", {status: 404});
  if (item.markup) return new Response(null, {status: 302, headers: {location: item.url}});
  const title = htmlEscape(item.title);
  const source = "https://nte.th.gl/db/" + kind + "/" + encodeURIComponent(item.id);
  const label = kind === "characters" ? "Personajlar" : "Arclar";
  const details = profileDetails(kind, item, await profileData(env));
  const markup = '<p><a class="text-link" href="' + catalogRoutes[kind] + '">' + label +
    '</a></p><div class="catalog-profile-heading">' + catalogIcon(item.icon) + '<h1>' + title +
    '</h1></div><p>Bu yozuv The Hidden Gaming Lair katalogidan olingan. Batafsil ma’lumotni manbadan ko‘rishingiz mumkin.</p>' +
    '<a class="button secondary" href="' + htmlEscape(source) +
    '" target="_blank" rel="noopener noreferrer">Manbani ochish</a>' + details;
  const html = assets["/katalog.html"][1].replace("<!-- CATALOG_TITLE -->", () => title)
    .replace("<!-- CONTENT -->", () => markup);
  return new Response(html, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
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
    const illustrated = searchIndex.guides.map(item => ({
      ...item,
      aliases: [...item.aliases, item.steps.flatMap(step => [step.title, step.text, step.alt]).join(" ")],
    }));
    const missionItems = [...illustrated, ...communityVideos, ...searchIndex.videos, ...searchIndex.quests]
      .map((item) => ({...item, url: "/missiyalar.html?q=" + encodeURIComponent(item.title)}));
    const [characters, arcs] = await Promise.all([loadCatalog(env, "characters"), loadCatalog(env, "arcs")]);
    const groups = [
      ["Personajlar", searchGroup(characters, query)],
      ["Arclar", searchGroup(arcs, query)],
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

  if (/^\/personaj-[a-z0-9-]+\.html$/.test(path)) return curatedCharacterPage(path, env);
  if (path === "/personajlar.html") return catalogPage("characters", env);
  if (path === "/arclar.html") return catalogPage("arcs", env);
  if (path === "/katalog.html") return catalogProfile(url, env);

  if (path === "/reyting-versiyasi.json") {
    const officialFeed = env.BUCKET ? await readNewsFeed(env.BUCKET, "official") : [];
    const releases = [...officialFeed, ...curatedNews].filter(item =>
      item.label === "Yangilanish" && item.date <= localDate() &&
      item.url.startsWith("https://nte.perfectworld.com/") &&
      /^(?:NTE )?\d+\.\d+/i.test(item.title));
    const versions = releases.map(item => item.title.match(/\d+(?:\.\d+){1,2}/)?.[0]).filter(Boolean);
    versions.sort((a, b) => b.localeCompare(a, "en", {numeric: true}));
    return new Response(request.method === "HEAD" ? null : JSON.stringify({version: versions[0] ?? null}), {
      headers: {"content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff"},
    });
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
    const [manual, feed] = await Promise.all([records(env.BUCKET, "promos"), readNewsFeed(env.BUCKET, "telegram")]);
    const seen = new Set(manual.map((item) => item.title.toUpperCase()));
    const automatic = feed.filter((item) => item.promo?.expiry >= localDate()).flatMap((item) => {
      const code = item.promo.title.toUpperCase();
      if (seen.has(code)) return [];
      seen.add(code);
      return [{...item.promo, url: item.url}];
    });
    return render("/promokodlar.html", promoPage([...manual, ...automatic]));
  }

  if (!["/videolar.html", "/jamoa.html"].includes(path) || !env.BUCKET) {
    const file = Object.hasOwn(assets, path === "/" ? "/index.html" : path) ? assets[path === "/" ? "/index.html" : path] : null;
    if (!file) return new Response("Sahifa topilmadi.", {status: 404});
    const [type, data] = file;
    const body = type.includes("charset") ? data : Uint8Array.from(atob(data), (value) => value.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : body, {headers: {"content-type": type, "x-content-type-options": "nosniff"}});
  }

  const video = path === "/videolar.html";
  const items = await records(env.BUCKET, video ? "videos" : "links");
  if (video) {
    const seen = new Set(["https://www.youtube.com/watch?v=npFfF2iNJMY", ...items.map((item) => item.url)]);
    for (const item of await readNewsFeed(env.BUCKET, "telegram")) {
      if (!item.video || seen.has(item.video)) continue;
      seen.add(item.video);
      items.push({title: item.title, description: item.description, url: item.video, newTab: true});
    }
  }
  const content = linkedEntries(items, video ? "O‘zbekcha videoqo‘llanmalar" : "Jamoaning boshqa havolalari");
  return new Response(request.method === "HEAD" ? null : assets[path][1].replace("</main>", () => content + "</main>"), {
    headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
  });
}

const contentPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://*.telesco.pe https://cdn.th.gl",
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
