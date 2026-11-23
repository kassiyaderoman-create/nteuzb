import { getStore } from "@netlify/blobs";
import worker from "../../.netlify-site/worker.mjs";

export const config = {path: [
  "/", "/index.html", "/admin", "/admin/", "/admin.html",
  "/yangiliklar.html", "/videolar.html", "/jamoa.html",
  "/personajlar.html", "/arclar.html", "/katalog.html", "/personaj-:slug.html",
  "/promokodlar", "/promokodlar/", "/promokodlar.html", "/missiya-videolari.json", "/reyting-versiyasi.json",
], preferStatic: false};
const routes = config.path;

function bucket(store) {
  return {
    async list({prefix}) {
      const {blobs} = await store.list({prefix});
      return {objects: blobs, truncated: false};
    },
    async get(key) {
      const value = await store.get(key, {type: "json"});
      return value === null ? null : {json: async () => value};
    },
    put: (key, value) => store.set(key, value),
    delete: (key) => store.delete(key),
  };
}

export default async function handler(request) {
  const path = new URL(request.url).pathname;
  if (!routes.includes(path) && !/^\/personaj-[a-z0-9-]+\.html$/.test(path)) return new Response("Sahifa topilmadi.", {status: 404});
  const password = process.env.NTE_ADMIN_PASSWORD;
  return worker.fetch(request, {
    BUCKET: bucket(getStore({name: "nteuzb-content", consistency: "strong"})),
    netlify: true,
    NTE_ADMIN_PASSWORD: password?.length >= 24 ? password : undefined,
  });
}
