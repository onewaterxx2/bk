const $ = (selector) => document.querySelector(selector);
const today = new Date().toISOString().slice(0, 10);

let state = { posts: [], projects: [], site: {}, friends: [], music: [], settings: {} };
let editingPostSlug = "";
let editingProjectSlug = "";
let savedSelection = null;

const msg = {
  requestFailed: "\u8bf7\u6c42\u5931\u8d25",
  saveCover: "\u6b63\u5728\u8bfb\u53d6\u5c01\u9762\u56fe",
  savePost: "\u6b63\u5728\u4fdd\u5b58\u6587\u7ae0\u5230\u672c\u5730",
  saveProject: "\u6b63\u5728\u4fdd\u5b58\u4f5c\u54c1\u5230\u672c\u5730",
  saveProxy: "\u6b63\u5728\u4fdd\u5b58\u4ee3\u7406\u8bbe\u7f6e",
  commitFiles: "\u6b63\u5728\u6574\u7406\u5e76\u63d0\u4ea4\u6587\u4ef6",
  pullRemote: "\u6b63\u5728\u62c9\u53d6\u8fdc\u7a0b\u66f4\u65b0",
  pushGitHub: "\u6b63\u5728\u4e0a\u4f20\u5230 GitHub",
  publishDone: "\u53d1\u5e03\u5b8c\u6210\uff0c\u7b49\u5f85 GitHub Pages \u6784\u5efa",
  publishFailed: "\u53d1\u5e03\u5931\u8d25"
};

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
  if (!res.ok) throw new Error(data.error || data.output || msg.requestFailed);
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

const fileToText = (file) =>
  new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file, "utf-8");
  });

const editor = () => $("#post-editor");

const saveSelection = () => {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) savedSelection = selection.getRangeAt(0);
};

const restoreSelection = () => {
  if (!savedSelection) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedSelection);
};

const sanitizePastedHtml = (html) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());
  doc.body.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || (name === "href" && value.startsWith("javascript:"))) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
};

const insertHtml = (html) => {
  restoreSelection();
  document.execCommand("insertHTML", false, html);
  saveSelection();
};

const syncEditorToTextarea = () => {
  $("#post-content").value = editor().innerHTML.trim();
};

const setEditorHtml = (html) => {
  editor().innerHTML = html || "";
  syncEditorToTextarea();
};

const asTagsInput = (value) => Array.isArray(value) ? value.join(", ") : String(value || "");

const setMessage = (message) => {
  const output = $("#output");
  if (output) output.textContent = message;
};

const setProgress = (percent, label) => {
  $("#progress-bar").style.width = `${percent}%`;
  $("#progress-percent").textContent = `${percent}%`;
  $("#progress-label").textContent = label;
};

const activateTab = (tab) => {
  const button = document.querySelector(`nav button[data-tab="${tab}"]`);
  if (!button) return;
  document.querySelectorAll("nav button").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  button.classList.add("active");
  document.getElementById(tab).classList.add("active");
};

const markStep = (index) => {
  document.querySelectorAll("#publish-steps li").forEach((item, itemIndex) => {
    item.classList.toggle("active", itemIndex === index);
    item.classList.toggle("done", itemIndex < index);
  });
};

const renderItemList = (target, items, type) => {
  const container = $(target);
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p class="empty">No ${type}s yet.</p>`;
    return;
  }
  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "item-button";
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.slug)}</span>
    `;
    button.addEventListener("click", async () => {
      try {
        setProgress(5, `Loading ${type}: ${item.slug}`);
        await (type === "post" ? loadPost(item.slug) : loadProject(item.slug));
        document.querySelectorAll(`${target} .item-button`).forEach((entry) => entry.classList.remove("selected"));
        button.classList.add("selected");
      } catch (error) {
        setProgress(100, `Failed to load ${type}`);
        alert(`${type === "post" ? "Post" : "Project"} load failed: ${error.message}`);
      }
    });
    container.append(button);
  });
};

const refreshContentLists = async () => {
  const latest = await request("/api/content");
  state.posts = latest.posts;
  state.projects = latest.projects;
  renderItemList("#post-list", state.posts, "post");
  renderItemList("#project-list", state.projects, "project");
};

