const form = document.getElementById("poll-form");
const formCard = document.getElementById("form-card");
const optionsList = document.getElementById("options-list");
const addOptionBtn = document.getElementById("add-option");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const shareLinkEl = document.getElementById("share-link");
const adminLinkEl = document.getElementById("admin-link");
const submitBtn = document.getElementById("submit-btn");
const copyToast = document.getElementById("copy-toast");

const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 200;
const MAX_OPTIONS = 20;

let optionCount = 2;

function renumberOptions() {
  const numbers = optionsList.querySelectorAll(".option-number");
  numbers.forEach((el, i) => {
    el.textContent = i + 1;
  });
  optionCount = numbers.length;
}

addOptionBtn.addEventListener("click", () => {
  const currentRows = optionsList.querySelectorAll(".option-row").length;
  if (currentRows >= MAX_OPTIONS) {
    errorEl.textContent = `Maximum of ${MAX_OPTIONS} options allowed.`;
    errorEl.classList.remove("hidden");
    return;
  }
  optionCount++;
  const row = document.createElement("div");
  row.className = "option-row";
  row.style.animationDelay = "0s";
  row.innerHTML = `
    <span class="option-number">${optionCount}</span>
    <input type="text" name="option" placeholder="Option ${optionCount}" required maxlength="${MAX_OPTION_LENGTH}">
    <button type="button" class="btn btn-remove remove-option">&times;</button>
  `;
  optionsList.appendChild(row);
  row.querySelector("input").focus();
});

optionsList.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-option")) {
    const rows = optionsList.querySelectorAll(".option-row");
    if (rows.length > 2) {
      e.target.closest(".option-row").remove();
      renumberOptions();
    }
  }
});

// Toggle row click handler
document.getElementById("toggle-multiple").addEventListener("click", (e) => {
  if (e.target.tagName !== "INPUT") {
    const checkbox = document.getElementById("allow-multiple");
    checkbox.checked = !checkbox.checked;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.classList.add("hidden");
  submitBtn.disabled = true;

  const question = document.getElementById("question").value.trim();
  const options = Array.from(document.querySelectorAll('input[name="option"]'))
    .map((input) => input.value.trim())
    .filter(Boolean);
  const allowMultiple = document.getElementById("allow-multiple").checked;
  const expiresRaw = document.getElementById("expires").value;
  const expiresInMinutes = expiresRaw ? parseInt(expiresRaw, 10) : undefined;

  if (question.length > MAX_QUESTION_LENGTH) {
    errorEl.textContent = `Question must be ${MAX_QUESTION_LENGTH} characters or fewer.`;
    errorEl.classList.remove("hidden");
    submitBtn.disabled = false;
    return;
  }

  if (options.length < 2) {
    errorEl.textContent = "At least 2 options are required.";
    errorEl.classList.remove("hidden");
    submitBtn.disabled = false;
    return;
  }

  if (options.length > MAX_OPTIONS) {
    errorEl.textContent = `Maximum of ${MAX_OPTIONS} options allowed.`;
    errorEl.classList.remove("hidden");
    submitBtn.disabled = false;
    return;
  }

  for (let i = 0; i < options.length; i++) {
    if (options[i].length > MAX_OPTION_LENGTH) {
      errorEl.textContent = `Option ${i + 1} must be ${MAX_OPTION_LENGTH} characters or fewer.`;
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      return;
    }
  }

  try {
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        options,
        allow_multiple: allowMultiple,
        expires_in_minutes: expiresInMinutes,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create poll");
    }

    const origin = window.location.origin;
    shareLinkEl.querySelector(".link-text").textContent = `${origin}/poll/${data.share_id}`;
    adminLinkEl.querySelector(".link-text").textContent = `${origin}/admin/${data.admin_id}`;
    formCard.classList.add("hidden");
    resultEl.classList.remove("hidden");
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
});

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
