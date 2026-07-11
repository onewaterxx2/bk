(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");
  const lyricCache = new Map();

  if (savedTheme === "dark") root.classList.add("dark");

  const normalizeSrc = (src) => {
    if (!src) return "";
    try {
      return new URL(src, window.location.href).href;
    } catch {
      return src;
    }
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const getSiteAudio = () => document.querySelector("[data-site-audio]");
  const getPlayers = () => [...document.querySelectorAll("[data-audio]")];
  const getPlayablePlayers = () => getPlayers().filter((player) => normalizeSrc(player.dataset.src || player.querySelector("audio")?.src));

  const getPlayerSource = (player) => normalizeSrc(player?.dataset.src || player?.querySelector("audio")?.src || "");

  const parseLrc = (raw) => {
    const lines = [];
    String(raw || "").split(/\r?\n/).forEach((line) => {
      const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const text = line.replace(/\[[^\]]+\]/g, "").trim();
      if (!matches.length || !text) return;
      matches.forEach((match) => {
        const millis = Number(String(match[3] || "0").padEnd(3, "0").slice(0, 3));
        lines.push({
          time: Number(match[1]) * 60 + Number(match[2]) + millis / 1000,
          text
        });
      });
    });
    return lines.sort((a, b) => a.time - b.time);
  };

  const getLyrics = async (url) => {
    const href = normalizeSrc(url);
    if (!href) return [];
    if (lyricCache.has(href)) return lyricCache.get(href);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error("Lyrics not found");
      const lyrics = parseLrc(await res.text());
      lyricCache.set(href, lyrics);
      return lyrics;
    } catch {
      lyricCache.set(href, []);
      return [];
    }
  };

  const setLyricLine = (player, text) => {
    const line = player?.querySelector("[data-lyrics-line]");
    if (line) line.textContent = text || "暂无歌词";
  };

  const updateLyrics = async (player, seconds) => {
    if (!player) return;
    const lyrics = await getLyrics(player.dataset.lyrics);
    if (!lyrics.length) {
      setLyricLine(player, player.dataset.lyrics ? "歌词加载中或格式不正确" : "暂无歌词");
      return;
    }

    let active = lyrics[0];
    for (const line of lyrics) {
      if (line.time <= seconds + 0.2) active = line;
      else break;
    }
    setLyricLine(player, active.text);
  };

  const findPlayerBySource = (source) => {
    const target = normalizeSrc(source);
    return getPlayers().find((player) => getPlayerSource(player) === target);
  };

  const syncAudioButtons = () => {
    const siteAudio = getSiteAudio();
    const activeSrc = normalizeSrc(siteAudio?.currentSrc || siteAudio?.src);
    const isPlaying = Boolean(siteAudio && activeSrc && !siteAudio.paused && !siteAudio.ended);
    const playable = getPlayablePlayers();

    getPlayers().forEach((player) => {
      const button = player.querySelector("[data-play-track]");
      const progress = player.querySelector("[data-progress]");
      const current = player.querySelector("[data-current-time]");
      const duration = player.querySelector("[data-duration]");
      const source = getPlayerSource(player);
      const isActive = Boolean(source && source === activeSrc);
      const seconds = isActive ? siteAudio.currentTime || 0 : 0;
      const total = isActive ? siteAudio.duration || 0 : 0;

      player.classList.toggle("is-active", isActive);
      if (button) button.dataset.playing = isActive && isPlaying ? "true" : "false";
      if (progress) {
        progress.value = total ? String(Math.round((seconds / total) * 1000)) : "0";
        progress.disabled = !isActive || !total;
      }
      if (current) current.textContent = formatTime(seconds);
      if (duration) duration.textContent = formatTime(total);

      const prev = player.querySelector("[data-prev-track]");
      const next = player.querySelector("[data-next-track]");
      if (prev) prev.disabled = playable.length <= 1;
      if (next) next.disabled = playable.length <= 1;

      if (isActive) updateLyrics(player, seconds);
      else setLyricLine(player, player.dataset.lyrics ? "等待播放歌词" : "暂无歌词");
    });
  };

  const playPlayer = async (player) => {
    const source = getPlayerSource(player);
    if (!source) return;

    const siteAudio = getSiteAudio();
    const audio = siteAudio || player.querySelector("audio");
    if (!audio) return;

    const current = normalizeSrc(audio.currentSrc || audio.src);
    if (current !== source) audio.src = source;
    await audio.play();
    await updateLyrics(player, audio.currentTime || 0);
    syncAudioButtons();
  };

  const togglePlayer = async (player) => {
    const siteAudio = getSiteAudio();
    const source = getPlayerSource(player);
    if (!siteAudio || !source) return;

    const current = normalizeSrc(siteAudio.currentSrc || siteAudio.src);
    if (current !== source || siteAudio.paused) {
      await playPlayer(player);
    } else {
      siteAudio.pause();
      syncAudioButtons();
    }
  };

  const playAdjacent = async (player, direction) => {
    const playable = getPlayablePlayers();
    if (!playable.length) return;

    const siteAudio = getSiteAudio();
    const active = findPlayerBySource(siteAudio?.currentSrc || siteAudio?.src) || player;
    const index = Math.max(0, playable.indexOf(active));
    const nextIndex = (index + direction + playable.length) % playable.length;
    await playPlayer(playable[nextIndex]);
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
    ["play", "pause", "ended", "emptied", "loadedmetadata", "durationchange", "timeupdate"].forEach((eventName) => {
      siteAudio.addEventListener(eventName, syncAudioButtons);
    });
    siteAudio.addEventListener("ended", async () => {
      const player = findPlayerBySource(siteAudio.currentSrc || siteAudio.src);
      if (player) await playAdjacent(player, 1);
    });
  };

  const bindAudioCards = () => {
    bindSiteAudio();

    getPlayers().forEach((player) => {
      if (player.dataset.boundAudio) return;
      player.dataset.boundAudio = "true";

      player.querySelector("[data-play-track]")?.addEventListener("click", async () => {
        await togglePlayer(player);
      });

      player.querySelector("[data-prev-track]")?.addEventListener("click", async () => {
        await playAdjacent(player, -1);
      });

      player.querySelector("[data-next-track]")?.addEventListener("click", async () => {
        await playAdjacent(player, 1);
      });

      player.querySelector("[data-progress]")?.addEventListener("input", (event) => {
        const siteAudio = getSiteAudio();
        if (!siteAudio || getPlayerSource(player) !== normalizeSrc(siteAudio.currentSrc || siteAudio.src) || !siteAudio.duration) return;
        siteAudio.currentTime = (Number(event.currentTarget.value) / 1000) * siteAudio.duration;
        syncAudioButtons();
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
