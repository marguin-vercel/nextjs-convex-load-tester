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

// Test patterns
const TEST_PATTERNS = {
  // Small queries - minimal bandwidth
  small: {
    name: "Small Queries (1 neighborhood)",
    limit: 1,
    description: "Tests high query volume with minimal data transfer"
  },
  // Medium queries - typical usage
  medium: {
    name: "Medium Queries (10 neighborhoods)",
    limit: 10,
    description: "Simulates typical application usage"
  },
  // Large queries - maximum data
  large: {
    name: "Large Queries (50 neighborhoods)",
    limit: 50,
    description: "Tests bandwidth and processing of large result sets"
  },
  // Mixed pattern - realistic usage
  mixed: {
    name: "Mixed Pattern",
    limits: [1, 5, 10, 25, 50],
    description: "Simulates realistic mixed query patterns"
  }
};

// Configuration
const CONFIG = {
  pattern: process.argv[2] || 'medium',
  totalQueries: parseInt(process.argv[3]) || 100,
  concurrency: parseInt(process.argv[4]) || 10,
  duration: parseInt(process.argv[5]) || 0, // 0 = use totalQueries, >0 = run for N seconds
};

// Statistics
const stats = {
  queries: [],
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
  latencyBuckets: {
    "0-50ms": 0,
    "50-100ms": 0,
    "100-200ms": 0,
    "200-500ms": 0,
    "500ms+": 0,
  },
};

// Execute a single query
async function executeQuery(queryNum, limit) {
  const startTime = Date.now();
  try {
    const result = await client.query(api.neighborhoods.listNeighborhoods, { limit });

    const latency = Date.now() - startTime;
    const bytesTransferred = JSON.stringify(result).length;

    // Update statistics
    stats.successfulQueries++;
    stats.totalBytesTransferred += bytesTransferred;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    // Latency buckets
    if (latency < 50) stats.latencyBuckets["0-50ms"]++;
    else if (latency < 100) stats.latencyBuckets["50-100ms"]++;
    else if (latency < 200) stats.latencyBuckets["100-200ms"]++;
    else if (latency < 500) stats.latencyBuckets["200-500ms"]++;
    else stats.latencyBuckets["500ms+"]++;

    stats.queries.push({ queryNum, latency, bytes: bytesTransferred, limit });

    return { success: true, latency, bytes: bytesTransferred };
  } catch (error) {
    stats.failedQueries++;
    stats.errors.push({ queryNum, error: error.message });
    return { success: false, error: error.message };
  } finally {
    stats.totalQueries++;
  }
}

// Get limit for current query based on pattern
function getQueryLimit(queryNum) {
  const pattern = TEST_PATTERNS[CONFIG.pattern];

  if (CONFIG.pattern === 'mixed') {
    return pattern.limits[queryNum % pattern.limits.length];
  }

  return pattern.limit;
}

// Run load test
async function runLoadTest() {
  const pattern = TEST_PATTERNS[CONFIG.pattern];

  console.log("\n🔥 Convex Advanced Load Test\n");
  console.log("Configuration:");
  console.log(`  Pattern: ${pattern.name}`);
  console.log(`  Description: ${pattern.description}`);
  console.log(`  Total Queries: ${CONFIG.totalQueries}`);
  console.log(`  Concurrency: ${CONFIG.concurrency}`);
  if (CONFIG.duration > 0) {
    console.log(`  Duration: ${CONFIG.duration} seconds`);
  }
  console.log("\n" + "=".repeat(60) + "\n");

  stats.startTime = Date.now();
  let queryCount = 0;

  const shouldContinue = () => {
    if (CONFIG.duration > 0) {
      return (Date.now() - stats.startTime) / 1000 < CONFIG.duration;
    }
    return queryCount < CONFIG.totalQueries;
  };

  while (shouldContinue()) {
    const batch = [];
    const batchSize = Math.min(CONFIG.concurrency, CONFIG.totalQueries - queryCount);

    for (let i = 0; i < batchSize; i++) {
      const limit = getQueryLimit(queryCount + i);
      batch.push(executeQuery(queryCount + i + 1, limit));
    }

    await Promise.all(batch);
    queryCount += batchSize;

    // Progress update
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const qps = (stats.totalQueries / elapsed).toFixed(1);
    const avgLatency = (stats.totalLatency / stats.successfulQueries).toFixed(0);

    process.stdout.write(
      `\r⚡ Queries: ${stats.totalQueries} | ` +
      `Elapsed: ${elapsed}s | ` +
      `QPS: ${qps} | ` +
      `Avg Latency: ${avgLatency}ms | ` +
      `Success: ${stats.successfulQueries} | ` +
      `Failed: ${stats.failedQueries}   `
    );
  }

  stats.endTime = Date.now();
  console.log("\n\n" + "=".repeat(60) + "\n");
}

