const STORAGE_KEY = "imposter.browser.state.v1";

const DEFAULT_THEMES = [
  {
    id: "theme-alltag",
    title: "Alltag",
    words: ["Schlüssel", "Kaffee", "Fahrrad", "Supermarkt", "Küche", "Handy", "Bahnhof", "Schule"]
  },
  {
    id: "theme-essen",
    title: "Essen",
    words: ["Pizza", "Sushi", "Burger", "Schokolade", "Pasta", "Salat", "Pfannkuchen", "Curry"]
  },
  {
    id: "theme-reisen",
    title: "Reisen",
    words: ["Strand", "Flughafen", "Hotel", "Koffer", "Pass", "Berg", "Taxi", "Museum"]
  },
  {
    id: "theme-sport",
    title: "Sport",
    words: ["Fußball", "Tennis", "Basketball", "Skifahren", "Yoga", "Schwimmen", "Boxen", "Radrennen"]
  },
  {
    id: "theme-filme",
    title: "Filme",
    words: ["Popcorn", "Kamera", "Regisseur", "Trailer", "Oscar", "Kino", "Drehbuch", "Premiere"]
  }
];

const DEFAULT_PLAYERS = [
  { id: createId(), name: "Spieler 1" },
  { id: createId(), name: "Spieler 2" },
  { id: createId(), name: "Spieler 3" }
];

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

let state = loadState();
let timerId = null;
let toastId = null;
let dragStartY = null;
let activeDragCard = null;

applyAppearance();
render();
registerServiceWorker();

app.addEventListener("input", handleInput);
app.addEventListener("change", handleChange);
app.addEventListener("click", handleClick);
app.addEventListener("pointerdown", handlePointerDown);
app.addEventListener("pointermove", handlePointerMove);
app.addEventListener("pointerup", handlePointerUp);
app.addEventListener("pointercancel", handlePointerUp);

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  const fallback = {
    players: DEFAULT_PLAYERS,
    themes: DEFAULT_THEMES,
    selectedThemeId: DEFAULT_THEMES[0].id,
    imposterCount: 1,
    hintsEnabled: false,
    durationSeconds: 180,
    phase: "menu",
    round: null,
    revealIndex: 0,
    cardVisible: false,
    remainingSeconds: 180,
    timerRunning: false,
    appearance: "dark",
    error: ""
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) {
      return fallback;
    }

    return normalizeState({
      ...fallback,
      ...saved,
      phase: "menu",
      round: null,
      revealIndex: 0,
      cardVisible: false,
      remainingSeconds: saved.durationSeconds || fallback.durationSeconds,
      timerRunning: false,
      error: ""
    });
  } catch {
    return fallback;
  }
}

function normalizeState(nextState = state) {
  nextState.players = Array.isArray(nextState.players) && nextState.players.length
    ? nextState.players.map((player) => ({
      id: player.id || createId(),
      name: typeof player.name === "string" ? player.name : ""
    }))
    : DEFAULT_PLAYERS;

  nextState.themes = Array.isArray(nextState.themes) && nextState.themes.length
    ? nextState.themes.map((theme) => ({
      id: theme.id || createId(),
      title: cleanText(theme.title) || "Thema",
      words: Array.isArray(theme.words) ? theme.words.map(cleanText).filter(Boolean) : []
    }))
    : DEFAULT_THEMES;

  if (!nextState.themes.some((theme) => theme.id === nextState.selectedThemeId)) {
    nextState.selectedThemeId = nextState.themes[0].id;
  }

  const playerCount = getNamedPlayers(nextState).length;
  const maxImposters = Math.max(1, playerCount - 1);
  nextState.imposterCount = clamp(Number(nextState.imposterCount) || 1, 1, maxImposters);
  nextState.durationSeconds = clamp(Number(nextState.durationSeconds) || 180, 30, 1800);
  nextState.hintsEnabled = Boolean(nextState.hintsEnabled);
  nextState.appearance = nextState.appearance === "light" ? "light" : "dark";
  return nextState;
}

function saveSetup() {
  const setupState = {
    players: state.players,
    themes: state.themes,
    selectedThemeId: state.selectedThemeId,
    imposterCount: state.imposterCount,
    hintsEnabled: state.hintsEnabled,
    durationSeconds: state.durationSeconds,
    appearance: state.appearance
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setupState));
  } catch {
    showToast("Speichern im Browser ist gerade nicht möglich.");
  }
}

