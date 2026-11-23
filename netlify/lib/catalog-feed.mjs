import { load } from "cheerio";

const origin = "https://nte.th.gl";
const spritePattern = /^https:\/\/cdn\.th\.gl\/neverness-to-everness\/icons\/icons\.[a-f0-9]+\.webp$/;

export function parseCatalog(html, kind) {
  if (!["characters", "arcs"].includes(kind)) throw new Error("Noma’lum katalog turi");
  const $ = load(html);
  const routes = new Map();
  for (const element of $("a[href^='/db/" + kind + "/']")) {
    const link = $(element);
    const path = link.attr("href");
    const id = path.split("/").at(-1);
    if (!/^[a-z0-9_]{1,90}$/i.test(id) || path !== "/db/" + kind + "/" + id) continue;
    const title = link.find("span[class*='group-hover:text-amber-400']").first().text().trim();
    if (!title || title.length > 120) continue;
    const image = link.find("img").first();
    const sprite = image.attr("src") ?? "";
    const coordinate = image.attr("style")?.match(/object-position:\s*(-?\d+)px\s+(-?\d+)px/);
    const icon = spritePattern.test(sprite) && coordinate
      ? {sprite, x: Number(coordinate[1]), y: Number(coordinate[2])} : undefined;
    routes.set(id, {id, title, url: origin + path, icon});
  }
  return [...routes.values()];
}

export async function fetchCatalog(kind) {
  const response = await fetch(origin + "/db/" + kind, {
    redirect: "error", signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("Katalog HTTP " + response.status);
  return parseCatalog(await response.text(), kind);
}

const statFields = {
  Rarity: "rank", Element: "element", HP: "hp", ATK: "atk", DEF: "def",
  "CRIT Rate": "critRate", "CRIT DMG": "critDamage",
};

export function parseCatalogFacts(html, id) {
  const $ = load(html);
  const fields = {};
  for (const element of $("main div")) {
    const label = $(element);
    if (label.children().length) continue;
    const key = statFields[label.text().trim()];
    if (!Object.hasOwn(statFields, label.text().trim())) continue;
    const value = label.next("div").text().trim();
    if (key === "rank" ? /^[SAB]$/.test(value) :
        key === "element" ? /^[A-Za-z ]{2,30}$/.test(value) : /^\d+(?:\.\d+)?%?$/.test(value)) fields[key] = value;
  }
  if (!fields.rank) throw new Error("Katalog tafsilotlari topilmadi");
  const planner = "/ascension-planner/" + id;
  if ($("a").toArray().some((element) => $(element).attr("href") === planner)) {
    fields.materialsUrl = origin + planner;
  }
  return fields;
}

export async function fetchCatalogFacts(kind, id) {
  if (!["characters", "arcs"].includes(kind) || !/^[a-z0-9_]{1,90}$/i.test(id)) throw new Error("Katalog ID xato");
  const response = await fetch(origin + "/db/" + kind + "/" + id, {
    redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Katalog tafsilotlari HTTP " + response.status);
  return parseCatalogFacts(await response.text(), id);
}
