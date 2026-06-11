const calendarStrip = document.querySelector("#calendarStrip");
const dayTitle = document.querySelector("#dayTitle");
const dayMeta = document.querySelector("#dayMeta");
const matchCards = document.querySelector("#matchCards");
const matchSearch = document.querySelector("#matchSearch");
const matchTitle = document.querySelector("#matchTitle");
const matchTime = document.querySelector("#matchTime");
const matchScore = document.querySelector("#matchScore");
const teamAName = document.querySelector("#teamAName");
const teamBName = document.querySelector("#teamBName");
const teamACrest = document.querySelector("#teamACrest");
const teamBCrest = document.querySelector("#teamBCrest");
const providerDot = document.querySelector("#providerDot");
const providerText = document.querySelector("#providerText");
const refreshText = document.querySelector("#refreshText");
const refreshButton = document.querySelector("#refreshButton");
const modelMeta = document.querySelector("#modelMeta");
const probabilityList = document.querySelector("#probabilityList");
const priceInputs = document.querySelector("#priceInputs");
const signals = document.querySelector("#signals");
const bankrollInput = document.querySelector("#bankroll");
const modeInputs = [...document.querySelectorAll("input[name='mode']")];
const liveFields = document.querySelector("#liveFields");
const minuteInput = document.querySelector("#minute");
const matchRead = document.querySelector("#matchRead");
const manualScoreA = document.querySelector("#manualScoreA");
const manualScoreB = document.querySelector("#manualScoreB");
const appError = document.querySelector("#appError");

const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const SCOREBOARD_PROXY_URLS = ["/.netlify/functions/scoreboard", "/api/scoreboard"];
const LIVE_REFRESH_MS = 30 * 1000;
const IDLE_REFRESH_MS = 90 * 1000;
const ESPN_TIMEOUT_MS = 5000;
let refreshTimer = null;
const TEAM_ALIASES = {
  "korea republic": ["south korea", "korea republic", "korea"],
  "ir iran": ["iran", "ir iran"],
  "cabo verde": ["cape verde", "cabo verde"],
  "curaçao": ["curacao", "curaçao"],
  "côte d'ivoire": ["cote d'ivoire", "côte d'ivoire", "ivory coast"],
  "bosnia and herzegovina": ["bosnia-herzegovina", "bosnia and herzegovina", "bosnia"],
  "congo dr": ["dr congo", "congo dr", "democratic republic of congo"],
  "türkiye": ["turkiye", "türkiye", "turkey"],
};
const COUNTRY_CODES = {
  "algeria": "ALG",
  "argentina": "ARG",
  "australia": "AUS",
  "austria": "AUT",
  "belgium": "BEL",
  "bosnia and herzegovina": "BIH",
  "brazil": "BRA",
  "cabo verde": "CPV",
  "canada": "CAN",
  "colombia": "COL",
  "congo dr": "COD",
  "croatia": "CRO",
  "curaçao": "CUW",
  "czechia": "CZE",
  "côte d'ivoire": "CIV",
  "ecuador": "ECU",
  "egypt": "EGY",
  "england": "ENG",
  "france": "FRA",
  "germany": "GER",
  "ghana": "GHA",
  "haiti": "HAI",
  "ir iran": "IRN",
  "iraq": "IRQ",
  "japan": "JPN",
  "jordan": "JOR",
  "korea republic": "KOR",
  "mexico": "MEX",
  "morocco": "MAR",
  "netherlands": "NED",
  "new zealand": "NZL",
  "norway": "NOR",
  "panama": "PAN",
  "paraguay": "PAR",
  "portugal": "POR",
  "qatar": "QAT",
  "saudi arabia": "KSA",
  "scotland": "SCO",
  "senegal": "SEN",
  "south africa": "RSA",
  "spain": "ESP",
  "sweden": "SWE",
  "switzerland": "SUI",
  "tunisia": "TUN",
  "türkiye": "TUR",
  "uruguay": "URU",
  "usa": "USA",
  "uzbekistan": "UZB",
};

const matches = parsePredictions(RAW_PREDICTIONS);
let days = buildDays(matches);
let selectedDayKey = days[0]?.key;
let selectedMatch = matches[0];
let lastRefreshAt = null;
const priceBook = {};

