# 江水博客

一个部署在 GitHub Pages 上的静态个人博客。它使用 Astro 构建，支持文章、作品、友链、音乐播放器、歌词、RSS、站点地图、3D 音乐律动粒子背景，并配套一个本地可视化管理工具，用来写文章、上传图片和音乐，然后一键发布到 GitHub。

在线预览：

```text
https://onewaterxx2.github.io/bk/
```

## 项目特点

- 深色玻璃质感界面，适合个人博客、随笔、技术文章、影像作品和作品集展示。
- Astro 静态构建，不需要购买服务器。
- GitHub Actions 自动构建并部署到 GitHub Pages。
- 支持文章列表、分类、标签、归档、RSS 和 sitemap。
- 支持文章封面、图文混排、HTML/MDX 内容。
- 支持作品页、友链页、关于页。
- 内置全站音乐播放器，切换页面不会中断播放。
- 支持音乐进度条、上一首、下一首、自动播放下一首、LRC 歌词显示。
- 支持 3D 粒子背景，播放音乐时会根据节奏律动。
- 自带本地管理工具，可以在浏览器里管理文章、作品、友链、音乐和站点资料。
- 管理工具支持上传文章封面、文章内图片、音乐文件、音乐封面和 LRC 歌词。
- 管理工具支持一键执行 Git 提交和推送，让 GitHub Pages 自动更新网站。

## 技术栈

- Astro 5
- MDX
- TypeScript
- Three.js
- GitHub Pages
- GitHub Actions
- Node.js 本地管理工具

## 目录结构

```text
.
├─ .github/workflows/deploy.yml   # GitHub Pages 自动部署流程
├─ public/                        # 静态资源
│  ├─ images/                     # 图片资源
│  ├─ media/                      # 音乐和歌词资源
│  ├─ embeds/                     # 可嵌入文章的独立网页
│  └─ scripts/site.js             # 前台交互脚本
├─ src/
│  ├─ components/                 # 页面组件
│  ├─ content/posts/              # 博客文章
│  ├─ content/projects/           # 作品内容
│  ├─ data/                       # 站点、友链、音乐配置
│  ├─ pages/                      # Astro 页面
│  ├─ scripts/audio-visualizer.js # 音乐律动粒子背景
│  └─ styles/global.css           # 全站样式
├─ tools/admin/                   # 本地管理工具
├─ astro.config.mjs               # Astro 配置
├─ package.json
└─ README.md
```

## 本地运行

先安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

浏览器访问：

```text
http://127.0.0.1:4321/bk/
```

如果你在 Windows 上使用 PowerShell，也可以执行：

```bash
npm.cmd install
npm.cmd run dev
```

## 本地构建

```bash
npm run build
```

构建产物会输出到：

```text
dist/
```

本地预览构建结果：

```bash
npm run preview
```

## 使用本地管理工具

这个项目没有在线后台，因为它是纯静态网站。管理工具运行在你自己的电脑上，用来修改本地文件，然后帮你提交并推送到 GitHub。

启动管理工具：

```bash
npm run admin
```

打开：

```text
http://127.0.0.1:4587
```

管理工具可以做这些事：

- 新建文章
- 编辑已有文章
- 上传文章封面
- 在文章中插入图片
- 管理作品
- 管理友链
- 管理站点标题、昵称、简介、GitHub 地址等资料
- 上传音乐
- 上传音乐封面
- 上传 LRC 歌词
- 保存到本地
- 保存并发布到 GitHub

### 发布流程

在管理工具里点击“保存并发布”后，它会依次执行：

```text
git add .
git commit -m "你的提交信息"
git pull --rebase
git push
```

推送成功后，GitHub Actions 会自动构建网站，并发布到 GitHub Pages。

## 桌面版管理工具

本地管理工具也可以打包成 Windows 桌面软件。桌面版启动后会自动打开管理界面，不需要手动运行命令和输入地址。

开发模式启动桌面版：

```bash
npm run admin:desktop
```

打包 Windows 免安装目录版：

```bash
npm run admin:pack
```

打包完成后运行：

```text
release/win-unpacked/江水博客管理工具.exe
```

如果想要方便移动，可以把 `release/win-unpacked/` 压缩成 zip。首次启动时，如果软件没有自动找到博客仓库目录，会提示你选择包含 `src`、`public`、`tools` 文件夹的目录。

## 写文章

文章文件位于：

```text
src/content/posts/
```

一篇文章大致长这样：

```md
---
title: "文章标题"
description: "文章摘要"
date: 2026-07-11
category: "随笔"
tags: ["生活", "记录"]
cover: "/bk/images/posts/example/cover.png"
---

这里写正文内容。

可以使用 Markdown，也可以在 MDX 中加入更复杂的内容。
```

推荐直接使用本地管理工具写文章。它会自动处理 slug、封面图、文章图片和文件保存。

## 发布图文文章

