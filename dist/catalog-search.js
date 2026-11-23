function normalizeCatalog(value) {
  return value.toLowerCase()
    .replace(/[‘’ʻʼ']/g, "")
    .normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function matchesCatalog(text, query) {
  const normalized = normalizeCatalog(text);
  return query.split(" ").every((word) => normalized.includes(word));
}

for (const catalog of document.querySelectorAll("[data-catalog]")) {
  const input = catalog.querySelector("[data-catalog-query]");
  const status = catalog.querySelector("[data-catalog-status]");
  const category = catalog.querySelector("[data-catalog-category]");
  const entries = [...catalog.querySelectorAll("[data-catalog-item]")];
  const update = () => {
    const query = normalizeCatalog(input.value);
    let count = 0;
    for (const item of entries) {
      const itemCategories = item.dataset.catalogCategories?.split(" ") ?? [item.dataset.locationCategory];
      const wrongCategory = category?.value && !itemCategories.includes(category.value);
      item.hidden = Boolean(wrongCategory || !matchesCatalog(item.dataset.catalogLabel ?? item.textContent, query));
      count += Number(!item.hidden);
    }
    status.textContent = count ? count + " ta natija" : "Mos natija topilmadi.";
  };
  if (input.id === "arc-search") {
    input.value = (new URLSearchParams(location.search).get("q") ?? "").slice(0, 120);
    const selected = entries.find((item) => normalizeCatalog(item.dataset.catalogLabel) === normalizeCatalog(input.value));
    const details = selected?.querySelector("details");
    if (details) details.open = true;
  }
  input.addEventListener("input", update);
  category?.addEventListener("change", update);
  if (input.id === "currency-search") {
    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      const entry = entries.find((item) => item.id === id);
      if (!entry?.hidden) return;
      input.value = "";
      category.value = "";
      update();
      entry.scrollIntoView();
    });
  }
  update();
}

const missionForm = document.querySelector("#mission-search");

if (missionForm && window.nteMissionCatalog) {
  const input = document.querySelector("#mission-query");
  const status = document.querySelector("#mission-status");
  const results = document.querySelector("#mission-results");
  const {quests, videos, guides} = window.nteMissionCatalog;
  let communityVideos = [];

  function link(label, url, classes = "") {
    const anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.href = url;
    anchor.className = classes;
    if (anchor.origin !== location.origin && anchor.protocol === "https:") {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    return anchor;
  }

  function searchLink(query) {
    const url = new URL("https://www.youtube.com/results");
    url.searchParams.set("search_query", "Neverness to Everness " + query + " walkthrough");
    return url.href;
  }

  function heading(label) {
    const title = document.createElement("h2");
    title.textContent = label;
    results.append(title);
  }

  function showVideos(items) {
    heading("Videoqo‘llanmalar");
    const cards = document.createElement("div");
    cards.className = "social";
    for (const item of items) {
      const card = link("", item.url);
      if (item.image) {
        const image = document.createElement("img");
        image.className = "mission-video-preview";
        image.src = item.image;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        card.append(image);
      }
      const title = document.createElement("strong");
      title.textContent = item.title;
      const description = document.createElement("span");
      description.textContent = item.description || "Videoni ochish";
      card.append(title, description);
      cards.append(card);
    }
    results.append(cards);
  }

  function showGuides(items) {
    if (!items.length) return;
    heading("Rasmli missiya qo‘llanmalari");
    for (const item of items) {
      const details = document.createElement("details");
      details.className = "mission-guide";
      details.open = items.length === 1;
      const title = document.createElement("summary");
      title.textContent = item.title;
      const steps = document.createElement("ol");
      steps.className = "illustrated-steps";
      for (const step of item.steps) {
        const entry = document.createElement("li");
        const stepTitle = document.createElement("h3");
        stepTitle.textContent = step.title;
        const explanation = document.createElement("p");
        explanation.textContent = step.text;
        const figure = document.createElement("figure");
        const imageLink = link("", step.image, "step-image");
        const image = document.createElement("img");
        image.src = step.image;
        image.alt = step.alt;
        image.loading = "lazy";
        image.decoding = "async";
        imageLink.append(image);
        const caption = document.createElement("figcaption");
        caption.textContent = step.alt;
        figure.append(imageLink, caption);
        entry.append(stepTitle, explanation, figure);
        steps.append(entry);
      }
      details.append(title);
      if (item.mapId) {
        details.append(link("Xaritada ko‘rish", "/interaktiv-xarita.html?joy=" + encodeURIComponent(item.mapId) + "#interactive-map-detail", "button secondary"));
      }
      details.append(steps, link("Manba va skrinshotlar: PowerPyx", item.url, "text-link"));
      results.append(details);
    }
  }

  function showResults() {
    const terms = input.value.trim();
    const query = normalizeCatalog(terms);
    results.replaceChildren();
    const available = [...communityVideos, ...videos];
    if (!query) {
      status.textContent = terms ? "Missiya nomidan harf yoki raqam kiriting." : "";
      showGuides(guides);
      showVideos(available.slice(0, 8));
      return;
    }

    const relevant = available.filter((item) => [item.title, ...(item.aliases ?? [])]
      .some((name) => matchesCatalog(name, query))).slice(0, 8);
    const solutions = guides.filter((item) => matchesCatalog([
      item.title, ...item.aliases, ...item.steps.flatMap((step) => [step.title, step.text, step.alt]),
    ].join(" "), query));
    const unique = new Map();
    for (const item of quests) {
      if (matchesCatalog(item.title, query) && !unique.has(item.title)) unique.set(item.title, item);
    }
    const matchedQuests = [...unique.values()].sort((a, b) =>
      Number(normalizeCatalog(b.title) === query) - Number(normalizeCatalog(a.title) === query) ||
      a.title.length - b.title.length).slice(0, 10);

    const counts = [
      solutions.length ? solutions.length + " ta rasmli qo‘llanma" : "",
      relevant.length ? relevant.length + " ta video" : "",
    ].filter(Boolean);
    status.textContent = counts.length ? counts.join(" va ") + " topildi." :
      matchedQuests.length ? "Missiya topildi. Hozircha rasmli yechim yoki video mavjud emas." :
        "Mos missiya topilmadi. O‘yindagi nomini yoki qisqaroq so‘zni sinab ko‘ring.";
    showGuides(solutions);
    if (relevant.length) showVideos(relevant);
    if (matchedQuests.length) {
      heading("Mos missiya nomlari");
      const list = document.createElement("ul");
      list.className = "mission-matches";
      for (const item of matchedQuests) {
        const row = document.createElement("li");
        row.append(link(item.title, item.url, "text-link"), link("Video qidirish", searchLink(item.title), "text-link"));
        list.append(row);
      }
      results.append(list);
    }
    results.append(link("YouTube’da «" + terms + "»ni qidirish", searchLink(terms), "button secondary mission-fallback"));
  }

  input.value = (new URLSearchParams(location.search).get("q") ?? "").slice(0, 120);
  input.addEventListener("input", showResults);
  missionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    showResults();
  });
  showResults();
  fetch("/missiya-videolari.json").then((response) => response.ok ? response.json() : [])
    .then((items) => {
      communityVideos = items;
      showResults();
    }).catch(() => {});
}
