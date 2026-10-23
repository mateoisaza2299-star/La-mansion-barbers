document.documentElement.classList.add("js");
window.__mcMotion = "pending";
window.setTimeout(function () {
  if (window.__mcMotion === "ready") return;
  document.documentElement.classList.add("motion-ready");
}, 2500);
