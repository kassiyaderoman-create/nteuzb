import { load } from "cheerio";
import JSON5 from "json5";

const official = "https://nte.perfectworld.com";
const telegram = "https://t.me/s/nteuzb";
const dateInTashkent = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Tashkent"});
const communityStart = "2026-11-22";

async function read(url) {
  const response = await fetch(url, {redirect: "error", signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error("Source response: " + response.status);
  return response.text();
}

function text(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function telegramNews(markup) {
  const $ = load(markup);
  const posts = $("[data-post]").toArray().flatMap((element) => {
    const post = $(element);
    const id = post.attr("data-post")?.match(/^nteuzb\/(\d+)$/)?.[1];
    const rawTime = post.find("time[datetime]").first().attr("datetime");
    const body = post.find(".tgme_widget_message_text").first().clone();
    if (!id || !rawTime || !body.length || Number.isNaN(Date.parse(rawTime))) return [];
    const date = dateInTashkent.format(new Date(rawTime));
    if (date < communityStart || id === "146") return [];
    body.find("br").replaceWith("\n");
    const lines = body.text().split("\n").map(text).filter(Boolean);
    const title = lines.shift()?.slice(0, 120);
    if (!title) return [];
    const tags = lines.filter((line) => /^#(?:promokod|qollanma)$/i.test(line)).map((line) => line.toLowerCase());
    const promoCode = lines.find((line) => /^Kod:/i.test(line))?.match(/^Kod:\s*([A-Za-z0-9_-]{1,64})$/i)?.[1];
    const expiry = lines.find((line) => /^Muddati:/i.test(line))?.match(/^Muddati:\s*(\d{4}-\d{2}-\d{2})$/i)?.[1];
    const expiryTime = expiry ? new Date(expiry) : null;
    const validExpiry = expiryTime && Number.isFinite(expiryTime.getTime()) && expiryTime.toISOString().slice(0, 10) === expiry;
    const videoId = body.find("a[href]").toArray().map((anchor) => $(anchor).attr("href"))
      .map((url) => url.match(/^https:\/\/(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})(?=$|[?&#])/)?.[1])
      .find(Boolean);
    const media = post.find(".tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb").first().attr("style") ?? "";
    const cover = media.match(/url\(['"]?(https:\/\/[\w.-]+\.telesco\.pe\/file\/[^'")\s]+)/)?.[1];
    return [{
      title, description: lines.join(" ").slice(0, 220), date, label: "Jamoa",
      url: "https://t.me/nteuzb/" + id, source: "Telegram postini ochish",
      image: cover, newTab: true,
      promo: tags.includes("#promokod") && promoCode && validExpiry && expiry >= date
        ? {title: promoCode, expiry} : undefined,
      video: tags.includes("#qollanma") && videoId
        ? "https://www.youtube.com/watch?v=" + videoId : undefined,
    }];
  });
  if (!$("[data-post]").length) throw new Error("Telegram postlari topilmadi");
  return posts;
}

function classifyOfficial(title, event = false) {
  const version = title.match(/\b(?:version|patch)\s+(\d+(?:\.\d+){1,2})\b/i)?.[1];
  if (/maintenance/i.test(title)) return {title: "NTE texnik tanaffusi", label: "Texnik tanaffus"};
  if (version && /update|patch notes/i.test(title)) {
    return {title: "NTE " + version + " yangilanishi", label: "Yangilanish"};
  }
  if (event || /limited.time event|event announcement/i.test(title)) {
    return {title: "NTE’ning rasmiy tadbir e’loni", label: "Tadbir"};
  }
  return {title: "NTE rasmiy xabari", label: "E’lon"};
}

export function officialNews(script) {
  const raw = script.match(/^\s*var\s+newsdataObj\s*=\s*([\s\S]*?)\s*;\s*$/)?.[1];
  if (!raw) throw new Error("Rasmiy lenta formati o‘zgargan");
  const channels = JSON5.parse(raw).en;
  if (!Array.isArray(channels?.news)) throw new Error("Rasmiy inglizcha lenta topilmadi");
  return Object.values(channels).filter(Array.isArray).flat().flatMap((item) => {
    if (!/^\/en\/article\/news\/(?:gamenews|gamebroad|gameevent)\/\d{8}\/\d+\.html$/.test(item?.url ?? "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item?.time ?? "") || typeof item?.title !== "string") return [];
    return [{
      ...classifyOfficial(item.title, item.channelName === "gameevent"),
      description: "Asl sarlavha · " + text(item.title).slice(0, 190),
      date: item.time, url: official + item.url,
      source: "Rasmiy xabarni ochish", newTab: true,
    }];
  });
}

export async function fetchOfficialNews() {
  const markup = await read(official + "/en/main.html");
  const script = markup.match(/https:\/\/nte\.perfectworld\.com\/include\/newsData\d+\.js/)?.[0];
  if (!script) throw new Error("Yangiliklar manbasi topilmadi");
  return officialNews(await read(script));
}

export async function fetchTelegramNews() {
  return telegramNews(await read(telegram));
}

const steamApp = 4508340;
const googleFeed = "https://news.google.com/rss/search?q=%22Neverness%20to%20Everness%22%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen";

export function steamNews(payload) {
  const app = payload?.appnews;
  if (app?.appid !== steamApp || !Array.isArray(app.newsitems)) throw new Error("Steam lentasi topilmadi");
  return app.newsitems.flatMap(item => {
    const date = new Date(item.date * 1000);
    if (item.feedname !== "steam_community_announcements" ||
        item.appid !== steamApp || !/^\d{10,25}$/.test(item.gid ?? "") ||
        typeof item.title !== "string" || !Number.isFinite(date.getTime())) return [];
    return [{
      ...classifyOfficial(item.title),
      date: dateInTashkent.format(date),
      description: "Asl sarlavha · " + text(item.title).slice(0, 190),
      url: "https://store.steampowered.com/news/app/" + steamApp + "/view/" + item.gid,
      source: "Steam’dagi rasmiy e’lonni ochish", newTab: true,
    }];
  });
}

export function discoveryNews(markup) {
  const $ = load(markup, {xml: true});
  if (!$("rss > channel").length) throw new Error("Google News RSS formati o‘zgargan");
  return $("item").toArray().flatMap(element => {
    const item = $(element);
    const title = text(item.children("title").text());
    const source = text(item.children("source").text());
    const date = new Date(item.children("pubDate").text());
    let url;
    try { url = new URL(item.children("link").text().trim()); } catch { return []; }
    if (url.origin !== "https://news.google.com" || url.username || url.password ||
        !/^\/rss\/articles\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
        !title || !source || !Number.isFinite(date.getTime())) return [];
    return [{title: title.slice(0, 180), source: source.slice(0, 90),
      date: dateInTashkent.format(date), url: url.origin + url.pathname}];
  }).slice(0, 30);
}

export async function fetchSteamNews() {
  const url = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=" + steamApp + "&count=30&maxlength=1";
  return steamNews(JSON.parse(await read(url)));
}

export async function fetchDiscoveryNews() {
  return discoveryNews(await read(googleFeed));
}
