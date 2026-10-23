document.documentElement.classList.add("js");
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("motion");
window.__mcMotion = "pending";
window.setTimeout(function () {
  if (window.__mcMotion === "ready") return;
  document.documentElement.classList.add("motion-ready");
}, 2500);
