export function initScrollChrome(header) {
  const bar = document.querySelector("[data-progress]");
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (!bar) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    bar.style.transform = "scaleX(" + progress.toFixed(4) + ")";
  };

  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request, { passive: true });
  update();
}

export function initCounters(reduceMotion) {
  const nodes = [...document.querySelectorAll("[data-count]")];
  if (!nodes.length || reduceMotion || !("IntersectionObserver" in window)) return;
  nodes.forEach((el) => {
    el.textContent = "0";
  });
  const run = (el) => {
    const target = Number(el.getAttribute("data-count"));
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      run(entry.target);
    });
  }, { threshold: 0.6 });
  nodes.forEach((el) => observer.observe(el));
}