function parsePredictions(raw) {
  const linePattern = /^(OpenAI|Anthropic|Google|xAI) picked (.+?) (\d+)% for (.+)$/;
  const byMatch = new Map();

  raw.trim().split("\n").forEach((line) => {
    const match = line.trim().match(linePattern);
    if (!match) return;
    const [, model, pick, confidence, fixture] = match;
    if (!byMatch.has(fixture)) {
      const [teamA, teamB] = fixture.split(" vs ");
      byMatch.set(fixture, {
        id: byMatch.size + 1,
        fixture,
        teamA,
        teamB,
        picks: [],
      });
    }
    byMatch.get(fixture).picks.push({
      model,
      pick,
      confidence: Number(confidence),
    });
  });

  return [...byMatch.values()].map((fixture, index) => ({
    ...fixture,
    ...scheduleFor(index),
    outcomes: buildOutcomes(fixture.teamA, fixture.teamB, fixture.picks),
  }));
}

function scheduleFor(index) {
  // The benchmark markup exposed ordered fixtures, but the local static app keeps
  // schedule data as an editable seed. The first two are from the user's screenshots.
  const exact = [
    { date: "2026-06-11", label: "Thu Jun 11", time: "12:00 PM" },
    { date: "2026-06-11", label: "Thu Jun 11", time: "7:00 PM" },
  ][index];
  if (exact) return exact;

  const start = new Date("2026-06-12T12:00:00");
  const slot = (index - 2) % 4;
  const dayOffset = Math.floor((index - 2) / 4);
  const date = new Date(start);
  date.setDate(start.getDate() + dayOffset);
  const times = ["10:00 AM", "1:00 PM", "4:00 PM", "7:00 PM"];
  return {
    date: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).replace(",", ""),
    time: times[slot],
  };
}

function buildOutcomes(teamA, teamB, picks) {
  const grouped = picks.reduce((map, pick) => {
    map[pick.pick] ||= [];
    map[pick.pick].push(pick);
    return map;
  }, {});

  const explicit = Object.entries(grouped)
    .map(([label, group]) => {
      const avg = average(group.map((pick) => pick.confidence));
      return {
        label,
        displayLabel: label === "Draw" ? "Tie" : label,
        teamName: teamNameForOutcome(label, teamA, teamB),
        modelCount: group.length,
        avgConfidence: avg,
        aiFair: avg / 100,
        models: group,
        derived: false,
      };
    })
    .sort((a, b) => b.modelCount - a.modelCount || b.avgConfidence - a.avgConfidence);

  const labels = [codeForTeam(teamA), "Draw", codeForTeam(teamB)];
  const usedFair = explicit.reduce((sum, outcome) => sum + outcome.aiFair, 0);
  const missingLabels = labels.filter((label) => !explicit.some((outcome) => outcome.label === label));
  const residual = Math.max(0.03, 1 - usedFair);
  const derivedFair = missingLabels.length ? residual / missingLabels.length : 0;
  const derived = missingLabels.map((label) => ({
    label,
    displayLabel: label === "Draw" ? "Tie" : label,
    teamName: teamNameForOutcome(label, teamA, teamB),
    modelCount: 0,
    avgConfidence: derivedFair * 100,
    aiFair: derivedFair,
    models: [],
    derived: true,
  }));

  return [...explicit, ...derived].sort((a, b) => {
    const order = [codeForTeam(teamA), "Draw", codeForTeam(teamB)];
    return order.indexOf(a.label) - order.indexOf(b.label);
  });
}

function codeForTeam(teamName) {
  return COUNTRY_CODES[normalize(teamName)] || initials(teamName).slice(0, 3);
}

function teamNameForOutcome(label, teamA, teamB) {
  if (label === "Draw") return "Tie";
  if (label === codeForTeam(teamA)) return teamA;
  if (label === codeForTeam(teamB)) return teamB;
  return label;
}

