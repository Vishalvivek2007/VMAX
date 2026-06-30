// ── CONFIG ───────────────────────────────────────────────────
const TOKEN_KEY   = "vmax_token";
const USER_KEY    = "vmax_user";
const APP_ORIGIN  = window.location.origin;
const API_BASE    = `${APP_ORIGIN}/api`;
const TMDB_TOKEN  = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkMjFhNzExNTRjZjU2OTUwOWY2ZjAzNzM5ZTRhMzNkYSIsIm5iZiI6MTc4MjQ3NDYzOC40MzM5OTk4LCJzdWIiOiI2YTNlNjc4ZTdiOGY3Y2VlYmZmMDFkYWIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.ZEh-4iIW3Ey68V69l_RbkgWI57A2wKsYAvp6--zzBls";
const TMDB_BASE   = "https://api.themoviedb.org/3";
const IMG_BASE    = "https://image.tmdb.org/t/p/w500";
const IMG_ORIG    = "https://image.tmdb.org/t/p/original";
const VIDKING     = "https://www.vidking.net/embed/movie";
const VIDKING_TV  = "https://www.vidking.net/embed/tv";
const ACCENT      = "3B5BDB";

// ── STATE ────────────────────────────────────────────────────
let currentUser      = JSON.parse(localStorage.getItem(USER_KEY) || "null");
let authToken        = localStorage.getItem(TOKEN_KEY) || null;
let userWatchlist    = [];
let currentSection   = "home";
let socket           = null;
let currentRoom      = null;
let currentRoomMovie = null;
let currentPlayer    = null;
let applyingRoomSync = false;
let searchTimeout    = null;
let seriesLoaded     = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── TMDB FETCH ───────────────────────────────────────────────
async function tmdb(endpoint, params = "") {
  const url = `${TMDB_BASE}${endpoint}?language=en-US&${params}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${TMDB_TOKEN}`, "accept": "application/json" }
  });
  const data = await res.json();
  return data.results ?? data;
}

// ── API FETCH (backend) ──────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (authToken) opts.headers["Authorization"] = `Bearer ${authToken}`;
  if (body) opts.body = JSON.stringify(body);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json().catch(() => ({}));

      if (res.ok) return data;
      if (![502, 503, 504].includes(res.status) || attempt === 3) {
        return data.error ? data : { error: data.message || `Request failed (${res.status})` };
      }
    } catch (err) {
      if (attempt === 3) {
        return { error: "Server is waking up. Please try again in a few seconds." };
      }
    }

    await sleep(900 * (attempt + 1));
  }

  return { error: "Server is waking up. Please try again in a few seconds." };
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  updateNavAvatar();
  initSearch();
  initNavLinks();
  if (authToken) loadWatchlist();

  const [trending, popular, nowPlaying, action, scifi, comedy, topRated, horror] =
    await Promise.all([
      tmdb("/trending/movie/day"),
      tmdb("/movie/popular"),
      tmdb("/movie/now_playing"),
      tmdb("/discover/movie", "with_genres=28"),
      tmdb("/discover/movie", "with_genres=878"),
      tmdb("/discover/movie", "with_genres=35"),
      tmdb("/movie/top_rated"),
      tmdb("/discover/movie", "with_genres=27"),
    ]);

  buildHero(trending[0], "movie");
  renderRow("trending-row",  trending,  "movie");
  renderTop10("top10-row",   popular.slice(0, 10));
  renderRow("new-row",       nowPlaying,"movie", "NEW");
  renderRow("action-row",    action,    "movie");
  renderRow("scifi-row",     scifi,     "movie");
  renderRow("comedy-row",    comedy,    "movie");
  renderRow("toprated-row",  topRated,  "movie");
  renderRow("horror-row",    horror,    "movie");
}

// ── NAV LINKS ────────────────────────────────────────────────
function initNavLinks() {
  document.querySelectorAll(".nav-links a").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const section = a.dataset.section;
      switchSection(section);
    });
  });
  document.getElementById("room-nav-btn").addEventListener("click", openRoomModal);
  document.getElementById("nav-avatar").addEventListener("click", () => {
    if (currentUser) showUserMenu();
    else openAuthModal();
  });
}

