import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function importData() {
  console.log("Reading neighborhoods.json...");
  const fileContent = fs.readFileSync("neighborhoods.json", "utf8");

  // Parse NDJSON format (newline-delimited JSON)
  const data = fileContent
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  console.log(`Found ${data.length} neighborhoods to import`);

  // Import in batches of 50 to avoid overwhelming the system
  const batchSize = 50;
  let imported = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const neighborhoods = batch.map((item) => ({
      name: item.name,
      geometry: item.geometry,
    }));

    try {
      const result = await client.mutation(api.neighborhoods.importNeighborhoods, {
        neighborhoods,
      });
      imported += result.count;
      console.log(`Imported ${imported}/${data.length} neighborhoods...`);
    } catch (error) {
      console.error(`Error importing batch ${i / batchSize + 1}:`, error);
      throw error;
    }
  }

  console.log(`✅ Successfully imported ${imported} neighborhoods!`);

  // Show first 10 neighborhoods as a sample
  const sample = await client.query(api.neighborhoods.listNeighborhoods, {
    limit: 10,
  });
  console.log("\nSample neighborhoods:");
  sample.forEach((n) => console.log(`  - ${n.name}`));
}

importData()
  .then(() => {
    console.log("\n✨ Import completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  });
