import { getCollection } from "astro:content";

export async function getPublishedPosts() {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getProjects() {
  const projects = await getCollection("projects");
  return projects.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function uniqueTags(posts: Awaited<ReturnType<typeof getPublishedPosts>>) {
  return [...new Set(posts.flatMap((post) => post.data.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function uniqueCategories(posts: Awaited<ReturnType<typeof getPublishedPosts>>) {
  return [...new Set(posts.map((post) => post.data.category))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
