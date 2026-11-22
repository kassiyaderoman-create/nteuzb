import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { renderPage } from "./render-page.mjs";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function readAssets(directory, prefix = "") {
  const files = await readdir(directory, {withFileTypes: true});
  const result = {};
  for (const file of files) {
    if (file.name === "server") continue;
    const path = join(directory, file.name);
    const url = prefix + "/" + file.name;
    if (file.isDirectory()) {
      Object.assign(result, await readAssets(path, url));
    } else {
      const type = types[extname(path)];
      if (!type) continue;
      const data = await readFile(path);
      const content = type.includes("charset") ? data.toString() : data.toString("base64");
      result[url] = [type, extname(path) === ".html" ? renderPage(content) : content];
    }
  }
  return result;
}

function decodeTitle(value) {
  const entities = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'"};
  return value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => entities[entity]);
}

function buildSearchIndex(assets) {
  const roster = assets["/personajlar.html"][1];
  const arcs = assets["/arclar.html"][1];
  const characters = [...roster.matchAll(/data-catalog-item href="(\/personaj-[^"]+\.html)"[^>]*>[\s\S]*?<h2>([^<]+)<\/h2>/g)]
    .map(([, url, title]) => ({title: decodeTitle(title), url}));
  const weapons = [...arcs.matchAll(/<span class="arc-name">([^<]+)<\/span>/g)]
    .map(([, name]) => {
      const title = decodeTitle(name);
      return {title, url: "/arclar.html?q=" + encodeURIComponent(title) + "#arc-katalogi"};
    });
  const missionSource = assets["/mission-catalog.js"][1];
  const {quests, guides, videos} = JSON.parse(missionSource.trim().replace(/^window\.nteMissionCatalog = /, "").replace(/;$/, ""));
  if (!characters.length || !weapons.length || !quests.length) {
    throw new Error("Homepage search index is missing a catalog.");
  }
  return {characters, weapons, quests, guides, videos};
}

await mkdir("dist/server", {recursive: true});
const assets = await readAssets("dist");
const searchIndex = buildSearchIndex(assets);
const curatedNews = JSON.parse(await readFile("worker/news.json", "utf8"));
const source = await readFile("worker/index.mjs", "utf8");
const netlify = process.argv.includes("--netlify");
const runtimeAssets = netlify
  ? Object.fromEntries(["/index.html", "/admin.html", "/yangiliklar.html", "/promokodlar.html", "/videolar.html", "/jamoa.html"]
    .map((path) => [path, assets[path]]))
  : assets;
await writeFile(netlify ? ".netlify-site/worker.mjs" : "dist/server/index.js",
  "const assets = " + JSON.stringify(runtimeAssets) +
  ";\nconst searchIndex = " + JSON.stringify(searchIndex) +
  ";\nconst curatedNews = " + JSON.stringify(curatedNews) + ";\n" + source);
