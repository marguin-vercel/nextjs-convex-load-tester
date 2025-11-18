"use client";

import { useState } from "react";
import Link from "next/link";

interface LoadTestConfig {
  pattern: "small" | "medium" | "large" | "xlarge" | "xxlarge" | "huge" | "massive" | "mixed";
  totalQueries: number;
  concurrency: number;
  mode: "shared" | "new" | "both";
}

interface TestMetrics {
  duration: number;
  qps: number;
  avgLatency: number;
  medianLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  totalMB: number;
  successRate: number;
  latencyBuckets: Record<string, number>;
  errors: Array<{ queryNum: number; error: string }>;
}

interface TestResults {
  shared?: TestMetrics;
  new?: TestMetrics;
}

export default function LoadTest() {
  const [config, setConfig] = useState<LoadTestConfig>({
    pattern: "medium",
    totalQueries: 100,
    concurrency: 10,
    mode: "both",
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runLoadTest = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/load-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Failed to run load test");
    } finally {
      setIsRunning(false);
    }
  };

  const renderMetrics = (metrics: TestMetrics, title: string, color: string) => (
    <div className={`bg-white dark:bg-slate-800 p-6 rounded-lg border-2 ${color} shadow-lg`}>
      <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">
        {title}
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Duration</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {metrics.duration.toFixed(2)}s
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Queries/sec</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {metrics.qps.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Avg Latency</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.avgLatency.toFixed(0)}ms
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Success Rate</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {metrics.successRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Median:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {metrics.medianLatency.toFixed(0)}ms
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">P95:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {metrics.p95Latency.toFixed(0)}ms
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">P99:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {metrics.p99Latency.toFixed(0)}ms
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Min / Max:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {metrics.minLatency.toFixed(0)}ms / {metrics.maxLatency.toFixed(0)}ms
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Data Transferred:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {metrics.totalMB.toFixed(2)} MB
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
          Latency Distribution
        </div>
        {Object.entries(metrics.latencyBuckets).map(([bucket, count]) => {
          const total = Object.values(metrics.latencyBuckets).reduce((a, b) => a + b, 0);
          const percentage = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={bucket} className="mb-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400">{bucket}</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {percentage.toFixed(1)}% ({count})
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {metrics.errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <div className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            Errors ({metrics.errors.length})
          </div>
          {metrics.errors.slice(0, 3).map((err, idx) => (
            <div key={idx} className="text-xs text-red-600 dark:text-red-300">
              Query #{err.queryNum}: {err.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderComparison = () => {
    if (!results?.shared || !results?.new) return null;

    const avgLatencyImprovement = ((results.new.avgLatency - results.shared.avgLatency) / results.new.avgLatency * 100);
    const qpsImprovement = ((results.shared.qps - results.new.qps) / results.new.qps * 100);

    return (
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-lg border-2 border-purple-200 dark:border-purple-800">
        <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">
          Comparison Summary
        </h3>

        <div className="space-y-3">
          {avgLatencyImprovement > 0 ? (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <span className="text-2xl">✅</span>
              <span>
                Shared Client is <strong>{avgLatencyImprovement.toFixed(1)}% faster</strong> in average latency
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <span className="text-2xl">⚠️</span>
              <span>
                New Client is <strong>{Math.abs(avgLatencyImprovement).toFixed(1)}% faster</strong> in average latency
              </span>
            </div>
          )}

          {qpsImprovement > 0 ? (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <span className="text-2xl">✅</span>
              <span>
                Shared Client has <strong>{qpsImprovement.toFixed(1)}% higher</strong> throughput (QPS)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <span className="text-2xl">⚠️</span>
              <span>
                New Client has <strong>{Math.abs(qpsImprovement).toFixed(1)}% higher</strong> throughput (QPS)
              </span>
            </div>
          )}

          <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              💡 Recommendation
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {avgLatencyImprovement > 5 || qpsImprovement > 5
                ? "Use a SHARED CLIENT (connection reuse) for better performance."
                : "Both approaches have similar performance for this workload."}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Load Testing Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Test Convex query performance with different connection strategies using 5,070 neighborhoods
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">
            Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Query Pattern
              </label>
              <select
                value={config.pattern}
                onChange={(e) => setConfig({ ...config, pattern: e.target.value as any })}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="small">Small (1 neighborhood)</option>
                <option value="medium">Medium (10 neighborhoods)</option>
                <option value="large">Large (50 neighborhoods)</option>
                <option value="xlarge">Extra Large (100 neighborhoods)</option>
                <option value="xxlarge">XX-Large (250 neighborhoods)</option>
                <option value="huge">Huge (500 neighborhoods)</option>
                <option value="massive">Massive (1000 neighborhoods)</option>
                <option value="mixed">Mixed Pattern (1-500)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Test Mode
              </label>
              <select
                value={config.mode}
                onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="both">Compare Both (Shared vs New)</option>
                <option value="shared">Shared Client Only</option>
                <option value="new">New Client Per Request Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Total Queries
              </label>
              <input
                type="number"
                value={config.totalQueries}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setConfig({ ...config, totalQueries: isNaN(val) ? 1 : val });
                }}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                min="1"
                max="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Concurrency
              </label>
              <input
                type="number"
                value={config.concurrency}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setConfig({ ...config, concurrency: isNaN(val) ? 1 : val });
                }}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                min="1"
                max="100"
              />
            </div>
          </div>

          <button
            onClick={runLoadTest}
            disabled={isRunning}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
          >
            {isRunning && (
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isRunning ? "Running Load Test..." : "Run Load Test"}
          </button>
        </div>

        {isRunning && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent rounded-full animate-spin"></div>
              <div>
                <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  Load Test In Progress
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Testing {config.mode === "both" ? "both connection strategies" : `${config.mode} client`} with {config.pattern} pattern...
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
                <span>Executing {config.totalQueries} queries with {config.concurrency} concurrent connections</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                This may take a while depending on your configuration. Large queries with high concurrency will take longer.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <div className="text-red-700 dark:text-red-400 font-semibold">Error</div>
            <div className="text-red-600 dark:text-red-300">{error}</div>
          </div>
        )}

        {results && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {results.shared &&
                renderMetrics(results.shared, "Shared Client (Connection Reuse)", "border-green-300 dark:border-green-700")}
              {results.new &&
                renderMetrics(results.new, "New Client Per Request", "border-orange-300 dark:border-orange-700")}
            </div>

            {renderComparison()}
          </div>
        )}
      </div>
    </div>
  );
}