// Display detailed results
function displayResults() {
  const totalDuration = (stats.endTime - stats.startTime) / 1000;
  const queriesPerSecond = (stats.totalQueries / totalDuration).toFixed(2);
  const avgLatency = (stats.totalLatency / stats.successfulQueries).toFixed(2);
  const totalMB = (stats.totalBytesTransferred / 1024 / 1024).toFixed(2);
  const mbPerSecond = (parseFloat(totalMB) / totalDuration).toFixed(2);

  console.log("📊 Detailed Load Test Results\n");

  console.log("⚡ Performance Metrics:");
  console.log(`  Total Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`  Queries Per Second: ${queriesPerSecond}`);
  console.log(`  Average Latency: ${avgLatency}ms`);
  console.log(`  Median Latency: ${calculateMedianLatency()}ms`);
  console.log(`  P95 Latency: ${calculatePercentile(95)}ms`);
  console.log(`  P99 Latency: ${calculatePercentile(99)}ms`);
  console.log(`  Min Latency: ${stats.minLatency}ms`);
  console.log(`  Max Latency: ${stats.maxLatency}ms`);

  console.log("\n📈 Latency Distribution:");
  Object.entries(stats.latencyBuckets).forEach(([bucket, count]) => {
    const percentage = ((count / stats.successfulQueries) * 100).toFixed(1);
    const bar = "█".repeat(Math.floor(percentage / 2));
    console.log(`  ${bucket.padEnd(12)} ${bar} ${percentage}% (${count})`);
  });

  console.log("\n📊 Query Statistics:");
  console.log(`  Total Queries: ${stats.totalQueries}`);
  console.log(`  ✅ Successful: ${stats.successfulQueries} (${((stats.successfulQueries/stats.totalQueries)*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${stats.failedQueries} (${((stats.failedQueries/stats.totalQueries)*100).toFixed(1)}%)`);

  console.log("\n🌐 Bandwidth Usage:");
  console.log(`  Total Data Transferred: ${totalMB} MB`);
  console.log(`  Transfer Rate: ${mbPerSecond} MB/s`);
  console.log(`  Average per Query: ${(stats.totalBytesTransferred / stats.successfulQueries / 1024).toFixed(2)} KB`);
  console.log(`  Min per Query: ${(Math.min(...stats.queries.map(q => q.bytes)) / 1024).toFixed(2)} KB`);
  console.log(`  Max per Query: ${(Math.max(...stats.queries.map(q => q.bytes)) / 1024).toFixed(2)} KB`);

  console.log("\n💰 Free Tier Impact:");
  const bandwidthPercent = (parseFloat(totalMB) / 1024 * 100).toFixed(3);
  const functionsPercent = (stats.totalQueries / 1000000 * 100).toFixed(3);
  console.log(`  Database Bandwidth: ${bandwidthPercent}% of 1 GB/month limit`);
  console.log(`  Function Calls: ${functionsPercent}% of 1M/month limit`);
  console.log(`  Estimated monthly impact (if sustained):`);
  const monthlyQueries = stats.totalQueries * (30 * 24 * 3600 / totalDuration);
  const monthlyMB = parseFloat(totalMB) * (30 * 24 * 3600 / totalDuration);
  console.log(`    Queries: ${(monthlyQueries / 1000000).toFixed(1)}M/month`);
  console.log(`    Bandwidth: ${(monthlyMB / 1024).toFixed(1)} GB/month`);

  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    stats.errors.slice(0, 5).forEach(err => {
      console.log(`  Query #${err.queryNum}: ${err.error}`);
    });
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more errors`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// Calculate median latency
function calculateMedianLatency() {
  const latencies = stats.queries.map(q => q.latency).sort((a, b) => a - b);
  const mid = Math.floor(latencies.length / 2);
  return latencies.length % 2 === 0
    ? ((latencies[mid - 1] + latencies[mid]) / 2).toFixed(0)
    : latencies[mid].toFixed(0);
}

// Calculate percentile latency
function calculatePercentile(percentile) {
  const latencies = stats.queries.map(q => q.latency).sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * latencies.length) - 1;
  return latencies[index]?.toFixed(0) || 0;
}

// Run the test
runLoadTest()
  .then(() => {
    displayResults();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Load test failed:", error);
    process.exit(1);
  });