function render() {
  clearInterval(timerId);
  timerId = null;
  applyAppearance();

  if (state.phase === "menu") {
    app.innerHTML = renderMenu();
  }

  if (state.phase === "setup") {
    app.innerHTML = renderSetup();
  }

  if (state.phase === "reveal") {
    app.innerHTML = renderReveal();
  }

  if (state.phase === "timer") {
    app.innerHTML = renderTimer();
    if (state.timerRunning) {
      startTimer();
    }
  }

  if (state.phase === "results") {
    app.innerHTML = renderResults();
  }

  if (state.phase === "rules") {
    app.innerHTML = renderRules();
  }
}

function renderMenu() {
  const players = getNamedPlayers();
  const theme = getSelectedTheme();

  return `
    <section class="menu-screen" data-screen="menu">
      <header class="menu-hero">
        <img class="menu-mask" src="./assets/imposter-mask.svg" alt="">
        <p class="eyebrow">Pop-Art Partyspiel</p>
        <h1>Imposter</h1>
        <div class="comic-burst" aria-hidden="true">POW!</div>
      </header>

      <nav class="main-menu" aria-label="Hauptmenü">
        <button class="menu-action primary-pop" type="button" data-action="open-setup">
          ${icon("play")} Spiel starten
        </button>
        <button class="menu-action hot-pop" type="button" data-action="quick-start" ${validateSetup() ? "disabled" : ""}>
          ${icon("spark")} Schnellstart
        </button>
        <button class="menu-action" type="button" data-action="open-rules">
          ${icon("book")} Regeln
        </button>
        ${renderThemeButton()}
      </nav>

      <section class="menu-strip panel">
        <span>${players.length} Spieler</span>
        <span>${escapeHtml(theme.title)}</span>
        <span>${state.imposterCount} Imposter</span>
      </section>
    </section>
  `;
}

function renderSetup() {
  const theme = getSelectedTheme();
  const playerCount = getNamedPlayers().length;
  const maxImposters = Math.max(1, playerCount - 1);

  return `
    <section class="screen" data-screen="setup">
      <header class="topbar">
        <div class="brand">
          <img class="brand-mark" src="./assets/imposter-mask.svg" alt="">
          <div>
            <p class="eyebrow">Spiel-Setup</p>
            <h1>Imposter</h1>
          </div>
        </div>
        <div class="top-actions">
          <button class="theme-toggle" type="button" data-action="back-menu" aria-label="Hauptmenü" title="Hauptmenü">
            ${icon("home")}
            <span>Menü</span>
          </button>
          ${renderThemeButton()}
          <div class="phase-pill">Setup</div>
        </div>
      </header>

      ${state.error ? renderError(state.error) : ""}

      <div class="setup-grid">
        ${renderPanel("Spieler", "users", `
          <div class="stack" data-player-list>
            ${state.players.map(renderPlayerRow).join("")}
          </div>
          <button class="button ghost" type="button" data-action="add-player">
            ${icon("plus")} Spieler hinzufügen
          </button>
        `)}

        ${renderPanel("Runde", "sliders", `
          <label class="stack">
            <span class="small muted">Thema</span>
            <select class="field" data-setting="theme">
              ${state.themes.map((item) => `
                <option value="${escapeHtml(item.id)}" ${item.id === state.selectedThemeId ? "selected" : ""}>
                  ${escapeHtml(item.title)}
                </option>
              `).join("")}
            </select>
          </label>

          <div class="setting">
            <div class="setting-label">
              <span>Imposter</span>
              <span class="setting-value" data-imposter-value>${state.imposterCount}</span>
            </div>
            <input type="range" min="1" max="${maxImposters}" value="${state.imposterCount}" data-setting="imposters">
          </div>

          <div class="setting">
            <div class="setting-label">
              <span>Rundenzeit</span>
              <span class="setting-value" data-duration-value>${formatTime(state.durationSeconds)}</span>
            </div>
            <input type="range" min="30" max="1800" step="30" value="${state.durationSeconds}" data-setting="duration">
          </div>

          <label class="switch setting">
            <span>
              <strong>Hinweis für Imposter</strong>
              <span class="small muted">Thema als Spur</span>
            </span>
            <input type="checkbox" data-setting="hints" ${state.hintsEnabled ? "checked" : ""}>
          </label>
        `)}

        ${renderPanel("Themen & Wörter", "book", `
          <div class="input-line">
            <input class="field" type="text" placeholder="Neues Thema" autocomplete="off" data-new-theme>
            <button class="button ghost icon-only" type="button" title="Thema hinzufügen" aria-label="Thema hinzufügen" data-action="add-theme">
              ${icon("plus")}
            </button>
          </div>

          <div class="word-list" aria-label="Themen">
            ${state.themes.map((item) => `
              <button class="chip ${item.id === state.selectedThemeId ? "active" : ""}" type="button" data-action="select-theme" data-theme-id="${escapeHtml(item.id)}">
                ${escapeHtml(item.title)}
              </button>
            `).join("")}
          </div>

          <div class="row spread">
            <div>
              <h3>${escapeHtml(theme.title)}</h3>
              <p class="small muted">${theme.words.length} Wörter</p>
            </div>
            <button class="button ghost icon-only" type="button" title="Thema löschen" aria-label="Thema löschen" data-action="delete-theme" ${state.themes.length <= 1 ? "disabled" : ""}>
              ${icon("trash")}
            </button>
          </div>

          <div class="input-line">
            <input class="field" type="text" placeholder="Neues Wort" autocomplete="off" data-new-word>
            <button class="button ghost icon-only" type="button" title="Wort hinzufügen" aria-label="Wort hinzufügen" data-action="add-word">
              ${icon("plus")}
            </button>
          </div>

          <div class="stack">
            ${theme.words.length ? theme.words.map((word) => renderWordRow(theme.id, word)).join("") : `
              <p class="muted small">Noch keine Wörter in diesem Thema.</p>
            `}
          </div>
        `, "wide")}
      </div>

      <button class="button primary" type="button" data-action="start-round">
        ${icon("play")} Runde starten
      </button>
    </section>
  `;
}

