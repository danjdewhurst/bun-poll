const shareId = window.location.pathname.split("/").pop();
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

const loadingEl = document.getElementById("loading");
const pollViewEl = document.getElementById("poll-view");
const questionEl = document.getElementById("question");
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

function showResults(options, totalVotes) {
  renderResults(options, totalVotes);
  resultsSectionEl.classList.remove("hidden");
}

function connectWs() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws/${shareId}`);

  ws.addEventListener("open", () => {
    wsDotEl.classList.remove("disconnected");
    wsTextEl.textContent = "Live";
  });

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "results") {
      showResults(data.options, data.total_votes);
    }
    if (data.type === "viewers") {
      document.getElementById("viewer-count").textContent = data.count;
    }
  });

  ws.addEventListener("close", () => {
    wsDotEl.classList.add("disconnected");
    wsTextEl.textContent = "Reconnecting\u2026";
    setTimeout(connectWs, 2000);
  });
}

async function loadPoll() {
  try {
    const res = await fetch(`/api/polls/${shareId}?voter_token=${voterToken}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to load poll");
    }

    const data = await res.json();
    hasVoted = data.has_voted;

    questionEl.textContent = data.poll.question;

    if (data.poll.expires_at && Date.now() > data.poll.expires_at) {
      questionEl.innerHTML += '<span class="expired-badge">Expired</span>';
    }

    loadingEl.classList.add("hidden");
    pollViewEl.classList.remove("hidden");

    if (hasVoted || (data.poll.expires_at && Date.now() > data.poll.expires_at)) {
      voteSectionEl.classList.add("hidden");
      showResults(data.options, data.total_votes);
    } else {
      renderVoteOptions(data);
    }

    connectWs();
  } catch (err) {
    loadingEl.querySelector(".loading-spinner").remove();
    const textEl = loadingEl.querySelector(".loading-text");
    textEl.classList.add("loading-error");
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
    label.className = "vote-option";
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

loadPoll();
