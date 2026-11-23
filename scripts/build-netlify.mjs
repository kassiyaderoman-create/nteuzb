import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { renderPage } from "./render-page.mjs";

await rm(".netlify-site", {recursive: true, force: true});
await mkdir(".netlify-site", {recursive: true});
const build = spawnSync(process.execPath, ["scripts/build.mjs", "--netlify"], {stdio: "inherit"});
if (build.status !== 0) process.exit(build.status ?? 1);

const excluded = new Set(["server", "admin.html", "promokodlar.html", "yangiliklar.html", "videolar.html", "jamoa.html", "personajlar.html", "arclar.html", "katalog.html"]);
const root = resolve("dist");
await cp(root, ".netlify-site/public", {
  recursive: true,
  filter: (path) => !excluded.has(path.slice(root.length + 1).split("/")[0]),
});

const output = ".netlify-site/public";
for (const file of await readdir(output)) {
  if (file.endsWith(".html")) {
    const path = join(output, file);
    await writeFile(path, renderPage(await readFile(path, "utf8")));
  }
}

const { default: worker } = await import("../.netlify-site/worker.mjs");
const sample = await worker.fetch(new Request("https://nteuzb.example/"), {});
const names = ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"];
await writeFile(".netlify-site/public/_headers", "/*\n" +
  names.map((name) => "  " + name + ": " + sample.headers.get(name)).join("\n") + "\n");
