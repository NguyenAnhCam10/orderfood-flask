(function () {

  function formatVnd(value) {
    return Math.round(Number(value) || 0).toLocaleString("vi-VN") + "đ";
  }

  function findRow(el) {
    return el.closest("li.list-group-item") || el.closest("tr");
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? "0.6" : "1";
  }

  // ===== Countdown badges (cho ACCEPTED tab) =====
  function startCountdowns() {
    document.querySelectorAll(".countdown-badge[data-expiry]").forEach(el => {
      const expiry = parseInt(el.dataset.expiry) * 1000;
      function tick() {
        const diff = expiry - Date.now();
        if (diff <= 0) { el.textContent = "sắp xong"; return; }
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${m}:${String(s).padStart(2, "0")}`;
        setTimeout(tick, 1000);
      }
      tick();
    });
  }
  startCountdowns();

  // ===== Xác nhận đơn (PAID → ACCEPTED) =====
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".approve-order-btn");
    if (!btn) return;
    const orderId = btn.dataset.orderId;
    const row = findRow(btn);
    try {
      setLoading(btn, true);
      const res = await fetch(`/owner/orders/${orderId}/approve`, {
        method: "POST", headers: { "Accept": "application/json" }
      });
      const data = await res.json();
      if (!res.ok || data.status !== "ACCEPTED") throw new Error(data.error || "Lỗi");

      row.style.opacity = 0;
      setTimeout(() => row.remove(), 350);

      const approvedList = document.querySelector("#approved-list");
      if (approvedList) {
        const expiry = data.accepted_at_ts + data.waiting_time * 60;
        const li = document.createElement("li");
        li.className = "list-group-item";
        li.id = `order-row-${data.order_id}`;
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>Đơn #${data.order_id}</strong> — ${data.customer_name} — ${formatVnd(data.total_price)}
              <span class="badge bg-primary ms-2">Còn <span class="countdown-badge" data-expiry="${expiry}">…</span></span>
            </div>
            <button class="btn btn-warning btn-sm deliver-order-btn" data-order-id="${data.order_id}">
              Bắt đầu giao hàng
            </button>
          </div>
          <div class="mt-1 small text-muted">
            ${(data.items || []).map(i => `— ${i.name} x ${i.quantity}`).join(" ")}
          </div>`;
        approvedList.appendChild(li);
        startCountdowns();
      }

      // Chuyển sang tab Đang chuẩn bị
      document.getElementById("approved-tab")?.click();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  // ===== Bắt đầu giao (ACCEPTED → DELIVERING) =====
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".deliver-order-btn");
    if (!btn) return;
    const orderId = btn.dataset.orderId;
    const row = findRow(btn);
    try {
      setLoading(btn, true);
      const res = await fetch(`/owner/orders/${orderId}/deliver`, {
        method: "POST", headers: { "Accept": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi");

      row.style.opacity = 0;
      setTimeout(() => row.remove(), 350);

      const deliveringList = document.querySelector("#delivering-list");
      if (deliveringList) {
        const li = document.createElement("li");
        li.className = "list-group-item";
        li.id = `order-row-${data.order_id}`;
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <div><strong>Đơn #${data.order_id}</strong></div>
            <button class="btn btn-success btn-sm complete-order-btn" data-order-id="${data.order_id}">
              Đã giao thành công
            </button>
          </div>`;
        deliveringList.appendChild(li);
      }
      document.getElementById("delivering-tab")?.click();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  // ===== Hoàn thành (DELIVERING → COMPLETED) =====
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".complete-order-btn");
    if (!btn) return;
    const orderId = btn.dataset.orderId;
    const row = findRow(btn);
    try {
      setLoading(btn, true);
      const res = await fetch(`/owner/orders/${orderId}/complete`, {
        method: "POST", headers: { "Accept": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi");

      row.style.opacity = 0;
      setTimeout(() => row.remove(), 350);
      document.getElementById("completed-tab")?.click();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  // ===== Hủy đơn (PAID/ACCEPTED/DELIVERING → CANCELED) =====
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form.cancel-order-form");
    if (!form) return;
    e.preventDefault();
    const orderId = form.dataset.orderId;
    const reason = form.querySelector("textarea[name='reason']").value.trim();
    const btn = form.querySelector("button[type=submit]");
    const row = form.closest("li.list-group-item");
    try {
      setLoading(btn, true);
      const res = await fetch(`/owner/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi");

      row.style.opacity = 0;
      setTimeout(() => row.remove(), 350);

      const cancelledList = document.querySelector("#cancelled ul.list-group");
      if (cancelledList) {
        const li = document.createElement("li");
        li.className = "list-group-item";
        li.innerHTML = `Đơn #${data.order_id} — ${data.customer_name} —
          <span class="text-danger">Đã hủy</span>
          ${data.refunded ? '<span class="text-info ms-1 small">· Đã hoàn tiền</span>' : ''}
          <br><small><strong>Lý do:</strong> ${data.reason || '—'}</small>`;
        cancelledList.appendChild(li);
      }
      document.getElementById("cancelled-tab")?.click();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(btn, false);
    }
  });

})();
