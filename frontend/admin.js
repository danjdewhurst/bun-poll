import { connectWs, renderResults, renderShareButtons, setupCopyHandlers } from "./shared.js";

const adminId = window.location.pathname.split("/").pop();

let features = { exports: true, websocket: true, adminManagement: true };

const loadingEl = document.getElementById("loading");
const adminViewEl = document.getElementById("admin-view");
const questionEl = document.getElementById("question");
const resultsEl = document.getElementById("results");
const totalVotesEl = document.getElementById("total-votes");
const shareLinkEl = document.getElementById("share-link");

let shareId = null;

const showToast = setupCopyHandlers(document.getElementById("copy-toast"));

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
    const [featuresRes, res] = await Promise.all([
      fetch("/api/features"),
      fetch(`/api/polls/admin/${adminId}`),
    ]);

    if (featuresRes.ok) features = await featuresRes.json();

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to load poll");
    }

    const data = await res.json();
    shareId = data.poll.share_id;

    questionEl.textContent = data.poll.question;

    const isScheduled = data.poll.starts_at && Date.now() < data.poll.starts_at;

    if (isScheduled) {
      if (!questionEl.querySelector(".scheduled-badge")) {
        const badge = document.createElement("span");
        badge.className = "scheduled-badge";
        badge.textContent = "Scheduled";
        questionEl.appendChild(badge);
      }
    } else if (data.poll.expires_at && Date.now() > data.poll.expires_at) {
      markExpired();
    }

    const origin = window.location.origin;
    const pollUrl = `${origin}/poll/${shareId}`;
    shareLinkEl.querySelector(".link-text").textContent = pollUrl;

    renderShareButtons(
      document.getElementById("share-actions"),
      pollUrl,
      data.poll.question,
      showToast,
    );

    const embedSnippetEl = document.getElementById("embed-snippet");
    embedSnippetEl.querySelector(".link-text").textContent =
      `<iframe src="${origin}/embed/${shareId}" width="400" height="300" frameborder="0"></iframe>`;

    document.getElementById("created-at").textContent = formatDate(data.poll.created_at);
    document.getElementById("starts-at").textContent = data.poll.starts_at
      ? formatDate(data.poll.starts_at)
      : "Immediately";
    document.getElementById("expires-at").textContent = data.poll.expires_at
      ? formatDate(data.poll.expires_at)
      : "Never";
    document.getElementById("poll-type").textContent = data.poll.allow_multiple
      ? "Multiple choice"
      : "Single choice";
    document.getElementById("poll-id").textContent = shareId;

    renderResults(resultsEl, totalVotesEl, data.options, data.total_votes);

    if (!features.exports) {
      document.querySelector('[data-section="export"]').classList.add("hidden");
    }
    if (!features.adminManagement) {
      document.querySelector('[data-section="management"]').classList.add("hidden");
    }

    loadingEl.classList.add("hidden");
    adminViewEl.classList.remove("hidden");

    if (features.websocket) {
      connectWs({
        shareId,
        statusDot: document.getElementById("ws-dot"),
        statusText: document.getElementById("ws-text"),
        onMessage(data) {
          if (data.type === "results") {
            renderResults(resultsEl, totalVotesEl, data.options, data.total_votes);
          }
          if (data.type === "closed") {
            renderResults(resultsEl, totalVotesEl, data.options, data.total_votes);
            markExpired();
          }
          if (data.type === "viewers") {
            document.getElementById("viewer-count").textContent = data.count;
          }
        },
      });
    } else {
      document.getElementById("ws-status").classList.add("hidden");
      document.getElementById("viewer-bar").classList.add("hidden");
    }
  } catch (err) {
    loadingEl.querySelector(".loading-spinner").remove();
    const textEl = loadingEl.querySelector(".loading-text");
    textEl.classList.add("loading-error");
    textEl.textContent = err.message;
  }
}

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
  _pollExpired = true;
  const closeBtn = document.getElementById("btn-close");
  closeBtn.disabled = true;
  if (!questionEl.querySelector(".expired-badge")) {
    const badge = document.createElement("span");
    badge.className = "expired-badge";
    badge.textContent = "Expired";
    questionEl.appendChild(badge);
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
    renderResults(resultsEl, totalVotesEl, data.options, data.total_votes);
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
    renderResults(resultsEl, totalVotesEl, data.options, data.total_votes);
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
