import { getStore } from "@netlify/blobs";
import { fetchCatalogFacts } from "../lib/catalog-feed.mjs";
import seed from "../../worker/catalog-seed.json" with { type: "json" };

export const config = {schedule: "37 * * * *"};

export default async function syncCatalogFacts() {
  const store = getStore({name: "nteuzb-content", consistency: "strong"});
  const listed = await Promise.all(Object.keys(seed).map(async (kind) => ({
    kind, rows: (await store.get("feed/catalog-" + kind, {type: "json"})) ?? seed[kind],
  })));
  const existing = (await store.get("feed/catalog-facts", {type: "json"})) ?? [];
  const byId = new Map(existing.map((item) => [item.kind + "/" + item.id, item]));
  const now = Date.now();
  const oldest = (candidate) => byId.get(candidate.kind + "/" + candidate.id)?.checked ?? 0;
  const work = listed.flatMap(({kind, rows}) => rows.map(({id}) => ({kind, id})))
    .sort((a, b) => oldest(a) - oldest(b)).slice(0, 8);
  const results = await Promise.allSettled(work.map(async ({kind, id}) => ({
    kind, id, checked: now, ...(await fetchCatalogFacts(kind, id)),
  })));
  let updates = 0;
  for (const [index, result] of results.entries()) {
    const {kind, id} = work[index];
    const key = kind + "/" + id;
    if (result.status === "fulfilled") {
      byId.set(key, result.value);
      updates++;
    } else {
      byId.set(key, {...byId.get(key), kind, id, checked: now});
      console.error("Katalog tafsiloti yangilanmadi:", kind, id, result.reason?.message);
    }
  }
  await store.setJSON("feed/catalog-facts", [...byId.values()]);
  return new Response(null, {status: updates ? 204 : 502});
}
