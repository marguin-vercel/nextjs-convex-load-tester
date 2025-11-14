import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Configuration
const CONFIG = {
  totalQueries: parseInt(process.argv[2]) || 100,
  concurrency: parseInt(process.argv[3]) || 10,
  queryLimit: parseInt(process.argv[4]) || 10, // Number of neighborhoods per query
  delayMs: parseInt(process.argv[5]) || 0, // Delay between batches
};

// Statistics tracking
const stats = {
  totalQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  totalBytesTransferred: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  errors: [],
  startTime: 0,
  endTime: 0,
};

// Execute a single query and track metrics
async function executeQuery(queryNum) {
  const startTime = Date.now();
  try {
    const result = await client.query(api.neighborhoods.listNeighborhoods, {
      limit: CONFIG.queryLimit,
    });

    const latency = Date.now() - startTime;
    const bytesTransferred = JSON.stringify(result).length;

    stats.successfulQueries++;
    stats.totalBytesTransferred += bytesTransferred;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    return { success: true, latency, bytes: bytesTransferred };
  } catch (error) {
    stats.failedQueries++;
    stats.errors.push({ queryNum, error: error.message });
    return { success: false, error: error.message };
  } finally {
    stats.totalQueries++;
  }
}

// Execute queries in batches with concurrency control
async function runLoadTest() {
  console.log("\n🔥 Convex Load Test Starting...\n");
  console.log("Configuration:");
  console.log(`  Total Queries: ${CONFIG.totalQueries}`);
  console.log(`  Concurrency: ${CONFIG.concurrency}`);
  console.log(`  Results per Query: ${CONFIG.queryLimit} neighborhoods`);
  console.log(`  Delay between batches: ${CONFIG.delayMs}ms`);
  console.log("\n" + "=".repeat(60) + "\n");

  stats.startTime = Date.now();

  // Create batches
  const batches = [];
  for (let i = 0; i < CONFIG.totalQueries; i += CONFIG.concurrency) {
    const batchSize = Math.min(CONFIG.concurrency, CONFIG.totalQueries - i);
    const batch = [];

    for (let j = 0; j < batchSize; j++) {
      batch.push(executeQuery(i + j + 1));
    }

    batches.push(batch);
  }

  // Execute batches
  let completedQueries = 0;
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await Promise.all(batches[i]);
    completedQueries += batchResults.length;

    // Progress update
    const progress = ((completedQueries / CONFIG.totalQueries) * 100).toFixed(1);
    const avgLatency = (stats.totalLatency / stats.successfulQueries).toFixed(0);
    process.stdout.write(
      `\r⚡ Progress: ${completedQueries}/${CONFIG.totalQueries} (${progress}%) | ` +
      `Avg Latency: ${avgLatency}ms | ` +
      `Success: ${stats.successfulQueries} | ` +
      `Failed: ${stats.failedQueries}`
    );

    // Delay between batches if configured
    if (CONFIG.delayMs > 0 && i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayMs));
    }
  }

  stats.endTime = Date.now();
  console.log("\n\n" + "=".repeat(60) + "\n");
}

// Display results
function displayResults() {
  const totalDuration = (stats.endTime - stats.startTime) / 1000;
  const queriesPerSecond = (stats.totalQueries / totalDuration).toFixed(2);
  const avgLatency = (stats.totalLatency / stats.successfulQueries).toFixed(2);
  const totalMB = (stats.totalBytesTransferred / 1024 / 1024).toFixed(2);
  const mbPerSecond = (parseFloat(totalMB) / totalDuration).toFixed(2);

  console.log("📊 Load Test Results\n");

  console.log("Performance Metrics:");
  console.log(`  Total Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`  Queries Per Second: ${queriesPerSecond}`);
  console.log(`  Average Latency: ${avgLatency}ms`);
  console.log(`  Min Latency: ${stats.minLatency}ms`);
  console.log(`  Max Latency: ${stats.maxLatency}ms`);

  console.log("\nQuery Statistics:");
  console.log(`  Total Queries: ${stats.totalQueries}`);
  console.log(`  ✅ Successful: ${stats.successfulQueries} (${((stats.successfulQueries/stats.totalQueries)*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${stats.failedQueries} (${((stats.failedQueries/stats.totalQueries)*100).toFixed(1)}%)`);

  console.log("\nBandwidth Usage:");
  console.log(`  Total Data Transferred: ${totalMB} MB`);
  console.log(`  Transfer Rate: ${mbPerSecond} MB/s`);
  console.log(`  Average per Query: ${(stats.totalBytesTransferred / stats.successfulQueries / 1024).toFixed(2)} KB`);

  console.log("\nFree Tier Impact:");
  const bandwidthPercent = (parseFloat(totalMB) / 1024 * 100).toFixed(2); // 1 GB free tier
  console.log(`  Bandwidth Used: ${bandwidthPercent}% of monthly 1 GB limit`);
  console.log(`  Function Calls Used: ${(stats.totalQueries / 1000000 * 100).toFixed(3)}% of monthly 1M limit`);

  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  Query #${err.queryNum}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// Run the load test
runLoadTest()
  .then(() => {
    displayResults();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Load test failed:", error);
    process.exit(1);
  });