function renderPlayerRow(player) {
  return `
    <div class="player-row">
      <input class="field" type="text" value="${escapeHtml(player.name)}" placeholder="Name" autocomplete="off" data-player-name data-player-id="${escapeHtml(player.id)}">
      <button class="button ghost icon-only" type="button" title="Spieler entfernen" aria-label="Spieler entfernen" data-action="remove-player" data-player-id="${escapeHtml(player.id)}">
        ${icon("minus")}
      </button>
    </div>
  `;
}

function renderWordRow(themeId, word) {
  return `
    <div class="word-row">
      <span class="chip">${escapeHtml(word)}</span>
      <button class="button ghost icon-only" type="button" title="Wort entfernen" aria-label="Wort entfernen" data-action="delete-word" data-theme-id="${escapeHtml(themeId)}" data-word="${escapeHtml(word)}">
        ${icon("minus")}
      </button>
    </div>
  `;
}

function renderReveal() {
  const card = state.round.cards[state.revealIndex];
  const roleClass = card.role === "imposter" ? "imposter" : "civilian";
  const revealClass = state.cardVisible ? "revealed" : "covered";

  return `
    <section class="reveal-stage" data-screen="reveal">
      <header class="topbar">
        <div>
          <p class="eyebrow">Karte ${state.revealIndex + 1} von ${state.round.cards.length}</p>
          <h2>${escapeHtml(card.player.name)}</h2>
        </div>
        <div class="top-actions">
          <button class="theme-toggle" type="button" data-action="back-menu" aria-label="Hauptmenü" title="Hauptmenü">
            ${icon("home")}
            <span>Menü</span>
          </button>
          ${renderThemeButton()}
          <div class="phase-pill">Privat</div>
        </div>
      </header>

      <div class="center">
        <article class="secret-card ${roleClass} ${revealClass}" data-reveal-card>
          <div class="card-reveal-layer ${roleClass}" aria-hidden="${state.cardVisible ? "false" : "true"}">
            <div class="card-content">
              ${renderVisibleCard(card)}
            </div>
          </div>
          <div class="card-cover" data-card-cover>
            <div class="card-content">
              ${renderHiddenCard(card)}
            </div>
          </div>
        </article>
      </div>

      <div class="stack">
        ${state.cardVisible ? `
          <button class="button primary" type="button" data-action="next-card">
            ${icon("check")} Verstanden
          </button>
        ` : `
          <button class="button primary" type="button" data-action="reveal-card">
            ${icon("arrow-up")} Karte hochziehen
          </button>
        `}
      </div>
    </section>
  `;
}

function renderHiddenCard(card) {
  return `
    ${icon("lock", "card-symbol")}
    <div>
      <p class="role-title">Hochziehen</p>
      <p class="muted">Nur ${escapeHtml(card.player.name)} schaut.</p>
    </div>
  `;
}