function switchSection(section) {
  currentSection = section;
  document.querySelectorAll(".nav-links a").forEach(a => {
    a.classList.toggle("active", a.dataset.section === section);
  });

  document.getElementById("hero-section").style.display    = (section === "home" || section === "movies") ? "" : "none";
  document.getElementById("movies-sections").style.display = (section === "home" || section === "movies") ? "" : "none";
  document.getElementById("series-sections").style.display = section === "series" ? "" : "none";
  document.getElementById("watchlist-section").style.display = section === "watchlist" ? "" : "none";

  if (section === "series" && !seriesLoaded) loadSeries();
  if (section === "watchlist") renderWatchlistSection();
}

// ── SERIES ───────────────────────────────────────────────────
async function loadSeries() {
  seriesLoaded = true;
  const [trending, popular, topRated, drama, crime, scifi] = await Promise.all([
    tmdb("/trending/tv/day"),
    tmdb("/tv/popular"),
    tmdb("/tv/top_rated"),
    tmdb("/discover/tv", "with_genres=18"),   // drama
    tmdb("/discover/tv", "with_genres=80"),   // crime
    tmdb("/discover/tv", "with_genres=10765"),// sci-fi & fantasy
  ]);

  renderRow("trending-tv-row",  trending,  "tv");
  renderRow("popular-tv-row",   popular,   "tv");
  renderRow("toprated-tv-row",  topRated,  "tv");
  renderRow("drama-tv-row",     drama,     "tv");
  renderRow("crime-tv-row",     crime,     "tv");
  renderRow("scifi-tv-row",     scifi,     "tv");
}

// ── HERO ─────────────────────────────────────────────────────
function buildHero(movie, mediaType) {
  const bg = document.querySelector(".hero-bg-fill");
  bg.style.cssText = `
    background-image:
      linear-gradient(to right, rgba(11,11,15,.92) 30%, rgba(11,11,15,.3) 80%),
      linear-gradient(to top,   rgba(11,11,15,1)  0%,  transparent 50%),
      url(${IMG_ORIG}${movie.backdrop_path});
    background-size: cover;
    background-position: center top;
  `;
  const title = movie.title || movie.name;
  document.querySelector(".hero-title").textContent = title;
  document.querySelector(".hero-desc").textContent  = movie.overview;
  document.querySelector(".hero-rating").innerHTML  = `&#9733; ${movie.vote_average.toFixed(1)}`;
  document.querySelector(".btn-play").onclick = () => openPlayer(movie.id, title, mediaType);
  document.querySelector(".btn-more").onclick = () => openModal(movie.id, mediaType);
}

// ── RENDER HELPERS ───────────────────────────────────────────
function renderRow(id, movies, mediaType, badge) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = movies.map(m => cardHTML(m, mediaType, badge)).join("");
  el.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(+card.dataset.id, card.dataset.type));
  });
}

function renderTop10(id, movies) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = movies.map((m, i) => top10HTML(m, i)).join("");
  el.querySelectorAll(".top10-item").forEach(el => {
    el.addEventListener("click", () => openModal(+el.dataset.id, "movie"));
  });
}

function cardHTML(m, mediaType, badge) {
  const poster = m.poster_path ? `${IMG_BASE}${m.poster_path}` : "https://via.placeholder.com/175x263/13131a/555?text=No+Image";
  const title  = m.title || m.name || "Unknown";
  const inList = userWatchlist.some(w => w.movieId === m.id);
  return `
    <div class="card" data-id="${m.id}" data-type="${mediaType}">
      ${badge ? `<div class="card-badge">${badge}</div>` : ""}
      <div class="card-watchlist-btn ${inList ? "in-list" : ""}" data-id="${m.id}" data-type="${mediaType}" data-title="${title.replace(/"/g,"&quot;")}" data-poster="${m.poster_path || ""}" onclick="toggleWatchlist(event,${m.id},'${mediaType}','${title.replace(/'/g,"\\'")}','${m.poster_path||""}')">${inList ? "♥" : "♡"}</div>
      <img class="card-poster" src="${poster}" alt="${title}" loading="lazy">
      <div class="card-info">
        <div class="card-title">${title}</div>
        <div class="card-meta">
          <span class="card-star">&#9733; ${m.vote_average?.toFixed(1) || "N/A"}</span>
          <span class="dot">&middot;</span>
          <span>${(m.release_date || m.first_air_date || "").slice(0,4) || "N/A"}</span>
        </div>
      </div>
    </div>`;
}

