const media = [
  { type: "image", src: "064718069e1b513391af8de42dd5f64e.jpg" },
  { type: "image", src: "0a5352e0e0b4431fef7e7f49e7191f10.jpg" },
  { type: "video", src: "0e8681913c19882d16b7dc25783aac.mp4" },
  { type: "video", src: "111c34fd8481ab48f0a232c21a1b42.mp4" },
  { type: "image", src: "1310d887a438b80ca61c2ba70afbb81a.jpg" },
  { type: "image", src: "16a24e8aeb66927b4efcc223df9d5b76.jpg" },
  { type: "video", src: "1846a7355f884db00f5da3001f69a8.mp4" },
  { type: "image", src: "18ca9f8d066f961d613c7dd5d3fea841.jpg" },
  { type: "image", src: "19fa4d8ee612002e86237cc22a5558d3.jpg" },
  { type: "image", src: "228c7d7605f813122fd50c6a71f6a073.jpg" },
  { type: "image", src: "3008704581f69b5c61d5e09037944048.jpg" },
  { type: "image", src: "33591c3e1ecef6dd393ac57292e04c6e.jpg" },
  { type: "image", src: "35f3fb56755bdefac858a7d77b7190fe.jpg" },
  { type: "image", src: "38e1675d856df3dd787ce0e88ada7054.jpg" },
  { type: "video", src: "3ca18d31bb31fe082bd1fa4344c222.mp4" },
  { type: "image", src: "47dfcf1abbbd9b8a186ff2e424782afd.jpg" },
  { type: "image", src: "49a037ff0feaf72af448ca26608c533c.jpg" },
  { type: "image", src: "4a0177fdb21e19dad7694f40a4f5b9df.jpg" },
  { type: "image", src: "4cd463ff86ae62121bc9a24ea399434d.jpg" },
  { type: "image", src: "4e083329545b28494238faf256c9e8e6.jpg" },
  { type: "image", src: "5610e5afac816d530bf8952ad5260400.jpg" },
  { type: "image", src: "56e1e4f405b81894575099d2432e8979.jpg" },
  { type: "image", src: "57c5a4a339f733dd963523e497909aa3.jpg" },
  { type: "image", src: "68c9248429256a0d9bb60cf1b88bb806.jpg" },
  { type: "image", src: "91fe26d737520b356838c82fec736613.jpg" },
  { type: "image", src: "ad27a4b5842a6522110279bdcfaa34b4.jpg" },
  { type: "video", src: "ad5508353f09bd60ce38845467920b.mp4" },
  { type: "image", src: "b625a4999e4e27689059ae523948e045.jpg" },
  { type: "image", src: "ba51c467b6b4103335b1f426eb84349f.jpg" },
  { type: "image", src: "c2fbe75098d57b7016141256e07cb517.jpg" },
  { type: "image", src: "c5cbab0fccd4e49173d1e2b68794dee7.jpg" },
  { type: "image", src: "f3b99ea040cb6eaf02797fbb4b914945.jpg" },
];

const gallery = document.querySelector("#gallery");
const heroMedia = document.querySelector("#heroMedia");
const visibleCount = document.querySelector("#visibleCount");
const photoCount = document.querySelector("#photoCount");
const videoCount = document.querySelector("#videoCount");
const filters = document.querySelectorAll("[data-filter]");
const lightbox = document.querySelector("#lightbox");
const stage = document.querySelector("#stage");
const captionType = document.querySelector("#captionType");
const captionIndex = document.querySelector("#captionIndex");
const closeLightbox = document.querySelector("#closeLightbox");
const prevMedia = document.querySelector("#prevMedia");
const nextMedia = document.querySelector("#nextMedia");

let activeFilter = "all";
let activeIndex = 0;

const heroIndexes = [23, 6, 18];