function renderVisibleCard(card) {
  if (card.role === "imposter") {
    return `
      ${icon("mask", "card-symbol")}
      <p class="eyebrow">Rolle</p>
      <p class="role-title imposter">Imposter</p>
      <p class="muted">${card.hint ? `Hinweis: ${escapeHtml(card.hint)}` : "Kein Hinweis"}</p>
    `;
  }

  return `
    ${icon("seal", "card-symbol")}
    <p class="eyebrow">Geheimes Wort</p>
    <p class="role-title word">${escapeHtml(card.word)}</p>
  `;
}

function renderTimer() {
  const progress = timerProgress();

  return `
    <section class="timer-screen" data-screen="timer">
      <header class="topbar">
        <div>
          <p class="eyebrow">Startspieler</p>
          <h2 class="hero-name">${escapeHtml(state.round.firstSpeaker.name)}</h2>
        </div>
        <div class="top-actions">
          <button class="theme-toggle" type="button" data-action="back-menu" aria-label="Hauptmenü" title="Hauptmenü">
            ${icon("home")}
            <span>Menü</span>
          </button>
          ${renderThemeButton()}
          <div class="phase-pill">Runde</div>
        </div>
      </header>

      <div class="timer-dial" data-timer-dial style="--progress: ${progress}%">
        <div class="timer-inner">
          <span class="time" data-time>${formatTime(state.remainingSeconds)}</span>
          <span class="muted" data-timer-state>${state.timerRunning ? "läuft" : "pausiert"}</span>
        </div>
      </div>

      <div class="button-row">
        <button class="button ghost" type="button" data-action="toggle-timer">
          ${state.timerRunning ? icon("pause") : icon("play")} ${state.timerRunning ? "Pause" : "Weiter"}
        </button>
        <button class="button coral" type="button" data-action="show-results">
          ${icon("eye")} Aufdecken
        </button>
      </div>

      ${renderPanel("Reihenfolge", "order", `
        <div class="chip-list">
          ${state.round.speakingOrder.map((player) => `
            <span class="chip ${player.id === state.round.firstSpeaker.id ? "active" : ""}">
              ${escapeHtml(player.name)}
            </span>
          `).join("")}
        </div>
      `)}
    </section>
  `;
}

function renderResults() {
  return `
    <section class="screen" data-screen="results">
      <div class="floating-actions">
        <button class="theme-toggle" type="button" data-action="back-menu" aria-label="Hauptmenü" title="Hauptmenü">
          ${icon("home")}
          <span>Menü</span>
        </button>
        ${renderThemeButton()}
      </div>
      <header class="hero-center">
        <img class="result-mask" src="./assets/imposter-mask.svg" alt="">
        <p class="eyebrow">Auflösung</p>
        <h1>${escapeHtml(state.round.secretWord)}</h1>
      </header>

      ${renderPanel("Imposter", "mask", `
        <div class="stack">
          ${state.round.imposters.map((player) => `
            <div class="chip active">${escapeHtml(player.name)}</div>
          `).join("")}
        </div>
      `)}

      ${renderPanel("Start & Reihenfolge", "order", `
        <div class="chip-list">
          ${state.round.speakingOrder.map((player) => `
            <span class="chip ${player.id === state.round.firstSpeaker.id ? "active" : ""}">
              ${escapeHtml(player.name)}
            </span>
          `).join("")}
        </div>
      `)}

      <div class="button-row">
        <button class="button primary" type="button" data-action="new-round">
          ${icon("refresh")} Neue Runde
        </button>
        <button class="button ghost" type="button" data-action="back-setup">
          ${icon("sliders")} Setup
        </button>
      </div>
    </section>
  `;
}

function renderRules() {
  return `
    <section class="screen" data-screen="rules">
      <header class="topbar">
        <div class="brand">
          <img class="brand-mark" src="./assets/imposter-mask.svg" alt="">
          <div>
            <p class="eyebrow">Comic Code</p>
            <h1>Regeln</h1>
          </div>
        </div>
        <div class="top-actions">
          <button class="theme-toggle" type="button" data-action="back-menu" aria-label="Hauptmenü" title="Hauptmenü">
            ${icon("home")}
            <span>Menü</span>
          </button>
          ${renderThemeButton()}
        </div>
      </header>

      ${renderPanel("So läuft die Runde", "book", `
        <ol class="rule-list">
          <li>Alle Spieler schauen ihre Karte nur für sich selbst an.</li>
          <li>Normale Spieler sehen das geheime Wort.</li>
          <li>Imposter sehen ihre Rolle und optional einen Hinweis.</li>
          <li>Der zufällige Startspieler beginnt mit einem passenden Begriff.</li>
          <li>Wenn der Timer endet, werden Wort und Imposter aufgedeckt.</li>
        </ol>
      `)}

      <div class="button-row">
        <button class="button primary" type="button" data-action="open-setup">
          ${icon("play")} Spiel starten
        </button>
        <button class="button ghost" type="button" data-action="back-menu">
          ${icon("home")} Hauptmenü
        </button>
      </div>
    </section>
  `;
}

