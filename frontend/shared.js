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

export function renderResults(resultsEl, totalVotesEl, options, totalVotes, barClass = "result-bar") {
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
        <div class="fill" style="width: ${pct}%"></div>
        <span class="pct-overlay">${pctDisplay}%</span>
      </div>
    `;
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
