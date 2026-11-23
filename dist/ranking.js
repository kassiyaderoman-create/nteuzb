const roleFilter = document.querySelector("#ranking-role");
const rankingRows = document.querySelectorAll(".ranking-table tbody tr");
roleFilter.addEventListener("change", () => {
  for (const row of rankingRows) row.hidden = Boolean(roleFilter.value && row.dataset.role !== roleFilter.value);
});

const patchStatus = document.querySelector("#ranking-patch-status");
fetch("/reyting-versiyasi.json").then(async (response) => {
  if (!response.ok) return;
  const {version} = await response.json();
  const [major, minor, revision = 0] = String(version).split(".").map(Number);
  if (major > 1 || (major === 1 && (minor > 5 || (minor === 5 && revision > 0)))) {
    patchStatus.textContent = "NTE " + version + " chiqdi. Bu reyting qayta tekshirilmoqda.";
    patchStatus.hidden = false;
  }
}).catch(() => {});