function createVisual(item, options = {}) {
  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = item.src;
    video.muted = options.muted ?? true;
    video.loop = options.loop ?? true;
    video.playsInline = true;
    video.preload = options.preload ?? "metadata";
    if (options.controls) video.controls = true;
    if (options.autoplay) {
      video.autoplay = true;
      video.play().catch(() => {});
    }
    return video;
  }

  const image = document.createElement("img");
  image.src = item.src;
  image.alt = "照片墙图片";
  image.loading = options.loading ?? "lazy";
  image.decoding = "async";
  return image;
}

function videoBadge() {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  return badge;
}

function renderHero() {
  heroIndexes.forEach((index) => {
    const item = media[index];
    const tile = document.createElement("button");
    tile.className = "hero-tile";
    tile.type = "button";
    tile.setAttribute("aria-label", item.type === "video" ? "打开视频" : "打开照片");
    tile.append(createVisual(item, { autoplay: item.type === "video", preload: "auto" }));
    if (item.type === "video") tile.append(videoBadge());
    tile.addEventListener("click", () => openLightbox(index));
    heroMedia.append(tile);
  });
}

function renderGallery() {
  media.forEach((item, index) => {
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.dataset.type = item.type;
    card.style.animationDelay = `${Math.min(index * 22, 420)}ms`;
    card.setAttribute("aria-label", item.type === "video" ? "预览视频" : "预览照片");
    card.append(createVisual(item));
    if (item.type === "video") {
      card.append(videoBadge());
      card.addEventListener("mouseenter", () => card.querySelector("video")?.play().catch(() => {}));
      card.addEventListener("mouseleave", () => {
        const video = card.querySelector("video");
        if (video) video.pause();
      });
    }
    card.addEventListener("click", () => openLightbox(index));
    gallery.append(card);
  });
}

function applyFilter(filter) {
  activeFilter = filter;
  filters.forEach((button) => button.classList.toggle("is-active", button.dataset.filter === filter));

  let count = 0;
  document.querySelectorAll(".card").forEach((card) => {
    const show = filter === "all" || card.dataset.type === filter;
    card.classList.toggle("is-hidden", !show);
    if (show) count += 1;
  });

  visibleCount.textContent = `${count} 项`;
}

function currentSet() {
  if (activeFilter === "all") return media.map((_, index) => index);
  return media.map((item, index) => (item.type === activeFilter ? index : -1)).filter((index) => index >= 0);
}

function openLightbox(index) {
  activeIndex = index;
  renderStage();
  if (!lightbox.open) lightbox.showModal();
}

function renderStage() {
  const item = media[activeIndex];
  stage.replaceChildren(createVisual(item, {
    autoplay: item.type === "video",
    controls: item.type === "video",
    loading: "eager",
    muted: false,
    preload: "auto",
  }));
  captionType.textContent = item.type === "video" ? "VIDEO" : "PHOTO";
  captionIndex.textContent = `${activeIndex + 1} / ${media.length}`;
}

function moveLightbox(direction) {
  const set = currentSet();
  const currentPosition = Math.max(0, set.indexOf(activeIndex));
  const nextPosition = (currentPosition + direction + set.length) % set.length;
  activeIndex = set[nextPosition];
  renderStage();
}

filters.forEach((button) => {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
});

closeLightbox.addEventListener("click", () => lightbox.close());
prevMedia.addEventListener("click", () => moveLightbox(-1));
nextMedia.addEventListener("click", () => moveLightbox(1));

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

lightbox.addEventListener("close", () => {
  stage.querySelector("video")?.pause();
  stage.replaceChildren();
});

window.addEventListener("keydown", (event) => {
  if (!lightbox.open) return;
  if (event.key === "ArrowLeft") moveLightbox(-1);
  if (event.key === "ArrowRight") moveLightbox(1);
  if (event.key === "Escape") lightbox.close();
});

photoCount.textContent = media.filter((item) => item.type === "image").length;
videoCount.textContent = media.filter((item) => item.type === "video").length;

renderHero();
renderGallery();
applyFilter("all");
