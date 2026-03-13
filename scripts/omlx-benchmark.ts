#!/usr/bin/env npx tsx
/**
 * oMLX Model Benchmark — 測試所有已安裝模型在各種使用場景的表現
 *
 * Usage: npx tsx tests/omlx-benchmark.ts
 */

const LLM_URL = process.env.LOCAL_LLM_URL ?? 'http://localhost:8000';
const LLM_KEY = process.env.LOCAL_LLM_KEY ?? 'omlx-local';

// ─── Models ──────────────────────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  label: string;
  size: string;
}

// Will be populated from /v1/models
let MODELS: ModelInfo[] = [];

// ─── Test Scenarios ──────────────────────────────────────────────────────────

interface Scenario {
  name: string;
  category: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature: number;
  expectedMinLength: number; // minimum chars in response to consider valid
  tools?: boolean;
}

const SCENARIOS: Scenario[] = [
  // --- 快速回覆 ---
  {
    name: '簡單問答',
    category: '日常',
    prompt: 'What is 2+2? Reply with just the number.',
    maxTokens: 16,
    temperature: 0.1,
    expectedMinLength: 1,
  },
  {
    name: '分類/路由',
    category: '日常',
    prompt: 'Classify this text into one category (coding/chat/reasoning/creative): "Help me write a Python function to sort a list". Reply with one word only.',
    maxTokens: 8,
    temperature: 0.1,
    expectedMinLength: 3,
  },
  {
    name: '翻譯',
    category: '日常',
    prompt: 'Translate to Traditional Chinese: "The quick brown fox jumps over the lazy dog"',
    maxTokens: 64,
    temperature: 0.3,
    expectedMinLength: 5,
  },

  // --- 中等複雜度 ---
  {
    name: '摘要',
    category: '中等',
    prompt: `Summarize this in 2 sentences: "Artificial intelligence has transformed many industries. In healthcare, AI helps diagnose diseases earlier and more accurately. In finance, it detects fraud patterns that humans might miss. In transportation, self-driving cars use AI to navigate roads safely. However, these advances also raise concerns about job displacement, privacy, and algorithmic bias. Researchers and policymakers are working together to create frameworks that maximize AI's benefits while minimizing its risks."`,
    maxTokens: 128,
    temperature: 0.5,
    expectedMinLength: 30,
  },
  {
    name: '程式碼生成',
    category: '中等',
    prompt: 'Write a TypeScript function called `fibonacci` that returns the nth fibonacci number using memoization. Include the type signature.',
    maxTokens: 512,
    temperature: 0.3,
    expectedMinLength: 50,
  },
  {
    name: '創意寫作',
    category: '中等',
    prompt: 'Write a haiku about programming in the rain.',
    maxTokens: 64,
    temperature: 0.9,
    expectedMinLength: 10,
  },

  // --- 複雜推理 ---
  {
    name: '邏輯推理',
    category: '推理',
    prompt: 'A farmer has a fox, a chicken, and a bag of grain. He needs to cross a river in a boat that can only carry him and one item. The fox will eat the chicken if left alone, and the chicken will eat the grain if left alone. How does he get everything across? Explain step by step.',
    maxTokens: 512,
    temperature: 0.3,
    expectedMinLength: 100,
  },
  {
    name: '數學推理',
    category: '推理',
    prompt: 'If a train travels at 60 km/h for 2.5 hours, then at 80 km/h for 1.5 hours, what is the average speed for the entire journey? Show your work.',
    maxTokens: 256,
    temperature: 0.1,
    expectedMinLength: 50,
  },

  // --- 長 context ---
  {
    name: '長 prompt 理解',
    category: '長文',
    prompt: `Read the following conversation and answer the question at the end.

Alice: I think we should use PostgreSQL for the new project.
Bob: But we discussed using MongoDB last week because of the flexible schema.
Alice: True, but our data is mostly relational. We have users, orders, and products with clear relationships.
Bob: What about the analytics pipeline? MongoDB's aggregation framework is powerful.
Alice: We could use PostgreSQL with JSONB columns for the semi-structured data. Best of both worlds.
Bob: Good point. But what about scaling? We expect 10 million users in the first year.
Alice: PostgreSQL handles that fine with proper indexing and partitioning. Instagram runs on PostgreSQL.
Bob: OK, but we also need real-time features. WebSocket connections, live updates.
Alice: That's an application layer concern, not a database concern. We can use Redis for pub/sub.
Bob: Alright, I'm convinced. Let's go with PostgreSQL + Redis.
Alice: Great. I'll draft the schema this week.
Bob: And I'll set up the CI/CD pipeline with the new stack.

Questions:
1. What database did they finally choose?
2. What was Bob's initial preference?
3. What will Alice do next?`,
    maxTokens: 256,
    temperature: 0.3,
    expectedMinLength: 50,
  },

  // --- Tool calling ---
  {
    name: 'Tool Calling',
    category: '工具',
    prompt: 'Search memory for "TypeScript configuration"',
    maxTokens: 256,
    temperature: 0.1,
    expectedMinLength: 0, // tool calls may have empty content
    tools: true,
  },
];

