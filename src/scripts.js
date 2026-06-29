
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkMjFhNzExNTRjZjU2OTUwOWY2ZjAzNzM5ZTRhMzNkYSIsIm5iZiI6MTc4MjQ3NDYzOC40MzM5OTk4LCJzdWIiOiI2YTNlNjc4ZTdiOGY3Y2VlYmZmMDFkYWIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.ZEh-4iIW3Ey68V69l_RbkgWI57A2wKsYAvp6--zzBls";
const BASE_URL = "https://api.themoviedb.org/3";

const IMG_BASE  = "https://image.tmdb.org/t/p/w500";
const IMG_ORIG  = "https://image.tmdb.org/t/p/original";


const VIDKING   = "https://www.vidking.net/embed/movie";
const ACCENT    = "3B5BDB"; // used in Vidking color param


async function tmdb(endpoint, params = "") {
  const url = `${BASE_URL}${endpoint}?language=en-US&${params}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "accept": "application/json"
    }
  });
  const data = await res.json();
  return data.results ?? data;
}


async function init() {
  const [trending, popular, nowPlaying, action, scifi, comedy, topRated, horror] =
    await Promise.all([
      tmdb("/trending/movie/day"),
      tmdb("/movie/popular"),
      tmdb("/movie/now_playing"),
      tmdb("/discover/movie", "with_genres=28"),          // 28 = Action
      tmdb("/discover/movie", "with_genres=878"),         // 878 = Sci-Fi
      tmdb("/discover/movie", "with_genres=35"),          // 35 = Comedy
      tmdb("/movie/top_rated"),
      tmdb("/discover/movie", "with_genres=27"),          // 27 = Horror
    ]);

  buildHero(trending[0]);

  renderRow("trending-row",  trending);
  renderTop10("top10-row",   popular.slice(0, 10));
  renderRow("new-row",       nowPlaying, "NEW");
  renderRow("action-row",    action);
  renderRow("scifi-row",     scifi);
  renderRow("comedy-row",    comedy);
  renderRow("toprated-row",  topRated);
  renderRow("horror-row",    horror);
}

// ── HERO ────────────────────────────────────────────────────
function buildHero(movie) {
  // Set backdrop image
  const bg = document.querySelector(".hero-bg-fill");
  bg.style.cssText = `
    background-image:
      linear-gradient(to right, rgba(11,11,15,.92) 30%, rgba(11,11,15,.3) 80%),
      linear-gradient(to top,   rgba(11,11,15,1)  0%,  transparent 50%),
      url(${IMG_ORIG}${movie.backdrop_path});
    background-size: cover;
    background-position: center top;
  `;

  document.querySelector(".hero-title").textContent = movie.title;
  document.querySelector(".hero-desc").textContent  = movie.overview;
  document.querySelector(".hero-rating").innerHTML  = `&#9733; ${movie.vote_average.toFixed(1)}`;

  // Hero play button → open Vidking directly
  document.querySelector(".btn-play").onclick = () => openPlayer(movie.id, movie.title);

  // Hero "More Info" → open detail modal
  document.querySelector(".btn-more").onclick = () => openModal(movie.id);
}

// ── RENDER HELPERS ──────────────────────────────────────────
function renderRow(id, movies, badge) {
  document.getElementById(id).innerHTML = movies.map(m => cardHTML(m, badge)).join("");
  // Attach click listeners after injecting HTML
  document.getElementById(id).querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(+card.dataset.id));
  });
}

function renderTop10(id, movies) {
  document.getElementById(id).innerHTML = movies.map((m, i) => top10HTML(m, i)).join("");
  document.getElementById(id).querySelectorAll(".top10-item").forEach(el => {
    el.addEventListener("click", () => openModal(+el.dataset.id));
  });
}

