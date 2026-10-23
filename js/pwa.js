const root = document.documentElement;

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.navigator.standalone === true;

const ios = () => {
  const ua = window.navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
};

const markOffline = () => {
  root.classList.toggle("is-offline", !window.navigator.onLine);
};

let wasOffline = !window.navigator.onLine;
markOffline();

window.addEventListener("offline", () => {
  wasOffline = true;
  markOffline();
});

window.addEventListener("online", () => {
  markOffline();
  if (!wasOffline) return;
  wasOffline = false;
  if (root.dataset.panelReady === "1") return;
  window.location.reload();
});

const bootInstall = () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  const button = document.querySelector("[data-install]");
  const guide = document.querySelector("[data-install-guide]");
  if (!button) return;

  const hide = () => {
    button.hidden = true;
    if (guide) guide.hidden = true;
  };

  if (standalone()) {
    hide();
    return;
  }

  window.addEventListener("appinstalled", hide);
  const media = window.matchMedia("(display-mode: standalone)");
  if (media.addEventListener) {
    media.addEventListener("change", () => {
      if (standalone()) hide();
    });
  }

  if (ios()) {
    button.hidden = false;
    button.addEventListener("click", () => {
      if (!guide) return;
      guide.hidden = false;
      const close = guide.querySelector("[data-install-close]");
      if (close) close.focus();
    });
    if (!guide) return;
    guide.addEventListener("click", (event) => {
      if (event.target === guide) guide.hidden = true;
    });
    const close = guide.querySelector("[data-install-close]");
    if (close) {
      close.addEventListener("click", () => {
        guide.hidden = true;
        button.focus();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !guide.hidden) guide.hidden = true;
    });
    return;
  }

  let promptEvent = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event;
    if (!standalone()) button.hidden = false;
  });
  button.addEventListener("click", async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    promptEvent = null;
    if (choice && choice.outcome === "accepted") hide();
  });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootInstall);
else bootInstall();
