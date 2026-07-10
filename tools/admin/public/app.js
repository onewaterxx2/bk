const $ = (selector) => document.querySelector(selector);
const today = new Date().toISOString().slice(0, 10);

let state = { site: {}, friends: [], music: [] };

const request = async (url, body) => {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.output || "请求失败");
  return data;
};

const fileToDataUrl = (file) =>
  new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

const setMessage = (message) => {
  const output = $("#output");
  if (output) output.textContent = message;
};

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

const friendRow = (friend = {}) => {
  const div = document.createElement("div");
  div.className = "repeat friend-row";
  div.innerHTML = `
    <label>名称<input data-field="name" value="${friend.name || ""}"></label>
    <label>链接<input data-field="url" value="${friend.url || ""}"></label>
    <label>头像<input data-field="avatar" value="${friend.avatar || ""}"></label>
    <label>描述<input data-field="description" value="${friend.description || ""}"></label>
  `;
  return div;
};

const musicRow = (track = {}) => {
  const div = document.createElement("div");
  div.className = "repeat music-row";
  div.innerHTML = `
    <label>歌名<input data-field="title" value="${track.title || ""}"></label>
    <label>作者<input data-field="artist" value="${track.artist || ""}"></label>
    <label>已有音频路径<input data-field="src" value="${track.src || ""}"></label>
    <label>已有封面路径<input data-field="cover" value="${track.cover || ""}"></label>
    <label>上传音频<input data-field="audioData" type="file" accept="audio/*"></label>
    <label>上传封面<input data-field="coverData" type="file" accept="image/*"></label>
  `;
  return div;
};

const collectRows = async (selector) => {
  const rows = [];
  for (const row of document.querySelectorAll(selector)) {
    const item = {};
    for (const field of row.querySelectorAll("[data-field]")) {
      if (field.type === "file") item[field.dataset.field] = await fileToDataUrl(field.files[0]);
      else item[field.dataset.field] = field.value;
    }
    rows.push(item);
  }
  return rows;
};

const load = async () => {
  state = await request("/api/content");
  $("#post-date").value = today;
  $("#project-date").value = today;
  $("#site-title").value = state.site.title || "";
  $("#site-nickname").value = state.site.nickname || "";
  $("#site-location").value = state.site.location || "";
  $("#site-github").value = state.site.github || "";
  $("#site-subtitle").value = state.site.subtitle || "";
  $("#site-bio").value = state.site.bio || "";

  $("#friend-list").innerHTML = "";
  state.friends.forEach((friend) => $("#friend-list").append(friendRow(friend)));

  $("#music-list").innerHTML = "";
  state.music.forEach((track) => $("#music-list").append(musicRow(track)));
};

$("#add-friend").addEventListener("click", () => $("#friend-list").append(friendRow()));
$("#add-music").addEventListener("click", () => $("#music-list").append(musicRow()));

$("#save-post").addEventListener("click", async () => {
  const body = {
    title: $("#post-title").value,
    slug: $("#post-slug").value,
    category: $("#post-category").value,
    tags: $("#post-tags").value,
    pubDate: $("#post-date").value,
    readingTime: $("#post-reading").value,
    description: $("#post-description").value,
    coverData: await fileToDataUrl($("#post-cover").files[0]),
    featured: $("#post-featured").checked,
    draft: $("#post-draft").checked,
    content: $("#post-content").value
  };
  const result = await request("/api/posts", body);
  alert(`文章已保存：${result.slug}`);
});

$("#save-project").addEventListener("click", async () => {
  const body = {
    title: $("#project-title").value,
    slug: $("#project-slug").value,
    tags: $("#project-tags").value,
    pubDate: $("#project-date").value,
    link: $("#project-link").value,
    repo: $("#project-repo").value,
    description: $("#project-description").value,
    coverData: await fileToDataUrl($("#project-cover").files[0]),
    featured: $("#project-featured").checked,
    content: $("#project-content").value
  };
  const result = await request("/api/projects", body);
  alert(`作品已保存：${result.slug}`);
});

$("#save-friends").addEventListener("click", async () => {
  await request("/api/friends", { friends: await collectRows(".friend-row") });
  alert("友链已保存");
});

$("#save-music").addEventListener("click", async () => {
  await request("/api/music", { music: await collectRows(".music-row") });
  alert("音乐已保存");
});

$("#save-site").addEventListener("click", async () => {
  await request("/api/site", {
    site: {
      ...state.site,
      title: $("#site-title").value,
      nickname: $("#site-nickname").value,
      location: $("#site-location").value,
      github: $("#site-github").value,
      subtitle: $("#site-subtitle").value,
      bio: $("#site-bio").value
    }
  });
  alert("站点资料已保存");
});

$("#publish-btn").addEventListener("click", async () => {
  setMessage("正在发布...");
  try {
    const result = await request("/api/publish", { message: $("#commit-message").value });
    setMessage(result.output || "发布完成");
  } catch (error) {
    setMessage(error.message);
  }
});

load().catch((error) => alert(error.message));
