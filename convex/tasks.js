import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all messages/tasks
export const get = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks;
  },
});

// Add a new message/task
export const add = mutation({
  args: {
    role: v.string(),
    content: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { role, content, userId }) => {
    const task = await ctx.db.insert("tasks", {
      role,
      content,
      userId,
      createdAt: Date.now(),
    });
    return task;
  },
});
