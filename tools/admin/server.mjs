import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const adminPublic = join(root, "tools/admin/public");
const port = Number(process.env.BLOG_ADMIN_PORT || 4587);

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

const safeJoin = (...parts) => {
  const target = resolve(root, ...parts);
  const rel = relative(root, target);
  if (rel.startsWith("..") || normalize(rel).startsWith("..")) {
    throw new Error("Path escapes project root");
  }
  return target;
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

const listMarkdown = (collection) => {
  const dir = safeJoin("src/content", collection);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .map((file) => {
      const full = join(dir, file);
      const raw = readFileSync(full, "utf8");
      const title = /^title:\s*["']?(.+?)["']?\s*$/m.exec(raw)?.[1] || file;
      return { slug: file.replace(/\.(md|mdx)$/i, ""), title, path: relative(root, full) };
    });
};

const runGit = (args) =>
  new Promise((resolvePromise) => {
    const child = spawn("git", args, { cwd: root, shell: false });
    let out = "";
    child.stdout.on("data", (data) => (out += data.toString()));
    child.stderr.on("data", (data) => (out += data.toString()));
    child.on("close", (code) => resolvePromise({ code, out }));
  });

const publish = async (message) => {
  const steps = [];
  const head = await runGit(["rev-parse", "--verify", "HEAD"]);
  const branchResult = await runGit(["branch", "--show-current"]);
  const branch = branchResult.out.trim() || "main";
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const commands = [];

  if (head.code === 0 && upstream.code === 0) {
    commands.push(["pull", "--rebase"]);
  } else if (head.code === 0) {
    steps.push("No upstream branch yet; skipping pull before first push.");
  } else {
    steps.push("No commits yet; skipping pull before initial commit.");
  }

  commands.push(["add", "."], ["commit", "-m", message || "publish blog update"]);
  commands.push(upstream.code === 0 ? ["push"] : ["push", "-u", "origin", branch]);

  for (const args of commands) {
    const result = await runGit(args);
    steps.push(`$ git ${args.join(" ")}\n${result.out}`.trim());
    const noChanges = args[0] === "commit" && /nothing to commit|no changes added/i.test(result.out);
    if (result.code !== 0 && !noChanges) {
      return { ok: false, output: steps.join("\n\n") };
    }
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

const routes = {
  "GET /api/content": async (_req, res) => {
    json(res, 200, {
      posts: listMarkdown("posts"),
      projects: listMarkdown("projects"),
      site: JSON.parse(readFileSync(safeJoin("src/data/site.json"), "utf8")),
      friends: JSON.parse(readFileSync(safeJoin("src/data/friends.json"), "utf8")),
      music: JSON.parse(readFileSync(safeJoin("src/data/music.json"), "utf8"))
    });
  },
  "POST /api/posts": async (req, res) => {
    const body = await readBody(req);
    const slug = slugify(body.slug || body.title);
    const cover = body.coverData ? saveDataUrl(body.coverData, `images/posts/${slug}`, "cover") : body.cover;
    const data = {
      title: body.title,
      description: body.description,
      pubDate: body.pubDate || new Date().toISOString().slice(0, 10),
      category: body.category || "随笔",
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
    mkdirSync(safeJoin("src/content/posts"), { recursive: true });
    writeFileSync(safeJoin("src/content/posts", `${slug}.md`), `${frontmatter(data)}${body.content || ""}\n`, "utf8");
    json(res, 200, { ok: true, slug });
  },
  "POST /api/projects": async (req, res) => {
    const body = await readBody(req);
    const slug = slugify(body.slug || body.title);
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
    mkdirSync(safeJoin("src/content/projects"), { recursive: true });
    writeFileSync(safeJoin("src/content/projects", `${slug}.md`), `${frontmatter(data)}${body.content || ""}\n`, "utf8");
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
      const slug = slugify(`${item.title}-${item.artist}`);
      const src = item.audioData ? saveDataUrl(item.audioData, "media/music", slug) : item.src;
      const cover = item.coverData ? saveDataUrl(item.coverData, `images/music/${slug}`, "cover") : item.cover;
      tracks.push({ title: item.title, artist: item.artist, src, cover });
    }
    writeFileSync(safeJoin("src/data/music.json"), JSON.stringify(tracks, null, 2), "utf8");
    json(res, 200, { ok: true });
  },
  "POST /api/site": async (req, res) => {
    const body = await readBody(req);
    writeFileSync(safeJoin("src/data/site.json"), JSON.stringify(body.site || {}, null, 2), "utf8");
    json(res, 200, { ok: true });
  },
  "POST /api/publish": async (req, res) => {
    const body = await readBody(req);
    const result = await publish(body.message);
    json(res, result.ok ? 200 : 500, result);
  }
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const key = `${req.method} ${url.pathname}`;
    if (routes[key]) return await routes[key](req, res);

    const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = resolve(adminPublic, `.${requestPath}`);
    if (!target.startsWith(adminPublic) || !existsSync(target) || !statSync(target).isFile()) {
      return text(res, 404, "Not found");
    }
    text(res, 200, readFileSync(target), contentType(target));
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`江水博客管理工具：http://127.0.0.1:${port}`);
});