const clearPostForm = () => {
  editingPostSlug = "";
  $("#post-title").value = "";
  $("#post-slug").value = "";
  $("#post-category").value = "\u968f\u7b14";
  $("#post-tags").value = "";
  $("#post-date").value = today;
  $("#post-reading").value = "";
  $("#post-description").value = "";
  $("#post-cover").value = "";
  $("#post-cover-path").value = "";
  $("#post-featured").checked = false;
  $("#post-draft").checked = false;
  setEditorHtml("");
};

const clearProjectForm = () => {
  editingProjectSlug = "";
  $("#project-title").value = "";
  $("#project-slug").value = "";
  $("#project-tags").value = "";
  $("#project-date").value = today;
  $("#project-link").value = "";
  $("#project-repo").value = "";
  $("#project-description").value = "";
  $("#project-cover").value = "";
  $("#project-cover-path").value = "";
  $("#project-featured").checked = false;
  $("#project-content").value = "";
};

const loadPost = async (slug) => {
  const post = await request(`/api/posts/${encodeURIComponent(slug)}`);
  editingPostSlug = post.slug;
  $("#post-title").value = post.title || "";
  $("#post-slug").value = post.slug || "";
  $("#post-category").value = post.category || "\u968f\u7b14";
  $("#post-tags").value = asTagsInput(post.tags);
  $("#post-date").value = String(post.pubDate || today).slice(0, 10);
  $("#post-reading").value = post.readingTime || "";
  $("#post-description").value = post.description || "";
  $("#post-cover").value = "";
  $("#post-cover-path").value = post.cover || "";
  $("#post-featured").checked = Boolean(post.featured);
  $("#post-draft").checked = Boolean(post.draft);
  setEditorHtml(post.content || "");
  setProgress(0, `Loaded post: ${post.slug}`);
};

const loadProject = async (slug) => {
  const project = await request(`/api/projects/${encodeURIComponent(slug)}`);
  editingProjectSlug = project.slug;
  $("#project-title").value = project.title || "";
  $("#project-slug").value = project.slug || "";
  $("#project-tags").value = asTagsInput(project.tags);
  $("#project-date").value = String(project.pubDate || today).slice(0, 10);
  $("#project-link").value = project.link || "";
  $("#project-repo").value = project.repo || "";
  $("#project-description").value = project.description || "";
  $("#project-cover").value = "";
  $("#project-cover-path").value = project.cover || "";
  $("#project-featured").checked = Boolean(project.featured);
  $("#project-content").value = project.content || "";
  setProgress(0, `Loaded project: ${project.slug}`);
};

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    restoreSelection();
    document.execCommand(button.dataset.command, false, button.dataset.value || null);
    syncEditorToTextarea();
    editor().focus();
  });
});

editor().addEventListener("keyup", () => {
  saveSelection();
  syncEditorToTextarea();
});

editor().addEventListener("mouseup", saveSelection);

editor().addEventListener("input", syncEditorToTextarea);

editor().addEventListener("paste", async (event) => {
  event.preventDefault();
  const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
  if (files.length) {
    for (const file of files) {
      const src = await fileToDataUrl(file, (value) => setProgress(value, "Reading pasted image"));
      insertHtml(`<figure><img src="${src}" alt=""><figcaption></figcaption></figure>`);
    }
    syncEditorToTextarea();
    return;
  }
  const html = event.clipboardData.getData("text/html");
  const text = event.clipboardData.getData("text/plain");
  insertHtml(html ? sanitizePastedHtml(html) : escapeHtml(text).replace(/\n/g, "<br>"));
  syncEditorToTextarea();
});

editor().addEventListener("drop", async (event) => {
  const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;
  event.preventDefault();
  for (const file of files) {
    const src = await fileToDataUrl(file, (value) => setProgress(value, "Reading dropped image"));
    insertHtml(`<figure><img src="${src}" alt=""><figcaption></figcaption></figure>`);
  }
  syncEditorToTextarea();
});

