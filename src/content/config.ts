import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().default("随笔"),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    mood: z.string().optional(),
    readingTime: z.string().optional()
  })
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    link: z.string().optional(),
    repo: z.string().optional(),
    featured: z.boolean().default(false)
  })
});

export const collections = { posts, projects };