function renderPanel(title, iconName, content, extraClass = "") {
  return `
    <section class="panel section ${extraClass}">
      <div class="section-head">
        <h2 class="section-title">${icon(iconName)} ${escapeHtml(title)}</h2>
      </div>
      ${content}
    </section>
  `;
}

function renderThemeButton() {
  const isDark = state.appearance === "dark";
  return `
    <button class="theme-toggle" type="button" data-action="toggle-theme" aria-label="${isDark ? "Lightmode aktivieren" : "Darkmode aktivieren"}" title="${isDark ? "Lightmode" : "Darkmode"}">
      ${icon(isDark ? "sun" : "moon")}
      <span>${isDark ? "Light" : "Dark"}</span>
    </button>
  `;
}

function renderError(message) {
  return `
    <div class="error">
      ${icon("warning")}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function handleInput(event) {
  const target = event.target;

  if (target.matches("[data-player-name]")) {
    const player = state.players.find((item) => item.id === target.dataset.playerId);
    if (player) {
      player.name = target.value;
      saveSetup();
    }
  }

  if (target.matches('[data-setting="imposters"]')) {
    state.imposterCount = Number(target.value);
    const value = app.querySelector("[data-imposter-value]");
    if (value) {
      value.textContent = String(state.imposterCount);
    }
    saveSetup();
  }

  if (target.matches('[data-setting="duration"]')) {
    state.durationSeconds = Number(target.value);
    const value = app.querySelector("[data-duration-value]");
    if (value) {
      value.textContent = formatTime(state.durationSeconds);
    }
    saveSetup();
  }
}

function handleChange(event) {
  const target = event.target;

  if (target.matches('[data-setting="theme"]')) {
    state.selectedThemeId = target.value;
    state.error = "";
    saveSetup();
    render();
  }

  if (target.matches('[data-setting="hints"]')) {
    state.hintsEnabled = target.checked;
    saveSetup();
  }
}

function handleClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;

  if (action === "add-player") {
    syncPlayerInputs();
    state.players.push({ id: createId(), name: `Spieler ${state.players.length + 1}` });
    normalizeState();
    saveSetup();
    render();
  }

  if (action === "open-setup") {
    pauseTimer();
    state.phase = "setup";
    state.round = null;
    state.error = "";
    render();
  }

  if (action === "open-rules") {
    pauseTimer();
    state.phase = "rules";
    state.error = "";
    render();
  }

  if (action === "back-menu") {
    pauseTimer();
    state.phase = "menu";
    state.round = null;
    state.error = "";
    render();
  }

  if (action === "quick-start") {
    syncPlayerInputs();
    startRound();
  }

  if (action === "remove-player") {
    syncPlayerInputs();
    state.players = state.players.filter((player) => player.id !== actionTarget.dataset.playerId);
    normalizeState();
    saveSetup();
    render();
  }

  if (action === "select-theme") {
    state.selectedThemeId = actionTarget.dataset.themeId;
    state.error = "";
    saveSetup();
    render();
  }

  if (action === "add-theme") {
    const input = app.querySelector("[data-new-theme]");
    const title = cleanText(input?.value);
    if (!title) {
      showToast("Gib zuerst einen Themennamen ein.");
      return;
    }

    const theme = { id: createId(), title, words: [] };
    state.themes.push(theme);
    state.selectedThemeId = theme.id;
    state.error = "";
    saveSetup();
    render();
  }

  if (action === "delete-theme") {
    if (state.themes.length <= 1) {
      return;
    }
    state.themes = state.themes.filter((theme) => theme.id !== state.selectedThemeId);
    normalizeState();
    saveSetup();
    render();
  }

  if (action === "add-word") {
    const input = app.querySelector("[data-new-word]");
    const word = cleanText(input?.value);
    const theme = getSelectedTheme();
    if (!word) {
      showToast("Gib zuerst ein Wort ein.");
      return;
    }

    const exists = theme.words.some((item) => item.localeCompare(word, "de", { sensitivity: "accent" }) === 0);
    if (exists) {
      showToast("Dieses Wort ist schon im Thema.");
      return;
    }

    theme.words.push(word);
    state.error = "";
    saveSetup();
    render();
  }

  if (action === "delete-word") {
    const theme = state.themes.find((item) => item.id === actionTarget.dataset.themeId);
    if (!theme) {
      return;
    }
    theme.words = theme.words.filter((word) => word !== actionTarget.dataset.word);
    saveSetup();
    render();
  }

  if (action === "start-round") {
    syncPlayerInputs();
    startRound();
  }

  if (action === "toggle-theme") {
    state.appearance = state.appearance === "dark" ? "light" : "dark";
    saveSetup();
    render();
  }

  if (action === "reveal-card") {
    state.cardVisible = true;
    render();
  }

  if (action === "next-card") {
    advanceReveal();
  }

  if (action === "toggle-timer") {
    if (state.timerRunning) {
      pauseTimer();
    } else {
      state.timerRunning = true;
      startTimer();
      updateTimerUi();
    }
  }

  if (action === "show-results") {
    showResults();
  }

  if (action === "new-round") {
    startRound();
  }

  if (action === "back-setup") {
    pauseTimer();
    state.phase = "setup";
    state.round = null;
    state.error = "";
    render();
  }
}

function handlePointerDown(event) {
  const card = event.target.closest("[data-reveal-card]");
  const cover = event.target.closest("[data-card-cover]") || card?.querySelector("[data-card-cover]");
  if (!card || state.phase !== "reveal" || state.cardVisible) {
    return;
  }

  dragStartY = event.clientY;
  activeDragCard = cover;
  cover?.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  if (!activeDragCard || dragStartY === null) {
    return;
  }

  const offset = Math.min(0, event.clientY - dragStartY);
  activeDragCard.style.transform = `translateY(${Math.max(offset, -260)}px) rotate(-2deg)`;
}

function handlePointerUp(event) {
  if (!activeDragCard || dragStartY === null) {
    return;
  }

  const offset = event.clientY - dragStartY;
  activeDragCard.style.transform = "";

  if (offset < -70) {
    state.cardVisible = true;
    render();
  }

  dragStartY = null;
  activeDragCard = null;
}

function startRound() {
  normalizeState();
  const validation = validateSetup();
  if (validation) {
    state.error = validation;
    saveSetup();
    render();
    return;
  }

  const players = getNamedPlayers();
  const theme = getSelectedTheme();
  const words = theme.words.map(cleanText).filter(Boolean);
  const secretWord = sample(words);
  const revealOrder = shuffle(players);
  const imposters = new Set(shuffle(players).slice(0, state.imposterCount).map((player) => player.id));
  const firstSpeaker = sample(revealOrder);
  const firstIndex = revealOrder.findIndex((player) => player.id === firstSpeaker.id);
  const speakingOrder = revealOrder.slice(firstIndex).concat(revealOrder.slice(0, firstIndex));
  const cards = revealOrder.map((player) => ({
    player,
    role: imposters.has(player.id) ? "imposter" : "civilian",
    word: imposters.has(player.id) ? null : secretWord,
    hint: imposters.has(player.id) && state.hintsEnabled ? theme.title : null
  }));

  state.players = players;
  state.round = {
    themeTitle: theme.title,
    secretWord,
    revealOrder,
    speakingOrder,
    firstSpeaker,
    cards,
    imposters: cards.filter((card) => card.role === "imposter").map((card) => card.player),
    durationSeconds: state.durationSeconds
  };
  state.phase = "reveal";
  state.revealIndex = 0;
  state.cardVisible = false;
  state.remainingSeconds = state.durationSeconds;
  state.timerRunning = false;
  state.error = "";
  saveSetup();
  render();
}

function advanceReveal() {
  if (state.revealIndex + 1 < state.round.cards.length) {
    state.revealIndex += 1;
    state.cardVisible = false;
    render();
    return;
  }

  state.phase = "timer";
  state.remainingSeconds = state.round.durationSeconds;
  state.timerRunning = true;
  render();
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!state.timerRunning) {
      return;
    }

    state.remainingSeconds = Math.max(0, state.remainingSeconds - 1);
    updateTimerUi();

    if (state.remainingSeconds === 0) {
      showResults();
    }
  }, 1000);
}

function pauseTimer() {
  state.timerRunning = false;
  clearInterval(timerId);
  timerId = null;
  updateTimerUi();
}

function showResults() {
  pauseTimer();
  state.phase = "results";
  render();
}

function updateTimerUi() {
  const time = app.querySelector("[data-time]");
  const dial = app.querySelector("[data-timer-dial]");
  const timerState = app.querySelector("[data-timer-state]");
  const button = app.querySelector('[data-action="toggle-timer"]');

  if (time) {
    time.textContent = formatTime(state.remainingSeconds);
  }
  if (dial) {
    dial.style.setProperty("--progress", `${timerProgress()}%`);
  }
  if (timerState) {
    timerState.textContent = state.timerRunning ? "läuft" : "pausiert";
  }
  if (button) {
    button.innerHTML = `${state.timerRunning ? icon("pause") : icon("play")} ${state.timerRunning ? "Pause" : "Weiter"}`;
  }
}

function validateSetup() {
  const players = getNamedPlayers();
  const theme = getSelectedTheme();
  const words = theme.words.map(cleanText).filter(Boolean);

  if (players.length < 3) {
    return "Mindestens 3 Spieler werden benötigt.";
  }
  if (!words.length) {
    return "Das gewählte Thema braucht mindestens ein Wort.";
  }
  if (state.imposterCount < 1 || state.imposterCount >= players.length) {
    return "Die Anzahl der Imposter muss kleiner als die Spieleranzahl sein.";
  }
  if (state.durationSeconds < 30) {
    return "Die Rundenzeit muss mindestens 30 Sekunden betragen.";
  }
  return "";
}

function syncPlayerInputs() {
  app.querySelectorAll("[data-player-name]").forEach((input) => {
    const player = state.players.find((item) => item.id === input.dataset.playerId);
    if (player) {
      player.name = input.value;
    }
  });
}

function getSelectedTheme() {
  return state.themes.find((theme) => theme.id === state.selectedThemeId) || state.themes[0];
}

function getNamedPlayers(targetState = state) {
  return targetState.players
    .map((player) => ({ ...player, name: cleanText(player.name) }))
    .filter((player) => player.name);
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function cleanText(value) {
  return String(value || "").trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function timerProgress() {
  if (!state.round?.durationSeconds) {
    return 0;
  }
  return clamp(Math.round((state.remainingSeconds / state.round.durationSeconds) * 100), 0, 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  clearTimeout(toastId);
  toast.textContent = message;
  toast.classList.add("show");
  toastId = setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

function applyAppearance() {
  document.documentElement.dataset.theme = state.appearance;
  document.documentElement.style.colorScheme = state.appearance;

  const themeColor = state.appearance === "dark" ? "#080816" : "#fff7e5";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function icon(name, className = "icon") {
  const paths = {
    users: '<path d="M16 11a4 4 0 1 0-3.2-6.4A4 4 0 0 0 16 11Zm-8 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2c-3.4 0-6 1.6-6 3.7V20h12v-2.3c0-2.1-2.6-3.7-6-3.7ZM8 14c-3.4 0-6 1.6-6 3.7V20h6v-2.3c0-1.2.5-2.3 1.4-3.1A8.7 8.7 0 0 0 8 14Z"/>',
    sliders: '<path d="M4 6h8a3 3 0 1 0 0-2H4a1 1 0 0 0 0 2Zm14-2a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM4 13h2a3 3 0 1 0 0-2H4a1 1 0 1 0 0 2Zm8-2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-8 8h10a3 3 0 1 0 0-2H4a1 1 0 1 0 0 2Zm16-2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>',
    book: '<path d="M5 3h11a3 3 0 0 1 3 3v15H7a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2Zm0 14a2 2 0 0 0 2 2h10v-2H7a4 4 0 0 0-2 .54V17Zm0-2.46A4 4 0 0 1 7 14h10V6a1 1 0 0 0-1-1H5v9.54Z"/>',
    plus: '<path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z"/>',
    minus: '<path d="M5 11h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2Z"/>',
    trash: '<path d="M9 3h6l1 2h4a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2h4l1-2Zm-2 6h10l-.7 10.2A3 3 0 0 1 13.3 22h-2.6a3 3 0 0 1-3-2.8L7 9Z"/>',
    play: '<path d="M8 5.8c0-1.5 1.7-2.4 2.9-1.5l8.2 6.2c1 .8 1 2.2 0 3l-8.2 6.2A1.8 1.8 0 0 1 8 18.2V5.8Z"/>',
    pause: '<path d="M7 5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5Zm7 0a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2V5Z"/>',
    lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/>',
    "arrow-up": '<path d="M12 3 5 10a1 1 0 1 0 1.4 1.4L11 6.8V20a1 1 0 1 0 2 0V6.8l4.6 4.6A1 1 0 0 0 19 10l-7-7Z"/>',
    check: '<path d="M9.2 16.6 4.8 12.2a1 1 0 1 1 1.4-1.4l3 3 8.6-8.6a1 1 0 1 1 1.4 1.4l-9.3 10a1 1 0 0 1-1.5 0Z"/>',
    seal: '<path d="M12 2 9.7 4.1 6.7 3.4 5.8 6.4 3 7.8l1.1 2.9L2.8 13.5l2.6 1.7.3 3.1 3.1.3 1.7 2.6 2.8-1.3 2.9 1.1 1.4-2.8 3-.9-.7-3 2.1-2.3-2.1-2.3.7-3-3-.9-1.4-2.8-2.9 1.1L12 2Zm-1.2 13.6-3.4-3.4 1.4-1.4 2 2 4.6-4.6 1.4 1.4-6 6Z"/>',
    mask: '<path d="M3 9c0-3.5 3.4-6 9-6s9 2.5 9 6v3.4c0 4.4-4 8.6-9 8.6s-9-4.2-9-8.6V9Zm3.3 1.2c1.8-.9 4-.7 5.4.3-1 1.8-2.7 2.8-5 2.8-.7 0-.9-2.5-.4-3.1Zm11.4 0c-1.8-.9-4-.7-5.4.3 1 1.8 2.7 2.8 5 2.8.7 0 .9-2.5.4-3.1ZM9 16.4c1.7 1.1 4.3 1.1 6 0"/>',
    order: '<path d="M7 4h11a1 1 0 1 1 0 2H7.4l1.3 1.3a1 1 0 1 1-1.4 1.4l-3-3a1 1 0 0 1 0-1.4l3-3a1 1 0 0 1 1.4 1.4L7.4 4ZM17 18H6a1 1 0 1 1 0-2h10.6l-1.3-1.3a1 1 0 0 1 1.4-1.4l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4-1.4l1.3-1.3Z"/>',
    eye: '<path d="M12 5c5.5 0 9 5.7 9 7s-3.5 7-9 7-9-5.7-9-7 3.5-7 9-7Zm0 3.2A3.8 3.8 0 1 0 12 16a3.8 3.8 0 0 0 0-7.8Zm0 2A1.8 1.8 0 1 1 12 14a1.8 1.8 0 0 1 0-3.6Z"/>',
    refresh: '<path d="M19 5v5h-5a1 1 0 1 1 0-2h1.7a6 6 0 1 0 1 5.7 1 1 0 1 1 1.9.7A8 8 0 1 1 17 6.6V5a1 1 0 1 1 2 0Z"/>',
    warning: '<path d="M10.3 3.8a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.2l8-14ZM11 9v5h2V9h-2Zm0 7v2h2v-2h-2Z"/>'
    ,
    sun: '<path d="M12 4a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0 18a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1ZM4 13H3a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Zm17 0h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2ZM5.6 7a1 1 0 0 1-.7-.3l-.7-.7a1 1 0 1 1 1.4-1.4l.7.7A1 1 0 0 1 5.6 7Zm13.5 13.5a1 1 0 0 1-.7-.3l-.7-.7a1 1 0 0 1 1.4-1.4l.7.7a1 1 0 0 1-.7 1.7ZM18.4 7a1 1 0 0 1-.7-1.7l.7-.7A1 1 0 0 1 19.8 6l-.7.7a1 1 0 0 1-.7.3ZM4.9 20.5a1 1 0 0 1-.7-1.7l.7-.7a1 1 0 1 1 1.4 1.4l-.7.7a1 1 0 0 1-.7.3ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>',
    moon: '<path d="M20.5 14.6A8.7 8.7 0 0 1 9.4 3.5a1 1 0 0 0-1.2-1.2 10 10 0 1 0 13.5 13.5 1 1 0 0 0-1.2-1.2Z"/>',
    home: '<path d="M3 11.2 12 3l9 8.2a1 1 0 0 1-1.3 1.5L19 12v7a2 2 0 0 1-2 2h-3v-6h-4v6H7a2 2 0 0 1-2-2v-7l-.7.7A1 1 0 0 1 3 11.2Z"/>',
    spark: '<path d="M12 2 14.4 8 21 10.4 14.4 13 12 20l-2.4-7L3 10.4 9.6 8 12 2Zm6 13 1.1 2.9L22 19l-2.9 1.1L18 23l-1.1-2.9L14 19l2.9-1.1L18 15Z"/>'
  };

  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.play}</svg>`;
}
