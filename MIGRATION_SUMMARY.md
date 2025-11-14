# MongoDB to Convex Migration Summary

## Overview

Successfully migrated the `sample_restaurants` neighborhoods data from MongoDB to Convex.

## What Was Done

### 1. Schema Definition (`convex/schema.ts`)
Added a `neighborhoods` table with:
- `name`: string - The neighborhood name
- `geometry`: object - GeoJSON format containing type and coordinates

### 2. Convex Functions (`convex/neighborhoods.ts`)
Created the following functions:

**Queries:**
- `listNeighborhoods` - Returns a list of neighborhoods (default limit: 10)
- `getNeighborhoodByName` - Find a specific neighborhood by name
- `countNeighborhoods` - Get total count of neighborhoods

**Mutations:**
- `importNeighborhood` - Import a single neighborhood
- `importNeighborhoods` - Batch import multiple neighborhoods

### 3. Data Import
- Downloaded 195 neighborhoods from MongoDB sample dataset
- Imported all neighborhoods into Convex database
- Data source: `https://raw.githubusercontent.com/mongodb/docs-assets/geospatial/neighborhoods.json`

### 4. API Endpoint (`app/api/neighborhoods/route.ts`)
Created a Next.js API route that mimics the original MongoDB serverless function:
- **URL:** `/api/neighborhoods`
- **Query Parameters:** `?limit=10` (optional, defaults to 10)
- **Returns:** JSON array of neighborhood objects

## Usage Examples

### Using Convex Queries Directly
```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function MyComponent() {
  const neighborhoods = useQuery(api.neighborhoods.listNeighborhoods, { limit: 10 });
  return <div>{neighborhoods?.map(n => n.name).join(", ")}</div>;
}
```

### Using the API Endpoint
```bash
# Get 10 neighborhoods (default)
curl http://localhost:3001/api/neighborhoods

# Get 5 neighborhoods
curl http://localhost:3001/api/neighborhoods?limit=5
```

## Files Created/Modified

### Created:
- `convex/neighborhoods.ts` - Convex functions for neighborhoods
- `app/api/neighborhoods/route.ts` - Next.js API route
- `import-neighborhoods.mjs` - Data import script
- `neighborhoods.json` - Downloaded neighborhood data

### Modified:
- `convex/schema.ts` - Added neighborhoods table definition

## Data Statistics

- **Total Neighborhoods:** 195
- **Format:** GeoJSON Polygons representing NYC neighborhoods
- **Sample Neighborhoods:** Bedford, Midwood, Fordham South, Borough Park, East Flushing, etc.

## Comparison: MongoDB vs Convex

### Original (MongoDB - `nodejs-serverless-function-express`)
```typescript
// api/hello.ts
const documents = await withClient(async (client) => {
  const db = client.db("sample_restaurants");
  const collection = db.collection("neighborhoods");
  return collection.find({}).limit(10).toArray();
});
```

### New (Convex - `my-convex-app`)
```typescript
// convex/neighborhoods.ts
export const listNeighborhoods = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db.query("neighborhoods").take(limit);
  },
});
```

## Benefits of Convex Migration

1. **Real-time Updates** - Convex queries automatically update when data changes
2. **Type Safety** - Full TypeScript support with generated types
3. **No Connection Management** - No need to manage database connections
4. **Built-in Caching** - Convex handles caching automatically
5. **Serverless** - No infrastructure to manage
6. **Developer Experience** - Simpler API, less boilerplate code

## Next Steps

To start the development server:
```bash
cd /Users/michael.arguin/work/marketplace-testing/convex-test/my-convex-app
npm run dev
```

The API will be available at: `http://localhost:3001/api/neighborhoods`
