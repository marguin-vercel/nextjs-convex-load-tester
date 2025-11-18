import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

interface LoadTestConfig {
  pattern: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'huge' | 'massive' | 'mixed';
  totalQueries: number;
  concurrency: number;
  mode: 'shared' | 'new' | 'both';
}

interface TestStats {
  queries: Array<{ queryNum: number; latency: number; bytes: number; limit: number }>;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  totalBytesTransferred: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  errors: Array<{ queryNum: number; error: string }>;
  startTime: number;
  endTime: number;
  latencyBuckets: {
    "0-50ms": number;
    "50-100ms": number;
    "100-200ms": number;
    "200-500ms": number;
    "500ms+": number;
  };
}

const TEST_PATTERNS = {
  small: { limit: 1, name: "Small Queries (1 neighborhood)" },
  medium: { limit: 10, name: "Medium Queries (10 neighborhoods)" },
  large: { limit: 50, name: "Large Queries (50 neighborhoods)" },
  xlarge: { limit: 100, name: "Extra Large Queries (100 neighborhoods)" },
  xxlarge: { limit: 250, name: "XX-Large Queries (250 neighborhoods)" },
  huge: { limit: 500, name: "Huge Queries (500 neighborhoods)" },
  massive: { limit: 1000, name: "Massive Queries (1000 neighborhoods)" },
  mixed: { limits: [1, 10, 50, 100, 250, 500], name: "Mixed Pattern" }
};

function createStats(): TestStats {
  return {
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
}

async function executeQueryWithSharedClient(
  sharedClient: ConvexHttpClient,
  queryNum: number,
  limit: number,
  stats: TestStats
) {
  const startTime = Date.now();
  try {
    const result = await sharedClient.query(api.neighborhoods.listNeighborhoods, { limit });
    const latency = Date.now() - startTime;
    const bytesTransferred = JSON.stringify(result).length;

    stats.successfulQueries++;
    stats.totalBytesTransferred += bytesTransferred;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    if (latency < 50) stats.latencyBuckets["0-50ms"]++;
    else if (latency < 100) stats.latencyBuckets["50-100ms"]++;
    else if (latency < 200) stats.latencyBuckets["100-200ms"]++;
    else if (latency < 500) stats.latencyBuckets["200-500ms"]++;
    else stats.latencyBuckets["500ms+"]++;

    stats.queries.push({ queryNum, latency, bytes: bytesTransferred, limit });
    return { success: true, latency, bytes: bytesTransferred };
  } catch (error: any) {
    stats.failedQueries++;
    stats.errors.push({ queryNum, error: error.message });
    return { success: false, error: error.message };
  } finally {
    stats.totalQueries++;
  }
}

async function executeQueryWithNewClient(queryNum: number, limit: number, stats: TestStats) {
  const startTime = Date.now();
  try {
    const newClient = new ConvexHttpClient(CONVEX_URL);
    const result = await newClient.query(api.neighborhoods.listNeighborhoods, { limit });
    const latency = Date.now() - startTime;
    const bytesTransferred = JSON.stringify(result).length;

    stats.successfulQueries++;
    stats.totalBytesTransferred += bytesTransferred;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    if (latency < 50) stats.latencyBuckets["0-50ms"]++;
    else if (latency < 100) stats.latencyBuckets["50-100ms"]++;
    else if (latency < 200) stats.latencyBuckets["100-200ms"]++;
    else if (latency < 500) stats.latencyBuckets["200-500ms"]++;
    else stats.latencyBuckets["500ms+"]++;

    stats.queries.push({ queryNum, latency, bytes: bytesTransferred, limit });
    return { success: true, latency, bytes: bytesTransferred };
  } catch (error: any) {
    stats.failedQueries++;
    stats.errors.push({ queryNum, error: error.message });
    return { success: false, error: error.message };
  } finally {
    stats.totalQueries++;
  }
}

function getQueryLimit(queryNum: number, pattern: string) {
  const testPattern = TEST_PATTERNS[pattern as keyof typeof TEST_PATTERNS];

  if (pattern === 'mixed') {
    return (testPattern as any).limits[queryNum % (testPattern as any).limits.length];
  }

  return (testPattern as any).limit;
}

async function runLoadTest(
  config: LoadTestConfig,
  mode: 'shared' | 'new',
  sharedClient?: ConvexHttpClient
): Promise<TestStats> {
  const stats = createStats();
  stats.startTime = Date.now();
  let queryCount = 0;

  while (queryCount < config.totalQueries) {
    const batch = [];
    const batchSize = Math.min(config.concurrency, config.totalQueries - queryCount);

    for (let i = 0; i < batchSize; i++) {
      const limit = getQueryLimit(queryCount + i, config.pattern);
      if (mode === 'shared' && sharedClient) {
        batch.push(executeQueryWithSharedClient(sharedClient, queryCount + i + 1, limit, stats));
      } else {
        batch.push(executeQueryWithNewClient(queryCount + i + 1, limit, stats));
      }
    }

    await Promise.all(batch);
    queryCount += batchSize;
  }

  stats.endTime = Date.now();
  return stats;
}

function calculateMetrics(stats: TestStats) {
  const totalDuration = (stats.endTime - stats.startTime) / 1000;
  const queriesPerSecond = stats.totalQueries / totalDuration;
  const avgLatency = stats.successfulQueries > 0
    ? stats.totalLatency / stats.successfulQueries
    : 0;
  const totalMB = stats.totalBytesTransferred / 1024 / 1024;

  const latencies = stats.queries.map(q => q.latency).sort((a, b) => a - b);
  const medianLatency = latencies.length > 0
    ? latencies[Math.floor(latencies.length / 2)]
    : 0;
  const p95Latency = latencies.length > 0
    ? latencies[Math.ceil(0.95 * latencies.length) - 1]
    : 0;
  const p99Latency = latencies.length > 0
    ? latencies[Math.ceil(0.99 * latencies.length) - 1]
    : 0;

  return {
    duration: totalDuration,
    qps: queriesPerSecond,
    avgLatency,
    medianLatency,
    p95Latency,
    p99Latency,
    minLatency: stats.minLatency === Infinity ? 0 : stats.minLatency,
    maxLatency: stats.maxLatency,
    totalMB,
    successRate: (stats.successfulQueries / stats.totalQueries) * 100,
    latencyBuckets: stats.latencyBuckets,
    errors: stats.errors.slice(0, 5),
  };
}

export async function POST(request: NextRequest) {
  try {
    const config: LoadTestConfig = await request.json();

    if (config.mode === 'both') {
      // Run both tests
      const sharedClient = new ConvexHttpClient(CONVEX_URL);
      const [sharedStats, newStats] = await Promise.all([
        runLoadTest(config, 'shared', sharedClient),
        runLoadTest(config, 'new'),
      ]);

      return NextResponse.json({
        shared: calculateMetrics(sharedStats),
        new: calculateMetrics(newStats),
      });
    } else {
      // Run single test
      const sharedClient = config.mode === 'shared' ? new ConvexHttpClient(CONVEX_URL) : undefined;
      const stats = await runLoadTest(config, config.mode, sharedClient);

      return NextResponse.json({
        [config.mode]: calculateMetrics(stats),
      });
    }
  } catch (error: any) {
    console.error("Load test error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run load test" },
      { status: 500 }
    );
  }
}
