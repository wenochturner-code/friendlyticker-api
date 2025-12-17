// ui/app.js
// Main frontend logic & API calls for FriendlyTicker

import * as components from "./components.js";

// ====== Config ======
const API_BASE = "http://127.0.0.1:8000";
const ALERT_EMAIL_KEY = "ft_alert_email";

// Phase 2 Alerts UI prefs (frontend-only persistence)
const ALERT_PREFS_KEY = "ft_alert_prefs_v1";

// ====== App State (Phase 2 Step 3) ======
const state = {
  isPro: false,
  userId: null,

  // Per-ticker alert preferences (frontend-only). Backend interprets later.
  alertPrefsByTicker: {},
};

// ====== DOM Cache ======
let analyzeForm;
let tickerInput;
let analyzeButton;
let analyzeResultContainer;

let analyzeView;
let watchlistView;
let alertsView;
let proView;
let faqView;
let contactView;

let watchlistList;
let watchlistEmptyState;

let globalMessage;

// Phase 3.5: focus return target for Pro modal
let proModalReturnFocusEl = null;

// ====== Init ======

function initApp() {
  // v0 rule: Pro = email captured
  state.isPro = !!getStoredAlertEmail();

  try {
    const existing = localStorage.getItem("ft_user_id");
    if (existing) {
      state.userId = existing;
    } else {
      state.userId = `ft_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      localStorage.setItem("ft_user_id", state.userId);
    }
  } catch {
    state.userId = `ft_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  // Load alert preferences (frontend-only)
  state.alertPrefsByTicker = loadAlertPrefs();

  // Phase 5 (analytics): returning_user (derived)
  if (window.posthog && typeof window.posthog.capture === "function") {
    window.posthog.capture("returning_user", { user_id: state.userId });
  }

  // Grab DOM elements
  analyzeForm = document.getElementById("analyze-form");
  tickerInput = document.getElementById("ticker-input");
  analyzeButton = document.getElementById("analyze-button");
  analyzeResultContainer = document.getElementById("analyze-result");

  analyzeView = document.getElementById("analyze-view");
  watchlistView = document.getElementById("watchlist-view");
  alertsView = document.getElementById("alerts-view");
  proView = document.getElementById("pro-view");
  faqView = document.getElementById("faq-view");
  contactView = document.getElementById("contact-view");

  watchlistList = document.getElementById("watchlist-list");
  watchlistEmptyState = document.getElementById("watchlist-empty-state");

  globalMessage = document.getElementById("global-message");

  // Phase 2 Step 4: Render-only UI (sidebar + static pages)
  if (components && typeof components.renderSidebar === "function") components.renderSidebar();
  if (components && typeof components.renderProView === "function") components.renderProView();
  if (components && typeof components.renderFaqView === "function") components.renderFaqView();
  if (components && typeof components.renderContactView === "function") components.renderContactView();

  // Phase 3: wire Pro upgrade entry points (sidebar button)
  const sidebarUpgradeBtn = document.getElementById("upgrade-btn");
  if (sidebarUpgradeBtn) {
    sidebarUpgradeBtn.addEventListener("click", () => {
      // Phase 5 (analytics)
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture("upgrade_clicked", { source: "sidebar", user_id: state.userId });
      }
      openProModal({ source: "sidebar" });
    });
  }

  // Phase 3: wire Pro upgrade entry point (analyze page button) via event delegation
  if (analyzeResultContainer) {
    analyzeResultContainer.addEventListener("click", async (e) => {
      const target = e.target;
      if (!target) return;

      const btn = target.closest ? target.closest("#upgrade-btn-analyze") : null;
      if (btn) {
        // Phase 5 (analytics)
        if (window.posthog && typeof window.posthog.capture === "function") {
          window.posthog.capture("upgrade_clicked", { source: "analyze", user_id: state.userId });
        }
        openProModal({ source: "analyze" });
        return;
      }

      // ✅ Enable alerts button on result card (prompt for email only if not stored)
      const clicked = target.closest ? target.closest("button") : null;
      const label = clicked && typeof clicked.textContent === "string" ? clicked.textContent : "";
      if (clicked && label && label.toLowerCase().includes("enable alerts")) {
        const card = clicked.closest ? clicked.closest(".result-card") : null;
        const tickerEl = card ? card.querySelector(".result-card__ticker") : null;
        const ticker = tickerEl && tickerEl.textContent ? tickerEl.textContent.trim().toUpperCase() : "";

        if (!ticker) {
          showError("Could not determine ticker for alerts.");
          return;
        }

        try {
          clearGlobalMessage();
          await ensureEmailThenEnableAlerts(ticker);
        } catch (err) {
          console.error(err);
          showError(err.message || "Could not enable alerts.");
        }
      }
    });
  }

  // Wire up events
  if (analyzeForm) {
    analyzeForm.addEventListener("submit", handleAnalyzeSubmit);
  }

  // Phase 2: Mount marketing Hero above the analyze form (non-destructive)
  if (analyzeView && components && typeof components.Hero === "function") {
    // Avoid duplicate insert if init runs again
    if (!analyzeView.querySelector(".hero")) {
      const heroEl = components.Hero();

      // Insert hero before the existing form (keeps #analyze-form untouched)
      if (analyzeForm && analyzeForm.parentNode === analyzeView) {
        analyzeView.insertBefore(heroEl, analyzeForm);
      } else {
        // Fallback: just put it at top of analyze view
        analyzeView.prepend(heroEl);
      }
    }
  }

  // Hash routing (Phase 2 Step 3)
  window.addEventListener("hashchange", handleRoute);

  // Initialize app on load
  if (!location.hash || location.hash === "#") {
    location.hash = "#/analyze";
  } else {
    handleRoute();
  }

  // Set active nav once at startup (and again on every route change)
  if (components && typeof components.setActiveSidebarLink === "function") components.setActiveSidebarLink();

  // Warm up watchlist (optional)
  fetchWatchlist().catch((err) => {
    console.error("Failed to fetch watchlist on init:", err);
  });
}

document.addEventListener("DOMContentLoaded", initApp);

// ====== Routing (Phase 2 Step 3) ======

function hideAllViews() {
  if (analyzeView) analyzeView.hidden = true;
  if (watchlistView) watchlistView.hidden = true;
  if (alertsView) alertsView.hidden = true;
  if (proView) proView.hidden = true;
  if (faqView) faqView.hidden = true;
  if (contactView) contactView.hidden = true;
}

function showViewByRoute(route) {
  hideAllViews();

  // Default route
  if (!route || route === "/" || route === "/analyze") {
    if (analyzeView) analyzeView.hidden = false;
    return;
  }

  if (route === "/watchlist") {
    if (watchlistView) watchlistView.hidden = false;
    return;
  }

  if (route === "/alerts") {
    if (alertsView) alertsView.hidden = false;
    renderAlertsPage();
    return;
  }

  if (route === "/pro") {
    if (proView) proView.hidden = false;
    return;
  }

  if (route === "/faq") {
    // Ensure FAQ is always rendered when the route is visited (safe + idempotent).
    if (components && typeof components.renderFaqView === "function") components.renderFaqView();
    if (faqView) faqView.hidden = false;
    return;
  }

  if (route === "/contact") {
    if (contactView) contactView.hidden = false;
    return;
  }

  // Unknown route => go home
  location.hash = "#/analyze";
}

function handleRoute() {
  const raw = location.hash || "";
  const route = raw.startsWith("#") ? raw.slice(1) : raw; // "#/analyze" -> "/analyze"
  showViewByRoute(route);

  // Phase 2 Step 4: keep sidebar active state in sync with route
  if (components && typeof components.setActiveSidebarLink === "function") components.setActiveSidebarLink();
}

// ====== Alerts Page (Part 2: prefs + gating + cards) ======

function renderAlertsPage() {
  if (!alertsView) return;

  const email = getStoredAlertEmail();

  alertsView.innerHTML = `
    <section class="panel panel--intro">
      <h1 class="panel__title">Alerts</h1>
      <p class="panel__text panel__text--muted">
        View and manage your alert preferences per ticker.
      </p>
    </section>
    <section class="card">
      <header class="card__header">
        <h2 class="card__title">Your alerts</h2>
      </header>
      <div id="alerts-empty" class="panel__text panel__text--muted" aria-live="polite"></div>
      <div id="alerts-list" aria-live="polite"></div>
    </section>
  `;

  const emptyEl = document.getElementById("alerts-empty");
  const listEl = document.getElementById("alerts-list");

  if (!emptyEl || !listEl) return;

  // Alerts page needs an email stored (same as your existing rule)
  if (!email) {
    emptyEl.textContent = "To manage alerts, analyze a stock first and enable alerts.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "analyze-form__button";
    btn.textContent = "Go to Analyze";
    btn.addEventListener("click", () => {
      location.hash = "#/analyze";
    });
    emptyEl.appendChild(document.createElement("br"));
    emptyEl.appendChild(btn);
    return;
  }

  emptyEl.textContent = "Loading…";

  (async () => {
    try {
      const rules = await fetchAlertsForEmail(email);
      emptyEl.textContent = "";

      const list = Array.isArray(rules) ? rules : [];
      if (!list.length) {
        emptyEl.textContent = "No alerts yet.";
        return;
      }

      // Sort enabled first, then ticker alpha (matches your old list behavior)
      list.sort((a, b) => {
        const aEn = !!a?.enabled;
        const bEn = !!b?.enabled;
        if (aEn !== bEn) return aEn ? -1 : 1;
        const at = String(a?.ticker || "");
        const bt = String(b?.ticker || "");
        return at.localeCompare(bt);
      });

       // v0: Pro = email captured
       const flags = { pro: !!email, alertsEnabled: true };

      

      // Use new AlertPreferencesCard if available
      if (components && typeof components.AlertPreferencesCard === "function") {
        listEl.innerHTML = "";
        const frag = document.createDocumentFragment();

        list.forEach((r) => {
          const ticker = String(r?.ticker || "").trim().toUpperCase();
          if (!ticker) return;

          // Ensure prefs exist in memory (and persisted)
          const prefs = ensurePrefsForTicker(ticker);

          const card = components.AlertPreferencesCard({
            ticker,
            prefs,
            flags,
            onUpdate: handleUpdateAlertPrefs,
          });

          frag.appendChild(card);
        });

        listEl.appendChild(frag);

        // Wire Upgrade CTA on cards via delegation (keeps render-only components clean)
        listEl.addEventListener("click", (e) => {
          const target = e.target;
          if (!target) return;
          const btn = target.closest ? target.closest("#upgrade-btn-alerts") : null;
          if (!btn) return;

          if (window.posthog && typeof window.posthog.capture === "function") {
            window.posthog.capture("upgrade_clicked", { source: "alerts", user_id: state.userId });
          }
          openProModal({ source: "alerts" });
        }, { once: true });

        return;
      }

      // Fallback to old list renderer if card component missing
      if (components && typeof components.renderAlertsList === "function") {
        components.renderAlertsList(listEl, list, {
          onToggle: handleToggleAlert,
          onRemove: handleRemoveAlert,
        });
        return;
      }

      // Ultimate fallback: text
      const lines = list.map((rr) => {
        const t = String(rr?.ticker || "").trim().toUpperCase();
        const on = !!rr?.enabled;
        return `${t} — ${on ? "ON" : "OFF"}`;
      });
      listEl.textContent = lines.join("\n");
    } catch (err) {
      console.error(err);
      emptyEl.textContent = "Could not load alerts right now.";
    }
  })();
}

function handleUpdateAlertPrefs(ticker, nextPrefs) {
  const t = String(ticker || "").trim().toUpperCase();
  if (!t) return;

  const normalized = normalizePrefs(nextPrefs);
  state.alertPrefsByTicker[t] = normalized;

  // Persist (debounced)
  scheduleSaveAlertPrefs();

  // Optional: re-render to reflect disabled controls, etc. (not required)
  // If you notice any UI not updating due to internal state, uncomment:
  // if (location.hash === "#/alerts") renderAlertsPage();
}

async function handleToggleAlert(ticker, enabled) {
  const email = getStoredAlertEmail();
  if (!email) return;

  try {
    await patchAlertEnabled(email, ticker, enabled);
    if (location.hash === "#/alerts") renderAlertsPage();
  } catch (err) {
    console.error(err);
    showError(err.message || "Could not update that alert.");
  }
}

async function handleRemoveAlert(ticker) {
  const email = getStoredAlertEmail();
  if (!email) return;

  try {
    await deleteAlert(email, ticker);
    if (location.hash === "#/alerts") renderAlertsPage();
  } catch (err) {
    console.error(err);
    showError(err.message || "Could not remove that alert.");
  }
}

async function fetchAlertsForEmail(email) {
  const url = `${API_BASE}/api/alerts?email=${encodeURIComponent(email)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load alerts.");
  const data = await res.json();
  if (data && Array.isArray(data.rules)) return data.rules;
  return [];
}

async function patchAlertEnabled(email, ticker, enabled) {
  const url = `${API_BASE}/api/alerts/${encodeURIComponent(String(ticker || "").trim().toUpperCase())}?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: !!enabled }),
  });
  if (!res.ok) throw new Error("Could not update alert.");
  return res.json();
}

