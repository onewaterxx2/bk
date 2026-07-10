const $ = (selector) => document.querySelector(selector);
const today = new Date().toISOString().slice(0, 10);

let state = { site: {}, friends: [], music: [], settings: {} };

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

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

const fileToDataUrl = (file, onProgress) =>
  new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

const setMessage = (message) => {
  const output = $("#output");
  if (output) output.textContent = message;
};

const setProgress = (percent, label) => {
  $("#progress-bar").style.width = `${percent}%`;
  $("#progress-percent").textContent = `${percent}%`;
  $("#progress-label").textContent = label;
};

const markStep = (index) => {
  document.querySelectorAll("#publish-steps li").forEach((item, itemIndex) => {
    item.classList.toggle("active", itemIndex === index);
    item.classList.toggle("done", itemIndex < index);
  });
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
    <label>名称<input data-field="name" value="${escapeHtml(friend.name)}"></label>
    <label>链接<input data-field="url" value="${escapeHtml(friend.url)}"></label>
    <label>头像<input data-field="avatar" value="${escapeHtml(friend.avatar)}"></label>
    <label>描述<input data-field="description" value="${escapeHtml(friend.description)}"></label>
  `;
  return div;
};

const musicRow = (track = {}) => {
  const div = document.createElement("div");
  div.className = "repeat music-row";
  div.innerHTML = `
    <label>歌名<input data-field="title" value="${escapeHtml(track.title)}"></label>
    <label>作者<input data-field="artist" value="${escapeHtml(track.artist)}"></label>
    <label>已有音频路径<input data-field="src" value="${escapeHtml(track.src)}"></label>
    <label>已有封面路径<input data-field="cover" value="${escapeHtml(track.cover)}"></label>
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
  $("#git-proxy").value = state.settings.gitProxy || "http://127.0.0.1:7897";

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
    coverData: await fileToDataUrl($("#post-cover").files[0], (value) => setProgress(value, "正在读取封面图")),
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
    coverData: await fileToDataUrl($("#project-cover").files[0], (value) => setProgress(value, "正在读取封面图")),
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
  setProgress(10, "正在读取音乐文件");
  await request("/api/music", { music: await collectRows(".music-row") });
  setProgress(100, "音乐已保存");
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
  const button = $("#publish-btn");
  let timer;
  button.disabled = true;
  setMessage("");
  try {
    markStep(0);
    setProgress(10, "正在保存代理设置");
    await request("/api/settings", { settings: { gitProxy: $("#git-proxy").value.trim() } });

    markStep(1);
    setProgress(30, "正在拉取远程更新");

    const timerSteps = [
      [2, 55, "正在整理并提交文件"],
      [3, 80, "正在上传到 GitHub"]
    ];
    let index = 0;
    timer = setInterval(() => {
      const step = timerSteps[index];
      if (!step) return;
      markStep(step[0]);
      setProgress(step[1], step[2]);
      index += 1;
    }, 1400);

    const result = await request("/api/publish", { message: $("#commit-message").value });
    clearInterval(timer);
    markStep(4);
    setProgress(100, "发布完成，等待 GitHub Pages 构建");
    setMessage(result.output || "发布完成");
  } catch (error) {
    if (timer) clearInterval(timer);
    setProgress(100, "发布失败");
    setMessage(error.message);
  } finally {
    if (timer) clearInterval(timer);
    button.disabled = false;
  }
});

load().catch((error) => alert(error.message));
