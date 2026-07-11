(() => {
  const lyricCache = new Map();

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

  const getPlayerSource = (player) => normalizeSrc(player?.dataset.src || player?.querySelector("audio")?.src || "");

  const getPlaylist = () => {
    const node = document.getElementById("site-playlist");
    if (!node?.textContent) return [];
    try {
      return JSON.parse(node.textContent);
    } catch {
      return [];
    }
  };

  const findTrackBySource = (source) => {
    const target = normalizeSrc(source);
    return getPlaylist().find((track) => normalizeSrc(track.src) === target);
  };

  const getPlaylistIndex = (source) => {
    const target = normalizeSrc(source);
    return getPlaylist().findIndex((track) => normalizeSrc(track.src) === target);
  };

  const isMiniPlayer = (player) => !player.closest(".music-list");

  const applyTrackToPlayer = (player, track) => {
    if (!player || !track) return;
    const cover = track.cover || player.dataset.cover || "";
    player.dataset.title = track.title || "";
    player.dataset.artist = track.artist || "";
    player.dataset.cover = cover;
    player.dataset.src = track.src || "";
    player.dataset.lyrics = track.lyrics || "";

    const image = player.querySelector(".music-cover");
    const title = player.querySelector(".music-meta h3");
    const artist = player.querySelector(".music-meta > p");
    const audio = player.querySelector("audio");
    if (image && cover) image.src = cover;
    if (title) title.textContent = track.title || "";
    if (artist) artist.textContent = track.artist || "";
    if (audio && track.src) audio.src = track.src;
  };

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
    const playlist = getPlaylist();

    getPlayers().forEach((player) => {
      if (isMiniPlayer(player)) {
        applyTrackToPlayer(player, findTrackBySource(activeSrc));
      }

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
      if (prev) prev.disabled = playlist.length <= 1;
      if (next) next.disabled = playlist.length <= 1;

      if (isActive) updateLyrics(player, seconds);
      else setLyricLine(player, player.dataset.lyrics ? "等待播放歌词" : "暂无歌词");
    });
  };

  const playPlayer = async (player) => {
    const source = getPlayerSource(player);
    if (!source) return;

    const track = findTrackBySource(source) || {
      title: player.dataset.title,
      artist: player.dataset.artist,
      cover: player.dataset.cover,
      src: player.dataset.src,
      lyrics: player.dataset.lyrics
    };
    await playTrack(track);
  };

  const playTrack = async (track) => {
    if (!track?.src) return;

    const siteAudio = getSiteAudio();
    if (!siteAudio) return;

    const current = normalizeSrc(siteAudio.currentSrc || siteAudio.src);
    const source = normalizeSrc(track.src);
    if (current !== source) siteAudio.src = track.src;
    await siteAudio.play();
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
    const playlist = getPlaylist();
    if (!playlist.length) return;

    const siteAudio = getSiteAudio();
    const activeSource = normalizeSrc(siteAudio?.currentSrc || siteAudio?.src) || getPlayerSource(player);
    let index = getPlaylistIndex(activeSource);
    if (index === -1) index = getPlaylistIndex(getPlayerSource(player));
    if (index === -1) index = 0;
    const nextIndex = (index + direction + playlist.length) % playlist.length;
    await playTrack(playlist[nextIndex]);
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
