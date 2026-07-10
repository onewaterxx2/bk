# 江水博客

一个部署到 GitHub Pages 的 Astro 静态个人博客，包含本地网页版管理工具。

## 开发

```bash
npm.cmd install
npm.cmd run dev
```

站点默认访问：

```text
http://127.0.0.1:4321/bk/
```

## 本地管理工具

```bash
npm.cmd run admin
```

打开：

```text
http://127.0.0.1:4587
```

管理工具支持：

- 新建文章并上传封面图
- 管理作品
- 管理友链
- 上传音乐文件并写入音乐配置
- 编辑站点资料
- 一键执行 `git pull --rebase`、`git add`、`git commit`、`git push`

## 部署

仓库推送到 `https://github.com/onewaterxx2/bk` 后，GitHub Actions 会构建并发布到：

```text
https://onewaterxx2.github.io/bk/
```
