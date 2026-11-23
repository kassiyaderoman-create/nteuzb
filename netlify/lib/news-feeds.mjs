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

export function officialNews(script) {
  const raw = script.match(/^\s*var\s+newsdataObj\s*=\s*([\s\S]*?)\s*;\s*$/)?.[1];
  if (!raw) throw new Error("Rasmiy lenta formati o‘zgargan");
  const channels = JSON5.parse(raw).en;
  if (!Array.isArray(channels?.news)) throw new Error("Rasmiy inglizcha lenta topilmadi");
  return Object.values(channels).filter(Array.isArray).flat().flatMap((item) => {
    if (!/^\/en\/article\/news\/(?:gamenews|gamebroad|gameevent)\/\d{8}\/\d+\.html$/.test(item?.url ?? "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item?.time ?? "") || typeof item?.title !== "string") return [];
    const label = item.channelName === "gameevent" ? "Tadbir" : "E’lon";
    const version = item.title.match(/\b(?:version|patch)\s+(\d+(?:\.\d+){1,2})\b/i)?.[1];
    const update = version && item.channelName === "gamenews" && /update|patch notes/i.test(item.title);
    const title = update ? "NTE " + version + " yangilanishi" :
      label === "Tadbir" ? "NTE’ning rasmiy tadbir e’loni" : "NTE rasmiy xabari";
    return [{
      title, description: "Asl sarlavha · " + text(item.title).slice(0, 190), date: item.time,
      label: update ? "Yangilanish" : label, url: official + item.url,
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