function buildDays(allMatches) {
  const grouped = allMatches.reduce((map, match) => {
    map[match.date] ||= {
      key: match.date,
      label: match.label,
      matches: [],
    };
    map[match.date].matches.push(match);
    return map;
  }, {});
  return Object.values(grouped);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cents(value) {
  return `${Math.round(value * 100)}¢`;
}

function dollars(value) {
  if (value < 1 && value > 0) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(0)}`;
}

function currentMode() {
  return modeInputs.find((input) => input.checked)?.value || "pregame";
}

function isAutoLive() {
  return selectedMatch.live?.state === "in" || selectedMatch.live?.state === "post";
}

function currentDay() {
  return days.find((day) => day.key === selectedDayKey) || days[0];
}

function topOutcome(match) {
  return [...match.outcomes].sort((a, b) => b.aiFair - a.aiFair)[0];
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function riskAdjustedFair(outcome) {
  let fair = outcome.aiFair;
  const missingModelPenalty = outcome.derived ? 0.02 : (4 - outcome.modelCount) * 0.015;
  fair -= missingModelPenalty;

  if (currentMode() === "live" || isAutoLive()) {
    const liveState = currentLiveState();
    const slider = Number(matchRead.value || 0);
    fair = liveFair(outcome, fair, liveState);
    fair += slider * 0.025;
  }

  return Math.max(0.02, Math.min(0.96, fair));
}

function currentLiveState() {
  const live = selectedMatch.live;
  if (live?.state === "in" || live?.state === "post") {
    return {
      minute: Math.min(live.minute ?? Number(minuteInput.value || 0), 120),
      scoreA: live.scoreA,
      scoreB: live.scoreB,
      state: live.state,
    };
  }

  return {
    minute: Math.min(Number(minuteInput.value || 0), 120),
    scoreA: Math.max(0, Number(manualScoreA.value || 0)),
    scoreB: Math.max(0, Number(manualScoreB.value || 0)),
    state: currentMode() === "live" ? "in" : "pre",
  };
}

function liveFair(outcome, baseFair, liveState) {
  const minute = Math.max(0, Math.min(liveState.minute || 0, 120));
  const regulationMinute = Math.min(minute, 90);
  const elapsed = regulationMinute / 90;
  const remaining = Math.max(0.015, (90 - regulationMinute) / 90);
  const scoreDiff = liveState.scoreA - liveState.scoreB;

  if (outcome.label === "Draw") {
    if (scoreDiff === 0) {
      return baseFair + (1 - baseFair) * Math.pow(elapsed, 2.25) * 0.92;
    }
    return baseFair * Math.pow(remaining, 0.55);
  }

  const side = sideForOutcome(outcome.label);
  if (!side) return baseFair * Math.pow(remaining, 0.8);

  const ownDiff = side === "teamA" ? scoreDiff : -scoreDiff;
  if (ownDiff > 0) {
    return baseFair + (1 - baseFair) * Math.pow(elapsed, 1.8) * Math.min(0.96, 0.72 + ownDiff * 0.12);
  }
  if (ownDiff < 0) {
    return baseFair * Math.pow(remaining, 0.78 + Math.min(2, Math.abs(ownDiff)) * 0.45);
  }

  return baseFair * Math.pow(remaining, 0.72);
}

function sideForOutcome(label) {
  const target = normalize(label);
  const teamAKeys = teamKeys(selectedMatch.teamA, codeForTeam(selectedMatch.teamA), selectedMatch.live?.teamA?.abbreviation);
  const teamBKeys = teamKeys(selectedMatch.teamB, codeForTeam(selectedMatch.teamB), selectedMatch.live?.teamB?.abbreviation);
  if (teamAKeys.includes(target)) return "teamA";
  if (teamBKeys.includes(target)) return "teamB";
  return null;
}

function stakeFor(edge, bankroll, modelCount) {
  if (edge < 0.025) return 0;
  let fraction = 0;
  if (edge < 0.05) fraction = 0.015;
  else if (edge < 0.08) fraction = 0.035;
  else if (edge < 0.12) fraction = 0.06;
  else fraction = 0.09;

  const consensusTrim = [0, 0.55, 0.7, 0.85, 1][modelCount] || 0.5;
  const cap = bankroll <= 60 ? 6 : bankroll * 0.12;
  return Math.min(bankroll * fraction * consensusTrim, cap);
}

function signalFor(outcome, price, bankroll) {
  if (selectedMatch.live?.state === "post") {
    return { status: "skip", label: "Final", fair: 0, entry: 0, great: 0, edge: 0, stake: 0 };
  }

  const fair = riskAdjustedFair(outcome);
  const entry = fair - 0.03;
  const great = fair - 0.07;
  const edge = fair - price;
  const stake = stakeFor(edge, bankroll, outcome.modelCount);

  if (Number.isNaN(price)) {
    return { status: "wait", label: "Enter price", fair, entry, great, edge: 0, stake: 0 };
  }

  if (edge >= 0.025) {
    return { status: "buy", label: "Buy", fair, entry, great, edge, stake };
  }

  if (price <= entry + 0.02) {
    return { status: "wait", label: "Close", fair, entry, great, edge, stake: 0 };
  }

  return { status: "skip", label: "Skip", fair, entry, great, edge, stake: 0 };
}

function renderCalendar() {
  days = buildDays(matches);
  calendarStrip.innerHTML = days.map((day) => `
    <button class="dayButton ${day.key === selectedDayKey ? "active" : ""}" data-day="${day.key}">
      <span>${day.label.split(" ")[0]}</span>
      <strong>${day.label.split(" ").slice(1).join(" ")}</strong>
      <small>${day.matches.length} matches</small>
    </button>
  `).join("");

  calendarStrip.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDayKey = button.dataset.day;
      selectedMatch = currentDay().matches[0];
      matchSearch.value = "";
      render();
      refreshEspnData();
    });
  });
}

function renderMatchCards() {
  const query = matchSearch.value.trim().toLowerCase();
  const day = currentDay();
  const visibleMatches = query
    ? matches.filter((match) => match.fixture.toLowerCase().includes(query))
    : day.matches;

  dayTitle.textContent = query ? "Search results" : day.label;
  dayMeta.textContent = `${visibleMatches.length} match${visibleMatches.length === 1 ? "" : "es"} available.`;

  matchCards.innerHTML = visibleMatches.map((match) => {
    const top = topOutcome(match);
    return `
      <button class="matchCard ${match.fixture === selectedMatch.fixture ? "active" : ""}" data-match="${match.id}">
        <time>${match.live?.state === "in" ? match.live.displayClock || "Live" : match.time}</time>
        <div class="miniTeams">
          <span>${match.teamA}</span>
          <span>${match.teamB}</span>
        </div>
        <div class="miniEdge">
          <span>${match.live ? liveCardText(match) : `AI lean: ${top.displayLabel}`}</span>
          <strong>${match.live ? liveScoreText(match) : cents(top.aiFair)}</strong>
        </div>
      </button>
    `;
  }).join("");

  matchCards.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMatch = matches.find((match) => match.id === Number(button.dataset.match)) || selectedMatch;
      selectedDayKey = selectedMatch.date;
      render();
      refreshEspnData();
    });
  });
}

function renderMatchup() {
  teamAName.textContent = selectedMatch.teamA;
  teamBName.textContent = selectedMatch.teamB;
  teamACrest.textContent = selectedMatch.live?.teamA?.abbreviation || initials(selectedMatch.teamA);
  teamBCrest.textContent = selectedMatch.live?.teamB?.abbreviation || initials(selectedMatch.teamB);
  matchTitle.textContent = `${selectedMatch.teamA} vs ${selectedMatch.teamB}`;
  matchScore.textContent = selectedMatch.live ? liveScoreText(selectedMatch) : "0 - 0";
  matchTime.textContent = selectedMatch.live?.detail || `${selectedMatch.label} · ${selectedMatch.time}`;
  modelMeta.textContent = `${selectedMatch.picks.length} model picks loaded. Probabilities below are pregame AI confidence for picked outcomes.`;
}

function renderProbabilities() {
  probabilityList.innerHTML = selectedMatch.outcomes.map((outcome) => {
    const chips = outcome.derived
      ? `<span class="chip mutedChip">Derived residual estimate</span>`
      : outcome.models.map((model) => `<span class="chip">${model.model} ${model.confidence}%</span>`).join("");
    return `
      <div class="probabilityRow ${outcome.derived ? "derivedRow" : ""}">
        <div class="probabilityTop">
          <strong>${outcome.displayLabel}</strong>
          <span>${cents(outcome.aiFair)} · ${outcome.derived ? "derived" : `${outcome.modelCount}/4 models`}</span>
        </div>
        <div class="barTrack">
          <div class="barFill" style="width: ${Math.round(outcome.aiFair * 100)}%"></div>
        </div>
        <div class="modelChips">${chips}</div>
      </div>
    `;
  }).join("");
}

function renderPriceInputs() {
  priceInputs.innerHTML = selectedMatch.outcomes
    .map((outcome) => `
      <label class="priceRow">
        <span>
          <strong>${outcome.displayLabel}</strong>
          <small>${outcome.derived ? "derived residual estimate" : `${outcome.modelCount}/4 models`} · raw fair ${cents(outcome.aiFair)}</small>
        </span>
        <input class="priceInput" data-outcome="${outcome.label}" type="number" min="1" max="99" step="1" placeholder="¢" value="${priceBook[selectedMatch.id]?.[outcome.label] || ""}">
      </label>
    `)
    .join("");

  priceInputs.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      priceBook[selectedMatch.id] ||= {};
      priceBook[selectedMatch.id][input.dataset.outcome] = input.value;
      renderSignals();
    });
  });
}

function renderSignals() {
  const bankroll = Math.max(Number(bankrollInput.value || 50), 1);
  const prices = new Map(
    [...priceInputs.querySelectorAll("input")].map((input) => [
      input.dataset.outcome,
      input.value === "" ? Number.NaN : Number(input.value) / 100,
    ])
  );

  signals.classList.remove("empty");
  signals.innerHTML = selectedMatch.outcomes.map((outcome) => {
    const price = prices.get(outcome.label);
    const signal = signalFor(outcome, price, bankroll);
    const modeNote = currentMode() === "live" || isAutoLive()
      ? "Live mode is using score/time plus your slider read."
      : "Pregame mode uses benchmark confidence, then demands a discount before buying.";
    const priceText = Number.isNaN(price) ? "none" : cents(price);

    return `
      <article class="signalCard ${signal.status}">
        <div class="signalTop">
          <div>
            <h3>${outcome.displayLabel}</h3>
            <p class="reason">${outcome.derived ? "No model directly picked this; using residual probability." : `${outcome.modelCount}/4 models picked this outcome.`} ${modeNote}</p>
          </div>
          <span class="badge">${signal.label}</span>
        </div>
        <div class="metrics">
          <div class="metric"><span>RH price</span><strong>${priceText}</strong></div>
          <div class="metric"><span>Adj fair</span><strong>${cents(signal.fair)}</strong></div>
          <div class="metric"><span>Buy zone</span><strong>≤ ${cents(signal.entry)}</strong></div>
          <div class="metric"><span>Stake</span><strong>${signal.stake ? dollars(signal.stake) : "$0"}</strong></div>
        </div>
        <p class="reason">${reasonText(signal, outcome, price)}</p>
      </article>
    `;
  }).join("");
}

function reasonText(signal, outcome, price) {
  if (selectedMatch.live?.state === "post") {
    return "Match is final. Do not enter new winner positions from this calculator.";
  }
  if (Number.isNaN(price)) {
    return `Enter Robinhood's ${outcome.displayLabel} price. Great entry starts around ${cents(signal.great)}.`;
  }
  if (signal.status === "buy") {
    return `Robinhood is ${cents(signal.edge)} below adjusted fair. Suggested stake is intentionally small and capped. Great entry is ${cents(signal.great)} or lower.`;
  }
  if (signal.status === "wait") {
    return `This is near the buy zone, but not quite enough edge. Wait for ${cents(signal.entry)} or lower; stronger entry around ${cents(signal.great)}.`;
  }
  return `Market is not cheap enough versus adjusted fair. Wait for ${cents(signal.entry)} or lower; stronger entry around ${cents(signal.great)}.`;
}

