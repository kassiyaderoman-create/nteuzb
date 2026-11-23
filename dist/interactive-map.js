(() => {
  const mapElement = document.querySelector("#interactive-map");
  if (!mapElement || !window.L || !Array.isArray(window.nteMapPlaces)) return;

  const places = window.nteMapPlaces;
  const titleByType = {
    missions: "Missiya", travel: "Transport", anomalies: "Anomaliya",
    crates: "Sandiq", places: "Diqqatga sazovor joy", services: "Xizmat", photos: "Surat joyi",
  };
  const query = document.querySelector("#interactive-map-query");
  const type = document.querySelector("#interactive-map-type");
  const district = document.querySelector("#interactive-map-district");
  const results = document.querySelector("#interactive-map-results");
  const status = document.querySelector("#interactive-map-status");
  const detail = document.querySelector("#interactive-map-detail");
  const tileError = document.querySelector("#interactive-map-error");
  const storageKey = "nteuzb.map.visited";
  const allBounds = L.latLngBounds([[-212121, -384099], [475013, 303035]]);
  const cityBounds = L.latLngBounds(places.flatMap(place => place.coordinates ? [place.coordinates] : []));
  const mapSource = "https://nte.th.gl/maps/Hethereau/";
  let selected;
  let found = new Set();

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(stored)) found = new Set(stored);
  } catch {}

  const map = L.map(mapElement, {
    crs: L.extend({}, L.CRS.Simple, {
      transformation: new L.Transformation(0.0007451239496226355, 286.20136392610465,
        0.0007451239496226355, 158.05643731790303),
    }),
    minZoom: 0, maxZoom: 6, maxBounds: allBounds, maxBoundsViscosity: 0.7,
    zoomControl: false, attributionControl: false, scrollWheelZoom: false,
  });
  const tiles = L.tileLayer("/assets/map/tiles/{z}/{y}/{x}.webp", {
    minNativeZoom: 0, maxNativeZoom: 3, noWrap: true, bounds: allBounds, tileSize: 512,
  });
  let tilesReady = false;
  tiles.on("tileload", () => {
    tilesReady = true;
    tileError.hidden = true;
  });
  tiles.on("load", () => { tileError.hidden = tilesReady; });
  tiles.addTo(map);
  const reset = () => {
    const area = places.filter(place => place.district === district.value && place.coordinates);
    const bounds = district.value && area.length ? L.latLngBounds(area.map(place => place.coordinates)) : cityBounds;
    map.fitBounds(bounds, {padding: [28, 28], maxZoom: district.value ? 4 : 2, animate: false});
  };
  reset();
  document.querySelector("#map-plus").addEventListener("click", () => map.zoomIn());
  document.querySelector("#map-minus").addEventListener("click", () => map.zoomOut());
  document.querySelector("#map-reset").addEventListener("click", reset);

  function node(tag, content, className) {
    const element = document.createElement(tag);
    element.textContent = content;
    if (className) element.className = className;
    return element;
  }

  function markerImage(category) {
    const image = document.createElement("img");
    image.src = "/assets/map/markers/" + category + ".webp";
    image.alt = "";
    return image;
  }

  function link(text, href, external = false) {
    const anchor = node("a", text, "text-link");
    anchor.href = href;
    if (external) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    return anchor;
  }

  function normalize(value) {
    return value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
      .replace(/['‘’ʻʼ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function photoFigure(src, caption, source) {
    const figure = node("figure", "", "map-detail-figure");
    const imageLink = link("", src);
    imageLink.setAttribute("aria-label", caption + ". Kattalashtirish");
    const image = document.createElement("img");
    image.src = src;
    image.alt = caption;
    imageLink.append(image);
    const label = node("figcaption", caption);
    if (source) label.append(" ", link("Skrinshot manbasi", source, true));
    figure.append(imageLink, label);
    return figure;
  }

  function showDetail(place) {
    const actions = node("div", "", "actions");
    const button = node("button", found.has(place.id) ? "✓ Topdim" : "Topdim", "button secondary");
    button.type = "button";
    button.setAttribute("aria-pressed", String(found.has(place.id)));
    button.addEventListener("click", () => {
      if (found.has(place.id)) found.delete(place.id);
      else found.add(place.id);
      try { localStorage.setItem(storageKey, JSON.stringify([...found])); } catch {}
      update();
      button.textContent = found.has(place.id) ? "✓ Topdim" : "Topdim";
      button.setAttribute("aria-pressed", String(found.has(place.id)));
    });
    actions.append(button);
    if (place.guide) actions.append(link("Bog‘liq qo‘llanma", place.guide));
    if (place.source || place.sourceUrl) {
      actions.append(link("Joylashuv manbasi", place.sourceUrl ?? mapSource + place.source, true));
    }

    detail.replaceChildren(node("h2", place.title), node("p", place.description));
    if (place.district === "bridge-crossings") detail.append(node("p", "Bridge Crossings · Tuman", "interactive-map-credit"));
    if (place.preview) detail.append(photoFigure(place.preview, place.previewCaption ?? "Yashil doira xaritadagi joyni ko‘rsatadi.", place.previewSource));
    if (place.photo) detail.append(photoFigure(place.photo, place.photoCaption, place.photoSource));
    detail.append(actions);
    detail.hidden = false;
  }

  function select(place, navigate = true) {
    selected = place.id;
    showDetail(place);
    if (place.coordinates) {
      map.setView(place.coordinates, Math.max(district.value || place.district ? 4 : 3, map.getZoom()), {animate: false});
    }
    if (navigate) {
      const url = new URL(location.href);
      url.searchParams.set("joy", place.id);
      history.replaceState(null, "", url);
    }
    update();
    if (navigate && matchMedia("(max-width: 760px)").matches) detail.scrollIntoView({block: "nearest"});
  }

  const markers = new Map(places.filter(place => place.coordinates).map(place => {
    const icon = L.divIcon({
      className: "map-marker",
      iconSize: [34, 34], iconAnchor: [17, 17], html: markerImage(place.marker ?? place.type),
    });
    const marker = L.marker(place.coordinates, {icon, title: place.title})
      .on("click", () => select(place));
    return [place.id, marker];
  }));

  const legend = document.querySelector("#interactive-map-legend");
  const legendButtons = Object.entries(titleByType).map(([category, label]) => {
    const button = node("button", label, "map-legend-button");
    button.type = "button";
    button.prepend(markerImage(category));
    button.addEventListener("click", () => {
      type.value = type.value === category ? "" : category;
      update();
    });
    legend.append(button);
    return [category, button];
  });

  function update() {
    const words = normalize(query.value).split(" ").filter(Boolean);
    const matches = places.filter(place => {
      const searchable = normalize([place.title, place.name, place.description, place.district === "bridge-crossings" ? "Bridge Crossings" : "", titleByType[place.type]].join(" "));
      return (!district.value || place.district === district.value) &&
        (!type.value || place.type === type.value) && words.every(word => searchable.includes(word));
    });
    for (const [category, button] of legendButtons) {
      button.setAttribute("aria-pressed", String(type.value === category));
    }
    const visible = new Set(matches.map(place => place.id));
    for (const [id, marker] of markers) {
      if (visible.has(id) && !map.hasLayer(marker)) marker.addTo(map);
      if (!visible.has(id) && map.hasLayer(marker)) map.removeLayer(marker);
      const element = marker.getElement();
      if (!element) continue;
      element.setAttribute("aria-label", marker.options.title);
      element.classList.toggle("map-marker-selected", selected === id);
      element.classList.toggle("map-marker-found", found.has(id));
    }
    results.replaceChildren(...matches.map(place => {
      const row = document.createElement("li");
      const button = node("button", "", "map-result");
      button.type = "button";
      button.setAttribute("aria-pressed", String(selected === place.id));
      const photo = document.createElement("img");
      photo.src = place.photo ?? place.preview;
      photo.alt = "";
      photo.loading = "lazy";
      photo.decoding = "async";
      const description = node("span", "", "map-result-label");
      const category = node("small", titleByType[place.type] + (found.has(place.id) ? " · Topilgan" : ""), "map-result-category");
      category.prepend(markerImage(place.marker ?? place.type));
      description.append(node("strong", place.title), category);
      button.append(photo, description);
      button.addEventListener("click", () => select(place));
      row.append(button);
      return row;
    }));
    const pinned = matches.filter(place => place.coordinates).length;
    const photographed = matches.length - pinned;
    status.textContent = [
      pinned ? pinned + " ta xarita belgisi" : "",
      photographed ? photographed + " ta suratli joy" : "",
    ].filter(Boolean).join(" · ") || "Mos joy topilmadi.";
  }

  query.addEventListener("input", update);
  type.addEventListener("change", update);
  district.addEventListener("change", () => {
    const url = new URL(location.href);
    if (district.value) url.searchParams.set("tuman", district.value);
    else url.searchParams.delete("tuman");
    history.replaceState(null, "", url);
    reset();
    update();
  });
  const params = new URLSearchParams(location.search);
  if (params.get("tuman") === "bridge-crossings") {
    district.value = "bridge-crossings";
    reset();
  }
  const initial = places.find(place => place.id === params.get("joy"));
  if (initial) {
    select(initial, false);
    if (location.hash === "#interactive-map-detail") detail.scrollIntoView({block: "start"});
  } else update();
})();