function top10HTML(m, i) {
  return `
    <div class="top10-item" data-id="${m.id}">
      <div class="top10-num">${i + 1}</div>
      <img class="top10-img-placeholder" src="${IMG_BASE}${m.poster_path}" alt="${m.title}" loading="lazy">
    </div>`;
}

// ── WATCHLIST ────────────────────────────────────────────────
async function loadWatchlist() {
  if (!authToken) return;
  const data = await api("GET", "/watchlist");
  if (data.watchlist) userWatchlist = data.watchlist;
}

async function toggleWatchlist(e, movieId, mediaType, title, posterPath) {
  e.stopPropagation();
  if (!authToken) { openAuthModal(); return; }

  const btn = e.currentTarget;
  const inList = userWatchlist.some(w => w.movieId === movieId);

  if (inList) {
    await api("DELETE", `/watchlist/${movieId}`);
    userWatchlist = userWatchlist.filter(w => w.movieId !== movieId);
    btn.textContent = "♡";
    btn.classList.remove("in-list");
  } else {
    const data = await api("POST", "/watchlist", { movieId, title, posterPath, mediaType });
    if (data.watchlist) userWatchlist = data.watchlist;
    btn.textContent = "♥";
    btn.classList.add("in-list");
  }
}

function renderWatchlistSection() {
  const row = document.getElementById("watchlist-row");
  const empty = document.getElementById("watchlist-empty");
  if (!authToken) {
    row.innerHTML = `<div class="watchlist-login-prompt">
      <p>Sign in to access your watchlist.</p>
      <button class="btn-play" onclick="openAuthModal()" style="margin-top:14px">Sign In</button>
    </div>`;
    empty.style.display = "none";
    return;
  }
  if (!userWatchlist.length) {
    row.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  row.innerHTML = userWatchlist.map(w => `
    <div class="card" data-id="${w.movieId}" data-type="${w.mediaType}" onclick="openModal(${w.movieId},'${w.mediaType}')">
      <div class="card-watchlist-btn in-list" onclick="toggleWatchlist(event,${w.movieId},'${w.mediaType}','','')">♥</div>
      <img class="card-poster" src="${w.posterPath ? IMG_BASE + w.posterPath : 'https://via.placeholder.com/175x263/13131a/555?text=No+Image'}" loading="lazy">
      <div class="card-info">
        <div class="card-title">${w.title}</div>
        <div class="card-meta"><span style="color:#7B93F5;font-size:11px;text-transform:uppercase">${w.mediaType === "tv" ? "Series" : "Movie"}</span></div>
      </div>
    </div>`).join("");
}

// ── MODAL SYSTEM ─────────────────────────────────────────────
const modal     = document.getElementById("movie-modal");
const modalBody = document.getElementById("modal-body");

modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllModals(); });

function closeModal() {
  modal.classList.remove("open");
  modalBody.innerHTML = "";
  currentPlayer = null;
}

function closeAllModals() {
  closeModal();
  closeAuthModal();
  closeRoomModal();
  closeSearch();
}

async function openModal(id, mediaType = "movie") {
  modal.classList.add("open");
  modalBody.innerHTML = `<div class="modal-loading">Loading…</div>`;

  if (mediaType === "tv") {
    await openTVModal(id);
  } else {
    await openMovieModal(id);
  }
}

