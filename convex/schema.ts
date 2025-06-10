import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    role: v.string(), // "prompt" or "response"
    content: v.string(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_creation_time", ["createdAt"]),
});