$("#editor-link").addEventListener("click", () => {
  const href = prompt("URL");
  if (!href) return;
  restoreSelection();
  document.execCommand("createLink", false, href);
  syncEditorToTextarea();
});

$("#editor-image").addEventListener("click", () => {
  const src = prompt("Image URL");
  if (!src) return;
  insertHtml(`<figure><img src="${escapeHtml(src)}" alt=""><figcaption></figcaption></figure>`);
  syncEditorToTextarea();
});

$("#editor-clear").addEventListener("click", () => {
  if (!confirm("Clear editor content?")) return;
  setEditorHtml("");
});

const friendRow = (friend = {}) => {
  const div = document.createElement("div");
  div.className = "repeat friend-row";
  div.innerHTML = `
    <label>Name<input data-field="name" value="${escapeHtml(friend.name)}"></label>
    <label>URL<input data-field="url" value="${escapeHtml(friend.url)}"></label>
    <label>Avatar<input data-field="avatar" value="${escapeHtml(friend.avatar)}"></label>
    <label>Description<input data-field="description" value="${escapeHtml(friend.description)}"></label>
  `;
  return div;
};

const musicRow = (track = {}) => {
  const div = document.createElement("div");
  div.className = "repeat music-row";
  div.innerHTML = `
    <label>Title<input data-field="title" value="${escapeHtml(track.title)}"></label>
    <label>Artist<input data-field="artist" value="${escapeHtml(track.artist)}"></label>
    <label>Audio path<input data-field="src" value="${escapeHtml(track.src)}"></label>
    <label>Cover path<input data-field="cover" value="${escapeHtml(track.cover)}"></label>
    <label>Lyrics path<input data-field="lyrics" value="${escapeHtml(track.lyrics)}"></label>
    <label>Upload audio<input data-field="audioData" type="file" accept="audio/*"></label>
    <label>Upload cover<input data-field="coverData" type="file" accept="image/*"></label>
    <label>Upload LRC<input data-field="lyricsData" type="file" accept=".lrc,text/plain"></label>
  `;
  return div;
};

const collectRows = async (selector) => {
  const rows = [];
  for (const row of document.querySelectorAll(selector)) {
    const item = {};
    for (const field of row.querySelectorAll("[data-field]")) {
      if (field.type === "file" && field.dataset.field === "lyricsData") {
        item[field.dataset.field] = await fileToText(field.files[0]);
      } else {
        item[field.dataset.field] = field.type === "file" ? await fileToDataUrl(field.files[0]) : field.value;
      }
    }
    rows.push(item);
  }
  return rows;
};

const load = async () => {
  state = await request("/api/content");
  clearPostForm();
  clearProjectForm();
  $("#site-title").value = state.site.title || "";
  $("#site-nickname").value = state.site.nickname || "";
  $("#site-location").value = state.site.location || "";
  $("#site-github").value = state.site.github || "";
  $("#site-subtitle").value = state.site.subtitle || "";
  $("#site-bio").value = state.site.bio || "";
  $("#git-proxy").value = state.settings.gitProxy || "http://127.0.0.1:7897";

  renderItemList("#post-list", state.posts, "post");
  renderItemList("#project-list", state.projects, "project");

  $("#friend-list").innerHTML = "";
  state.friends.forEach((friend) => $("#friend-list").append(friendRow(friend)));

  $("#music-list").innerHTML = "";
  state.music.forEach((track) => $("#music-list").append(musicRow(track)));
};

$("#new-post").addEventListener("click", clearPostForm);
$("#new-project").addEventListener("click", clearProjectForm);
$("#add-friend").addEventListener("click", () => $("#friend-list").append(friendRow()));
$("#add-music").addEventListener("click", () => $("#music-list").append(musicRow()));

const buildPostBody = async () => ({
  originalSlug: editingPostSlug,
  title: $("#post-title").value,
  slug: $("#post-slug").value,
  category: $("#post-category").value,
  tags: $("#post-tags").value,
  pubDate: $("#post-date").value,
  readingTime: $("#post-reading").value,
  description: $("#post-description").value,
  cover: $("#post-cover-path").value,
  coverData: await fileToDataUrl($("#post-cover").files[0], (value) => setProgress(value, msg.saveCover)),
  featured: $("#post-featured").checked,
  draft: $("#post-draft").checked,
  content: (syncEditorToTextarea(), $("#post-content").value)
});

