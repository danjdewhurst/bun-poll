import { escapeHtml, getVoterToken, startCountdown, connectWs, renderResults } from "./shared.js";

const shareId = window.location.pathname.split("/").pop();
let features = { websocket: true };
const voterToken = getVoterToken(shareId);

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
const errorEl = document.getElementById("error");
const voteBtn = document.getElementById("vote-btn");
const fullPollLink = document.getElementById("full-poll-link");

let hasVoted = false;

function showResults(options, totalVotes) {
  renderResults(resultsEl, totalVotesEl, options, totalVotes, "embed-result-bar");
  resultsSectionEl.classList.remove("hidden");
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
      startCountdown(data.poll.starts_at, countdownTimerEl);
    } else if (hasVoted || isExpired) {
      voteSectionEl.classList.add("hidden");
      showResults(data.options, data.total_votes);
    } else {
      renderVoteOptions(data);
    }

    if (features.websocket) {
      connectWs({
        shareId,
        statusDot: document.getElementById("ws-dot"),
        statusText: document.getElementById("ws-text"),
        onMessage(data) {
          if (data.type === "results") {
            showResults(data.options, data.total_votes);
          }
        },
      });
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

loadPoll();
