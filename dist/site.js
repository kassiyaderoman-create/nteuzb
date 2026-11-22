const menu = document.querySelector(".menu");
const navigation = document.querySelector("#nav");

function setMenu(open) {
  menu.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("open", open);
}

menu.addEventListener("click", () => {
  setMenu(menu.getAttribute("aria-expanded") !== "true");
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});

document.addEventListener("click", (event) => {
  if (menu.getAttribute("aria-expanded") === "true" && !event.target.closest("#nav, .menu")) {
    setMenu(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    menu.focus();
  }
});

const filters = document.querySelector(".filters");
if (filters) {
  const filterButtons = [...filters.querySelectorAll("button")];
  const guides = document.querySelectorAll("[data-category]");

  filters.hidden = false;
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    for (const option of filterButtons) {
      option.setAttribute("aria-pressed", String(option === button));
    }

    const category = button.dataset.filter;
    for (const guide of guides) {
      guide.hidden = category !== "all" && guide.dataset.category !== category;
    }
  });
}

const touchFeedback = window.matchMedia("(prefers-reduced-motion: no-preference)");
let touchMark;

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || !event.isPrimary || !touchFeedback.matches || document.documentElement.dataset.theme === "calm") return;

  touchMark?.remove();
  const mark = document.createElement("span");
  mark.className = "touch-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.style.left = event.clientX + "px";
  mark.style.top = event.clientY + "px";
  mark.addEventListener("animationend", () => mark.remove(), {once: true});
  document.body.append(mark);
  touchMark = mark;
}, {passive: true});

const copyStatus = document.querySelector("#copy-status");
if (copyStatus) {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      copyStatus.textContent = "Kod nusxalandi.";
    } catch {
      copyStatus.textContent = "Kodni qo‘lda nusxalang: " + button.dataset.copy;
    }
  });
}

const adminPasswordToggle = document.querySelector("#admin-password-toggle");
const adminPassword = document.querySelector("#admin-password");
if (adminPasswordToggle && adminPassword) {
  adminPasswordToggle.hidden = false;
  adminPasswordToggle.addEventListener("click", () => {
    const show = adminPassword.type === "password";
    adminPassword.type = show ? "text" : "password";
    adminPasswordToggle.textContent = show ? "Yashirish" : "Ko‘rsatish";
  });
}
