import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Query to list neighborhoods (similar to the original MongoDB API)
export const listNeighborhoods = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const neighborhoods = await ctx.db
      .query("neighborhoods")
      .take(limit);

    return neighborhoods;
  },
});

// Mutation to import a single neighborhood
export const importNeighborhood = mutation({
  args: {
    name: v.string(),
    geometry: v.object({
      type: v.string(),
      coordinates: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("neighborhoods", {
      name: args.name,
      geometry: args.geometry,
    });
    return id;
  },
});

// Mutation to import multiple neighborhoods at once
export const importNeighborhoods = mutation({
  args: {
    neighborhoods: v.array(
      v.object({
        name: v.string(),
        geometry: v.object({
          type: v.string(),
          coordinates: v.any(),
        }),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const neighborhood of args.neighborhoods) {
      const id = await ctx.db.insert("neighborhoods", {
        name: neighborhood.name,
        geometry: neighborhood.geometry,
      });
      ids.push(id);
    }
    return { count: ids.length, ids };
  },
});

// Query to get a neighborhood by name
export const getNeighborhoodByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const neighborhood = await ctx.db
      .query("neighborhoods")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    return neighborhood;
  },
});

// Query to count total neighborhoods
export const countNeighborhoods = query({
  handler: async (ctx) => {
    const neighborhoods = await ctx.db.query("neighborhoods").collect();
    return neighborhoods.length;
  },
});