function render() {
  syncSelectedMatch();
  syncModeFromEspn();
  renderProviderStatus();
  renderCalendar();
  renderMatchCards();
  renderMatchup();
  renderProbabilities();
  renderPriceInputs();
  renderSignals();
}

function syncModeFromEspn() {
  const liveRadio = modeInputs.find((input) => input.value === "live");
  const pregameRadio = modeInputs.find((input) => input.value === "pregame");
  if (selectedMatch.live?.state === "in" && liveRadio) {
    liveRadio.checked = true;
  }
  if (selectedMatch.live?.state === "post" && pregameRadio) {
    pregameRadio.checked = true;
  }
  liveFields.hidden = currentMode() !== "live";
}

try {
  render();
  refreshEspnData();
} catch (error) {
  showAppError(error);
}

matchSearch.addEventListener("input", () => {
  const firstMatch = matches.find((match) => match.fixture.toLowerCase().includes(matchSearch.value.trim().toLowerCase()));
  if (firstMatch) selectedMatch = firstMatch;
  render();
  if (firstMatch) refreshEspnData();
});

bankrollInput.addEventListener("input", renderSignals);
minuteInput.addEventListener("input", renderSignals);
matchRead.addEventListener("input", renderSignals);
modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    liveFields.hidden = currentMode() !== "live";
    renderSignals();
  });
});

