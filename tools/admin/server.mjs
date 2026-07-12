import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const root = resolve(process.env.BLOG_ADMIN_ROOT || defaultRoot);
const adminPublic = resolve(process.env.BLOG_ADMIN_PUBLIC || join(root, "tools/admin/public"));
const port = Number(process.env.BLOG_ADMIN_PORT || 4587);

const safeJoin = (...parts) => {
  const target = resolve(root, ...parts);
  const rel = relative(root, target);
  if (rel.startsWith("..") || normalize(rel).startsWith("..")) {
    throw new Error("Path escapes project root");
  }
  return target;
};

const settingsPath = safeJoin("tools/admin/settings.json");

function readSettings() {
  if (!existsSync(settingsPath)) return { gitProxy: "http://127.0.0.1:7897" };
  return JSON.parse(readFileSync(settingsPath, "utf8"));
}

const json = (res, status, body) => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
};

const text = (res, status, body, type = "text/plain; charset=utf-8") => {
  res.writeHead(status, { "content-type": type });
  res.end(body);
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const slugify = (value) => {
  const textValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return textValue || `post-${Date.now()}`;
};

const yamlString = (value) => `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const frontmatter = (data) => {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(yamlString).join(", ")}]`);
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value ? "true" : "false"}`);
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
};

const parseScalar = (value) => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
};

const parseMarkdown = (raw) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/m.exec(raw);
  if (!match) return { data: {}, content: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    data[line.slice(0, index).trim()] = parseScalar(line.slice(index + 1));
  }
  return { data, content: match[2] || "" };
};

const collectionDir = (collection) => safeJoin("src/content", collection);

const markdownPath = (collection, slug) => {
  const safeSlug = slugify(slug);
  return safeJoin("src/content", collection, `${safeSlug}.md`);
};

const readMarkdownItem = (collection, slug) => {
  const file = markdownPath(collection, slug);
  if (!existsSync(file)) return null;
  const parsed = parseMarkdown(readFileSync(file, "utf8"));
  return { slug: slugify(slug), ...parsed.data, content: parsed.content };
};

const saveDataUrl = (dataUrl, folder, fallbackName) => {
  if (!dataUrl) return "";
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid upload payload");
  const mime = match[1];
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "bin";
  const dir = safeJoin("public", folder);
  mkdirSync(dir, { recursive: true });
  const filename = `${fallbackName}.${ext}`;
  writeFileSync(join(dir, filename), Buffer.from(match[2], "base64"));
  return `/bk/${folder}/${filename}`.replace(/\\/g, "/");
};

const saveTextAsset = (content, folder, fallbackName, extension = "txt") => {
  if (!content) return "";
  const dir = safeJoin("public", folder);
  mkdirSync(dir, { recursive: true });
  const filename = `${fallbackName}.${extension}`;
  writeFileSync(join(dir, filename), content, "utf8");
  return `/bk/${folder}/${filename}`.replace(/\\/g, "/");
};

const saveInlineImage = (dataUrl, folder, fallbackName) => {
  const match = /^data:image\/([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return dataUrl;
  const ext = match[1].replace("jpeg", "jpg");
  const dir = safeJoin("public", folder);
  mkdirSync(dir, { recursive: true });
  const filename = `${fallbackName}.${ext}`;
  writeFileSync(join(dir, filename), Buffer.from(match[2], "base64"));
  return `/bk/${folder}/${filename}`.replace(/\\/g, "/");
};

const processContentAssets = (content, folder) => {
  let index = 0;
  return String(content || "").replace(/<img\b([^>]*?)\bsrc=(["'])(data:image\/[^"']+)\2([^>]*)>/gi, (_match, before, quote, src, after) => {
    index += 1;
    const saved = saveInlineImage(src, folder, `inline-${index}`);
    return `<img${before}src=${quote}${saved}${quote}${after}>`;
  });
};

const listMarkdown = (collection) => {
  const dir = collectionDir(collection);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .map((file) => {
      const full = join(dir, file);
      const raw = readFileSync(full, "utf8");
      const parsed = parseMarkdown(raw);
      const slug = file.replace(/\.(md|mdx)$/i, "");
      return {
        slug,
        title: parsed.data.title || file,
        description: parsed.data.description || "",
        pubDate: parsed.data.pubDate || "",
        category: parsed.data.category || "",
        tags: parsed.data.tags || [],
        cover: parsed.data.cover || "",
        path: relative(root, full)
      };
    });
};

const runGit = (args, options = {}) =>
  new Promise((resolvePromise) => {
    const proxyArgs = options.proxy
      ? ["-c", `http.proxy=${options.proxy}`, "-c", `https.proxy=${options.proxy}`]
      : [];
    const child = spawn("git", [...proxyArgs, ...args], { cwd: root, shell: false });
    let out = "";
    child.stdout.on("data", (data) => (out += data.toString()));
    child.stderr.on("data", (data) => (out += data.toString()));
    child.on("close", (code) => resolvePromise({ code, out }));
  });

const publish = async (message) => {
  const steps = [];
  const settings = readSettings();
  const head = await runGit(["rev-parse", "--verify", "HEAD"]);
  const branchResult = await runGit(["branch", "--show-current"]);
  const branch = branchResult.out.trim() || "main";
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const commands = [["add", "."], ["commit", "-m", message || "publish blog update"]];

  if (head.code === 0 && upstream.code === 0) {
    commands.push(["pull", "--rebase"]);
  } else if (head.code === 0) {
    steps.push("No upstream branch yet; skipping pull before first push.");
  } else {
    steps.push("No commits yet; skipping pull before initial commit.");
  }
  commands.push(upstream.code === 0 ? ["push"] : ["push", "-u", "origin", branch]);

  for (const args of commands) {
    const needsProxy = ["pull", "push"].includes(args[0]);
    const result = await runGit(args, { proxy: needsProxy ? settings.gitProxy : "" });
    const stepLabel = needsProxy && settings.gitProxy
      ? `$ git ${args.join(" ")}  (proxy: ${settings.gitProxy})`
      : `$ git ${args.join(" ")}`;
    steps.push(`${stepLabel}\n${result.out}`.trim());
    const noChanges = args[0] === "commit" && /nothing to commit|no changes added/i.test(result.out);
    if (result.code !== 0 && !noChanges) return { ok: false, output: steps.join("\n\n") };
  }
  return { ok: true, output: steps.join("\n\n") };
};

const contentType = (path) => {
  const ext = extname(path);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8"
  }[ext] || "application/octet-stream";
};

const savePost = (body) => {
  const slug = slugify(body.slug || body.title);
  const previousSlug = body.originalSlug ? slugify(body.originalSlug) : "";
  const cover = body.coverData ? saveDataUrl(body.coverData, `images/posts/${slug}`, "cover") : body.cover;
  const data = {
    title: body.title,
    description: body.description,
    pubDate: body.pubDate || new Date().toISOString().slice(0, 10),
    category: body.category || "\u968f\u7b14",
    tags: String(body.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    cover,
    featured: Boolean(body.featured),
    draft: Boolean(body.draft),
    mood: body.mood,
    readingTime: body.readingTime
  };
  mkdirSync(collectionDir("posts"), { recursive: true });
  const content = processContentAssets(body.content, `images/posts/${slug}`);
  writeFileSync(markdownPath("posts", slug), `${frontmatter(data)}${content}\n`, "utf8");
  if (previousSlug && previousSlug !== slug) {
    const previousPath = markdownPath("posts", previousSlug);
    if (existsSync(previousPath)) unlinkSync(previousPath);
  }
  return slug;
};

const saveProject = (body) => {
  const slug = slugify(body.slug || body.title);
  const previousSlug = body.originalSlug ? slugify(body.originalSlug) : "";
  const cover = body.coverData ? saveDataUrl(body.coverData, `images/projects/${slug}`, "cover") : body.cover;
  const data = {
    title: body.title,
    description: body.description,
    pubDate: body.pubDate || new Date().toISOString().slice(0, 10),
    tags: String(body.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    cover,
    link: body.link,
    repo: body.repo,
    featured: Boolean(body.featured)
  };
  mkdirSync(collectionDir("projects"), { recursive: true });
  writeFileSync(markdownPath("projects", slug), `${frontmatter(data)}${body.content || ""}\n`, "utf8");
  if (previousSlug && previousSlug !== slug) {
    const previousPath = markdownPath("projects", previousSlug);
    if (existsSync(previousPath)) unlinkSync(previousPath);
  }
  return slug;
};

const routes = {
  "GET /api/content": async (_req, res) => {
    json(res, 200, {
      posts: listMarkdown("posts"),
      projects: listMarkdown("projects"),
      site: JSON.parse(readFileSync(safeJoin("src/data/site.json"), "utf8")),
      friends: JSON.parse(readFileSync(safeJoin("src/data/friends.json"), "utf8")),
      music: JSON.parse(readFileSync(safeJoin("src/data/music.json"), "utf8")),
      settings: readSettings()
    });
  },
  "POST /api/posts": async (req, res) => {
    const slug = savePost(await readBody(req));
    json(res, 200, { ok: true, slug });
  },
  "POST /api/projects": async (req, res) => {
    const slug = saveProject(await readBody(req));
    json(res, 200, { ok: true, slug });
  },
  "POST /api/friends": async (req, res) => {
    const body = await readBody(req);
    writeFileSync(safeJoin("src/data/friends.json"), JSON.stringify(body.friends || [], null, 2), "utf8");
    json(res, 200, { ok: true });
  },
  "POST /api/music": async (req, res) => {
    const body = await readBody(req);
    const tracks = [];
    for (const item of body.music || []) {
      if (!item.title && !item.artist && !item.src && !item.audioData && !item.cover && !item.coverData && !item.lyrics && !item.lyricsData) continue;
      const slug = slugify(`${item.title}-${item.artist}`);
      const src = item.audioData ? saveDataUrl(item.audioData, "media/music", slug) : item.src;
      const cover = item.coverData ? saveDataUrl(item.coverData, `images/music/${slug}`, "cover") : item.cover;
      const lyrics = item.lyricsData ? saveTextAsset(item.lyricsData, "media/lyrics", slug, "lrc") : item.lyrics;
      tracks.push({ title: item.title, artist: item.artist, src, cover, lyrics });
    }
    writeFileSync(safeJoin("src/data/music.json"), JSON.stringify(tracks, null, 2), "utf8");
    json(res, 200, { ok: true });
  },
  "POST /api/site": async (req, res) => {
    const body = await readBody(req);
    writeFileSync(safeJoin("src/data/site.json"), JSON.stringify(body.site || {}, null, 2), "utf8");
    json(res, 200, { ok: true });
  },
  "POST /api/settings": async (req, res) => {
    const body = await readBody(req);
    writeFileSync(settingsPath, JSON.stringify(body.settings || {}, null, 2), "utf8");
    json(res, 200, { ok: true });
  },
  "POST /api/publish": async (req, res) => {
    const result = await publish((await readBody(req)).message);
    json(res, result.ok ? 200 : 500, result);
  }
};

const createAdminRequestHandler = () => async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const key = `${req.method} ${url.pathname}`;
    if (routes[key]) return await routes[key](req, res);

    if (req.method === "GET" && url.pathname.startsWith("/api/posts/")) {
      const item = readMarkdownItem("posts", decodeURIComponent(url.pathname.slice("/api/posts/".length)));
      return item ? json(res, 200, item) : json(res, 404, { ok: false, error: "Post not found" });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/projects/")) {
      const item = readMarkdownItem("projects", decodeURIComponent(url.pathname.slice("/api/projects/".length)));
      return item ? json(res, 200, item) : json(res, 404, { ok: false, error: "Project not found" });
    }

    const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = resolve(adminPublic, `.${requestPath}`);
    if (!target.startsWith(adminPublic) || !existsSync(target) || !statSync(target).isFile()) {
      return text(res, 404, "Not found");
    }
    text(res, 200, readFileSync(target), contentType(target));
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

export const startAdminServer = ({ host = "127.0.0.1", port: listenPort = port } = {}) => {
  const server = createServer(createAdminRequestHandler());
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(listenPort, host, () => {
      server.off("error", reject);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : listenPort;
      resolvePromise({
        server,
        host,
        port: actualPort,
        url: `http://${host}:${actualPort}`,
        root,
        adminPublic
      });
    });
  });
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startAdminServer()
    .then(({ url }) => {
      console.log(`Blog admin: ${url}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
