// Extension appearance only. Never touches formula generation or panel drafts.
(() => {
  const system = matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  let resolved;
  let revision = 0;
  let writes = Promise.resolve();
  let button;
  let persistenceError = "";

  function updateToggle() {
    if (!button) return;
    button.setAttribute("aria-pressed", String(resolved === "dark"));
    button.title = persistenceError || `Turn on ${resolved === "dark" ? "light" : "dark"} mode`;
    document.getElementById("theme-icon").textContent = resolved === "dark" ? "☀" : "☾";
    document.getElementById("theme-status").textContent = persistenceError;
  }

  function applyTheme() {
    resolved = preference || (system.matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", resolved);
    updateToggle();
  }

  function bindToggle() {
    button = document.getElementById("theme-toggle");
    updateToggle();
    button.addEventListener("click", () => {
      preference = resolved === "dark" ? "light" : "dark";
      const selection = preference;
      const selectionRevision = ++revision;
      persistenceError = "";
      applyTheme();
      // Serialize writes. Skip obsolete queued choices; an in-flight write must
      // settle before the latest choice is persisted. Failures do not stop the queue.
      writes = writes.then(async () => {
        if (selectionRevision !== revision) return;
        try {
          await chrome.storage.local.set({ theme: selection });
        } catch {
          if (selectionRevision === revision) {
            persistenceError = "Theme changed for this session, but could not be saved.";
            updateToggle();
          }
        }
      });
    });
  }

  applyTheme();
  system.addEventListener("change", () => {
    if (preference === null) applyTheme();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindToggle, { once: true });
  else bindToggle();

  (async () => {
    try {
      const saved = await chrome.storage.local.get("theme");
      if (revision !== 0) return; // A user choice takes precedence over a delayed read.
      preference = saved.theme === "light" || saved.theme === "dark" ? saved.theme : null;
      applyTheme();
    } catch {
      if (revision !== 0) return;
      persistenceError = "Could not load your theme preference. Using your system theme.";
      applyTheme();
    }
  })();
})();
