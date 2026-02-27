const shareId = window.location.pathname.split("/").pop();
let features = { websocket: true };
const VOTER_TOKEN_KEY = `voter_token_${shareId}`;

function getVoterToken() {
  let token = localStorage.getItem(VOTER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(VOTER_TOKEN_KEY, token);
  }
  return token;
}

const voterToken = getVoterToken();

// Apply query param styling
const params = new URLSearchParams(window.location.search);
const root = document.documentElement;

if (params.get("bg")) {
  root.style.setProperty("--embed-bg", `#${params.get("bg")}`);
}
if (params.get("accent")) {
  root.style.setProperty("--embed-accent", `#${params.get("accent")}`);
}

const loadingEl = document.getElementById("loading");
const embedViewEl = document.getElementById("embed-view");
const questionEl = document.getElementById("question");
const scheduledSectionEl = document.getElementById("scheduled-section");
const countdownTimerEl = document.getElementById("countdown-timer");
const voteSectionEl = document.getElementById("vote-section");
const voteOptionsEl = document.getElementById("vote-options");
const voteHintEl = document.getElementById("vote-hint");
const resultsSectionEl = document.getElementById("results-section");
const resultsEl = document.getElementById("results");
const totalVotesEl = document.getElementById("total-votes");
const wsDotEl = document.getElementById("ws-dot");
const wsTextEl = document.getElementById("ws-text");
const errorEl = document.getElementById("error");
const voteBtn = document.getElementById("vote-btn");
const fullPollLink = document.getElementById("full-poll-link");

let hasVoted = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderResults(options, totalVotes) {
  resultsEl.innerHTML = "";
  for (const opt of options) {
    const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
    const pctDisplay = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
    const bar = document.createElement("div");
    bar.className = "embed-result-bar";
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

function showResults(options, totalVotes) {
  renderResults(options, totalVotes);
  resultsSectionEl.classList.remove("hidden");
}

let wsReconnectDelay = 2000;
const WS_MAX_DELAY = 30000;
const WS_MAX_RETRIES = 20;
let wsRetryCount = 0;

function connectWs() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws/${shareId}`);

  ws.addEventListener("open", () => {
    wsDotEl.classList.remove("disconnected");
    wsTextEl.textContent = "Live";
    wsReconnectDelay = 2000;
    wsRetryCount = 0;
  });

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "results") {
        showResults(data.options, data.total_votes);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    wsDotEl.classList.add("disconnected");
    if (wsRetryCount >= WS_MAX_RETRIES) {
      wsTextEl.textContent = "Disconnected";
      return;
    }
    wsTextEl.textContent = "Reconnecting\u2026";
    setTimeout(connectWs, wsReconnectDelay);
    wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, WS_MAX_DELAY);
    wsRetryCount++;
  });
}

async function loadPoll() {
  try {
    const [featuresRes, res] = await Promise.all([
      fetch("/api/features"),
      fetch(`/api/polls/${shareId}?voter_token=${voterToken}`),
    ]);

    if (featuresRes.ok) features = await featuresRes.json();

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to load poll");
    }

    const data = await res.json();
    hasVoted = data.has_voted;

    const hideTitle = params.get("hideTitle") === "1";
    if (hideTitle) {
      questionEl.classList.add("hidden");
    } else {
      questionEl.textContent = data.poll.question;
    }

    const isScheduled = data.poll.starts_at && Date.now() < data.poll.starts_at;
    const isExpired = data.poll.expires_at && Date.now() > data.poll.expires_at;

    if (isScheduled) {
      const badge = document.createElement("span");
      badge.className = "embed-scheduled-badge";
      badge.textContent = "Coming soon";
      questionEl.appendChild(badge);
    } else if (isExpired) {
      const badge = document.createElement("span");
      badge.className = "embed-expired-badge";
      badge.textContent = "Expired";
      questionEl.appendChild(badge);
    }

    fullPollLink.href = `${window.location.origin}/poll/${shareId}`;

    loadingEl.classList.add("hidden");
    embedViewEl.classList.remove("hidden");

    if (isScheduled) {
      voteSectionEl.classList.add("hidden");
      scheduledSectionEl.classList.remove("hidden");
      startCountdown(data.poll.starts_at);
    } else if (hasVoted || isExpired) {
      voteSectionEl.classList.add("hidden");
      showResults(data.options, data.total_votes);
    } else {
      renderVoteOptions(data);
    }

    if (features.websocket) {
      connectWs();
    } else {
      document.getElementById("ws-status").classList.add("hidden");
    }
  } catch (err) {
    loadingEl.querySelector(".embed-spinner").remove();
    const textEl = loadingEl.querySelector(".embed-loading-text");
    textEl.classList.add("embed-loading-error");
    textEl.textContent = err.message;
  }
}

function renderVoteOptions(data) {
  const isMultiple = !!data.poll.allow_multiple;
  const inputType = isMultiple ? "checkbox" : "radio";
  voteHintEl.textContent = isMultiple ? "Choose one or more" : "Choose one";
  voteOptionsEl.innerHTML = "";

  for (const opt of data.options) {
    const label = document.createElement("label");
    label.className = "embed-vote-option";
    label.innerHTML = `
      <input type="${inputType}" name="vote" value="${opt.id}">
      <span class="custom-check${isMultiple ? " is-checkbox" : ""}"></span>
      <span class="option-text">${escapeHtml(opt.text)}</span>
    `;
    voteOptionsEl.appendChild(label);
  }
}

document.getElementById("vote-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.classList.add("hidden");
  voteBtn.disabled = true;

  const selected = Array.from(document.querySelectorAll('input[name="vote"]:checked')).map((el) =>
    parseInt(el.value, 10),
  );

  if (selected.length === 0) {
    errorEl.textContent = "Please select an option.";
    errorEl.classList.remove("hidden");
    voteBtn.disabled = false;
    return;
  }

  try {
    const res = await fetch(`/api/polls/${shareId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: selected, voter_token: voterToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to vote");
    }

    hasVoted = true;
    voteSectionEl.classList.add("hidden");
    showResults(data.options, data.total_votes);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
    voteBtn.disabled = false;
  }
});

function startCountdown(startsAt) {
  function update() {
    const remaining = startsAt - Date.now();
    if (remaining <= 0) {
      window.location.reload();
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
    countdownTimerEl.textContent = parts.join(" ");
  }
  update();
  setInterval(update, 1000);
}

loadPoll();
