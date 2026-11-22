(() => {
  const key = "nteuzb.theme";
  const modes = ["dark", "light", "calm"];
  const labels = {dark: "Qorong‘i", light: "Yorug‘", calm: "Sokin"};
  const colors = {dark: "#0b1019", light: "#f3f4ee", calm: "#171c22"};
  const root = document.documentElement;

  const apply = (theme) => {
    root.dataset.theme = modes.includes(theme) ? theme : modes[0];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = colors[root.dataset.theme];
  };

  try {
    apply(localStorage.getItem(key));
  } catch {
    apply(null);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const control = document.querySelector(".theme-control");
    if (!control) return;
    const trigger = control.querySelector(".theme-trigger");
    const nextMode = () => modes[(modes.indexOf(root.dataset.theme) + 1) % modes.length];
    const sync = () => {
      const text = labels[root.dataset.theme] + " rejim. " + labels[nextMode()] + " rejimga o‘tish";
      trigger.setAttribute("aria-label", text);
      trigger.title = text;
    };

    sync();
    control.hidden = false;
    trigger.addEventListener("click", () => {
      apply(nextMode());
      sync();
      try {
        localStorage.setItem(key, root.dataset.theme);
      } catch {
        // The mode still applies when storage is unavailable.
      }
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== key && event.key !== null) return;
      apply(event.newValue);
      sync();
    });
  });
})();
