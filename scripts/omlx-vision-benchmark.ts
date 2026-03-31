#!/usr/bin/env npx tsx
/**
 * oMLX Vision Benchmark — Qwen3.5 VLM 影像辨識測試
 *
 * Qwen3.5-4B-MLX-4bit 原生支援 vision (297 vision tensors, ViT 24-layer)
 * 測試影像辨識在不同場景下的表現
 *
 * Usage: npx tsx scripts/omlx-vision-benchmark.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const LLM_URL = process.env.LOCAL_LLM_URL ?? 'http://localhost:8000';

// ─── Profile ───────────────────────────────────────────────────────────────

const PROFILE = {
  model: 'Qwen3.5-4B-MLX-4bit',
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  presence_penalty: 1.5,
  enable_thinking: false,
  max_tokens: 512,
};

// ─── Test Images (generated as base64 PNGs) ────────────────────────────────

function loadTestImage(name: string): string {
  const imgPath = `/tmp/${name}.png`;
  const data = fs.readFileSync(imgPath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

// Also test with a real screenshot if available
function loadRealImage(): string | null {
  const candidates = [
    '/Users/user/Workspace/mini-agent/memory/artifacts/cdp-dashboard-2026-02-13.png',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p);
      // Limit to 1MB to avoid timeout
      if (data.length > 1_000_000) {
        console.log(`  ⚠️  ${path.basename(p)} too large (${(data.length/1024/1024).toFixed(1)}MB), skipping`);
        return null;
      }
      return `data:image/png;base64,${data.toString('base64')}`;
    }
  }
  return null;
}

// ─── Scenarios ─────────────────────────────────────────────────────────────

interface VisionScenario {
  id: number;
  name: string;
  category: string;
  imageRef: string; // key to load image
  prompt: string;
  expectedKeywords: string[]; // at least one must appear in response
  purpose: string;
}

const SCENARIOS: VisionScenario[] = [
  {
    id: 1,
    name: '色彩辨識',
    category: '基礎',
    imageRef: 'test_red',
    prompt: 'What color is this image? Reply with just the color name.',
    expectedKeywords: ['red'],
    purpose: '基本顏色識別',
  },
  {
    id: 2,
    name: '形狀辨識',
    category: '基礎',
    imageRef: 'test_blue_circle',
    prompt: 'Describe what you see in this image. Be brief (1 sentence).',
    expectedKeywords: ['circle', 'blue', 'round', 'dot'],
    purpose: '形狀與顏色組合識別',
  },
  {
    id: 3,
    name: '圖案描述',
    category: '基礎',
    imageRef: 'test_stripes',
    prompt: 'Describe the pattern in this image. Be brief.',
    expectedKeywords: ['stripe', 'band', 'horizontal', 'green', 'yellow', 'line', 'bar', 'alter'],
    purpose: '圖案識別與描述',
  },
  {
    id: 4,
    name: '物件計數',
    category: '理解',
    imageRef: 'test_3dots',
    prompt: 'How many dots or circles are in this image? Reply with just the number.',
    expectedKeywords: ['3', 'three'],
    purpose: '物件計數能力',
  },
  {
    id: 5,
    name: '漸層分析',
    category: '理解',
    imageRef: 'test_gradient',
    prompt: 'Describe this image. What kind of visual effect is shown?',
    expectedKeywords: ['gradient', 'dark', 'light', 'gray', 'grey', 'fade', 'transition', 'black', 'white'],
    purpose: '細微視覺變化的描述能力',
  },
  {
    id: 6,
    name: '空間推理',
    category: '推理',
    imageRef: 'test_blue_circle',
    prompt: 'Where is the main object positioned in the image? Is it centered, left, right, top, or bottom?',
    expectedKeywords: ['center', 'middle', 'centered'],
    purpose: '空間位置推理',
  },
  {
    id: 7,
    name: '比較分析',
    category: '推理',
    imageRef: 'test_stripes',
    prompt: 'Are all the stripes the same width? How many different colors are there?',
    expectedKeywords: ['2', 'two', 'same', 'equal', 'green', 'yellow'],
    purpose: '比較與分析能力',
  },
];

// ─── Benchmark Runner ──────────────────────────────────────────────────────

interface VisionResult {
  scenario: string;
  category: string;
  success: boolean;
  keywordHit: boolean;
  matchedKeyword: string;
  prefillMs: number;
  totalMs: number;
  tokensGenerated: number;
  tokensPerSec: number;
  responsePreview: string;
  error?: string;
}

async function runVisionBenchmark(scenario: VisionScenario): Promise<VisionResult> {
  let imageDataUrl: string;
  if (scenario.imageRef === 'real_screenshot') {
    const real = loadRealImage();
    if (!real) {
      return {
        scenario: scenario.name, category: scenario.category,
        success: false, keywordHit: false, matchedKeyword: '',
        prefillMs: 0, totalMs: 0, tokensGenerated: 0, tokensPerSec: 0,
        responsePreview: '', error: 'No real screenshot available',
      };
    }
    imageDataUrl = real;
  } else {
    imageDataUrl = loadTestImage(scenario.imageRef);
  }

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: scenario.prompt },
      ],
    },
  ];

  const body = {
    model: PROFILE.model,
    messages,
    max_tokens: PROFILE.max_tokens,
    temperature: PROFILE.temperature,
    top_p: PROFILE.top_p,
    top_k: PROFILE.top_k,
    presence_penalty: PROFILE.presence_penalty,
    stream: true,
    chat_template_kwargs: { enable_thinking: PROFILE.enable_thinking },
  };

  const startTime = performance.now();
  let firstTokenTime = 0;
  let content = '';
  let tokensGenerated = 0;

  try {
    const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        scenario: scenario.name, category: scenario.category,
        success: false, keywordHit: false, matchedKeyword: '',
        prefillMs: 0, totalMs: 0, tokensGenerated: 0, tokensPerSec: 0,
        responsePreview: '', error: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
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
          const chunk = JSON.parse(line.slice(6));
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            content += delta.content;
            tokensGenerated++;
          }
          if (chunk.usage?.completion_tokens) {
            tokensGenerated = chunk.usage.completion_tokens;
          }
        } catch { /* skip */ }
      }
    }

    const totalMs = performance.now() - startTime;
    const prefillMs = firstTokenTime ? firstTokenTime - startTime : totalMs;
    const tokensPerSec = tokensGenerated > 0 ? (tokensGenerated / (totalMs / 1000)) : 0;

    const responseLower = content.toLowerCase();
    const matchedKeyword = scenario.expectedKeywords.find(k => responseLower.includes(k.toLowerCase())) ?? '';
    const keywordHit = matchedKeyword.length > 0;

    return {
      scenario: scenario.name,
      category: scenario.category,
      success: content.length > 0 && keywordHit,
      keywordHit,
      matchedKeyword,
      prefillMs: Math.round(prefillMs),
      totalMs: Math.round(totalMs),
      tokensGenerated,
      tokensPerSec: Math.round(tokensPerSec * 10) / 10,
      responsePreview: content.replace(/\n/g, ' ').slice(0, 120),
    };
  } catch (e) {
    const totalMs = performance.now() - startTime;
    return {
      scenario: scenario.name, category: scenario.category,
      success: false, keywordHit: false, matchedKeyword: '',
      prefillMs: 0, totalMs: Math.round(totalMs),
      tokensGenerated: 0, tokensPerSec: 0,
      responsePreview: '', error: (e as Error).message.slice(0, 80),
    };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function main() {
  console.log('🔍 oMLX Vision Benchmark — Qwen3.5-4B-MLX-4bit\n');

  // Verify model
  const modelsRes = await fetch(`${LLM_URL}/v1/models`);
  const modelsData = await modelsRes.json() as { data: Array<{ id: string }> };
  const available = modelsData.data.map(m => m.id);
  if (!available.includes(PROFILE.model)) {
    console.error(`❌ Model ${PROFILE.model} not available. Available: ${available.join(', ')}`);
    process.exit(1);
  }
  console.log(`📦 模型：${PROFILE.model}`);
  console.log(`⚙️  參數：temp=${PROFILE.temperature} top_p=${PROFILE.top_p} pp=${PROFILE.presence_penalty}\n`);

  // Warmup
  console.log('🔥 暖機（text）...');
  await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: PROFILE.model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 4, temperature: 0.1, stream: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  console.log('   ready\n');

  // Run scenarios
  const results: VisionResult[] = [];
  const total = SCENARIOS.length;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    process.stdout.write(`[${i + 1}/${total}] ${pad(scenario.name, 12)} (${scenario.category}) ... `);

    const result = await runVisionBenchmark(scenario);
    results.push(result);

    const status = result.success ? '✅' : result.keywordHit ? '⚠️' : '❌';
    console.log(
      `${status} ${formatMs(result.prefillMs)} → ${formatMs(result.totalMs)} | ${result.tokensGenerated} tok | ${result.tokensPerSec} tok/s`
    );
    if (result.responsePreview) {
      console.log(`     → ${result.responsePreview}`);
    }
    if (result.error) {
      console.log(`     ❌ ${result.error}`);
    }

    // Small delay between tests
    await new Promise(r => setTimeout(r, 300));
  }

  // ─── Summary ─────────────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(90)}`);
  console.log('📊 Vision Benchmark 結果');
  console.log('═'.repeat(90));
  console.log(`\n${pad('場景', 14)} ${pad('類別', 8)} ${pad('結果', 6)} ${pad('Prefill', 10)} ${pad('Total', 10)} ${pad('tok/s', 8)} ${pad('關鍵詞', 12)} 回應`);
  console.log('─'.repeat(90));

  for (const r of results) {
    const status = r.success ? '✅' : r.error ? '❌' : '⚠️';
    console.log(
      `${pad(r.scenario, 14)} ${pad(r.category, 8)} ${pad(status, 6)} ${pad(formatMs(r.prefillMs), 10)} ${pad(formatMs(r.totalMs), 10)} ${pad(String(r.tokensPerSec), 8)} ${pad(r.matchedKeyword || '—', 12)} ${r.responsePreview.slice(0, 40)}`
    );
  }

  const successCount = results.filter(r => r.success).length;
  const avgTokPerSec = results.filter(r => r.tokensPerSec > 0).reduce((s, r) => s + r.tokensPerSec, 0) / Math.max(1, results.filter(r => r.tokensPerSec > 0).length);
  const avgPrefill = results.filter(r => r.prefillMs > 0).reduce((s, r) => s + r.prefillMs, 0) / Math.max(1, results.filter(r => r.prefillMs > 0).length);

  console.log(`\n📈 總結：`);
  console.log(`   成功率：${successCount}/${results.length}`);
  console.log(`   平均速度：${Math.round(avgTokPerSec * 10) / 10} tok/s`);
  console.log(`   平均 Prefill：${formatMs(Math.round(avgPrefill))}`);

  // Save results
  const outputDir = path.join(process.cwd(), 'tests');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `vision-benchmark-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({
    date: new Date().toISOString(),
    model: PROFILE.model,
    profile: PROFILE,
    results,
  }, null, 2));
  console.log(`\n💾 結果已存：${outputPath}`);
  console.log('\n✅ Vision Benchmark 完成\n');
}

main().catch(e => {
  console.error('❌ Vision Benchmark 失敗:', e);
  process.exit(1);
});
