import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://onewaterxx2.github.io",
  base: "/bk",
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: "github-light"
    }
  }
});