// ─── Benchmark Runner ────────────────────────────────────────────────────────

interface BenchmarkResult {
  model: string;
  scenario: string;
  category: string;
  success: boolean;
  prefillMs: number;    // time to first token (approx)
  totalMs: number;      // total time
  tokensGenerated: number;
  tokensPerSec: number;
  responseLength: number;
  responsePreview: string;
  error?: string;
  hasToolCalls?: boolean;
}

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_memory',
      description: 'Search agent memory',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
];

async function runBenchmark(model: string, scenario: Scenario): Promise<BenchmarkResult> {
  const messages: Array<{ role: string; content: string }> = [];
  if (scenario.systemPrompt) {
    messages.push({ role: 'system', content: scenario.systemPrompt });
  }
  messages.push({ role: 'user', content: scenario.prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: scenario.maxTokens,
    temperature: scenario.temperature,
    stream: true,
    chat_template_kwargs: { enable_thinking: false },
  };
  if (scenario.tools) {
    body.tools = TOOLS;
  }

  const startTime = performance.now();
  let firstTokenTime = 0;
  let content = '';
  let tokensGenerated = 0;
  let hasToolCalls = false;

  try {
    const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        model, scenario: scenario.name, category: scenario.category,
        success: false, prefillMs: 0, totalMs: 0, tokensGenerated: 0,
        tokensPerSec: 0, responseLength: 0, responsePreview: '',
        error: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
      };
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const chunk = JSON.parse(line.slice(6)) as {
            choices: Array<{
              delta: { content?: string; tool_calls?: unknown[] };
              finish_reason?: string;
            }>;
            usage?: { completion_tokens?: number };
          };
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            content += delta.content;
            tokensGenerated++;
          }
          if (delta?.tool_calls) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            hasToolCalls = true;
            tokensGenerated++;
          }
          if (chunk.usage?.completion_tokens) {
            tokensGenerated = chunk.usage.completion_tokens;
          }
        } catch { /* keep-alive or malformed */ }
      }
    }

    const totalMs = performance.now() - startTime;
    const prefillMs = firstTokenTime ? firstTokenTime - startTime : totalMs;
    const tokensPerSec = tokensGenerated > 0 ? (tokensGenerated / (totalMs / 1000)) : 0;

    return {
      model,
      scenario: scenario.name,
      category: scenario.category,
      success: content.length >= scenario.expectedMinLength || hasToolCalls,
      prefillMs: Math.round(prefillMs),
      totalMs: Math.round(totalMs),
      tokensGenerated,
      tokensPerSec: Math.round(tokensPerSec * 10) / 10,
      responseLength: content.length,
      responsePreview: content.replace(/\n/g, ' ').slice(0, 80),
      hasToolCalls,
    };
  } catch (e) {
    const totalMs = performance.now() - startTime;
    return {
      model, scenario: scenario.name, category: scenario.category,
      success: false, prefillMs: 0, totalMs: Math.round(totalMs),
      tokensGenerated: 0, tokensPerSec: 0, responseLength: 0,
      responsePreview: '', error: (e as Error).message.slice(0, 80),
    };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

async function main() {
  // Discover models
  console.log('🔍 Discovering models on oMLX...\n');
  const modelsRes = await fetch(`${LLM_URL}/v1/models`);
  const modelsData = await modelsRes.json() as { data: Array<{ id: string }> };

  // Sort by size (smaller first based on name heuristics)
  const sizeOrder = (id: string): number => {
    if (id.includes('0.8B') || id.includes('0.5B') || id.includes('1B')) return 1;
    if (id.includes('3B') || id.includes('4B')) return 2;
    if (id.includes('7B') || id.includes('8B') || id.includes('9B')) return 3;
    if (id.includes('14B') || id.includes('13B')) return 4;
    if (id.includes('27B') || id.includes('32B') || id.includes('35B')) return 5;
    if (id.includes('70B') || id.includes('72B')) return 6;
    return 7;
  };

  MODELS = modelsData.data
    .map(m => {
      const size = m.id.match(/(\d+\.?\d*B)/)?.[1] || '?';
      return { id: m.id, label: m.id, size };
    })
    .sort((a, b) => sizeOrder(a.id) - sizeOrder(b.id));

  console.log(`📦 找到 ${MODELS.length} 個模型：`);
  MODELS.forEach(m => console.log(`   • ${m.id} (${m.size})`));
  console.log();

  // Run benchmarks
  const results: BenchmarkResult[] = [];
  const totalTests = MODELS.length * SCENARIOS.length;
  let completed = 0;

  for (const model of MODELS) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🤖 測試模型：${model.id} (${model.size})`);
    console.log('═'.repeat(70));

    for (const scenario of SCENARIOS) {
      completed++;
      process.stdout.write(`  [${completed}/${totalTests}] ${padRight(scenario.name, 16)} ... `);

      const result = await runBenchmark(model.id, scenario);
      results.push(result);

      const status = result.success ? '✅' : '❌';
      const speed = result.tokensPerSec > 0 ? `${result.tokensPerSec} tok/s` : 'N/A';
      console.log(
        `${status} prefill=${formatMs(result.prefillMs)} total=${formatMs(result.totalMs)} ` +
        `${speed} len=${result.responseLength}${result.hasToolCalls ? ' 🔧' : ''}` +
        `${result.error ? ` ERR: ${result.error}` : ''}`
      );

      // Brief cooldown between requests to avoid oMLX queue pressure
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ─── Summary Table ───────────────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(90)}`);
  console.log('📊 綜合比較表');
  console.log('═'.repeat(90));

  // Group by scenario, compare models
  const categories = [...new Set(SCENARIOS.map(s => s.category))];

  for (const cat of categories) {
    console.log(`\n── ${cat} ${'─'.repeat(80)}`);
    const catScenarios = SCENARIOS.filter(s => s.category === cat);

    for (const scenario of catScenarios) {
      console.log(`\n  📝 ${scenario.name}:`);
      console.log(`     ${padRight('模型', 30)} ${padRight('Prefill', 10)} ${padRight('Total', 10)} ${padRight('tok/s', 8)} ${padRight('狀態', 4)}`);
      console.log(`     ${'─'.repeat(66)}`);

      for (const model of MODELS) {
        const r = results.find(r => r.model === model.id && r.scenario === scenario.name);
        if (!r) continue;
        const status = r.success ? '✅' : '❌';
        console.log(
          `     ${padRight(model.id, 30)} ${padRight(formatMs(r.prefillMs), 10)} ${padRight(formatMs(r.totalMs), 10)} ${padRight(String(r.tokensPerSec), 8)} ${status}`
        );
      }
    }
  }

  // ─── Per-model Summary ─────────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(90)}`);
  console.log('📈 各模型總結');
  console.log('═'.repeat(90));

  for (const model of MODELS) {
    const modelResults = results.filter(r => r.model === model.id);
    const successCount = modelResults.filter(r => r.success).length;
    const avgTokPerSec = modelResults.filter(r => r.tokensPerSec > 0).reduce((sum, r) => sum + r.tokensPerSec, 0) /
      (modelResults.filter(r => r.tokensPerSec > 0).length || 1);
    const avgPrefill = modelResults.filter(r => r.prefillMs > 0).reduce((sum, r) => sum + r.prefillMs, 0) /
      (modelResults.filter(r => r.prefillMs > 0).length || 1);

    console.log(`\n  🤖 ${model.id} (${model.size})`);
    console.log(`     成功率：${successCount}/${modelResults.length}`);
    console.log(`     平均速度：${Math.round(avgTokPerSec * 10) / 10} tok/s`);
    console.log(`     平均 Prefill：${formatMs(Math.round(avgPrefill))}`);
  }

  // ─── Recommendations ───────────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(90)}`);
  console.log('💡 Profile 建議');
  console.log('═'.repeat(90));

  const fastModels = results
    .filter(r => r.category === '日常' && r.success)
    .sort((a, b) => a.totalMs - b.totalMs);
  const reasoningModels = results
    .filter(r => r.category === '推理' && r.success)
    .sort((a, b) => b.responseLength - a.responseLength);

  if (fastModels.length > 0) {
    console.log(`\n  fast profile 推薦：${fastModels[0].model}`);
    console.log(`    原因：日常任務最快 (${formatMs(fastModels[0].totalMs)})`);
  }
  if (reasoningModels.length > 0) {
    console.log(`\n  thinking profile 推薦：${reasoningModels[0].model}`);
    console.log(`    原因：推理任務最完整的回答 (${reasoningModels[0].responseLength} chars)`);
  }

  console.log('\n✅ Benchmark 完成\n');
}

main().catch(e => {
  console.error('❌ Benchmark 失敗:', e);
  process.exit(1);
});