const savePost = async () => {
  setProgress(12, msg.savePost);
  const result = await request("/api/posts", await buildPostBody());
  editingPostSlug = result.slug;
  $("#post-slug").value = result.slug;
  setProgress(24, `Saved post: ${result.slug}`);
  await refreshContentLists();
  return result;
};

$("#save-post").addEventListener("click", async () => {
  const result = await savePost();
  alert(`Saved locally: ${result.slug}\nUse Save and publish to upload to GitHub.`);
});

$("#save-post-publish").addEventListener("click", async () => {
  activateTab("publish");
  await savePost();
  await publishNow();
});

const buildProjectBody = async () => ({
  originalSlug: editingProjectSlug,
  title: $("#project-title").value,
  slug: $("#project-slug").value,
  tags: $("#project-tags").value,
  pubDate: $("#project-date").value,
  link: $("#project-link").value,
  repo: $("#project-repo").value,
  description: $("#project-description").value,
  cover: $("#project-cover-path").value,
  coverData: await fileToDataUrl($("#project-cover").files[0], (value) => setProgress(value, msg.saveCover)),
  featured: $("#project-featured").checked,
  content: $("#project-content").value
});

const saveProject = async () => {
  setProgress(12, msg.saveProject);
  const result = await request("/api/projects", await buildProjectBody());
  editingProjectSlug = result.slug;
  $("#project-slug").value = result.slug;
  setProgress(24, `Saved project: ${result.slug}`);
  await refreshContentLists();
  return result;
};

$("#save-project").addEventListener("click", async () => {
  const result = await saveProject();
  alert(`Saved locally: ${result.slug}\nUse Save and publish to upload to GitHub.`);
});

$("#save-project-publish").addEventListener("click", async () => {
  activateTab("publish");
  await saveProject();
  await publishNow();
});

const saveFriends = async () => {
  await request("/api/friends", { friends: await collectRows(".friend-row") });
  setProgress(24, "Friends saved locally");
};

$("#save-friends").addEventListener("click", async () => {
  await saveFriends();
  alert("Friends saved locally.");
});

$("#save-friends-publish").addEventListener("click", async () => {
  activateTab("publish");
  await saveFriends();
  await publishNow();
});

const saveMusic = async () => {
  setProgress(10, "Reading media files");
  await request("/api/music", { music: await collectRows(".music-row") });
  setProgress(100, "Music saved locally");
};

$("#save-music").addEventListener("click", async () => {
  await saveMusic();
  alert("Music saved locally.");
});

$("#save-music-publish").addEventListener("click", async () => {
  activateTab("publish");
  await saveMusic();
  await publishNow();
});

const saveSite = async () => {
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
  setProgress(24, "Site profile saved locally");
};

$("#save-site").addEventListener("click", async () => {
  await saveSite();
  alert("Site profile saved locally.");
});

$("#save-site-publish").addEventListener("click", async () => {
  activateTab("publish");
  await saveSite();
  await publishNow();
});

const publishNow = async () => {
  const button = $("#publish-btn");
  let timer;
  button.disabled = true;
  setMessage("");
  try {
    markStep(0);
    setProgress(10, msg.saveProxy);
    await request("/api/settings", { settings: { gitProxy: $("#git-proxy").value.trim() } });

    const timerSteps = [
      [1, 35, msg.commitFiles],
      [2, 60, msg.pullRemote],
      [3, 82, msg.pushGitHub]
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
    setProgress(100, msg.publishDone);
    setMessage(result.output || "Publish complete");
  } catch (error) {
    if (timer) clearInterval(timer);
    setProgress(100, msg.publishFailed);
    setMessage(error.message);
  } finally {
    if (timer) clearInterval(timer);
    button.disabled = false;
  }
};

$("#publish-btn").addEventListener("click", publishNow);

load().catch((error) => alert(error.message));
