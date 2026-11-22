const mapButton = document.querySelector("#show-guide-map");
const mapContainer = document.querySelector("#guide-map-frame");

mapButton.hidden = false;
mapButton.setAttribute("aria-controls", mapContainer.id);
mapButton.setAttribute("aria-expanded", "false");

mapButton.addEventListener("click", () => {
  const opening = mapContainer.hidden;
  if (opening && !mapContainer.firstElementChild) {
    const frame = document.createElement("iframe");
    frame.title = "Hethereau interaktiv xaritasi — The Hidden Gaming Lair";
    frame.src = "https://nte.th.gl/maps/Hethereau";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    mapContainer.append(frame);
  }
  mapContainer.hidden = !opening;
  mapButton.setAttribute("aria-expanded", String(opening));
  mapButton.textContent = opening ? "Xaritani yig‘ish" : "Xaritani shu yerda ochish";
});

if (new URLSearchParams(location.search).get("xarita") === "ochiq") {
  mapButton.click();
}