async function openMovieModal(movieId) {
  const [details, videos] = await Promise.all([
    tmdb(`/movie/${movieId}`),
    tmdb(`/movie/${movieId}/videos`),
  ]);

  const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") ||
    videos.find(v => v.site === "YouTube") || videos[0] || null;

  const genres  = (details.genres || []).map(g => `<span>${g.name}</span>`).join("");
  const runtime = details.runtime
    ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : "N/A";

  const trailerEmbed = trailer
    ? `<iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1"
         frameborder="0" allowfullscreen class="modal-trailer"></iframe>`
    : `<div class="no-trailer">No trailer available</div>`;

  const inList = userWatchlist.some(w => w.movieId === movieId);

  modalBody.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="modal-trailer-wrap">${trailerEmbed}</div>
    <div class="modal-info">
      <h2 class="modal-title">${details.title}</h2>
      ${details.tagline ? `<p class="modal-tagline">"${details.tagline}"</p>` : ""}
      <div class="modal-meta-row">
        <span class="modal-rating">&#9733; ${details.vote_average?.toFixed(1)}</span>
        <span class="dot">&middot;</span>
        <span>${(details.release_date || "").slice(0,4)}</span>
        <span class="dot">&middot;</span>
        <span>${runtime}</span>
        ${details.adult ? `<span class="badge-adult">18+</span>` : ""}
      </div>
      <div class="modal-genres">${genres}</div>
      <p class="modal-overview">${details.overview}</p>
      <div class="modal-actions">
        <button class="btn-watch-now" onclick="openPlayer(${details.id}, '${details.title.replace(/'/g,"\\'")}', 'movie')">
          &#9654;&nbsp; Watch Now
        </button>
        <button class="btn-watchlist-modal ${inList ? "in-list" : ""}"
          onclick="toggleWatchlist(event,${movieId},'movie','${details.title.replace(/'/g,"\\'")}','${details.poster_path||""}')">
          ${inList ? "♥ In My List" : "♡ Add to List"}
        </button>
        ${currentRoom ? `<button class="btn-watch-room" onclick="watchInRoom(${details.id},'${details.title.replace(/'/g,"\\'")}','movie')">🎬 Watch in Room</button>` : ""}
      </div>
    </div>`;
}

async function openTVModal(tvId) {
  const details = await tmdb(`/tv/${tvId}`);
  const videos  = await tmdb(`/tv/${tvId}/videos`);

  const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") ||
    videos.find(v => v.site === "YouTube") || videos[0] || null;

  const genres  = (details.genres || []).map(g => `<span>${g.name}</span>`).join("");
  const seasons = (details.seasons || []).filter(s => s.season_number > 0);
  const inList  = userWatchlist.some(w => w.movieId === tvId);

  const trailerEmbed = trailer
    ? `<iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1"
         frameborder="0" allowfullscreen class="modal-trailer"></iframe>`
    : `<div class="no-trailer">No trailer available</div>`;

  // Season selector
  const seasonOpts = seasons.map(s =>
    `<option value="${s.season_number}">Season ${s.season_number} (${s.episode_count} eps)</option>`
  ).join("");

  modalBody.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="modal-trailer-wrap">${trailerEmbed}</div>
    <div class="modal-info">
      <div class="tv-badge">SERIES</div>
      <h2 class="modal-title">${details.name}</h2>
      ${details.tagline ? `<p class="modal-tagline">"${details.tagline}"</p>` : ""}
      <div class="modal-meta-row">
        <span class="modal-rating">&#9733; ${details.vote_average?.toFixed(1)}</span>
        <span class="dot">&middot;</span>
        <span>${(details.first_air_date || "").slice(0,4)}</span>
        <span class="dot">&middot;</span>
        <span>${details.number_of_seasons} Season${details.number_of_seasons !== 1 ? "s" : ""}</span>
        <span class="dot">&middot;</span>
        <span>${details.number_of_episodes} Episodes</span>
      </div>
      <div class="modal-genres">${genres}</div>
      <p class="modal-overview">${details.overview}</p>

      <!-- Season / Episode Picker -->
      <div class="episode-picker">
        <div class="picker-row">
          <select class="season-select" id="season-select" onchange="loadEpisodes(${tvId})">
            ${seasonOpts}
          </select>
          <select class="episode-select" id="episode-select">
            <option>Select season first</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-watch-now" onclick="watchTVEpisode(${tvId}, '${details.name.replace(/'/g,"\\'")}')">
            &#9654;&nbsp; Play Episode
          </button>
          <button class="btn-watchlist-modal ${inList ? "in-list" : ""}"
            onclick="toggleWatchlist(event,${tvId},'tv','${details.name.replace(/'/g,"\\'")}','${details.poster_path||""}')">
            ${inList ? "♥ In My List" : "♡ Add to List"}
          </button>
        </div>
      </div>

      <div class="episodes-grid" id="episodes-grid">
        <p style="color:#555;font-size:13px">Choose a season to see episodes.</p>
      </div>
    </div>`;

  // Auto-load season 1 episodes
  if (seasons.length) loadEpisodes(tvId);
}