refreshButton.addEventListener("click", refreshEspnData);

async function refreshEspnData() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  setProviderStatus("loading", "Updating ESPN", `Checking ${currentDay()?.label || "selected day"}...`);
  try {
    const events = await fetchEspnDate(selectedDayKey || selectedMatch.date);
    applyEspnEvents(events);
    lastRefreshAt = new Date();
    setProviderStatus("ok", "ESPN live", nextRefreshText());
    render();
  } catch (error) {
    setProviderStatus("bad", "ESPN slow", `Keeping local schedule · retrying in ${Math.round(IDLE_REFRESH_MS / 1000)}s`);
  } finally {
    scheduleNextRefresh();
  }
}

async function fetchEspnDate(dateKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESPN_TIMEOUT_MS);
  const dateParam = dateKey.replaceAll("-", "");
  try {
    const data = await fetchScoreboardJson(dateParam, controller.signal);
    return (data.events || []).map(parseEspnEvent);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchScoreboardJson(dateParam, signal) {
  const urls = shouldUseProxy()
    ? [...SCOREBOARD_PROXY_URLS.map((url) => `${url}?date=${dateParam}`), `${ESPN_SCOREBOARD_URL}?dates=${dateParam}`]
    : [`${ESPN_SCOREBOARD_URL}?dates=${dateParam}`];

  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(`${url} ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Scoreboard unavailable");
}

function shouldUseProxy() {
  return window.location.protocol !== "file:";
}

function parseEspnEvent(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((team) => team.homeAway === "home") || competitors[0] || {};
  const away = competitors.find((team) => team.homeAway === "away") || competitors[1] || {};
  const status = event.status?.type || {};
  const eventDate = new Date(event.date);
  const date = Number.isNaN(eventDate.getTime()) ? undefined : localDateKey(eventDate);
  const time = Number.isNaN(eventDate.getTime())
    ? undefined
    : eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const state = status.state || "pre";
  return {
    id: event.id,
    date,
    time,
    state,
    completed: Boolean(status.completed),
    detail: detailForEspnStatus(state, date, time, status, event.status?.displayClock),
    shortDetail: shortDetailForEspnStatus(state, status, event.status?.displayClock),
    displayClock: event.status?.displayClock || "",
    minute: parseMinute(event.status?.displayClock || status.shortDetail || status.detail),
    scoreA: Number(home.score || 0),
    scoreB: Number(away.score || 0),
    teamA: teamFromEspn(home.team),
    teamB: teamFromEspn(away.team),
  };
}

function detailForEspnStatus(state, date, time, status, displayClock) {
  if (state === "pre") return `${formatDateLabel(date)} · ${time || "TBD"}`;
  if (state === "in") return displayClock || status.shortDetail || status.detail || "Live";
  if (state === "post") return status.shortDetail || "Final";
  return status.shortDetail || status.detail || "Status";
}

function shortDetailForEspnStatus(state, status, displayClock) {
  if (state === "pre") return "Pregame";
  if (state === "in") return displayClock || "Live";
  if (state === "post") return "Final";
  return status.shortDetail || "Status";
}

function teamFromEspn(team = {}) {
  return {
    name: team.displayName || team.name || team.shortDisplayName || "",
    shortName: team.shortDisplayName || team.name || team.displayName || "",
    abbreviation: team.abbreviation || "",
    logo: team.logo || "",
  };
}

function parseMinute(text = "") {
  const match = String(text).match(/(\d{1,3})/);
  return match ? Number(match[1]) : undefined;
}

function applyEspnEvents(events) {
  matches.forEach((match) => {
    const espnMatch = findEspnMatch(match, events);
    if (!espnMatch) return;
    const event = espnMatch.event;
    const live = espnMatch.reversed ? reverseLiveEvent(event) : event;
    match.date = live.date || match.date;
    match.label = formatDateLabel(match.date);
    match.time = live.time || match.time;
    match.live = live;
  });
}

function findEspnMatch(match, events) {
  for (const event of events) {
    const eventKeysA = teamKeys(event.teamA.name, event.teamA.abbreviation, event.teamA.shortName);
    const eventKeysB = teamKeys(event.teamB.name, event.teamB.abbreviation, event.teamB.shortName);
    const matchKeysA = teamKeys(match.teamA);
    const matchKeysB = teamKeys(match.teamB);
    const direct = hasIntersection(matchKeysA, eventKeysA) && hasIntersection(matchKeysB, eventKeysB);
    const reverse = hasIntersection(matchKeysA, eventKeysB) && hasIntersection(matchKeysB, eventKeysA);
    if (direct || reverse) return { event, reversed: reverse };
  }
  return null;
}

function reverseLiveEvent(event) {
  return {
    ...event,
    scoreA: event.scoreB,
    scoreB: event.scoreA,
    teamA: event.teamB,
    teamB: event.teamA,
  };
}

function teamKeys(...values) {
  return values
    .filter(Boolean)
    .flatMap((value) => [normalize(value), ...(TEAM_ALIASES[normalize(value)] || []).map(normalize)])
    .filter(Boolean);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasIntersection(a, b) {
  return a.some((value) => b.includes(value));
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).replace(",", "");
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function liveScoreText(match) {
  const live = match.live;
  return live ? `${live.scoreA} - ${live.scoreB}` : "0 - 0";
}

function liveCardText(match) {
  if (!match.live) return `AI lean: ${topOutcome(match).displayLabel}`;
  if (match.live.state === "pre") return match.live.shortDetail || "Pregame";
  if (match.live.state === "in") return match.live.displayClock || match.live.shortDetail || "Live";
  if (match.live.state === "post") return "Final";
  return match.live.shortDetail || "Status";
}

function renderProviderStatus() {
  if (!lastRefreshAt) return;
  refreshText.textContent = nextRefreshText();
}

function setProviderStatus(status, text, detail) {
  providerDot.className = `providerDot ${status}`;
  providerText.textContent = text;
  refreshText.textContent = detail;
}

function timeAgo(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  return `${Math.floor(seconds / 60)} min ago`;
}

function selectedDayHasLiveMatch() {
  return currentDay()?.matches.some((match) => match.live?.state === "in") || false;
}

function nextRefreshMs() {
  return selectedDayHasLiveMatch() ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
}

function nextRefreshText() {
  const cadence = Math.round(nextRefreshMs() / 1000);
  const last = lastRefreshAt ? `Updated ${timeAgo(lastRefreshAt)}` : "Ready";
  return `${last} · every ${cadence}s`;
}

function scheduleNextRefresh() {
  refreshTimer = setTimeout(refreshEspnData, nextRefreshMs());
}

function syncSelectedMatch() {
  selectedMatch = matches.find((match) => match.id === selectedMatch.id) || selectedMatch;
  if (!days.some((day) => day.key === selectedDayKey)) selectedDayKey = selectedMatch.date;
}

function showAppError(error) {
  console.error(error);
  if (!appError) return;
  appError.hidden = false;
  appError.textContent = `App error: ${error?.message || error}`;
}
