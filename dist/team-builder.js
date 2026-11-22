const planner = document.querySelector("#team-builder");
const slots = [...planner.querySelectorAll("select")];
const profiles = planner.querySelector("#team-profiles");
const status = planner.querySelector("#team-status");
const feedback = planner.querySelector("#team-feedback");
const shareField = planner.querySelector("#team-url");
const shareLabel = planner.querySelector("#team-url-label");
const url = new URL(location.href);

function character(value) {
  return value === "zero-female" ? "zero" : value;
}

function updateTeam() {
  const chosen = slots.map((slot) => slot.value);
  for (const slot of slots) {
    for (const option of slot.options) {
      option.disabled = Boolean(option.value && option.value !== slot.value &&
        chosen.some((value) => value && character(value) === character(option.value)));
    }
  }
  profiles.replaceChildren();
  for (const slot of slots.filter((item) => item.value)) {
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.href = "/personaj-" + slot.value + ".html";
    link.textContent = slot.selectedOptions[0].textContent;
    link.className = "text-link";
    row.append(link);
    profiles.append(row);
  }
  status.textContent = chosen.filter(Boolean).length + " / 4 personaj tanlandi";
  if (chosen.some(Boolean)) url.searchParams.set("tarkib", chosen.join(","));
  else url.searchParams.delete("tarkib");
  shareField.value = url.href;
  feedback.textContent = "";
  shareField.hidden = true;
  shareLabel.hidden = true;
  history.replaceState(null, "", url);
}

const loaded = (url.searchParams.get("tarkib") ?? "").split(",", 4);
const used = new Set();
for (const [index, slot] of slots.entries()) {
  const value = loaded[index];
  if (value && !used.has(character(value)) && [...slot.options].some((option) => option.value === value)) {
    slot.value = value;
    used.add(character(value));
  }
  slot.addEventListener("change", updateTeam);
}
planner.querySelector("#team-reset").addEventListener("click", () => {
  for (const slot of slots) slot.value = "";
  updateTeam();
});
planner.querySelector("#team-share").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareField.value);
    feedback.textContent = "Jamoa havolasi nusxalandi.";
  } catch {
    shareField.hidden = false;
    shareLabel.hidden = false;
    shareField.select();
    feedback.textContent = "Havolani qo‘lda nusxalang.";
  }
});
updateTeam();