async function deleteAlert(email, ticker) {
  const url = `${API_BASE}/api/alerts/${encodeURIComponent(String(ticker || "").trim().toUpperCase())}?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error("Could not delete alert.");
  return res.json();
}

async function fetchAlertsStatus(email) {
  const res2 = await fetch(`${API_BASE}/alerts/status`);
  if (!res2.ok) throw new Error("status");
  const data2 = await res2.json();
  if (Array.isArray(data2)) return data2;
  if (data2 && Array.isArray(data2.rules)) return data2.rules;
  if (data2 && Array.isArray(data2.alerts)) return data2.alerts;
  if (data2 && Array.isArray(data2.items)) return data2.items;
  return [];
}

// ====== Phase 3: Pro modal orchestration ======

function openProModal({ source = "unknown" } = {}) {
  // Phase 5 (analytics)
  if (window.posthog && typeof window.posthog.capture === "function") {
    window.posthog.capture("pro_modal_viewed", { source, user_id: state.userId });
  }

  if (!components || typeof components.showProModal !== "function") {
    // Fallback to route if modal not available
    location.hash = "#/pro";
    return;
  }

  // Phase 3.5: capture focus so we can restore it on close
  proModalReturnFocusEl = document.activeElement || null;

  components.showProModal();
  wireProModalEvents(source);

  // Phase 3.5: focus the email input if present
  const emailEl = document.getElementById("pro-waitlist-email");
  if (emailEl && typeof emailEl.focus === "function") emailEl.focus();
}

function closeProModal() {
  if (!components || typeof components.hideProModal !== "function") return;
  components.hideProModal();

  // Phase 3.5: return focus to opener (if still in DOM)
  if (proModalReturnFocusEl && typeof proModalReturnFocusEl.focus === "function") {
    try {
      proModalReturnFocusEl.focus();
    } catch {
      // ignore
    }
  }
  proModalReturnFocusEl = null;
}

function setProWaitlistStatus(text, type = "info") {
  const el = document.getElementById("pro-waitlist-status");
  if (!el) return;

  el.textContent = text || "";

  // Minimal class toggles (safe even if CSS doesn't exist yet)
  el.classList.remove("pro-modal__status--error", "pro-modal__status--success");
  if (type === "error") el.classList.add("pro-modal__status--error");
  if (type === "success") el.classList.add("pro-modal__status--success");
}

function wireProModalEvents(source) {
  const overlay = document.getElementById("pro-modal-overlay");
  const closeBtn = document.getElementById("pro-modal-close");
  const submitBtn = document.getElementById("pro-waitlist-submit");

  // Avoid stacking listeners if modal opened multiple times
  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = "1";
    closeBtn.addEventListener("click", () => closeProModal());
  }

  // Click outside modal closes (optional, safe)
  if (overlay && !overlay.dataset.wired) {
    overlay.dataset.wired = "1";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeProModal();
    });
  }

  if (submitBtn && !submitBtn.dataset.wired) {
    submitBtn.dataset.wired = "1";
    submitBtn.addEventListener("click", async () => {
      await submitProWaitlist({ source });
    });
  }

  // Phase 3.5: Escape key closes (wire once)
  if (!document.body.dataset.proEscWired) {
    document.body.dataset.proEscWired = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const ov = document.getElementById("pro-modal-overlay");
      if (ov && ov.style.display !== "none") closeProModal();
    });
  }

  // Clear status each time modal is opened
  setProWaitlistStatus("");
}

async function submitProWaitlist({ source = "unknown" } = {}) {
  setProWaitlistStatus("");

  const emailEl = document.getElementById("pro-waitlist-email");
  const email = (emailEl?.value || "").trim();

  // Email is optional; if present, basic sanity check only (don't block)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setProWaitlistStatus("That email looks invalid (or leave it blank).", "error");
    return;
  }

  const payload = {
    email: email || null,
    user_id: state.userId || null,
    intent: "upgrade_clicked",
    source,
  };

  try {
    const url = `${API_BASE}/api/waitlist`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let msg = "Could not join the waitlist right now.";
      try {
        const data = await res.json();
        if (data && (data.error || data.detail)) msg = data.error || data.detail;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    setProWaitlistStatus("You're on the list. We'll reach out soon.", "success");
    if (email) storeAlertEmail(email); // v0: entering email here makes you Pro too


    // Auto-close a moment later (keeps UX clean)
    setTimeout(() => {
      closeProModal();
    }, 900);
  } catch (err) {
    console.error(err);
    setProWaitlistStatus(err.message || "Could not join the waitlist.", "error");
  }
}

// Phase 3 plan hook: on free-tier limit hit => show Pro modal (limits come in Phase 4)
function onFreeLimitHit(reason = "limit") {
  openProModal({ source: `limit_${reason}` });
}

// ====== Event Handlers ======

async function handleAnalyzeSubmit(event) {
  event.preventDefault();

  clearGlobalMessage();

  const rawInput = (tickerInput?.value || "").trim();

  // Phase 2.5: single-ticker only (reject multi-ticker / multi-token input)
  // TODO Phase 4: Batch scan via Watchlist / multi-ticker input
  if (rawInput.includes(",") || /\s+/.test(rawInput)) {
    showError("Enter one ticker at a time (e.g., AAPL). Multi-ticker scan is coming.");
    return;
  }

  // Support comma-separated tickers: "AAPL, JNJ, TD"
  const tickers = rawInput
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    showError("Please enter a stock ticker, like AAPL or TSLA.");
    return;
  }

  try {
    setLoading(true);

    // Clear previous results once at the start
    if (analyzeResultContainer) analyzeResultContainer.innerHTML = "";

    // Analyze each ticker and append cards
    for (let i = 0; i < tickers.length; i++) {
      await callAnalyzeAPI(tickers[i], { append: true });
    }
  } catch (err) {
    console.error(err);
    showError("Something went wrong while analyzing that ticker. Try again.");
  } finally {
    setLoading(false);
  }
}

// ====== API Calls ======

async function callAnalyzeAPI(ticker, { append = false } = {}) {
  const url = `${API_BASE}/api/analyze`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticker }),
  });

  if (!res.ok) {
    let message = "Could not analyze that ticker.";
    try {
      const errorData = await res.json();
      if (errorData && errorData.detail) {
        message = Array.isArray(errorData.detail)
          ? errorData.detail.map((d) => d.msg || "").join(" ")
          : errorData.detail;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  const result = await res.json();
  renderAnalyzeResult(result, { append });
  return result;
}

async function upsertAlertRule(email, ticker, enabled = true) {
  const url = `${API_BASE}/alerts/upsert`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ticker, enabled }),
  });

  if (!res.ok) {
    let message = "Could not save alert.";
    try {
      const data = await res.json();
      if (data && data.detail) message = data.detail;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

async function handleAddToWatchlist(ticker) {
  clearGlobalMessage();

  try {
    const url = `${API_BASE}/api/watchlist/add`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ticker }),
    });

    if (!res.ok) {
      let message = "Could not add that ticker to your watchlist.";
      try {
        const errorData = await res.json();
        if (errorData && errorData.detail) {
          message = errorData.detail;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await res.json();
    if (data && data.code === "PRO_REQUIRED") {
      // Phase 5 (analytics)
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture("watchlist_limit_hit", { ticker, user_id: state.userId });
      }
      showGlobalMessage(data.error || "Pro required to add more tickers to your watchlist.", "error");
      onFreeLimitHit("watchlist");
      return;
    }

    // Phase 5 (analytics)
    if (window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture("watchlist_add_success", { ticker, user_id: state.userId });
    }

    showGlobalMessage("Added to your watchlist.", "success");

    // Refresh watchlist so the change shows up
    await fetchWatchlist();
  } catch (err) {
    console.error(err);
    showError(err.message || "Failed to add to watchlist.");
  }
}

async function handleRemoveFromWatchlist(ticker) {
  clearGlobalMessage();

  try {
    const url = `${API_BASE}/api/watchlist/remove`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ticker }),
    });

    if (!res.ok) {
      let message = "Could not remove that ticker from your watchlist.";
      try {
        const errorData = await res.json();
        if (errorData && errorData.detail) {
          message = errorData.detail;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    showGlobalMessage("Removed from your watchlist.", "success");

    // Refresh list
    await fetchWatchlist();
  } catch (err) {
    console.error(err);
    showError(err.message || "Failed to remove from watchlist.");
  }
}

async function fetchWatchlist() {
  const url = `${API_BASE}/api/watchlist`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Watchlist request failed with status:", res.status);
      // Don't throw here; it's not critical to block the rest of the app
      return;
    }

    const items = await res.json();
    renderWatchlist(items || []);
  } catch (err) {
    console.error("Error fetching watchlist:", err);
    // Silent fail on UI, or show gentle message if you want:
    // showError("Couldn't load your watchlist right now.");
  }
}

// ====== Rendering ======

function renderAnalyzeResult(result, { append = false } = {}) {
  if (!analyzeResultContainer) return;

  // Phase 5 (analytics)
  if (window.posthog && typeof window.posthog.capture === "function") {
    window.posthog.capture("analysis_viewed", { ticker: (result && result.ticker) ? String(result.ticker).toUpperCase() : "", user_id: state.userId });
  }

  // Clear previous content
  if (!append) {
    analyzeResultContainer.innerHTML = "";
  }

  // If you created components.js with createResultCard, use it:
  if (components && typeof components.createResultCard === "function") {
    const cardEl = components.createResultCard(result, handleAddToWatchlist);
    analyzeResultContainer.appendChild(cardEl);
    return;
  }

  // Fallback: simple built-in card if components.js isn't present yet
  const card = document.createElement("div");
  card.className = "result-card";

  const header = document.createElement("div");
  header.className = "result-card__header";

  const left = document.createElement("div");
  const tickerEl = document.createElement("div");
  tickerEl.className = "result-card__ticker";
  tickerEl.textContent = (result.ticker || "").toUpperCase();

  const companyEl = document.createElement("div");
  companyEl.className = "result-card__company";
  companyEl.textContent = result.company_name || "—";

  left.appendChild(tickerEl);
  left.appendChild(companyEl);

  const right = document.createElement("div");
  const pill = document.createElement("div");
  pill.className = "result-card__pill";

  const label = result.momentum?.label || "—";
  pill.textContent = label;

  // Add momentum style if available
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes("uptrend")) {
    pill.classList.add("momentum--uptrend");
  } else if (normalizedLabel.includes("downtrend")) {
    pill.classList.add("momentum--downtrend");
  } else if (normalizedLabel.includes("sideways")) {
    pill.classList.add("momentum--sideways");
  }

  right.appendChild(pill);

  header.appendChild(left);
  header.appendChild(right);

  const scoreEl = document.createElement("div");
  scoreEl.className = "result-card__score";
  const score = result.momentum?.score;
  if (typeof score === "number") {
    scoreEl.textContent = `Trend Health: ${score}/100`;
  } else {
    scoreEl.textContent = "";
  }

  const summaryEl = document.createElement("p");
  summaryEl.className = "result-card__summary";
  summaryEl.textContent =
    result.summary ||
    "Descriptive snapshot of recent momentum and regime signals. Treat this as context, not a forecast.";

  const actions = document.createElement("div");
  actions.className = "result-card__actions";

  const watchlistBtn = document.createElement("button");
  watchlistBtn.type = "button";
  watchlistBtn.className = "result-card__watchlist-btn";
  watchlistBtn.textContent = "Add to watchlist";

  watchlistBtn.addEventListener("click", () => {
    const t = (result.ticker || "").toUpperCase();
    if (!t) return;
    handleAddToWatchlist(t);
  });

  actions.appendChild(watchlistBtn);

  card.appendChild(header);
  if (scoreEl.textContent) card.appendChild(scoreEl);
  card.appendChild(summaryEl);
  card.appendChild(actions);

  analyzeResultContainer.appendChild(card);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
  el.style.display = hidden ? "none" : "";
}

function renderWatchlist(items) {
  if (!watchlistList || !watchlistEmptyState) return;

  watchlistList.innerHTML = "";

  const hasItems = Array.isArray(items) && items.length > 0;

  // ✅ THIS is the exact line that fixes your bug
  setHidden(watchlistEmptyState, hasItems);

  // If no items, stop here
  if (!hasItems) return;

  items.forEach((item) => {
    const row = components && typeof components.createWatchlistItem === "function"
      ? components.createWatchlistItem(item, handleRemoveFromWatchlist)
      : null;

    if (row) {
      watchlistList.appendChild(row);
    }
  });
}

// ====== Helpers (loading & errors) ======

function setLoading(isLoading) {
  if (!analyzeButton) return;

  if (isLoading) {
    analyzeButton.disabled = true;
    analyzeButton.dataset.originalText = analyzeButton.textContent;
    analyzeButton.textContent = "Analyzing…";
  } else {
    analyzeButton.disabled = false;
    if (analyzeButton.dataset.originalText) {
      analyzeButton.textContent = analyzeButton.dataset.originalText;
    } else {
      analyzeButton.textContent = "Analyze";
    }
  }
}

function showError(message) {
  // For now, use the global message area
  showGlobalMessage(message, "error");
}

function showGlobalMessage(message, type = "info") {
  if (!globalMessage) return;

  globalMessage.textContent = message || "";
  globalMessage.className = "global-message global-message--visible";

  if (type === "error") {
    globalMessage.classList.add("global-message--error");
  } else if (type === "success") {
    globalMessage.classList.add("global-message--success");
  }

  // Auto-hide after a few seconds
  setTimeout(() => {
    if (!globalMessage) return;
    globalMessage.classList.remove(
      "global-message--visible",
      "global-message--error",
      "global-message--success"
    );
    globalMessage.textContent = "";
  }, 4000);
}

function clearGlobalMessage() {
  if (!globalMessage) return;
  globalMessage.classList.remove(
    "global-message--visible",
    "global-message--error",
    "global-message--success"
  );
  globalMessage.textContent = "";
}

function getStoredAlertEmail() {
  const e = (localStorage.getItem(ALERT_EMAIL_KEY) || "").trim().toLowerCase();
  if (!e || e.length >= 200 || !e.includes("@")) return null;
  return e;
}

function storeAlertEmail(email) {
  localStorage.setItem(ALERT_EMAIL_KEY, (email || "").trim().toLowerCase());
  state.isPro = true; // v0 rule: email == pro
}

async function ensureEmailThenEnableAlerts(ticker) {
  let email = getStoredAlertEmail();

  if (!email) {
    email = (window.prompt("Enter your email to enable alerts:") || "").trim().toLowerCase();
    if (!email || email.length >= 200 || !email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    storeAlertEmail(email);
  }

  await upsertAlertRule(email, ticker, true);
  showGlobalMessage(`Alerts enabled for ${ticker}.`, "success");
  if (location.hash === "#/alerts") renderAlertsPage();
}

// ====== Alert Prefs (frontend-only) ======

function defaultAlertPrefs() {
  return {
    regimeShift: true,
    healthDelta: { enabled: true, sensitivity: "med" },
    trendPressure: false,
    thresholds: { enabled: false, below: 60, above: 75 },
    digest: { enabled: false, cadence: "daily" },
  };
}

function normalizePrefs(p) {
  const base = defaultAlertPrefs();
  const obj = p && typeof p === "object" ? p : {};
  const out = {
    ...base,
    ...obj,
    healthDelta: {
      ...base.healthDelta,
      ...(obj.healthDelta && typeof obj.healthDelta === "object" ? obj.healthDelta : {}),
    },
    thresholds: {
      ...base.thresholds,
      ...(obj.thresholds && typeof obj.thresholds === "object" ? obj.thresholds : {}),
    },
    digest: {
      ...base.digest,
      ...(obj.digest && typeof obj.digest === "object" ? obj.digest : {}),
    },
  };

  // sanitize sensitivity
  const s = String(out.healthDelta.sensitivity || "med").toLowerCase();
  out.healthDelta.sensitivity = s === "low" || s === "high" ? s : "med";

  // sanitize numbers
  const below = Number(out.thresholds.below);
  const above = Number(out.thresholds.above);
  out.thresholds.below = Number.isFinite(below) ? below : 60;
  out.thresholds.above = Number.isFinite(above) ? above : 75;

  return out;
}

function loadAlertPrefs() {
  try {
    const raw = localStorage.getItem(ALERT_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out = {};
    Object.keys(parsed).forEach((k) => {
      const t = String(k || "").trim().toUpperCase();
      if (!t) return;
      out[t] = normalizePrefs(parsed[k]);
    });
    return out;
  } catch {
    return {};
  }
}

let _savePrefsTimer = null;
function scheduleSaveAlertPrefs() {
  if (_savePrefsTimer) clearTimeout(_savePrefsTimer);
  _savePrefsTimer = setTimeout(() => {
    _savePrefsTimer = null;
    saveAlertPrefs();
  }, 250);
}

function saveAlertPrefs() {
  try {
    localStorage.setItem(ALERT_PREFS_KEY, JSON.stringify(state.alertPrefsByTicker || {}));
  } catch {
    // ignore quota / privacy mode errors
  }
}

function ensurePrefsForTicker(ticker) {
  const t = String(ticker || "").trim().toUpperCase();
  if (!t) return defaultAlertPrefs();

  if (!state.alertPrefsByTicker || typeof state.alertPrefsByTicker !== "object") {
    state.alertPrefsByTicker = {};
  }

  if (!state.alertPrefsByTicker[t]) {
    state.alertPrefsByTicker[t] = defaultAlertPrefs();
    scheduleSaveAlertPrefs();
  } else {
    // normalize older shapes
    state.alertPrefsByTicker[t] = normalizePrefs(state.alertPrefsByTicker[t]);
  }

  return state.alertPrefsByTicker[t];
}

// Contact: copy email (works even if the view is re-rendered)
(() => {
  const email = "friendlyticker@gmail.com";

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("#copyEmailBtn");
    if (!btn) return;

    const toast = document.getElementById("copyToast");

    try {
      // Best path (secure contexts: https or localhost)
      await navigator.clipboard.writeText(email);
    } catch (err) {
      // Fallback path
      try {
        const t = document.createElement("textarea");
        t.value = email;
        t.setAttribute("readonly", "");
        t.style.position = "fixed";
        t.style.left = "-9999px";
        t.style.top = "-9999px";
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        document.body.removeChild(t);
      } catch (_) {
        if (toast) toast.textContent = "Couldn’t copy. Email: " + email;
        return;
      }
    }

    const old = btn.textContent;
    btn.textContent = "Copied!";
    btn.disabled = true;
    if (toast) toast.textContent = "Email copied to clipboard";

    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = false;
      if (toast) toast.textContent = "";
    }, 1200);
  });
})();
