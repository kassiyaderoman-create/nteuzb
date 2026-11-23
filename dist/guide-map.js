(() => {
  const mapButton = document.querySelector("#show-guide-map");
  const mapContainer = document.querySelector("#guide-map-frame");
  const selection = document.querySelector("#joy-xaritasi");
  const heading = document.querySelector("#map-selection-title");
  const preview = document.querySelector("#map-location-preview");
  const places = [...document.querySelectorAll("[data-map-place]")];
  const mapUrl = "https://nte.th.gl/maps/Hethereau";
  const storageKey = "nteuzb.map.visited";

  let visited = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(saved)) visited = new Set(saved);
  } catch {
    // The map remains usable when browser storage is unavailable.
  }

  function toggleMap(url = mapUrl) {
    let frame = mapContainer.querySelector("iframe");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.title = "Hethereau interaktiv xaritasi — The Hidden Gaming Lair";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      mapContainer.append(frame);
    }
    if (frame.src !== url) frame.src = url;
    setMapOpen(true);
  }

  function setMapOpen(open) {
    mapContainer.hidden = !open;
    mapButton.setAttribute("aria-expanded", String(open));
    mapButton.textContent = open ? "Xaritani yig‘ish" : "Xaritani shu yerda ochish";
  }

  function selectPlace(place, focus = false) {
    const title = place.querySelector("h3").textContent;
    const photo = place.querySelector("[data-map-photo]");
    const mapLink = place.querySelector('a[href^="' + mapUrl + '/"]');
    heading.textContent = title;
    preview.replaceChildren();
    selection.hidden = false;
    if (photo) {
      const link = photo.cloneNode();
      link.className = "map-photo-link";
      link.setAttribute("aria-label", title + " suratini kattalashtirish");
      const image = document.createElement("img");
      image.src = photo.href;
      image.alt = title;
      link.append(image);
      preview.append(link);
      setMapOpen(false);
    } else if (mapLink) {
      const external = mapLink.cloneNode(true);
      external.textContent = "Joyni alohida oynada ochish";
      external.target = "_blank";
      external.rel = "noopener noreferrer";
      preview.append(external);
      toggleMap(mapLink.href);
    }
    if (focus) {
      const panelUrl = new URL(location.href);
      panelUrl.searchParams.set("joy", place.dataset.mapPlace);
      panelUrl.hash = selection.id;
      history.replaceState(null, "", panelUrl);
      heading.focus({preventScroll: true});
      selection.scrollIntoView({block: "start"});
    }
  }

  for (const place of places) {
    const id = place.dataset.mapPlace;
    const actions = place.querySelector(".actions");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "button secondary";
    open.textContent = "Shu yerda ko‘rish";
    open.addEventListener("click", () => selectPlace(place, true));
    const found = document.createElement("button");
    found.type = "button";
    found.className = "button secondary";
    const updateFound = () => {
      const saved = visited.has(id);
      found.textContent = saved ? "✓ Topdim" : "Topdim";
      found.setAttribute("aria-pressed", String(saved));
    };
    updateFound();
    found.addEventListener("click", () => {
      if (visited.has(id)) visited.delete(id);
      else visited.add(id);
      updateFound();
      try {
        localStorage.setItem(storageKey, JSON.stringify([...visited]));
      } catch {
        // A selection still remains visible until the current page closes.
      }
    });
    actions.append(open, found);
  }

  mapButton.hidden = false;
  mapButton.setAttribute("aria-controls", mapContainer.id);
  setMapOpen(false);
  mapButton.addEventListener("click", () => {
    if (mapContainer.hidden) toggleMap();
    else setMapOpen(false);
  });

  const parameters = new URLSearchParams(location.search);
  const initial = places.find(place => place.dataset.mapPlace === parameters.get("joy"));
  if (initial) {
    selectPlace(initial);
    if (location.hash === "#" + selection.id) selection.scrollIntoView({block: "start"});
  } else if (parameters.get("xarita") === "ochiq") {
    toggleMap();
  }
})();