async function loadEpisodes(tvId) {
  const seasonNum = +document.getElementById("season-select").value;
  const grid      = document.getElementById("episodes-grid");
  const epSelect  = document.getElementById("episode-select");
  grid.innerHTML  = `<div style="color:#555;font-size:13px">Loading episodes…</div>`;

  const season = await tmdb(`/tv/${tvId}/season/${seasonNum}`);
  const eps    = season.episodes || [];

  // Populate dropdown
  epSelect.innerHTML = eps.map(e =>
    `<option value="${e.episode_number}">Ep ${e.episode_number}: ${e.name}</option>`
  ).join("");

  // Render episode cards
  grid.innerHTML = eps.map(ep => `
    <div class="episode-card" onclick="openPlayerTV(${tvId}, '${ep.name.replace(/'/g,"\\'")}', ${seasonNum}, ${ep.episode_number})">
      <div class="ep-thumb-wrap">
        ${ep.still_path
          ? `<img class="ep-thumb" src="${IMG_BASE}${ep.still_path}" loading="lazy">`
          : `<div class="ep-thumb-placeholder">EP ${ep.episode_number}</div>`}
        <div class="ep-play-icon">▶</div>
      </div>
      <div class="ep-info">
        <div class="ep-num">Episode ${ep.episode_number}</div>
        <div class="ep-name">${ep.name}</div>
        ${ep.runtime ? `<div class="ep-runtime">${ep.runtime}m</div>` : ""}
      </div>
    </div>`).join("");
}

function watchTVEpisode(tvId, showName) {
  const seasonNum = +document.getElementById("season-select").value;
  const epNum     = +document.getElementById("episode-select").value;
  openPlayerTV(tvId, showName, seasonNum, epNum);
}

// ── PLAYER ───────────────────────────────────────────────────
function openPlayer(movieId, title, mediaType = "movie") {
  if (mediaType === "tv") {
    openPlayerTV(movieId, title, 1, 1);
    return;
  }
  openRoomPlayer({ movieId, title, mediaType });
}

function openPlayerTV(tvId, showName, season, episode) {
  openRoomPlayer({ movieId: tvId, title: showName, mediaType: "tv", season, episode });
}

function playerUrlFor(item, options = {}) {
  const mediaType = item.mediaType || "movie";
  const url = mediaType === "tv"
    ? new URL(`${VIDKING_TV}/${item.movieId}/${item.season || 1}/${item.episode || 1}`)
    : new URL(`${VIDKING}/${item.movieId}`);
  url.searchParams.set("color", ACCENT);
  url.searchParams.set("autoPlay", options.autoplay === false ? "false" : "true");
  if (mediaType === "tv") {
    url.searchParams.set("nextEpisode", "true");
    url.searchParams.set("episodeSelector", "true");
  }

  const startAt = Number(options.currentTime);
  if (Number.isFinite(startAt) && startAt > 0) {
    url.searchParams.set("progress", Math.floor(startAt));
  }

  return url.toString();
}

function openRoomPlayer(item, options = {}) {
  const normalized = {
    movieId: item.movieId,
    title: item.title || item.movieTitle || "Now Playing",
    mediaType: item.mediaType || "movie",
    season: item.season || 1,
    episode: item.episode || 1
  };

  if (options.roomSynced) currentRoomMovie = normalized;
  currentPlayer = {
    ...normalized,
    currentTime: Number(options.currentTime) || 0,
    playing: options.playing ?? false,
    roomSynced: !!options.roomSynced
  };

  const displayTitle = normalized.mediaType === "tv"
    ? `${normalized.title} - S${String(normalized.season).padStart(2,"0")}E${String(normalized.episode).padStart(2,"0")}`
    : normalized.title;

  _showPlayer(playerUrlFor(normalized, options), displayTitle);
}

