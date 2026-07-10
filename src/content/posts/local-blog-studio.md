---
title: "为什么用本地工具管理静态博客"
description: "不用服务器，也能拥有接近后台的发布体验。"
pubDate: 2026-07-11
category: "技术"
tags: ["GitHub Pages", "Astro", "工具"]
cover: "/bk/images/covers/admin-tool.svg"
featured: true
readingTime: "4 min"
---

静态博客最大的优点是稳定和省心，但传统写作流程常常要打开编辑器、处理图片路径、手动提交 Git。对个人博客来说，这些步骤会打断写作。

本地管理工具的目标是把这些步骤收起来：

1. 在网页表单里写标题、摘要、标签和正文。
2. 选择封面图或音乐文件。
3. 点击保存，工具写入仓库文件。
4. 点击发布，工具执行 Git 提交和推送。

这样仍然保留 GitHub Pages 的免费部署和静态站性能，也不会把 GitHub 写入密钥暴露在公网页面里。