如果你想写图文结合的文章，可以在管理工具的编辑器中：

- 粘贴普通网页内容
- 上传文章封面
- 插入文章图片
- 保留常见的排版结构

文章中的图片会保存到：

```text
public/images/posts/
```

文章内容会保存到：

```text
src/content/posts/
```

## 嵌入独立网页

如果你有一个独立网页，比如照片墙、小游戏、作品演示页，可以放到：

```text
public/embeds/
```

然后在文章中用 iframe 嵌入：

```html
<iframe
  src="/bk/embeds/photo-wall/"
  style="width: 100%; height: 720px; border: 0; border-radius: 18px;"
></iframe>
```

这样独立网页的样式不会污染博客文章的样式。

## 管理音乐和歌词

音乐配置位于：

```text
src/data/music.json
```

音乐文件通常保存到：

```text
public/media/music/
```

歌词文件通常保存到：

```text
public/media/lyrics/
```

音乐封面通常保存到：

```text
public/images/music/
```

音乐配置示例：

```json
[
  {
    "title": "歌曲名",
    "artist": "歌手名",
    "src": "/bk/media/music/song.mp3",
    "cover": "/bk/images/music/song/cover.png",
    "lyrics": "/bk/media/lyrics/song.lrc"
  }
]
```

推荐通过管理工具上传音乐、封面和 LRC 歌词。上传后首页播放器和音乐页面会使用同一套播放状态，切换页面不会中断音乐。

## 修改站点资料

站点资料位于：

```text
src/data/site.json
```

可以修改：

- 网站标题
- 昵称
- 个人简介
- 位置
- GitHub 地址

也可以直接在本地管理工具里修改。

## 部署到自己的 GitHub Pages

如果你想把这个项目部署成自己的博客，可以按下面做。

1. Fork 或复制这个仓库。
2. 修改 `astro.config.mjs`：

```js
export default defineConfig({
  site: "https://你的用户名.github.io",
  base: "/你的仓库名",
  integrations: [mdx(), sitemap()]
});
```

3. 修改 `src/data/site.json` 里的站点资料。
4. 修改 `src/data/music.json`、`src/data/friends.json` 和文章内容。
5. 推送到 GitHub。
6. 打开仓库的 Settings -> Pages。
7. Source 选择 GitHub Actions。
8. 等待 Actions 构建完成。

访问地址通常是：

```text
https://你的用户名.github.io/你的仓库名/
```

如果你的仓库名不是 `bk`，请注意所有以 `/bk/` 开头的资源路径也需要同步改成你的仓库名。

## GitHub Actions 部署说明

部署流程在：

```text
.github/workflows/deploy.yml
```

每次推送到 `main` 分支后，它会：

1. 拉取代码。
2. 安装 Node.js。
3. 执行 `npm ci`。
4. 执行 `npm run build`。
5. 上传 `dist/`。
6. 发布到 GitHub Pages。

## 常用命令

```bash
npm install       # 安装依赖
npm run dev       # 本地开发
npm run build     # 构建静态网站
npm run preview   # 预览构建结果
npm run admin     # 启动本地管理工具
npm run admin:desktop # 启动桌面版管理工具
npm run admin:pack    # 打包 Windows 免安装目录版
```

## 常见问题

### 为什么不需要服务器？

因为博客前台是 Astro 构建出来的静态 HTML、CSS 和 JS，可以直接托管在 GitHub Pages 上。管理工具只在本地运行，用来修改仓库文件和推送代码。

### 在线网站可以直接登录后台吗？

不可以。这个项目的管理工具是本地工具，不是在线后台。这样更适合 GitHub Pages，也避免在公开网站上保存登录和写入权限。

### 上传文章后为什么线上没有立刻更新？

GitHub Actions 构建和 GitHub Pages 缓存需要一点时间。一般等待几十秒到几分钟，然后强制刷新浏览器即可。

### 音乐为什么不能自动播放？

现代浏览器通常禁止网页在用户没有交互时自动播放音乐。用户点击播放后，音乐会在页面切换时保持播放。

### LRC 歌词没有显示怎么办？

检查 `music.json` 中的 `lyrics` 路径是否正确，歌词文件是否是 `.lrc` 格式，并且时间轴格式类似：

```text
[00:12.30]第一句歌词
[00:18.90]第二句歌词
```

### 粒子背景太占性能怎么办？

右下角有粒子背景开关，可以关闭。系统开启“减少动态效果”时，粒子背景也会自动隐藏。

## 适合谁使用

这个项目适合想要下面这些能力的人：

- 不想买服务器，但想拥有一个在线个人博客。
- 想把内容托管在 GitHub。
- 想要比普通 Markdown 博客更精致的页面。
- 想用本地可视化工具管理文章和音乐。
- 想要一个能展示文章、作品、友链、音乐和个人资料的完整个人站点。

## License

当前仓库未声明开源许可证。复制、商用或二次发布前，请先确认作者授权。
