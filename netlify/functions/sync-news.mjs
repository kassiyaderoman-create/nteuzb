import { getStore } from "@netlify/blobs";
import { fetchDiscoveryNews, fetchOfficialNews, fetchSteamNews, fetchTelegramNews } from "../lib/news-feeds.mjs";

export const config = {schedule: "*/30 * * * *"};

export default async function syncNews() {
  const store = getStore({name: "nteuzb-content", consistency: "strong"});
  const feeds = {official: fetchOfficialNews, telegram: fetchTelegramNews, steam: fetchSteamNews, discovery: fetchDiscoveryNews};
  const settled = await Promise.allSettled(Object.entries(feeds).map(async ([name, fetchNews]) => {
    const key = "feed/" + name;
    const [previous, latest] = await Promise.all([store.get(key, {type: "json"}), fetchNews()]);
    const byUrl = new Map([...(previous ?? []), ...latest].map((item) => [item.url, item]));
    const merged = [...byUrl.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    await store.setJSON(key, merged);
  }));
  if (settled.some((result) => result.status === "rejected")) {
    const sources = Object.keys(feeds).filter((_, index) => settled[index].status === "rejected");
    console.error("Yangilik lentasi yangilanmadi:", sources.join(", "));
    return new Response(null, {status: 502});
  }
  return new Response(null, {status: 204});
}
