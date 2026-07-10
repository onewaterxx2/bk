import rss from "@astrojs/rss";
import { getPublishedPosts } from "../lib/content";
import site from "../data/site.json";

export async function GET(context) {
  const posts = await getPublishedPosts();
  return rss({
    title: site.title,
    description: site.subtitle,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.slug}/`
    }))
  });
}