// [📖 LEARN] Template literals (`backticks`) let you write
// multi-line HTML strings with ${variables} inside.
function cardHTML(m, badge) {
  const poster = m.poster_path ? `${IMG_BASE}${m.poster_path}` : "";
  return `
    <div class="card" data-id="${m.id}">
      ${badge ? `<div class="card-badge">${badge}</div>` : ""}
      <img class="card-poster" src="${poster}" alt="${m.title}" loading="lazy">
      <div class="card-info">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span class="card-star">&#9733; ${m.vote_average.toFixed(1)}</span>
          <span class="dot">&middot;</span>
          <span>${m.release_date ? m.release_date.slice(0, 4) : "N/A"}</span>
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

// ── MODAL SYSTEM ────────────────────────────────────────────
// [📖 LEARN] A "modal" is just a div that sits on top of
// everything (high z-index) with a semi-transparent backdrop.
// We show/hide it by toggling a CSS class.

const modal = document.getElementById("movie-modal");
const modalBody = document.getElementById("modal-body");

// Close modal on backdrop click
modal.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});

// Close on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

function closeModal() {
  modal.classList.remove("open");
  // IMPORTANT: clear iframe src to stop video playback when modal closes
  modalBody.innerHTML = "";
}

async function openModal(movieId) {
  modal.classList.add("open");
  modalBody.innerHTML = `<div class="modal-loading">Loading…</div>`;

  // [📖 LEARN] We fire TWO requests in parallel:
  // 1. /movie/{id}         → movie details (runtime, genres, tagline…)
  // 2. /movie/{id}/videos  → trailers, teasers, clips
  const [details, videos] = await Promise.all([
    tmdb(`/movie/${movieId}`),
    tmdb(`/movie/${movieId}/videos`),
  ]);

  // [📖 LEARN] Find the YouTube trailer key.
  // TMDB returns an array of video objects. We prefer:
  //   type === "Trailer" AND site === "YouTube"
  // The key is the YouTube video ID: youtube.com/watch?v={key}
  const trailer =
  videos.find(v => v.site === "YouTube" && v.type === "Trailer") ||
  videos.find(v => v.site === "YouTube") ||
  videos[0] ||
  null;

  const genres = details.genres.map(g => `<span>${g.name}</span>`).join("");
  const runtime = details.runtime
    ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m`
    : "N/A";
  const trailerEmbed = trailer
    ? `<iframe
         src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1"
         frameborder="0" allowfullscreen
         class="modal-trailer"
       ></iframe>`
    : `<div class="no-trailer">No trailer available</div>`;

  modalBody.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>

    <!-- TRAILER -->
    <div class="modal-trailer-wrap">
      ${trailerEmbed}
    </div>

    <!-- MOVIE INFO -->
    <div class="modal-info">
      <h2 class="modal-title">${details.title}</h2>
      ${details.tagline ? `<p class="modal-tagline">"${details.tagline}"</p>` : ""}

      <div class="modal-meta-row">
        <span class="modal-rating">&#9733; ${details.vote_average.toFixed(1)}</span>
        <span class="dot">&middot;</span>
        <span>${details.release_date ? details.release_date.slice(0, 4) : ""}</span>
        <span class="dot">&middot;</span>
        <span>${runtime}</span>
        ${details.adult ? `<span class="badge-adult">18+</span>` : ""}
      </div>

      <div class="modal-genres">${genres}</div>

      <p class="modal-overview">${details.overview}</p>

      <button class="btn-watch-now" onclick="openPlayer(${details.id}, '${details.title.replace(/'/g, "\\'")}')">
        &#9654;&nbsp; Watch Now
      </button>
    </div>
  `;
}


function openPlayer(movieId, title) {
  // Build the Vidking URL
  const vidkingURL = `${VIDKING}/${movieId}?color=${ACCENT}&autoPlay=true`;

  modal.classList.add("open");
  modalBody.innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="player-title">${title}</div>

    
    <iframe
      src="${vidkingURL}"
      class="vidking-player"
      frameborder="0"
      allowfullscreen
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
    ></iframe>

    <div class="player-progress-bar">
      <div class="player-progress-fill" id="progress-fill"></div>
    </div>
    <div id="player-status" class="player-status"></div>
  `;
  window.addEventListener("message", handlePlayerMessage);
}


function handlePlayerMessage(event) {
  try {
    const msg = JSON.parse(event.data);
    if (msg.type !== "PLAYER_EVENT") return;

    const { event: evtName, progress, currentTime, duration } = msg.data;

    // Update our custom progress bar
    const fill = document.getElementById("progress-fill");
    const status = document.getElementById("player-status");
    if (fill && progress != null) {
      fill.style.width = `${Math.min(progress, 100)}%`;
    }
    if (status) {
      if (evtName === "play")  status.textContent = "▶ Playing";
      if (evtName === "pause") status.textContent = "⏸ Paused";
      if (evtName === "ended") status.textContent = "✓ Finished";
    }

  } catch (e) {
    console.log(e);
  }
}

// ── TABS ────────────────────────────────────────────────────
document.querySelectorAll(".section-tabs").forEach(tabs => {
  tabs.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });
});

// ── GO ──────────────────────────────────────────────────────
init();