function _showPlayer(url, title) {
  modal.classList.add("open");
  modalBody.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="player-title">${title}</div>
    <iframe src="${url}" class="vidking-player" frameborder="0" allowfullscreen
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>
    <div class="player-progress-bar"><div class="player-progress-fill" id="progress-fill"></div></div>
    <div id="player-status" class="player-status"></div>`;
  window.addEventListener("message", handlePlayerMessage);
}

function handlePlayerMessage(event) {
  try {
    const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    if (msg.type !== "PLAYER_EVENT") return;
    const { event: evtName, progress } = msg.data;
    const currentTime = Number(msg.data.currentTime || msg.data.time || 0);
    if (currentPlayer && Number.isFinite(currentTime)) currentPlayer.currentTime = currentTime;
    const fill   = document.getElementById("progress-fill");
    const status = document.getElementById("player-status");
    if (fill && progress != null) fill.style.width = `${Math.min(progress, 100)}%`;
    if (status) {
      if (evtName === "play")  status.textContent = "▶ Playing";
      if (evtName === "pause") status.textContent = "⏸ Paused";
      if (evtName === "ended") status.textContent = "✓ Finished";
    }
    // Sync to room if in one
    if (currentRoom && socket && currentPlayer?.roomSynced && !applyingRoomSync) {
      if (evtName === "play")  socket.emit("room-play",  { roomCode: currentRoom, currentTime });
      if (evtName === "pause") socket.emit("room-pause", { roomCode: currentRoom, currentTime });
      if (evtName === "seeked" || evtName === "seek") socket.emit("room-seek", { roomCode: currentRoom, currentTime });
    }
  } catch (e) {}
}

function postPlayerCommand(action, currentTime) {
  const iframe = document.querySelector(".vidking-player");
  if (!iframe?.contentWindow) return false;

  const payloads = [
    { type: "PLAYER_COMMAND", action, currentTime },
    { type: "PLAYER_COMMAND", event: action, data: { currentTime } },
    { type: "CONTROL_PLAYER", action, time: currentTime }
  ];

  payloads.forEach(payload => {
    iframe.contentWindow.postMessage(JSON.stringify(payload), "*");
    iframe.contentWindow.postMessage(payload, "*");
  });

  return true;
}

function applyRoomSync(action, currentTime = 0, username = "Someone") {
  if (!currentRoomMovie) {
    addChatMessage("system", `${username} changed playback, but no movie is open yet`);
    return;
  }

  applyingRoomSync = true;
  currentPlayer = {
    ...(currentPlayer || currentRoomMovie),
    currentTime,
    playing: action === "play"
  };

  postPlayerCommand(action, currentTime);
  setTimeout(() => {
    applyingRoomSync = false;
  }, 2500);

  openRoomPlayer(currentRoomMovie, {
    currentTime,
    playing: action === "play",
    autoplay: action !== "pause",
    roomSynced: true
  });

  const status = document.getElementById("player-status");
  if (status) status.textContent = `${username} ${action === "play" ? "played" : action === "pause" ? "paused" : "seeked"} the room`;
}

// ── SEARCH ───────────────────────────────────────────────────
function initSearch() {
  const overlay  = document.getElementById("search-overlay");
  const input    = document.getElementById("search-input");
  const clearBtn = document.getElementById("search-clear");
  const toggleBtn = document.getElementById("search-toggle");

  toggleBtn.addEventListener("click", () => {
    overlay.classList.add("open");
    setTimeout(() => input.focus(), 100);
  });

  clearBtn.addEventListener("click", closeSearch);

  input.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (!q) {
      document.getElementById("search-content").innerHTML = `<div class="search-hint"><p>Start typing to search across thousands of titles</p></div>`;
      return;
    }
    document.getElementById("search-content").innerHTML = `<div class="search-loading">Searching…</div>`;
    searchTimeout = setTimeout(() => runSearch(q), 350);
  });

  // Close on Escape
  input.addEventListener("keydown", e => { if (e.key === "Escape") closeSearch(); });
}

function closeSearch() {
  const overlay = document.getElementById("search-overlay");
  const input   = document.getElementById("search-input");
  overlay.classList.remove("open");
  input.value = "";
  document.getElementById("search-content").innerHTML = `<div class="search-hint"><p>Start typing to search across thousands of titles</p></div>`;
}

async function runSearch(query) {
  const [movies, tv] = await Promise.all([
    tmdb("/search/movie", `query=${encodeURIComponent(query)}`),
    tmdb("/search/tv",    `query=${encodeURIComponent(query)}`),
  ]);

  const content = document.getElementById("search-content");
  const combined = [
    ...movies.slice(0,10).map(m => ({...m, _type:"movie"})),
    ...tv.slice(0,10).map(t => ({...t, _type:"tv"})),
  ].filter(m => m.poster_path);

  if (!combined.length) {
    content.innerHTML = `<div class="search-empty">No results for "<strong>${query}</strong>"</div>`;
    return;
  }

  content.innerHTML = `
    <div class="search-label">Results for "<strong>${query}</strong>"</div>
    <div class="search-grid">${combined.map(m => searchCardHTML(m)).join("")}</div>`;

  content.querySelectorAll(".search-card").forEach(card => {
    card.addEventListener("click", () => {
      closeSearch();
      openModal(+card.dataset.id, card.dataset.type);
    });
  });
}

function searchCardHTML(m) {
  const title = m.title || m.name || "Unknown";
  const year  = (m.release_date || m.first_air_date || "").slice(0,4);
  return `
    <div class="search-card" data-id="${m.id}" data-type="${m._type}">
      <img src="${IMG_BASE}${m.poster_path}" alt="${title}" loading="lazy">
      <div class="search-card-overlay">
        <div class="search-card-title">${title}</div>
        <div class="search-card-meta">
          <span class="search-card-type">${m._type === "tv" ? "Series" : "Movie"}</span>
          ${year ? `<span>${year}</span>` : ""}
          ${m.vote_average ? `<span>★ ${m.vote_average.toFixed(1)}</span>` : ""}
        </div>
      </div>
    </div>`;
}

// ── AUTH ─────────────────────────────────────────────────────
function updateNavAvatar() {
  const avatar = document.getElementById("nav-avatar");
  if (currentUser) {
    avatar.textContent = currentUser.username.slice(0,2).toUpperCase();
    avatar.classList.add("logged-in");
  } else {
    avatar.textContent = "?";
    avatar.classList.remove("logged-in");
  }
}

function openAuthModal() {
  document.getElementById("auth-modal").classList.add("open");
}
function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("open");
  document.getElementById("login-error").textContent = "";
  document.getElementById("reg-error").textContent = "";
}

function switchAuthTab(tab) {
  document.getElementById("login-tab").classList.toggle("active", tab === "login");
  document.getElementById("register-tab").classList.toggle("active", tab === "register");
  document.getElementById("login-form").style.display    = tab === "login" ? "" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "" : "none";
}

async function handleLogin() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("login-error");
  errEl.textContent = "";

  const data = await api("POST", "/auth/login", { email, password });
  if (data.error) { errEl.textContent = data.error; return; }

  authToken   = data.token;
  currentUser = data.user;
  localStorage.setItem(TOKEN_KEY, authToken);
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  closeAuthModal();
  updateNavAvatar();
  loadWatchlist();
}

async function handleRegister() {
  const username = document.getElementById("reg-username").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl    = document.getElementById("reg-error");
  errEl.textContent = "";

  const data = await api("POST", "/auth/register", { username, email, password });
  if (data.error) { errEl.textContent = data.error; return; }

  authToken   = data.token;
  currentUser = data.user;
  localStorage.setItem(TOKEN_KEY, authToken);
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  closeAuthModal();
  updateNavAvatar();
}

function showUserMenu() {
  // Simple sign-out on avatar click (could expand to dropdown)
  if (confirm(`Signed in as ${currentUser.username}. Sign out?`)) {
    authToken   = null;
    currentUser = null;
    userWatchlist = [];
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    updateNavAvatar();
  }
}

// ── WATCH ROOM ───────────────────────────────────────────────
function openRoomModal() {
  if (!authToken) { openAuthModal(); return; }
  document.getElementById("room-modal").classList.add("open");
}
function closeRoomModal() {
  document.getElementById("room-modal").classList.remove("open");
  document.getElementById("room-error").textContent = "";
}

async function createRoom() {
  await warmBackend();
  const data = await api("POST", "/rooms/create", {});
  if (data.error) { document.getElementById("room-error").textContent = data.error; return; }
  enterRoom(data.room.code, true);
  closeRoomModal();
}

async function joinRoom() {
  await warmBackend();
  const code = document.getElementById("join-code-input").value.trim().toUpperCase();
  if (code.length !== 6) { document.getElementById("room-error").textContent = "Enter a valid 6-character code"; return; }

  const data = await api("GET", `/rooms/${code}`);
  if (data.error) { document.getElementById("room-error").textContent = data.error; return; }
  enterRoom(code, false);
  closeRoomModal();
}

async function warmBackend() {
  await api("GET", "/warmup");
}

function enterRoom(code, isHost) {
  currentRoom = code;
  document.getElementById("hud-code").textContent = code;
  document.getElementById("room-hud").style.display = "block";

  // Connect socket
  if (socket) socket.disconnect();
  socket = io(APP_ORIGIN, {
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    timeout: 20000
  });
  socket.emit("join-room", { roomCode: code, username: currentUser?.username || "Guest" });

  socket.on("connect_error", () => {
    addChatMessage("system", "Connecting to the room server...");
  });

  socket.io.on("reconnect", () => {
    socket.emit("join-room", { roomCode: code, username: currentUser?.username || "Guest" });
    addChatMessage("system", "Reconnected to the room");
  });

  socket.on("member-count", count => {
    document.getElementById("hud-member-count").textContent = count;
  });

  socket.on("user-joined", ({ username }) => addChatMessage("system", `${username} joined the room`));
  socket.on("user-left",   ({ username }) => addChatMessage("system", `${username} left the room`));

  socket.on("chat-message", ({ username, message, time }) => {
    addChatMessage(username, message, time);
  });

  socket.on("room-state", state => {
    if (!state?.movieId) return;
    currentRoomMovie = {
      movieId: state.movieId,
      title: state.movieTitle,
      mediaType: state.mediaType || "movie",
      season: state.season || 1,
      episode: state.episode || 1
    };
    openRoomPlayer(currentRoomMovie, {
      currentTime: state.currentTime || 0,
      playing: !!state.playing,
      autoplay: !!state.playing,
      roomSynced: true
    });
    addChatMessage("system", `Synced to room: ${state.movieTitle}`);
  });

  socket.on("room-movie-changed", ({ movieId, movieTitle, mediaType, season, episode }) => {
    currentRoomMovie = {
      movieId,
      title: movieTitle,
      mediaType: mediaType || "movie",
      season: season || 1,
      episode: episode || 1
    };
    openRoomPlayer(currentRoomMovie, { autoplay: true, roomSynced: true });
    addChatMessage("system", `Now watching: ${movieTitle}`);
  });

  socket.on("sync-play", ({ currentTime, username }) => applyRoomSync("play", currentTime, username));
  socket.on("sync-pause", ({ currentTime, username }) => applyRoomSync("pause", currentTime, username));
  socket.on("sync-seek", ({ currentTime, username }) => applyRoomSync("seek", currentTime, username));

  // Show toast
  showToast(isHost ? `Room created! Code: ${code}` : `Joined room ${code}`);
}

function leaveRoom() {
  if (socket) { socket.disconnect(); socket = null; }
  currentRoom = null;
  document.getElementById("room-hud").style.display = "none";
  document.getElementById("room-chat").style.display = "none";
}

function copyRoomCode() {
  navigator.clipboard.writeText(currentRoom || "").then(() => showToast("Room code copied!"));
}

function toggleRoomChat() {
  const chat = document.getElementById("room-chat");
  chat.style.display = chat.style.display === "none" ? "flex" : "none";
  if (chat.style.display === "flex") document.getElementById("chat-input").focus();
}

function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const msg   = input.value.trim();
  if (!msg || !socket) return;
  socket.emit("room-chat", { roomCode: currentRoom, message: msg });
  input.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chat-input");
  if (chatInput) {
    chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChatMessage(); });
  }
});

function addChatMessage(username, message, time) {
  const msgs = document.getElementById("chat-messages");
  if (!msgs) return;
  const isSystem = username === "system";
  const div = document.createElement("div");
  div.className = isSystem ? "chat-msg chat-system" : "chat-msg";
  div.innerHTML = isSystem
    ? `<span class="chat-system-text">${message}</span>`
    : `<span class="chat-user">${username}</span><span class="chat-text">${message}</span>${time ? `<span class="chat-time">${time}</span>` : ""}`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function watchInRoom(movieId, title, mediaType) {
  if (!socket || !currentRoom) return;
  currentRoomMovie = { movieId, title, mediaType: mediaType || "movie", season: 1, episode: 1 };
  socket.emit("room-set-movie", { roomCode: currentRoom, movieId, movieTitle: title, mediaType });
  openRoomPlayer(currentRoomMovie, { autoplay: true, roomSynced: true });
}

// ── TABS ─────────────────────────────────────────────────────
document.querySelectorAll(".section-tabs").forEach(tabs => {
  tabs.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });
});

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "vmax-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── GO ───────────────────────────────────────────────────────
init();
