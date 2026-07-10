const root = document.documentElement;
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") root.classList.add("dark");

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    root.classList.toggle("dark");
    localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
  });
});

const searchInput = document.querySelector("[data-search]");
if (searchInput) {
  const cards = [...document.querySelectorAll("[data-search-card]")];
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    cards.forEach((card) => {
      const haystack = card.dataset.searchCard?.toLowerCase() ?? "";
      card.toggleAttribute("hidden", q.length > 0 && !haystack.includes(q));
    });
  });
}

const progress = document.querySelector("[data-reading-progress]");
if (progress) {
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const value = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, value))})`;
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

document.querySelectorAll("[data-audio]").forEach((player) => {
  const audio = player.querySelector("audio");
  const button = player.querySelector("button");
  if (!audio || !button) return;
  button.addEventListener("click", () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play();
      button.dataset.playing = "true";
    } else {
      audio.pause();
      button.dataset.playing = "false";
    }
  });
});
