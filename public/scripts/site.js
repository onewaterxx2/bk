(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") root.classList.add("dark");

  const normalizeSrc = (src) => {
    if (!src) return "";
    try {
      return new URL(src, window.location.href).href;
    } catch {
      return src;
    }
  };

  const getSiteAudio = () => document.querySelector("[data-site-audio]");

  const syncAudioButtons = () => {
    const siteAudio = getSiteAudio();
    const activeSrc = normalizeSrc(siteAudio?.currentSrc || siteAudio?.src);
    const isPlaying = Boolean(siteAudio && activeSrc && !siteAudio.paused && !siteAudio.ended);

    document.querySelectorAll("[data-audio]").forEach((player) => {
      const button = player.querySelector("button");
      const localAudio = player.querySelector("audio");
      const localSrc = normalizeSrc(localAudio?.currentSrc || localAudio?.src);
      if (!button) return;
      button.dataset.playing = isPlaying && localSrc === activeSrc ? "true" : "false";
    });
  };

  const bindThemeToggles = () => {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      if (button.dataset.boundTheme) return;
      button.dataset.boundTheme = "true";
      button.addEventListener("click", () => {
        root.classList.toggle("dark");
        localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
      });
    });
  };

  const bindSearch = () => {
    const searchInput = document.querySelector("[data-search]");
    if (!searchInput || searchInput.dataset.boundSearch) return;
    searchInput.dataset.boundSearch = "true";
    const cards = [...document.querySelectorAll("[data-search-card]")];
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      cards.forEach((card) => {
        const haystack = card.dataset.searchCard?.toLowerCase() ?? "";
        card.toggleAttribute("hidden", q.length > 0 && !haystack.includes(q));
      });
    });
  };

  const updateReadingProgress = () => {
    const progress = document.querySelector("[data-reading-progress]");
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const value = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, value))})`;
  };

  const bindSiteAudio = () => {
    const siteAudio = getSiteAudio();
    if (!siteAudio || siteAudio.dataset.boundSiteAudio) return;
    siteAudio.dataset.boundSiteAudio = "true";
    ["play", "pause", "ended", "emptied", "loadedmetadata"].forEach((eventName) => {
      siteAudio.addEventListener(eventName, syncAudioButtons);
    });
  };

  const bindAudioCards = () => {
    bindSiteAudio();

    document.querySelectorAll("[data-audio]").forEach((player) => {
      if (player.dataset.boundAudio) return;
      player.dataset.boundAudio = "true";

      const localAudio = player.querySelector("audio");
      const button = player.querySelector("button");
      if (!localAudio || !button) return;

      button.addEventListener("click", async () => {
        const source = normalizeSrc(localAudio.currentSrc || localAudio.src);
        if (!source) return;

        const siteAudio = getSiteAudio();
        const audio = siteAudio || localAudio;
        const current = normalizeSrc(audio.currentSrc || audio.src);
        const isSameTrack = current === source;

        try {
          if (!isSameTrack) {
            audio.src = source;
            await audio.play();
          } else if (audio.paused) {
            await audio.play();
          } else {
            audio.pause();
          }
        } finally {
          syncAudioButtons();
        }
      });
    });

    syncAudioButtons();
  };

  const initPage = () => {
    bindThemeToggles();
    bindSearch();
    updateReadingProgress();
    bindAudioCards();
  };

  if (!window.__jiangshuiSiteEventsBound) {
    window.__jiangshuiSiteEventsBound = true;
    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    window.addEventListener("resize", updateReadingProgress);
    document.addEventListener("astro:page-load", initPage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, { once: true });
  } else {
    initPage();
  }
})();
