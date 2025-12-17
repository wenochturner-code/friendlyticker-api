// ui/components.js
// Reusable UI builders for FriendlyTicker (result cards, watchlist items, messages)

/**
 * Render sidebar into <aside id="sidebar">.
 * Phase 2 Step 4: render-only UI logic (no routing logic here).
 */
export function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = "";

  const container = document.createElement("div");
  container.className = "sidebar";

  const brand = document.createElement("div");
  brand.className = "sidebar__brand";

  const logo = document.createElement("div");
  logo.className = "sidebar__logo";
  logo.textContent = "FT";

  const title = document.createElement("div");
  title.className = "sidebar__title";
  title.textContent = "FriendlyTicker";

  brand.appendChild(logo);
  brand.appendChild(title);

  const nav = document.createElement("nav");
  nav.className = "sidebar__nav";

  const links = [
    { href: "#/analyze", label: "Analyze" },
    { href: "#/watchlist", label: "Watchlist" },
    { href: "#/alerts", label: "Alerts" },
    { href: "#/pro", label: "Pro" },
    { href: "#/faq", label: "FAQ" },
    { href: "#/contact", label: "Contact" },
  ];

  links.forEach((item) => {
    const a = document.createElement("a");
    a.className = "sidebar__link";
    a.href = item.href;
    a.textContent = item.label;
    nav.appendChild(a);
  });

  container.appendChild(brand);
  container.appendChild(nav);

  // Phase 3: Upgrade to Pro entry point (sidebar)
  const upgradeWrap = document.createElement("div");
  upgradeWrap.className = "sidebar__upgrade";

  const upgradeBtn = document.createElement("button");
  upgradeBtn.type = "button";
  upgradeBtn.id = "upgrade-btn";
  upgradeBtn.className = "sidebar__cta";
  upgradeBtn.textContent = "Upgrade to Pro";

  upgradeWrap.appendChild(upgradeBtn);
  container.appendChild(upgradeWrap);

  sidebar.appendChild(container);
}

/**
 * Highlight active sidebar link based on current hash route.
 * Still render-only: reads location, updates classes.
 */
export function setActiveSidebarLink() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const raw = location.hash || "#/analyze";
  const current = raw.startsWith("#") ? raw : `#${raw}`;

  const links = sidebar.querySelectorAll("a.sidebar__link");
  links.forEach((a) => {
    const isActive = a.getAttribute("href") === current;
    a.classList.toggle("sidebar__link--active", isActive);
  });
}

/**
 * Render Pro page content into #pro-view.
 */
export function renderProView() {
  const el = document.getElementById("pro-view");
  if (!el) return;

  el.innerHTML = "";

  const intro = document.createElement("section");
  intro.className = "panel panel--intro";

  const h1 = document.createElement("h1");
  h1.className = "panel__title";
  h1.textContent = "FriendlyTicker Pro";

  const p1 = document.createElement("p");
  p1.className = "panel__text";
  p1.innerHTML =
    "Unlock deeper signals, higher limits, and faster workflows. <strong>(Payments coming later)</strong>";

  const p2 = document.createElement("p");
  p2.className = "panel__text panel__text--muted";
  p2.textContent =
    "This page is a placeholder in Phase 2. Phase 3 adds the Pro toggle + waitlist capture.";

  intro.appendChild(h1);
  intro.appendChild(p1);
  intro.appendChild(p2);

  const card = document.createElement("section");
  card.className = "card";

  const header = document.createElement("header");
  header.className = "card__header";

  const title = document.createElement("h2");
  title.className = "card__title";
  title.textContent = "Coming soon";

  header.appendChild(title);

  const list = document.createElement("ul");
  list.className = "pro-list";

  const items = [
    "Alerts (email/SMS) when trend breaks",
    "More watchlist slots",
    "Faster multi-ticker analysis",
    "Advanced decay + context",
    "AI summaries (optional)",
  ];

  items.forEach((t) => {
    const li = document.createElement("li");
    li.className = "pro-list__item";
    li.textContent = t;
    list.appendChild(li);
  });

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "analyze-form__button";
  cta.textContent = "Upgrade (coming soon)";
  cta.disabled = true;

  card.appendChild(header);
  card.appendChild(list);
  card.appendChild(cta);

  el.appendChild(intro);
  el.appendChild(card);
}

/**
 * Render Alerts list into mountEl.
 * @param {HTMLElement} mountEl
 * @param {Array<{ticker: string, enabled: boolean}>} alerts
 * @param {{onToggle: Function, onRemove: Function}} handlers
 */
export function renderAlertsList(mountEl, alerts, { onToggle, onRemove } = {}) {
  if (!mountEl) return;

  mountEl.innerHTML = "";

  const list = Array.isArray(alerts) ? alerts.slice() : [];
  list.sort((a, b) => {
    const aEn = !!a?.enabled;
    const bEn = !!b?.enabled;
    if (aEn !== bEn) return aEn ? -1 : 1;
    const at = String(a?.ticker || "");
    const bt = String(b?.ticker || "");
    return at.localeCompare(bt);
  });

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "alerts-empty";
    empty.textContent = "No alerts yet.";
    mountEl.appendChild(empty);
    return;
  }

  const container = document.createElement("div");
  container.className = "alerts-list";

  list.forEach((a) => {
    const row = createAlertRow(
      { ticker: a?.ticker, enabled: !!a?.enabled },
      { onToggle, onRemove }
    );
    container.appendChild(row);
  });

  mountEl.appendChild(container);
}

