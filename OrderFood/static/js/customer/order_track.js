(function () {
  // ===== Countdown khi ACCEPTED =====
  const countdownEl = document.getElementById("countdown");
  if (countdownEl && window.ORDER_ACCEPTED_AT && window.ORDER_WAITING_TIME) {
    const expiry = window.ORDER_ACCEPTED_AT * 1000 + window.ORDER_WAITING_TIME * 60 * 1000;

    function tick() {
      const diff = expiry - Date.now();
      if (diff <= 0) {
        countdownEl.textContent = "sắp xong!";
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdownEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
      setTimeout(tick, 1000);
    }
    tick();
  }

  // ===== Rating stars =====
  const wrap = document.querySelector(".rating-stars:not(.rating-readonly)");
  if (!wrap) return;
  const stars = Array.from(wrap.querySelectorAll(".star"));
  const input = document.getElementById("rating-input");

  function paint(n) {
    stars.forEach((s, i) => s.classList.toggle("on", i < n));
  }

  stars.forEach(btn => {
    btn.addEventListener("click", () => {
      const n = +btn.dataset.val;
      paint(n);
      input.value = n;
    });
    btn.addEventListener("mouseenter", () => paint(+btn.dataset.val));
    btn.addEventListener("mouseleave", () => paint(+input.value || 0));
  });
})();
