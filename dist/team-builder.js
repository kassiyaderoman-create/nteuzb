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
    const portrait = document.createElement("img");
    portrait.src = "/assets/team-portraits/" + slot.value + ".webp";
    portrait.alt = "";
    portrait.loading = "lazy";
    const name = document.createElement("span");
    name.textContent = slot.selectedOptions[0].textContent;
    link.append(portrait, name);
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

const roster = planner.querySelector("#team-owned-list");
const recommendation = planner.querySelector("#team-recommendation");
const presets = window.nteTeamPresets;
const rosterKey = "nteuzb.team-owned";
let owned = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(rosterKey) ?? "[]");
  if (Array.isArray(stored)) owned = new Set(stored);
} catch {}

const labels = new Map([...slots[0].options]
  .filter(option => option.value)
  .map(option => [option.value, option.textContent]));

function recommendTeam() {
  recommendation.replaceChildren();
  if (!owned.size) return;
  const scores = presets.map(preset => {
    const used = new Set(preset.members.map(character));
    const matched = preset.members.map(id => {
      const direct = [...owned].find(value => character(value) === character(id));
      if (direct) return direct;
      const alternate = preset.replacements[id]?.find(value => owned.has(value) && !used.has(character(value)));
      if (alternate) used.add(character(alternate));
      return alternate ?? "";
    });
    return {preset, matched, count: matched.filter(Boolean).length,
      direct: matched.filter((id, index) => id && character(id) === character(preset.members[index])).length};
  }).sort((a, b) => b.count - a.count || b.direct - a.direct);
  const best = scores[0];
  if (!best.count) {
    recommendation.textContent = "Belgilangan personajlar orasida tayyor tarkibga mos keladigani hozircha topilmadi.";
    return;
  }
  const heading = document.createElement("h3");
  heading.textContent = best.preset.title + " · " + best.count + "/4 sizda bor";
  const reason = document.createElement("p");
  reason.textContent = best.preset.why;
  const detail = document.createElement("p");
  const missing = best.preset.members.filter((_, index) => !best.matched[index]);
  const alternatives = best.matched.flatMap((id, index) => id && character(id) !== character(best.preset.members[index])
    ? [labels.get(best.preset.members[index]) + " o‘rniga " + labels.get(id)] : []);
  detail.textContent = [missing.length ? "Yetishmaydi — " + missing.map(id => labels.get(id)).join(", ") : "",
    alternatives.length ? "Muqobil — " + alternatives.join(", ") : ""].filter(Boolean).join(". ");
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "button secondary";
  apply.textContent = "Mos personajlarni tarkibga qo‘yish";
  apply.addEventListener("click", () => {
    slots.forEach((slot, index) => { slot.value = best.matched[index]; });
    updateTeam();
  });
  recommendation.append(heading, reason, detail, apply);
}

for (const [id, name] of labels) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = owned.has(id);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) owned.add(id);
    else owned.delete(id);
    try { localStorage.setItem(rosterKey, JSON.stringify([...owned])); } catch {}
    recommendTeam();
  });
  label.append(checkbox, name);
  roster.append(label);
}
recommendTeam();
