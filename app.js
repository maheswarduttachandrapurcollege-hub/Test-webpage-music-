// Optimized Player & Queue with performance improvements
let player = null;
let songQueue = [];
let currentIndex = -1;
let apiReady = false;
let searchTimeout = null;

function onYouTubeIframeAPIReady(){
  apiReady = true;
  player = new YT.Player('yt-player', {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      playsinline: 1
    },
    events: {
      onStateChange: onPlayerStateChange,
      onReady: onPlayerReady
    }
  });
}

function onPlayerReady(event) {
  // Player is ready, can now perform actions
}

function onPlayerStateChange(e){
  if (e && e.data === YT.PlayerState.ENDED){
    requestAnimationFrame(() => playNext());
  }
}

function setQueue(items, autoStartFirst){
  songQueue = items.slice();
  if (!songQueue.length) return;
  currentIndex = 0;
  const it = songQueue[0];
  const vid = getVideoId(it);
  const title = it.snippet?.title || "Untitled";
  const thumb = it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url;
  updateNowPlaying(title, thumb);
  if (apiReady && player){
    if (autoStartFirst) player.loadVideoById(vid);
    else player.cueVideoById(vid);
  }
}

function playAtIndex(idx, autoplay=true){
  if (!songQueue.length) return;
  currentIndex = (idx + songQueue.length) % songQueue.length;
  const it = songQueue[currentIndex];
  const vid = getVideoId(it);
  const title = it.snippet?.title || "Untitled";
  const thumb = it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url;
  
  // Smooth title and thumbnail updates
  requestAnimationFrame(() => {
    updateNowPlaying(title, thumb);
    if (apiReady && player){
      if (autoplay) player.loadVideoById(vid);
      else player.cueVideoById(vid);
    }
  });
}

function playNext(){ 
  requestAnimationFrame(() => playAtIndex(currentIndex + 1, true)); 
}

function playPrev(){ 
  requestAnimationFrame(() => playAtIndex(currentIndex - 1, true)); 
}

function updateNowPlaying(title, thumb){
  const titleEl = document.getElementById("song-title");
  const thumbEl = document.getElementById("song-thumbnail");
  
  // Smooth transitions
  titleEl.style.opacity = '0.7';
  setTimeout(() => {
    titleEl.innerText = title;
    titleEl.style.opacity = '1';
  }, 150);
  
  if (thumb) {
    thumbEl.style.opacity = '0.7';
    thumbEl.onload = () => {
      thumbEl.style.opacity = '1';
    };
    thumbEl.src = thumb;
  }
}

// CONFIG
const apiKey = "AIzaSyCHd0jZWIldZtpl0UzbJUs4dcPO2ZmA-Ho";

// Preload query pool (randomized per refresh)
const PRELOAD_QUERIES = [
  "lofi chill", "trending music", "bollywood hits", "edm 2025", "romantic songs",
  "indie pop", "top hindi songs", "punjabi hits", "sad songs", "party mix"
];

// Debounced search function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedSearch = debounce(() => {
  const q = document.getElementById("search").value.trim();
  if (q) loadSongs(q, false);
}, 300);

document.addEventListener("DOMContentLoaded", () => {
  // Bind search with debouncing
  document.getElementById("search-btn").addEventListener("click", () => {
    const q = document.getElementById("search").value.trim();
    if (q) loadSongs(q, false);
  });
  
  document.getElementById("search").addEventListener("input", debouncedSearch);
  
  document.getElementById("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.trim();
      if (q) loadSongs(q, false);
    }
  });

  // Preload random set
  const randomQuery = PRELOAD_QUERIES[Math.floor(Math.random() * PRELOAD_QUERIES.length)];
  setTimeout(() => loadSongs(randomQuery), 100);
});

// Optimized loading with better error handling
function loadSongs(query, resetPlayer = true){
  showLoading();

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=18&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;

  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
      return r.json();
    })
    .then(data => {
      const items = data.items || [];
      requestAnimationFrame(() => {
        renderGrid(items);
        if (resetPlayer) { 
          setQueue(items, false); 
        }
        // Autoplay the first result into the top music box
        if (items.length){
          const first = items[0];
          const vid = getVideoId(first);
          const title = first.snippet?.title || "Untitled";
          const thumb = first.snippet?.thumbnails?.high?.url || first.snippet?.thumbnails?.medium?.url;
          updateNowPlaying(title, thumb);
          if (apiReady && player) {
            player.cueVideoById(vid);
          }
        }
      });
    })
    .catch(err => {
      console.error("Fetch error:", err);
      document.getElementById("results").innerHTML = `<div class="loading"><span>Could not load songs. Please try again.</span></div>`;
    });
}

// Optimized grid rendering with lazy loading concept
function renderGrid(items){
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (!items.length){
    container.innerHTML = '<div class="loading"><span>No results.</span></div>';
    return;
  }

  // Fragment for better performance
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const vid = getVideoId(item);
    const title = item.snippet?.title || "Untitled";
    const thumb = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url;

    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${index * 0.05}s`;
    
    card.innerHTML = `
      <img class="thumb loading" src="${thumb}" alt="${escapeHtml(title)}" loading="lazy" />
      <div class="info"><h3 class="title">${escapeHtml(title)}</h3></div>
    `;
    
    // Optimized click handler
    card.addEventListener("click", () => { 
      songQueue = items.slice(); 
      playAtIndex(items.indexOf(item), true); 
    }, { passive: true });

    // Image load optimization
    const img = card.querySelector('.thumb');
    img.addEventListener('load', () => {
      img.classList.remove('loading');
    }, { once: true });

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function getVideoId(item){
  return item?.id?.videoId || item?.id;
}

function showLoading(){
  const container = document.getElementById("results");
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[s]);
}

// Optimized tab switching with smooth transitions
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    
    // Remove active class from all tabs
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.remove("active");
    });
    
    // Add active class to target tab with slight delay for smooth transition
    requestAnimationFrame(() => {
      document.getElementById(`tab-${tab}`).classList.add("active");
    });
  }, { passive: true });
});

// Feedback form (no backend, just a message)
const fbForm = document.getElementById("feedback-form");
if (fbForm){
  fbForm.addEventListener("submit", function(e){
    e.preventDefault();
    const statusEl = document.getElementById("feedback-status");
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.innerText = "Thanks for your feedback!";
      statusEl.style.opacity = '1';
    }, 200);
    this.reset();
  });
}

// Intersection Observer for better performance on scroll
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  // Observe cards as they're created
  const observeCards = () => {
    document.querySelectorAll('.card:not(.observed)').forEach(card => {
      observer.observe(card);
      card.classList.add('observed');
    });
  };

  // Call after grid renders
  setTimeout(observeCards, 500);
}

// Optimize requestAnimationFrame usage
let rafId = null;
function optimizedRender(callback) {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(callback);
}

// Performance monitoring
if ('performance' in window) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      console.log(`Page load time: ${perfData.loadEventEnd - perfData.fetchStart}ms`);
    }, 0);
  });
}