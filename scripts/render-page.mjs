import { readFile } from "node:fs/promises";

const names = {
  SITE_HEADER: "site-header",
  SITE_FOOTER: "site-footer",
  LEARNING_NAV: "learning-nav",
};
const templates = Object.fromEntries(await Promise.all(
  Object.entries(names).map(async ([name, file]) => [
    name, (await readFile(new URL("../templates/" + file + ".html", import.meta.url), "utf8")).trimEnd(),
  ])
));

export function renderPage(html) {
  return html.replace(
    /<!-- (SITE_HEADER|SITE_FOOTER|LEARNING_NAV)(?: (\/[^ :]*):(page|true))? -->/g,
    (_, name, path, state) => {
      const template = templates[name];
      if (!path) return template;
      const link = 'href="' + path + '"';
      if (!template.includes(link)) throw new Error("Missing active page in " + name + ": " + path);
      const target = template.includes('<a ' + link) ? '<a ' + link : link;
      return template.replace(target, target + ' aria-current="' + state + '"');
    }
  );
}