function createAlertRow({ ticker, enabled }, { onToggle, onRemove } = {}) {
  const t = (ticker || "").toUpperCase();

  const row = document.createElement("div");
  row.className = "alert-row";
  if (!enabled) row.classList.add("alert-row--disabled");

  const left = document.createElement("div");
  left.className = "alert-row__left";

  const tickerEl = document.createElement("div");
  tickerEl.className = "alert-row__ticker";
  tickerEl.textContent = t;

  left.appendChild(tickerEl);

  const mid = document.createElement("div");
  mid.className = "alert-row__mid";

  const badge = document.createElement("div");
  badge.className = "alert-badge";
  badge.textContent = enabled ? "Enabled" : "Disabled";
  badge.classList.add(enabled ? "alert-badge--enabled" : "alert-badge--disabled");

  mid.appendChild(badge);

  const right = document.createElement("div");
  right.className = "alert-row__right";

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "alert-toggle";
  toggle.checked = !!enabled;

  toggle.addEventListener("change", () => {
    if (!t || typeof onToggle !== "function") return;
    onToggle(t, !!toggle.checked);
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "alert-remove-btn";
  removeBtn.textContent = "Remove";

  removeBtn.addEventListener("click", () => {
    if (!t || typeof onRemove !== "function") return;
    onRemove(t);
  });

  right.appendChild(toggle);
  right.appendChild(removeBtn);

  row.appendChild(left);
  row.appendChild(mid);
  row.appendChild(right);

  return row;
}

/* ==========================================================
   Phase 2.5 / Part 1: Alerts Preferences UI primitives
   (render-only, state is owned by app.js later)
   ========================================================== */

/**
 * Small "PRO" badge pill.
 * @returns {HTMLElement}
 */
export function ProBadge() {
  const el = document.createElement("span");
  el.className = "pro-badge";
  el.textContent = "PRO";
  return el;
}

/**
 * Disabled overlay wrapper (feature-gated look without UI forks).
 * @param {HTMLElement} child
 * @param {{message?: string}} opts
 * @returns {HTMLElement}
 */
export function DisabledOverlay(child, { message } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "disabled-overlay";

  const content = document.createElement("div");
  content.className = "disabled-overlay__content";
  if (child) content.appendChild(child);

  const veil = document.createElement("div");
  veil.className = "disabled-overlay__veil";
  veil.setAttribute("aria-hidden", "true");

  const lock = document.createElement("div");
  lock.className = "disabled-overlay__lock";
  lock.textContent = "🔒";

  veil.appendChild(lock);

  if (message) {
    const msg = document.createElement("div");
    msg.className = "disabled-overlay__message";
    msg.textContent = message;
    veil.appendChild(msg);
  }

  wrap.appendChild(content);
  wrap.appendChild(veil);
  return wrap;
}

/**
 * Segmented control (pill buttons).
 * @param {{options: string[], value: string, onChange: Function, disabled?: boolean}} props
 * @returns {HTMLElement}
 */
export function SegmentedControl({ options, value, onChange, disabled } = {}) {
  const opts = Array.isArray(options) ? options : [];
  const current = String(value || "");
  const root = document.createElement("div");
  root.className = "segmented-control";
  if (disabled) root.classList.add("segmented-control--disabled");

  opts.forEach((opt) => {
    const v = String(opt);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segmented-control__option";
    btn.textContent = v;
    btn.setAttribute("aria-pressed", String(v === current));
    if (v === current) btn.classList.add("is-active");
    if (disabled) btn.disabled = true;

    btn.addEventListener("click", () => {
      if (disabled) return;
      if (typeof onChange !== "function") return;
      onChange(v);
    });

    root.appendChild(btn);
  });

  return root;
}

/**
 * Toggle row (label/desc left, toggle/rightSlot right).
 * @param {{
 *  label: string,
 *  description?: string,
 *  value: boolean,
 *  disabled?: boolean,
 *  onChange?: Function,
 *  rightSlot?: HTMLElement | (()=>HTMLElement)
 * }} props
 * @returns {HTMLElement}
 */
export function ToggleRow({
  label,
  description,
  value,
  disabled,
  onChange,
  rightSlot,
} = {}) {
  const row = document.createElement("div");
  row.className = "toggle-row";
  if (disabled) row.classList.add("toggle-row--disabled");

  const left = document.createElement("div");
  left.className = "toggle-row__left";

  const title = document.createElement("div");
  title.className = "toggle-row__label";
  title.textContent = String(label || "");

  left.appendChild(title);

  if (description) {
    const desc = document.createElement("div");
    desc.className = "toggle-row__description";
    desc.textContent = String(description);
    left.appendChild(desc);
  }

  const right = document.createElement("div");
  right.className = "toggle-row__right";

  // checkbox switch (CSS can style it later)
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "toggle-row__switch";
  toggle.checked = !!value;
  toggle.disabled = !!disabled;

  toggle.addEventListener("change", () => {
    if (disabled) return;
    if (typeof onChange !== "function") return;
    onChange(!!toggle.checked);
  });

  right.appendChild(toggle);

  if (rightSlot) {
    const slotWrap = document.createElement("div");
    slotWrap.className = "toggle-row__slot";

    const node =
      typeof rightSlot === "function" ? rightSlot() : rightSlot;

    if (node) slotWrap.appendChild(node);
    right.appendChild(slotWrap);
  }

  row.appendChild(left);
  row.appendChild(right);

  return row;
}

/**
 * Alert preferences card (render-only).
 * @param {{
 *  ticker: string,
 *  prefs: any,
 *  flags?: { pro?: boolean, alertsEnabled?: boolean },
 *  onUpdate?: Function
 * }} props
 * @returns {HTMLElement}
 */
export function AlertPreferencesCard({ ticker, prefs, flags, onUpdate } = {}) {
  const t = String(ticker || "").toUpperCase();
  const p = prefs && typeof prefs === "object" ? prefs : {};
  const f = flags && typeof flags === "object" ? flags : {};

  // gating rule: show everything, disable if not Pro (or alerts not enabled)
  const pro = !!f.pro;
  const alertsEnabled = "alertsEnabled" in f ? !!f.alertsEnabled : true;
  const gated = !(pro && alertsEnabled);

  const card = document.createElement("section");
  card.className = "alert-card card";
  if (gated) card.classList.add("alert-card--gated");

  // Header
  const header = document.createElement("div");
  header.className = "alert-card__header";

  const left = document.createElement("div");
  left.className = "alert-card__left";

  const tickerEl = document.createElement("div");
  tickerEl.className = "alert-card__ticker";
  tickerEl.textContent = t;

  const sub = document.createElement("div");
  sub.className = "alert-card__sub";
  sub.textContent = "Alert preferences";

  left.appendChild(tickerEl);
  left.appendChild(sub);

  const right = document.createElement("div");
  right.className = "alert-card__right";

  if (!pro) {
    const badge = ProBadge();
    right.appendChild(badge);
  }

  const status = document.createElement("div");
  status.className = "alert-card__status";
  status.textContent = gated ? "Pro required" : "Active";
  right.appendChild(status);

  header.appendChild(left);
  header.appendChild(right);

  // Body
  const body = document.createElement("div");
  body.className = "alert-card__body";

  const safeUpdate = (nextPrefs) => {
    if (typeof onUpdate !== "function") return;
    if (!t) return;
    onUpdate(t, nextPrefs);
  };

  // Regime Shift
  body.appendChild(
    ToggleRow({
      label: "Regime shift",
      description: "Notify when trend regime flips (Uptrend/Sideways/Downtrend).",
      value: !!p.regimeShift,
      disabled: gated,
      onChange: (v) => {
        safeUpdate({ ...p, regimeShift: !!v });
      },
    })
  );

  // Trend Health Δ (1D) + sensitivity segmented
  const sensitivityValue =
    typeof p?.healthDelta?.sensitivity === "string"
      ? p.healthDelta.sensitivity
      : "med";

  const seg = SegmentedControl({
    options: ["Low", "Med", "High"],
    value:
      sensitivityValue.toLowerCase().startsWith("l")
        ? "Low"
        : sensitivityValue.toLowerCase().startsWith("h")
        ? "High"
        : "Med",
    disabled: gated || !p?.healthDelta?.enabled,
    onChange: (v) => {
      const mapped = String(v || "").toLowerCase();
      safeUpdate({
        ...p,
        healthDelta: {
          ...(p.healthDelta || {}),
          enabled: true,
          sensitivity: mapped === "low" ? "low" : mapped === "high" ? "high" : "med",
        },
      });
    },
  });

  body.appendChild(
    ToggleRow({
      label: "Trend Health delta (Δ 1D)",
      description: "Notify when Trend Health changes sharply day-over-day.",
      value: !!p?.healthDelta?.enabled,
      disabled: gated,
      onChange: (v) => {
        safeUpdate({
          ...p,
          healthDelta: {
            ...(p.healthDelta || {}),
            enabled: !!v,
            sensitivity: (p?.healthDelta?.sensitivity || "med"),
          },
        });
      },
      rightSlot: seg,
    })
  );

  // Trend Pressure (renamed from momentum change)
  body.appendChild(
    ToggleRow({
      label: "Trend Pressure increases",
      description: "Notify when pressure shifts (cooling / breaking down / improving).",
      value: !!p.trendPressure,
      disabled: gated,
      onChange: (v) => {
        safeUpdate({ ...p, trendPressure: !!v });
      },
    })
  );

  // Advanced (collapsed by default)
  const advanced = document.createElement("div");
  advanced.className = "alert-advanced";

  const advBtn = document.createElement("button");
  advBtn.type = "button";
  advBtn.className = "alert-advanced__toggle";
  advBtn.textContent = "Advanced";
  advBtn.setAttribute("aria-expanded", "false");

  const advPanel = document.createElement("div");
  advPanel.className = "alert-advanced__panel";
  advPanel.style.display = "none";

  advBtn.addEventListener("click", () => {
    const isOpen = advPanel.style.display !== "none";
    advPanel.style.display = isOpen ? "none" : "";
    advBtn.setAttribute("aria-expanded", String(!isOpen));
  });

  // Threshold toggle + inputs (hidden section)
  const thresholdsEnabled = !!p?.thresholds?.enabled;
  const belowVal =
    typeof p?.thresholds?.below === "number" ? p.thresholds.below : 60;
  const aboveVal =
    typeof p?.thresholds?.above === "number" ? p.thresholds.above : 75;

  const thresholdRow = ToggleRow({
    label: "Health thresholds",
    description: "Optional: alert when Trend Health crosses a level.",
    value: thresholdsEnabled,
    disabled: gated,
    onChange: (v) => {
      safeUpdate({
        ...p,
        thresholds: {
          ...(p.thresholds || {}),
          enabled: !!v,
          below: belowVal,
          above: aboveVal,
        },
      });
    },
  });

  const thresholdInputs = document.createElement("div");
  thresholdInputs.className = "alert-threshold-inputs";

  const belowWrap = document.createElement("label");
  belowWrap.className = "alert-threshold-input";

  const belowLbl = document.createElement("span");
  belowLbl.className = "alert-threshold-input__label";
  belowLbl.textContent = "Below";

  const below = document.createElement("input");
  below.type = "number";
  below.min = "0";
  below.max = "100";
  below.step = "1";
  below.className = "alert-threshold-input__field";
  below.value = String(belowVal);
  below.disabled = gated || !thresholdsEnabled;

  below.addEventListener("change", () => {
    const num = Number(below.value);
    if (!Number.isFinite(num)) return;
    safeUpdate({
      ...p,
      thresholds: {
        ...(p.thresholds || {}),
        enabled: !!p?.thresholds?.enabled,
        below: num,
        above: aboveVal,
      },
    });
  });

  belowWrap.appendChild(belowLbl);
  belowWrap.appendChild(below);

  const aboveWrap = document.createElement("label");
  aboveWrap.className = "alert-threshold-input";

  const aboveLbl = document.createElement("span");
  aboveLbl.className = "alert-threshold-input__label";
  aboveLbl.textContent = "Above";

  const above = document.createElement("input");
  above.type = "number";
  above.min = "0";
  above.max = "100";
  above.step = "1";
  above.className = "alert-threshold-input__field";
  above.value = String(aboveVal);
  above.disabled = gated || !thresholdsEnabled;

  above.addEventListener("change", () => {
    const num = Number(above.value);
    if (!Number.isFinite(num)) return;
    safeUpdate({
      ...p,
      thresholds: {
        ...(p.thresholds || {}),
        enabled: !!p?.thresholds?.enabled,
        below: belowVal,
        above: num,
      },
    });
  });

  aboveWrap.appendChild(aboveLbl);
  aboveWrap.appendChild(above);

  thresholdInputs.appendChild(belowWrap);
  thresholdInputs.appendChild(aboveWrap);

  advPanel.appendChild(thresholdRow);
  advPanel.appendChild(thresholdInputs);

  advanced.appendChild(advBtn);
  advanced.appendChild(advPanel);

  body.appendChild(advanced);

  // Footer CTA (only shown when gated)
  const footer = document.createElement("div");
  footer.className = "alert-card__footer";

  if (gated) {
    const note = document.createElement("div");
    note.className = "alert-card__note";
    note.textContent = !alertsEnabled
      ? "Alerts are coming soon."
      : "Alerts are Pro. Join the waitlist / upgrade to unlock.";

    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "alert-card__cta";
    cta.textContent = "Upgrade to Pro";
    cta.disabled = false;
    cta.id = "upgrade-btn-alerts";

    footer.appendChild(note);
    footer.appendChild(cta);
  }

  card.appendChild(header);
  card.appendChild(body);
  if (footer.childNodes.length) card.appendChild(footer);

  // Optional overlay styling hook (CSS will make this subtle)
  if (gated) {
    // keep interactive elements disabled via attributes; overlay is visual only
    card.setAttribute("data-gated", "1");
  }

  return card;
}

/**
 * FAQ content model (grouped sections).
 * Keep stable IDs so open/close state can be consistent.
 */
export const FAQ_SECTIONS = [
  {
    title: "Basics",
    items: [
      {
        id: "basics-what-is-friendlyticker",
        q: "What is FriendlyTicker?",
        a: "FriendlyTicker is a decision-support app that translates trend signals into plain English so you can make calmer, faster calls.",
        details:
          "You run an analysis on a ticker and we show the current trend regime plus a few “health” signals that help you interpret whether the move looks stable, weakening, or changing.",
        example:
          "Example: “Uptrend + high Trend Health + positive Daily Change” usually reads like “trend is intact and strengthening.”",
      },
      {
        id: "basics-problem",
        q: "What problem does it solve?",
        a: "It helps you spot trend strength and trend changes without needing to interpret a dozen indicators.",
        details:
          "Instead of watching charts all day, you get a quick read on: (1) what regime we’re in, (2) how healthy that regime looks, and (3) whether that health is improving or fading.",
        example:
          "Example: If price is flat but Trend Health drops, that can signal weakening before a breakdown becomes obvious.",
      },
      {
        id: "basics-not-advice",
        q: "Is this buy/sell advice?",
        a: "No — it’s educational decision-support, not financial advice.",
        details:
          "We’re summarizing signals from the model. You choose how (or whether) to act, and you should always consider risk, timeframe, and your own plan.",
        example:
          "Example: A strong uptrend can still be a bad entry if you’re chasing a spike or your risk is wrong.",
      },
    ],
  },
  {
    title: "Signals",
    items: [
      {
        id: "signals-trend-regime",
        q: "What is Trend Regime?",
        a: "A simple label for overall price behavior: Uptrend, Sideways, or Downtrend.",
        details:
          "Trend Regime is the model’s best read on the dominant structure of recent price action. It answers the question: what type of environment is this stock currently in?",
        example:
          "Example: Sideways means price is chopping in a range, not trending cleanly in either direction.",
      },
      {
        id: "signals-trend-health",
        q: "What is Trend Health (0–100)?",
        a: "A 0–100 score describing how intact and stable the current Trend Regime looks.",
        details:
          "Higher values mean the regime is clean and internally consistent. Lower values mean more noise, conflict, or early signs that the regime may be weakening or unstable.",
        example:
          "Example: Uptrend + Trend Health 82 suggests a strong, clean trend. Uptrend + 38 suggests the uptrend exists, but is fragile or choppy.",
      },
      {
        id: "signals-health-change",
        q: "Why does Daily Change in Trend Health matter?",
        a: "It shows whether trend health is improving or deteriorating since the last update.",
        details:
          "Trend damage often appears as a drop in health before the Trend Regime itself changes. A negative daily change can be early weakness; a positive change can signal strengthening.",
        example:
          "Example: Uptrend + Trend Health 70 but Daily Change −12 means the uptrend still exists, but it just weakened meaningfully.",
      },
      {
        id: "signals-trend-pressure",
        q: "What is Trend Pressure?",
        a: "A read on whether momentum is pushing the trend forward or working against it.",
        details:
          "Trend Pressure reflects whether buying or selling pressure is supporting the current regime, cooling off, or actively breaking it down. This value comes from backend signals only.",
        example:
          "Example: “Cooling” suggests momentum is fading. “Breaking down” suggests pressure is now working against the trend.",
      },
      {
        id: "signals-as-of",
        q: "How often does it update / what does “as of” mean?",
        a: "Signals update when you run an analysis. “As of” shows when the backend last computed them.",
        details:
          "If you don’t rerun analysis, you’re viewing the most recent snapshot — not live data. Alerts and Pro features handle background monitoring.",
        example:
          "Example: If the timestamp is from yesterday, rerun analysis to refresh the signals.",
      },
    ],
  },
  {
    title: "Alerts & Pro",
    items: [
      {
        id: "alerts-trigger",
        q: "What triggers alerts?",
        a: "Alerts trigger when a saved ticker hits the conditions you selected (evaluated by the backend).",
        details:
          "In Pro, the idea is: you choose what you care about (regime change, health dropping, momentum breakdown, etc.), and the scheduler checks those conditions without you needing to babysit the app.",
        example:
          "Example: “Alert me if Trend Regime flips to Downtrend” or “if Daily Change in Health drops below −10.”",
      },
      {
        id: "alerts-no-price-move",
        q: "Why did I get an alert if price didn’t move much?",
        a: "Because some alerts are driven by signal changes, not big visible price moves.",
        details:
          "Trend Health / momentum can deteriorate internally while price still looks quiet. That’s often the point of the alert — catching weakening early.",
        example:
          "Example: Price is flat, but Trend Health drops sharply → you get warned before the chart looks “bad.”",
      },
      {
        id: "pro-whats-in-it",
        q: "What’s in Pro?",
        a: "More watchlist slots, alerts, batch scans, and deeper context. Payments come later.",
        details:
          "Pro is focused on saving time: monitor more tickers, get notified instead of checking manually, and get richer explanations around what changed.",
        example:
          "Example: Instead of analyzing 20 tickers one-by-one, you run a batch scan and only drill into the ones that changed.",
      },
    ],
  },
];

/**
 * FAQ accordion (render-only).
 * @param {{sections: Array<{title: string, items: Array<{id: string, q: string, a: string, details?: string, example?: string}>}>}} props
 * @returns {HTMLElement}
 */
export function FaqAccordion({ sections }) {
  const wrapper = document.createElement("div");
  wrapper.className = "faq-accordion";

  let openId = null;

  function render() {
    wrapper.innerHTML = "";

    const list = Array.isArray(sections) ? sections : [];
    list.forEach((section) => {
      const h = document.createElement("h3");
      h.className = "faq-section-title";
      h.textContent = section?.title || "";
      wrapper.appendChild(h);

      const items = Array.isArray(section?.items) ? section.items : [];
      items.forEach((item) => {
        const id = String(item?.id || "");
        const isOpen = openId === id;

        const row = document.createElement("button");
        row.type = "button";
        row.className = "faq-row";
        row.setAttribute("aria-expanded", String(!!isOpen));
        row.setAttribute("aria-controls", `faq-panel-${id}`);
        row.innerHTML = `
          <span class="faq-q">${item?.q || ""}</span>
          <span class="faq-chevron ${isOpen ? "open" : ""}">›</span>
        `;

        row.addEventListener("click", () => {
          openId = isOpen ? null : id; // one open at a time
          render();
        });

        const panel = document.createElement("div");
        panel.className = `faq-panel ${isOpen ? "open" : ""}`;
        panel.id = `faq-panel-${id}`;

        const a = document.createElement("div");
        a.className = "faq-a";
        a.innerHTML = `
          <div class="faq-a-main">${item?.a || ""}</div>
          ${item?.details ? `<div class="faq-a-details">${item.details}</div>` : ""}
          ${item?.example ? `<div class="faq-a-example">${item.example}</div>` : ""}
        `;

        panel.appendChild(a);

        wrapper.appendChild(row);
        wrapper.appendChild(panel);
      });
    });
  }

  render();
  return wrapper;
}

/**
 * Render FAQ content into #faq-view.
 */
export function renderFaqView() {
  const el = document.getElementById("faq-view");
  if (!el) return;

  el.innerHTML = "";

  const intro = document.createElement("section");
  intro.className = "panel panel--intro";

  const h1 = document.createElement("h1");
  h1.className = "panel__title";
  h1.textContent = "FAQ";

  const p = document.createElement("p");
  p.className = "panel__text panel__text--muted";
  p.textContent = "Quick answers about what the signals mean.";

  intro.appendChild(h1);
  intro.appendChild(p);

  const card = document.createElement("section");
  card.className = "card";

  card.appendChild(FaqAccordion({ sections: FAQ_SECTIONS }));

  el.appendChild(intro);
  el.appendChild(card);
}

/**
 * Render Contact content into #contact-view.
 */
export function renderContactView() {
  const el = document.getElementById("contact-view");
  if (!el) return;

  el.innerHTML = "";

  const intro = document.createElement("section");
  intro.className = "panel panel--intro";

  const h1 = document.createElement("h1");
  h1.className = "panel__title";
  h1.textContent = "Contact";

  const p = document.createElement("p");
  p.className = "panel__text panel__text--muted";
  p.textContent = "Questions, feedback, or feature requests?";

  intro.appendChild(h1);
  intro.appendChild(p);

  const card = document.createElement("section");
  card.className = "card";

  const msg = document.createElement("p");
  msg.className = "panel__text";
  msg.textContent =
    "We’d love to hear what you want next—bugs, feature ideas, or anything confusing.";

  const actions = document.createElement("div");
  actions.className = "contact-actions";

  const email = "friendlyticker@gmail.com";

  const mailBtn = document.createElement("a");
  mailBtn.className = "analyze-form__button";
  mailBtn.href = "mailto:friendlyticker@gmail.com?subject=FriendlyTicker%20Feedback";
  mailBtn.textContent = "Email FriendlyTicker";

  const emailText = document.createElement("div");
  emailText.className = "panel__text panel__text--muted";
  emailText.textContent = email;

  actions.appendChild(mailBtn);

  card.appendChild(msg);
  card.appendChild(actions);
  card.appendChild(emailText);

  el.appendChild(intro);
  el.appendChild(card);
}

/**
 * Create a result card for the Analyze view.
 * @param {Object} result - Analysis result from /api/analyze.
 * @param {Function} onAddToWatchlist - Callback(ticker) to add ticker to watchlist.
 * @returns {HTMLElement}
 */
export function createResultCard(result, onAddToWatchlist) {
  const ticker = (result?.ticker || "").toUpperCase();
  const companyName = result?.company_name || "—";

  // V2 backend shape preferred: result.signals.{regime,trend_score,delta_1d,momentum_decay}
  const regime =
    typeof result?.signals?.regime === "string"
      ? result.signals.regime
      : result?.momentum?.label || "—";

  const score =
    typeof result?.signals?.trend_score === "number"
      ? result.signals.trend_score
      : typeof result?.momentum?.score === "number"
      ? result.momentum.score
      : null;

  const delta =
    typeof result?.signals?.delta_1d === "number"
      ? result.signals.delta_1d
      : typeof result?.momentum?.delta_since_close === "number"
      ? result.momentum.delta_since_close
      : null;

  // ✅ Phase 2 rule: read decay from backend ONLY
  const decayLabel =
    typeof result?.momentum?.momentum_decay === "string"
      ? result.momentum.momentum_decay
      : typeof result?.signals?.momentum_decay === "string" &&
        result.signals.momentum_decay !== "None"
      ? result.signals.momentum_decay
      : "Stable";

  const summary =
    result?.summary ||
    "We couldn't generate a full summary yet, but the current regime is shown above.";

  const card = document.createElement("div");
  card.className = "result-card";

  // Header
  const header = document.createElement("div");
  header.className = "result-card__header";

  const left = document.createElement("div");

  const tickerEl = document.createElement("div");
  tickerEl.className = "result-card__ticker";
  tickerEl.textContent = ticker;

  const companyEl = document.createElement("div");
  companyEl.className = "result-card__company";
  companyEl.textContent = companyName;

  left.appendChild(tickerEl);
  // ✅ Task 1: remove duplicate ticker line on card (keep big ticker only)
  // (company_name sometimes equals ticker which created the "double ticker" look)
  // left.appendChild(companyEl);

  const right = document.createElement("div");
  const pill = document.createElement("div");
  pill.className = "result-card__pill";
  pill.textContent = `Regime: ${regime}`;

  const normalized = String(regime).toLowerCase();
  if (normalized.includes("uptrend")) {
    pill.classList.add("momentum--uptrend");
  } else if (normalized.includes("downtrend")) {
    pill.classList.add("momentum--downtrend");
  } else if (normalized.includes("sideways")) {
    pill.classList.add("momentum--sideways");
  }

  right.appendChild(pill);

  header.appendChild(left);
  header.appendChild(right);

  // Score row (primary)
  const scoreEl = document.createElement("div");
  scoreEl.className = "result-card__score";
  if (score !== null) {
    // ✅ Task 1: rename label (UI-only)
    scoreEl.textContent = `Trend Health: ${score}/100`;
  }

  // Delta row
  let deltaEl = null;
  if (delta !== null) {
    deltaEl = document.createElement("div");
    deltaEl.className = "result-card__delta";
    // ✅ Task 1: rename label (UI-only)
    deltaEl.textContent = `Daily Change in Health: ${delta}`;
  }

  // Trend Pressure (backend-owned)
  const decayEl = document.createElement("div");
  decayEl.className = "result-card__decay";
  decayEl.textContent = `Trend Pressure: ${decayLabel}`;

  // ✅ Task 1: group change signals (Daily Change + Trend Pressure)
  const changeWrap = document.createElement("div");
  changeWrap.className = "result-card__change-signals";

  const changeTitle = document.createElement("div");
  changeTitle.className = "result-card__change-title";
  changeTitle.textContent = "Change Signals";

  changeWrap.appendChild(changeTitle);
  if (deltaEl) changeWrap.appendChild(deltaEl);
  changeWrap.appendChild(decayEl);

  // Summary
  const summaryEl = document.createElement("p");
  summaryEl.className = "result-card__summary";
  summaryEl.textContent = summary;

  // Actions
  const actions = document.createElement("div");
  actions.className = "result-card__actions";

  const watchlistBtn = document.createElement("button");
  watchlistBtn.type = "button";
  watchlistBtn.className = "result-card__watchlist-btn";
  watchlistBtn.textContent = "Add to watchlist";

  watchlistBtn.addEventListener("click", () => {
    if (!ticker || typeof onAddToWatchlist !== "function") return;
    onAddToWatchlist(ticker);
  });

  actions.appendChild(watchlistBtn);

  const alertsBtn = document.createElement("button");
  alertsBtn.type = "button";
  alertsBtn.className = "result-card__watchlist-btn";
  alertsBtn.textContent = "Enable alerts (Pro)";
  alertsBtn.disabled = false;

  actions.appendChild(alertsBtn);

  // Phase 3: Upgrade to Pro entry point (analyze page)
  const upgradeBtn = document.createElement("button");
  upgradeBtn.type = "button";
  upgradeBtn.id = "upgrade-btn-analyze";
  upgradeBtn.className = "result-card__watchlist-btn";
  upgradeBtn.textContent = "Upgrade to Pro";

  actions.appendChild(upgradeBtn);

  // ✅ Task 1: reorder sections for scan-first hierarchy
  card.appendChild(header);
  if (score !== null) card.appendChild(scoreEl);
  card.appendChild(changeWrap);
  card.appendChild(summaryEl);
  card.appendChild(actions);

  return card;
}

/**
 * Create a single watchlist item row/card.
 */
export function createWatchlistItem(item, onRemove) {
  const ticker = (item?.ticker || "").toUpperCase();

  const label =
    typeof item?.signals?.regime === "string"
      ? item.signals.regime
      : item?.momentum?.label || "—";

  const summary =
    item?.summary || "Saved ticker. Analyze again to refresh its summary.";

  const score =
    typeof item?.signals?.trend_score === "number"
      ? item.signals.trend_score
      : typeof item?.momentum?.score === "number"
      ? item.momentum.score
      : null;

  const delta =
    typeof item?.signals?.delta_1d === "number"
      ? item.signals.delta_1d
      : typeof item?.momentum?.delta_since_close === "number"
      ? item.momentum.delta_since_close
      : null;

  const row = document.createElement("div");
  row.className = "watchlist-item";

  const left = document.createElement("div");
  left.className = "watchlist-item__left";

  const tickerEl = document.createElement("div");
  tickerEl.className = "watchlist-item__ticker";
  tickerEl.textContent = ticker;

  left.appendChild(tickerEl);

  if (score !== null) {
    const scoreLine = document.createElement("div");
    scoreLine.className = "watchlist-item__snippet";
    scoreLine.textContent = `Trend Health: ${score}/100`;
    left.appendChild(scoreLine);
  }

  if (delta !== null) {
    const deltaLine = document.createElement("div");
    deltaLine.className = "watchlist-item__snippet";
    deltaLine.textContent = `Daily Change in Health: ${delta}`;
    left.appendChild(deltaLine);
  }

  const snippetEl = document.createElement("div");
  snippetEl.className = "watchlist-item__snippet";
  snippetEl.textContent = truncateText(summary, 140);

  left.appendChild(snippetEl);

  const right = document.createElement("div");
  right.className = "watchlist-item__right";

  const pill = document.createElement("div");
  pill.className = "watchlist-item__momentum-pill";
  pill.textContent = label;

  const normalizedLabel = String(label).toLowerCase();
  if (normalizedLabel.includes("uptrend")) {
    pill.classList.add("momentum--uptrend");
  } else if (normalizedLabel.includes("downtrend")) {
    pill.classList.add("momentum--downtrend");
  } else if (normalizedLabel.includes("sideways")) {
    pill.classList.add("momentum--sideways");
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "watchlist-item__remove-btn";
  removeBtn.textContent = "Remove";

  removeBtn.addEventListener("click", () => {
    if (!ticker || typeof onRemove !== "function") return;
    onRemove(ticker);
  });

  right.appendChild(pill);
  right.appendChild(removeBtn);

  row.appendChild(left);
  row.appendChild(right);

  return row;
}

/**
 * Phase 3: Render-only Pro modal (no fetch, no payments).
 */
export function showProModal() {
  let overlay = document.getElementById("pro-modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pro-modal-overlay";
    overlay.className = "pro-modal__overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.background = "rgba(0,0,0,0.55)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const modal = document.createElement("div");
    modal.id = "pro-modal";
    modal.className = "pro-modal";
    modal.style.maxHeight = "90vh";
    modal.style.overflowY = "auto";

    const header = document.createElement("div");
    header.className = "pro-modal__header";

    const title = document.createElement("div");
    title.className = "pro-modal__title";
    title.textContent = "Upgrade to Pro";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.id = "pro-modal-close";
    closeBtn.className = "pro-modal__close";
    closeBtn.textContent = "×";

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "pro-modal__body";

    const blurb = document.createElement("p");
    blurb.className = "pro-modal__blurb";
    blurb.textContent =
      "Pro is coming soon. Join the waitlist to get early access.";

    const list = document.createElement("ul");
    list.className = "pro-modal__list";

    const items = [
      "More watchlist slots",
      "Batch scans",
      "Alerts",
      "Advanced decay + context",
      "AI summaries (optional)",
    ];

    items.forEach((t) => {
      const li = document.createElement("li");
      li.className = "pro-modal__item";
      li.textContent = t;
      list.appendChild(li);
    });

    const form = document.createElement("div");
    form.className = "pro-modal__form";

    const email = document.createElement("input");
    email.type = "email";
    email.id = "pro-waitlist-email";
    email.className = "pro-modal__input";
    email.placeholder = "Email (optional)";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.id = "pro-waitlist-submit";
    submit.className = "pro-modal__submit";
    submit.textContent = "Join waitlist";

    const status = document.createElement("div");
    status.id = "pro-waitlist-status";
    status.className = "pro-modal__status";
    status.textContent = "";

    form.appendChild(email);
    form.appendChild(submit);

    body.appendChild(blurb);
    body.appendChild(list);
    body.appendChild(form);
    body.appendChild(status);

    modal.appendChild(header);
    modal.appendChild(body);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  overlay.style.display = "flex";
}

export function hideProModal() {
  const overlay = document.getElementById("pro-modal-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
}

/* ========= Small Utility ========= */
function truncateText(text, maxLength) {
  if (!text || typeof text !== "string") return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}

/* ========= Phase 4: Watchlist lock UI (render-only) ========= */
const FREE_WATCHLIST_LIMIT = 3;

function _updateWatchlistLockUI() {
  const list = document.getElementById("watchlist-list");
  if (!list) return;

  const watchlistView = document.getElementById("watchlist-view");
  if (!watchlistView) return;

  const isLocked = list.children.length >= FREE_WATCHLIST_LIMIT;

  let hint = document.getElementById("watchlist-lock-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "watchlist-lock-hint";
    hint.className = "watchlist-lock-hint";
    hint.textContent = "Pro required to add more than 3 tickers to your watchlist.";

    const small = document.createElement("span");
    small.className = "watchlist-lock-hint__small";
    small.textContent = "Upgrade to unlock more watchlist slots.";
    hint.appendChild(small);

    if (watchlistView.firstChild) {
      watchlistView.insertBefore(hint, watchlistView.firstChild);
    } else {
      watchlistView.appendChild(hint);
    }
  }

  hint.style.display = isLocked ? "" : "none";

  const addBtn =
    watchlistView.querySelector("#watchlist-add-btn") ||
    watchlistView.querySelector(".watchlist-add-btn") ||
    null;

  if (addBtn && addBtn.classList) {
    addBtn.classList.toggle("watchlist-add-btn--locked", isLocked);
    if ("disabled" in addBtn) addBtn.disabled = !!isLocked;
  }
}

function _wireWatchlistLockObserver() {
  const list = document.getElementById("watchlist-list");
  if (!list) return;

  _updateWatchlistLockUI();

  if (list.dataset.lockObserverWired) return;
  list.dataset.lockObserverWired = "1";

  const obs = new MutationObserver(() => {
    _updateWatchlistLockUI();
  });

  obs.observe(list, { childList: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _wireWatchlistLockObserver);
} else {
  _wireWatchlistLockObserver();
}

export function Hero() {
  const section = document.createElement("section");
  section.className = "hero";

  section.innerHTML = `
    <h1>Know When a Stock’s Trend Is Still Worth Trading</h1>
    <p>
      FriendlyTicker turns price action into a clear direction, a simple health score,
      and a quick momentum read — so you know when to stay in or step aside.
    </p>

    <div class="heroPoints">
      <div class="heroPoint">
        <div class="heroPointTitle">Direction</div>
        <div class="heroPointBody">Uptrend · Sideways · Downtrend</div>
      </div>

      <div class="heroPoint">
        <div class="heroPointTitle">Trend Health (0–100)</div>
        <div class="heroPointBody">How intact the trend still is</div>
      </div>

      <div class="heroPoint">
        <div class="heroPointTitle">Momentum</div>
        <div class="heroPointBody">Strength building or fading</div>
      </div>
    </div>
  `;

  return section;
}
