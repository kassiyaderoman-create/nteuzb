import { getStore } from "@netlify/blobs";
import { fetchCatalog } from "../lib/catalog-feed.mjs";

export const config = {schedule: "17 */2 * * *"};

export default async function syncCatalog() {
  const store = getStore({name: "nteuzb-content", consistency: "strong"});
  const kinds = {characters: 20, arcs: 40};
  const results = await Promise.allSettled(Object.entries(kinds).map(async ([kind, minimum]) => {
    const key = "feed/catalog-" + kind;
    const [previous, next] = await Promise.all([store.get(key, {type: "json"}), fetchCatalog(kind)]);
    if (next.length < Math.max(minimum, Math.ceil((previous?.length ?? 0) * 0.8))) {
      throw new Error("Katalog javobi to‘liq ko‘rinmayapti: " + kind);
    }
    await store.setJSON(key, next);
  }));
  for (const result of results) {
    if (result.status === "rejected") console.error(result.reason);
  }
  return new Response(null, {status: results.some((result) => result.status === "rejected") ? 502 : 204});
}
