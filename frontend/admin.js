const adminId = window.location.pathname.split("/").pop();

const loadingEl = document.getElementById("loading");
const adminViewEl = document.getElementById("admin-view");
const questionEl = document.getElementById("question");
const resultsEl = document.getElementById("results");
const totalVotesEl = document.getElementById("total-votes");
const wsDotEl = document.getElementById("ws-dot");
const wsTextEl = document.getElementById("ws-text");
const shareLinkEl = document.getElementById("share-link");
const copyToast = document.getElementById("copy-toast");

let shareId = null;
let pollExpired = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderResults(options, totalVotes) {
  resultsEl.innerHTML = "";
  for (const opt of options) {
    const pct = totalVotes > 0 ? ((opt.votes / totalVotes) * 100) : 0;
    const pctDisplay = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
    const bar = document.createElement("div");
    bar.className = "result-bar";
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

function connectWs() {
  if (!shareId) return;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws/${shareId}`);

  ws.addEventListener("open", () => {
    wsDotEl.classList.remove("disconnected");
    wsTextEl.textContent = "Live";
  });

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "results") {
      renderResults(data.options, data.total_votes);
    }
    if (data.type === "closed") {
      renderResults(data.options, data.total_votes);
      markExpired();
    }
  });

  ws.addEventListener("close", () => {
    wsDotEl.classList.add("disconnected");
    wsTextEl.textContent = "Reconnecting\u2026";
    setTimeout(connectWs, 2000);
  });
}

function formatDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadAdmin() {
  try {
    const res = await fetch(`/api/polls/admin/${adminId}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to load poll");
    }

    const data = await res.json();
    shareId = data.poll.share_id;

    questionEl.textContent = data.poll.question;

    if (data.poll.expires_at && Date.now() > data.poll.expires_at) {
      markExpired();
    }

    const origin = window.location.origin;
    shareLinkEl.querySelector(".link-text").textContent = `${origin}/poll/${shareId}`;

    document.getElementById("created-at").textContent = formatDate(data.poll.created_at);
    document.getElementById("expires-at").textContent = data.poll.expires_at
      ? formatDate(data.poll.expires_at)
      : "Never";
    document.getElementById("poll-type").textContent = data.poll.allow_multiple
      ? "Multiple choice"
      : "Single choice";
    document.getElementById("poll-id").textContent = shareId;

    renderResults(data.options, data.total_votes);

    loadingEl.classList.add("hidden");
    adminViewEl.classList.remove("hidden");

    connectWs();
  } catch (err) {
    loadingEl.querySelector(".loading-spinner").remove();
    const textEl = loadingEl.querySelector(".loading-text");
    textEl.classList.add("loading-error");
    textEl.textContent = err.message;
  }
}

let toastTimer = null;
function showToast(text) {
  copyToast.textContent = text || "Copied to clipboard";
  copyToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => copyToast.classList.remove("show"), 2000);
}

document.addEventListener("click", (e) => {
  const box = e.target.closest("[data-copy]");
  if (box) {
    const text = box.querySelector(".link-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
      box.classList.add("copied");
      showToast();
      setTimeout(() => box.classList.remove("copied"), 2000);
    });
  }
});

document.getElementById("btn-csv").addEventListener("click", () => {
  window.location.href = `/api/polls/admin/${adminId}/export?format=csv`;
});

document.getElementById("btn-json").addEventListener("click", () => {
  window.location.href = `/api/polls/admin/${adminId}/export?format=json`;
});

document.getElementById("btn-summary").addEventListener("click", async () => {
  try {
    const res = await fetch(`/api/polls/admin/${adminId}/summary`);
    if (!res.ok) throw new Error("Failed to fetch summary");
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    showToast("Summary copied to clipboard");
  } catch {
    showToast("Failed to copy summary");
  }
});

function markExpired() {
  pollExpired = true;
  const closeBtn = document.getElementById("btn-close");
  closeBtn.disabled = true;
  // Add expired badge if not already present
  if (!questionEl.querySelector(".expired-badge")) {
    questionEl.innerHTML += '<span class="expired-badge">Expired</span>';
  }
}

document.getElementById("btn-close").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to close voting? This cannot be undone.")) return;
  try {
    const res = await fetch(`/api/polls/admin/${adminId}/close`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to close poll");
    }
    const data = await res.json();
    renderResults(data.options, data.total_votes);
    markExpired();
    document.getElementById("expires-at").textContent = formatDate(data.poll.expires_at);
    showToast("Voting closed");
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById("btn-reset").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to reset all votes? This cannot be undone.")) return;
  try {
    const res = await fetch(`/api/polls/admin/${adminId}/reset`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to reset votes");
    }
    const data = await res.json();
    renderResults(data.options, data.total_votes);
    showToast("Votes reset");
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById("btn-delete").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to delete this poll? This cannot be undone.")) return;
  try {
    const res = await fetch(`/api/polls/admin/${adminId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete poll");
    }
    window.location.href = "/";
  } catch (err) {
    showToast(err.message);
  }
});

loadAdmin();
