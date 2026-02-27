export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function getVoterToken(shareId) {
  const key = `voter_token_${shareId}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export function startCountdown(startsAt, timerEl, onExpired = () => location.reload()) {
  function update() {
    const remaining = startsAt - Date.now();
    if (remaining <= 0) {
      onExpired();
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${String(minutes).padStart(2, "0")}m`);
    parts.push(`${String(seconds).padStart(2, "0")}s`);
    timerEl.textContent = parts.join(" ");
  }
  update();
  setInterval(update, 1000);
}

const WS_MAX_DELAY = 30000;
const WS_MAX_RETRIES = 20;

export function connectWs({ shareId, onMessage, statusDot, statusText }) {
  let reconnectDelay = 2000;
  let retryCount = 0;

  function connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/ws/${shareId}`);

    ws.addEventListener("open", () => {
      statusDot.classList.remove("disconnected");
      statusText.textContent = "Live";
      reconnectDelay = 2000;
      retryCount = 0;
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.addEventListener("close", () => {
      statusDot.classList.add("disconnected");
      if (retryCount >= WS_MAX_RETRIES) {
        statusText.textContent = "Disconnected";
        return;
      }
      statusText.textContent = "Reconnecting\u2026";
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, WS_MAX_DELAY);
      retryCount++;
    });
  }

  connect();
}

export function renderResults(
  resultsEl,
  totalVotesEl,
  options,
  totalVotes,
  barClass = "result-bar",
) {
  resultsEl.innerHTML = "";
  for (const opt of options) {
    const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
    const pctDisplay = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
    const bar = document.createElement("div");
    bar.className = barClass;
    bar.innerHTML = `
      <div class="label-row">
        <span class="option-name">${escapeHtml(opt.text)}</span>
        <span class="option-stats">${opt.votes} vote${opt.votes !== 1 ? "s" : ""}</span>
      </div>
      <div class="bar">
        <div class="fill"></div>
        <span class="pct-overlay">${pctDisplay}%</span>
      </div>
    `;
    bar.querySelector(".fill").style.width = `${pct}%`;
    resultsEl.appendChild(bar);
  }
  totalVotesEl.textContent = `${totalVotes} total vote${totalVotes !== 1 ? "s" : ""}`;
}

export function setupCopyHandlers(toastEl) {
  let toastTimer = null;

  function showToast(text) {
    toastEl.textContent = text || "Copied to clipboard";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  function handleCopy(box) {
    const text = box.querySelector(".link-text").textContent;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        box.classList.add("copied");
        showToast();
        setTimeout(() => box.classList.remove("copied"), 2000);
      })
      .catch(() => {
        showToast("Failed to copy \u2014 please copy manually");
      });
  }

  document.addEventListener("click", (e) => {
    const box = e.target.closest("[data-copy]");
    if (box) handleCopy(box);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const box = e.target.closest("[data-copy]");
      if (box) {
        e.preventDefault();
        handleCopy(box);
      }
    }
  });

  return showToast;
}

const SHARE_ICONS = {
  copy: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  email:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 4.5L8 9l7-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  qr: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="10.5" y="10.5" width="4" height="4" rx="0.5" fill="currentColor"/></svg>',
  share:
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8v5a1 1 0 001 1h6a1 1 0 001-1V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 2v7M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function renderShareButtons(container, url, title, showToast) {
  container.innerHTML = "";

  // Copy Link
  const copyBtn = makeShareBtn(SHARE_ICONS.copy, "Copy Link");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(url)
      .then(() => showToast("Link copied to clipboard"))
      .catch(() => showToast("Failed to copy link"));
  });
  container.appendChild(copyBtn);

  // Email
  const emailBtn = makeShareBtn(SHARE_ICONS.email, "Email");
  emailBtn.addEventListener("click", () => {
    const subject = encodeURIComponent(title || "Check out this poll");
    const body = encodeURIComponent(url);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  });
  container.appendChild(emailBtn);

  // QR Code
  let qrPopover = null;
  const qrBtn = makeShareBtn(SHARE_ICONS.qr, "QR Code");
  qrBtn.style.position = "relative";
  qrBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (qrPopover?.parentNode) {
      qrPopover.remove();
      qrPopover = null;
      return;
    }
    qrPopover = document.createElement("div");
    qrPopover.className = "qr-popover";

    const canvas = document.createElement("canvas");
    import("qr-creator").then((mod) => {
      const QrCreator = mod.default;
      QrCreator.render(
        {
          text: url,
          radius: 0.4,
          ecLevel: "M",
          fill: "#f0ebe3",
          background: "#161514",
          size: 160,
        },
        canvas,
      );
    });
    qrPopover.appendChild(canvas);

    const downloadLink = document.createElement("a");
    downloadLink.className = "qr-download";
    downloadLink.textContent = "Download";
    downloadLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "poll-qr.png";
      a.click();
    });
    qrPopover.appendChild(downloadLink);
    qrBtn.appendChild(qrPopover);

    // Reposition if clipped by viewport edges
    requestAnimationFrame(() => {
      const rect = qrPopover.getBoundingClientRect();
      if (rect.left < 8) {
        qrPopover.style.left = "0";
        qrPopover.style.transform = "none";
      } else if (rect.right > window.innerWidth - 8) {
        qrPopover.style.left = "auto";
        qrPopover.style.right = "0";
        qrPopover.style.transform = "none";
      }
      if (rect.bottom > window.innerHeight - 8) {
        qrPopover.style.top = "auto";
        qrPopover.style.bottom = "calc(100% + 8px)";
      }
    });

    const dismiss = (ev) => {
      if (!qrPopover || qrPopover.contains(ev.target)) return;
      qrPopover.remove();
      qrPopover = null;
      document.removeEventListener("click", dismiss);
    };
    setTimeout(() => document.addEventListener("click", dismiss), 0);
  });
  container.appendChild(qrBtn);

  // Native share (conditional)
  if (navigator.share) {
    const shareBtn = makeShareBtn(SHARE_ICONS.share, "Share");
    shareBtn.addEventListener("click", () => {
      navigator.share({ title: title || "Poll", url }).catch(() => {});
    });
    container.appendChild(shareBtn);
  }
}

function makeShareBtn(iconHtml, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "share-btn";
  btn.innerHTML = `${iconHtml}<span>${label}</span>`;
  return btn;
}
