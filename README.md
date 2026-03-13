# Local LLM Benchmark

Apple Silicon 上本地 LLM 推理效能與品質的系統化基準測試。

使用 [oMLX](https://github.com/jundot/omlx) 推理伺服器，透過 OpenAI-compatible API 測試不同大小的量化模型在各種使用場景下的表現。

## 背景：為什麼需要本地 LLM

### 問題

[mini-agent](https://github.com/miles990/mini-agent) 是個人 AI agent [Kuro](https://kuro.page/) 的運行框架，24/7 常駐運行（但因持續觸碰 Claude Code 的 Weekly limits，已有一段長時間無法進行自我學習等高 token 消耗的任務 — 這也是尋找本地 LLM 分流方案的直接動機）。未來將抽取為通用框架 [Asurada](https://github.com/miles990/asurada)（阿斯拉達）— 一個 perception-driven 的個人 AI 夥伴框架，讓任何人都能跑自己的 agent。命名來源：《閃電霹靂車》的 AI 導航系統 — 自主判斷、感知環境、輔助駕駛。

核心推理使用 Claude Code CLI。隨著 agent 的感知系統、多 lane 並行、背景觸手（delegation）等功能逐步上線，**API token 用量急速成長**：

- 已使用 **2.5 個 Max Plan** 的額度，且用量持續增加
- 每個 OODA cycle 的 context 注入（perception + memory + skills）消耗大量 input tokens
- 6 條並行背景觸手 + foreground lane + main loop = 最多 9 條同時推理
- 不是所有任務都需要 Claude 等級的智力 — 路由分類、簡單問答用 Claude 是浪費

### 契機

兩個先前的實驗證明了「分層推理」的可行性：

1. **mushi — System 1 直覺層**：用輕量模型（Taalas HC1，~800ms）做快速 triage（wake/skip 判斷），讓不必要的 cycle 不發生。上線後**每天省 ~1M tokens**，980+ 次 triage 零 false negative 後畢業。證明「不是所有判斷都需要大模型」
2. **autoRouteProfile 架構**：已在 mini-agent 中實作兩階段路由 — 先用小模型分類，再路由到對應 profile。架構就緒，缺的是本地推理能力

然後看到了 [oMLX](https://github.com/jundot/omlx) — Apple Silicon 原生的 MLX 推理伺服器，支援 OpenAI-compatible API、多模型 pinning、streaming。剛好補上最後一塊拼圖。

### 目標

用本地 LLM 承擔不需要 Claude 智力的任務，**降低 API 成本的同時增加並發能力**。這也是 Asurada 通用架構的核心設計 — agent 不應該綁死在單一 LLM provider 上：

```
Asurada 三層推理架構：

  System 0: mushi（直覺層）    → 本地輕量模型，~800ms triage，判斷要不要醒來
  System 1: 本地 LLM（快思考）  → 0.8B 路由 + 9B 執行，免費、無限、低延遲
  System 2: Claude API（慢思考）→ 只用在真正需要高智力的地方

之前：所有任務 → Claude API（貴、有 rate limit、單點依賴）
之後：路由分類、簡單判斷 → 本地 0.8B（免費、無限、~100ms）
      一般任務          → 本地 9B（免費、無限、~18 tok/s）
      需要高智力的任務   → Claude API（只用在真正需要的地方）
```

本 benchmark 就是為了驗證 System 1 層的可行性 — 本地模型的速度和品質是否足以承擔分流任務。

## 測試環境

| 項目 | 規格 |
|------|------|
| 機器 | MacBook Pro (Mac14,10) |
| 晶片 | Apple M2 Pro |
| CPU 核心 | 12 核（8P + 4E） |
| 記憶體 | 16 GB 統一記憶體 |
| 系統 | macOS 26.2 (Build 25C56) |
| 推理伺服器 | oMLX 0.2.8 |
| API 協議 | OpenAI-compatible `/v1/chat/completions` |

## 使用場景

本 benchmark 服務於 [mini-agent](https://github.com/anthropics/mini-agent) — 一個跑在本機的個人 AI agent 框架。Agent 需要 **24/7 常駐運行**，核心需求：

| 需求 | 說明 |
|------|------|
| **低延遲路由** | Agent 每個 cycle 先判斷「這件事需要多少智力」，再決定用哪個模型。路由本身要 <200ms |
| **品質任務** | 程式碼生成、推理、翻譯等需要準確度的場景，不能犧牲品質 |
| **零雲端依賴** | 本機推理，不依賴外部 API。離線可用、無 token 費用、無隱私疑慮 |
| **並行常駐** | 多個模型同時 pin 在記憶體，切換零延遲。Agent daemon 不能因模型載入而卡住 |

**架構設想**：兩階段路由（autoRouteProfile）

```
用戶請求 → 0.8B 快速分類（~100ms）→ 路由到對應 profile → 9B 執行實際任務
```

## 測試模型

### 為什麼選 Qwen3.5

| 考量 | 說明 |
|------|------|
| **MLX 原生支援** | Qwen3.5 有官方 MLX 量化版本，Apple Silicon 推理效率最佳 |
| **DeltaNet 架構** | Gated DeltaNet（3:1 線性/注意力比）在長 context 下比純 Transformer 更省記憶體 |
| **262K context** | 支援超長 context（可擴展至 1M+ with YaRN），適合 agent 的感知 context 注入 |
| **模型家族完整** | 0.8B → 9B → 27B → 235B，同架構不同規模，未來升級路徑清晰 |
| **Thinking mode** | 原生支援 `<think>` 標籤的思考模式，可按需切換 |

### 為什麼選 0.8B + 9B 這個組合

**硬體限制**：MacBook Pro M2 Pro，**16GB 統一記憶體**。

| 限制 | 影響 |
|------|------|
| 16GB 總 RAM | OS + 應用 ~4GB，剩餘 ~12GB 可用於模型 |
| 需要同時 pin 兩個模型 | 切換延遲從 24s → 0.14s（[見 model pinning 研究](notes/model-swap-overhead.md)） |
| Agent daemon 常駐 | 不能讓模型佔滿所有記憶體 |

**記憶體預算**：

```
0.8B-4bit:  622 MB
9B-4bit:   5.6 GB
─────────────────
合計:      ~6.1 GB（16GB 的 38%，完全足夠）
```

**為什麼不選更大的模型**：

| 組合 | 記憶體 | 可行性 |
|------|--------|--------|
| 0.8B + 9B（當前） | ~6.1 GB | ✅ 充裕 |
| 0.8B + 27B-4bit | ~14 GB | ⚠️ 勉強可用，無餘量 |
| 9B + 27B-4bit | ~19 GB | ❌ 超出 16GB |
| 9B FP16 | ~18 GB | ❌ 單模型就超出 |

0.8B + 9B 是 16GB RAM 下**唯一能雙模型 pin 且留有餘量的組合**。

### 模型規格

| 模型 | 量化 | 磁碟大小 | Pin 狀態 |
|------|------|---------|---------|
| Qwen3.5-0.8B-MLX-4bit | 4-bit MLX | 622 MB | Pinned（常駐記憶體） |
| Qwen3.5-9B-MLX-4bit | 4-bit MLX | 5.6 GB | Pinned（常駐記憶體） |

## 測試項目

| 類別 | 場景 | 測試目的 |
|------|------|---------|
| 日常 | 簡單問答、分類/路由、翻譯 | 基礎能力、延遲 |
| 中等 | 摘要、程式碼生成、創意寫作 | 理解力、生成品質 |
| 推理 | 邏輯推理、數學推理 | 深度思考能力 |
| 長文 | 長 prompt 理解 | Context 處理能力 |
| 工具 | Tool Calling | 函數呼叫能力 |

## 快速結果

### 速度（三次測試平均）

| 模型 | 平均 tok/s | 平均 Prefill | 說明 |
|------|-----------|-------------|------|
| 0.8B-MLX-4bit | **~108 tok/s** | ~360ms | 跨測試穩定 |
| 9B-MLX-4bit | ~18 tok/s | ~750ms | 跨三次測試 ±5% |

0.8B 平均速度是 9B 的 **6 倍**。

### 品質

| 能力 | 0.8B | 9B | 勝出 |
|------|------|------|------|
| 簡單問答 | ✅ | ✅ | 平手 |
| 分類/路由 | ✅ | ✅ | 平手 |
| 翻譯 | ⚠️ 不精確 | ✅ 自然 | 9B |
| 摘要 | ✅ | ✅ | 平手 |
| 程式碼 | ❌ 有 bug | ✅ 正確 | 9B |
| 創意寫作 | ❌ 格式錯 | ✅ | 9B |
| 邏輯推理 | ❌ 混亂 | ⚠️ 方向對 | 9B |
| 數學推理 | ⚠️ 機械式 | ✅ 有洞察 | 9B |
| 閱讀理解 | ✅ 有引據 | ✅ 簡潔 | 0.8B |

### 推理 Profile 對比（Run 3 新增）

| Profile | 邏輯推理 | 數學推理 | 推薦 |
|---------|---------|---------|------|
| 9B (general) | 36.5s / 1,000 tok | 16.9s / 558 tok | 一般任務 |
| **9B-reasoning** | **19.3s / 629 tok** | **16.3s / 553 tok** | **推理場景最佳** |
| 9B-thinking | timeout (600s) | 53s / 1,797 tok | ⚠️ 不穩定 |

## 最終推薦：各場景勝出模型與參數

三次測試綜合結論。所有模型為 **4-bit MLX 量化版本**。

### 場景 → Profile 對應

| 場景 | 推薦 Profile | 模型 | 理由 |
|------|-------------|------|------|
| 簡單問答 | [**fast**](#fast) | 0.8B | 81ms，品質與 9B 相同 |
| 分類/路由 | [**fast**](#fast) | 0.8B | 109ms，保守參數下分類穩定 |
| 摘要 | [**fast**](#fast) | 0.8B | 469ms，品質與 9B 相同，速度快 6x |
| 閱讀理解 | [**fast**](#fast) | 0.8B | 1.2s，引據比 9B 更完整 |
| 翻譯 | [**default**](#default) | 9B | 0.8B 翻譯不精確 |
| 程式碼生成 | [**default**](#default) | 9B | 0.8B 有 bug / 幻覺 import |
| 創意寫作 | [**creative**](#creative) | 9B | 0.8B 不遵守格式 |
| Tool Calling | [**default**](#default) | 9B | 僅 9B 支援 |
| 邏輯推理 | [**reasoning**](#reasoning) ⭐ | 9B | 19.3s，比 general 快 47% |
| 數學推理 | [**reasoning**](#reasoning) ⭐ | 9B | 16.3s，最快且正確 |

### 三個核心 Profile

```
fast (0.8B)      → 路由、分類、簡單問答、摘要、閱讀理解
default (9B)     → 翻譯、程式碼、創意寫作、Tool Calling
reasoning (9B)   → 邏輯推理、數學推理
```

### Profile 完整參數

#### fast

| 參數 | 值 |
|------|-----|
| 模型 | Qwen3.5-0.8B-MLX-4bit |
| temperature | 0.7 |
| top_p | 0.8 |
| top_k | 20 |
| presence_penalty | 1.5 |
| enable_thinking | false |
| max_tokens | 32,768 |
| timeout | 30s |

> ⚠️ 官方推薦 temp=1.0, pp=2.0，但在 4-bit 量化下導致 thinking loop（[見發現 6](reports/findings.md#發現-6官方推薦參數不適合-08b-小模型run-3)）

#### default

| 參數 | 值 |
|------|-----|
| 模型 | Qwen3.5-9B-MLX-4bit |
| temperature | 0.7 |
| top_p | 0.8 |
| top_k | 20 |
| presence_penalty | 1.5 |
| enable_thinking | false |
| max_tokens | 32,768 |
| timeout | 600s |

> ✅ 完全符合 Qwen 官方 Non-Thinking General Tasks 建議

#### reasoning

| 參數 | 值 |
|------|-----|
| 模型 | Qwen3.5-9B-MLX-4bit |
| temperature | 1.0 |
| top_p | 1.0 |
| top_k | 40 |
| presence_penalty | 2.0 |
| enable_thinking | false |
| max_tokens | 81,920 |
| timeout | 600s |

> ✅ 完全符合 Qwen 官方 Non-Thinking Hard Reasoning 建議。邏輯推理比 general 快 47%，答案更簡潔

#### creative

| 參數 | 值 |
|------|-----|
| 模型 | Qwen3.5-9B-MLX-4bit |
| temperature | 0.7 |
| top_p | 0.8 |
| top_k | 20 |
| presence_penalty | 1.5 |
| enable_thinking | false |
| max_tokens | 32,768 |
| timeout | 600s |

> 對齊 Non-Thinking General Tasks 參數，Run 3 驗證穩定

#### thinking（不推薦常規使用）

| 參數 | 值 |
|------|-----|
| 模型 | Qwen3.5-9B-MLX-4bit |
| temperature | 1.0 |
| top_p | 0.95 |
| top_k | 20 |
| presence_penalty | 1.5 |
| enable_thinking | true |
| max_tokens | 81,920 |
| timeout | 600s |

> ⚠️ `<think>` 標籤生成率 ~50%，失敗時進入 thinking loop。推薦改用 [reasoning](#reasoning)

#### thinking-code（不推薦常規使用）

| 參數 | 值 |
|------|-----|
| 模型 | Qwen3.5-9B-MLX-4bit |
| temperature | 0.6 |
| top_p | 0.95 |
| top_k | 20 |
| presence_penalty | 0.0 |
| enable_thinking | true |
| max_tokens | 81,920 |
| timeout | 600s |

> ✅ 符合 Qwen 官方 Thinking Precise Coding 建議，但 `<think>` 標籤穩定性待驗證

### Thinking Mode 結論：不推薦常規使用

| 問題 | 說明 |
|------|------|
| **`<think>` 標籤不穩定** | 9B thinking mode 約 50% 機率不生成 `<think>` 標籤 |
| **Thinking loop** | 不生成 `<think>` 時，思考以純文字洩漏到 content，消耗所有 max_tokens 或觸發 timeout |
| **實測表現** | 邏輯推理 → timeout (600s)；數學推理 → 53s（正常時可用，但不穩定） |
| **根因假設** | 4-bit 量化壓平 softmax 機率分佈，低頻特殊 token（`<think>`）生成閾值偏移 |
| **替代方案** | 推理場景用 **reasoning** profile（non-thinking + 官方推理參數），速度更快且 100% 穩定 |

> **thinking** 和 **thinking-code** profile 保留但不推薦。需要推理能力時，**reasoning** profile 是更好的選擇 — 比 thinking 快 47%，且不依賴 `<think>` 標籤解析。

## 檔案結構

```
├── README.md                              # 本檔案
├── reports/
│   ├── 2026-03-13-benchmark.md            # Run 1/2 完整測試報告
│   ├── 2026-03-13-run3-official-params.md # Run 3 官方參數測試報告
│   └── findings.md                        # 關鍵發現與建議（1-8）
├── results/
│   ├── run-1-speed.json                   # 第一次速度測試原始數據
│   ├── run-2-speed.json                   # 第二次速度測試原始數據
│   ├── run-3-official-params.json         # 第三次官方參數測試原始數據
│   └── quality-responses.md               # 完整回答品質對比
├── config/
│   ├── test-scenarios.json                # 測試場景定義
│   └── model-profiles.json                # 模型 profile 參數（含 reasoning）
├── scripts/
│   └── omlx-benchmark.ts                  # 測試腳本（TypeScript）
├── models/
│   └── README.md                          # 模型規格說明
└── notes/
    └── model-swap-overhead.md             # 模型切換開銷研究
```

## 執行測試

```bash
# 需要 oMLX 在 localhost:8000 運行
npx tsx scripts/omlx-benchmark.ts
```

## 開放假設：4-bit 量化可能是官方參數失效的根因

上述問題（0.8B thinking loop、`<think>` 標籤不穩定、官方高溫參數失控）可能不是參數本身的問題，而是 **4-bit MLX 量化**改變了模型行為特性。

### 機制

| 效應 | 說明 | 對應現象 |
|------|------|---------|
| **機率分佈更模糊** | 權重精度下降 → softmax 峰值被壓平 | temp=1.0 在全精度可能還有清晰 top tokens，量化後散開 |
| **小模型影響更大** | 0.8B 參數少，每個權重精度損失佔比更高 | 0.8B temp=1.0 崩潰，9B temp=1.0 正常 |
| **特殊 token 偏移** | `<think>` 等低頻 token 量化後機率偏移大 | `<think>` 生成率 ~50% |
| **pp 放大效應** | 量化後重複傾向已不同，pp=2.0 過度懲罰 | 模型被推離正常 token → thinking loop |

### 待驗證

| 測試 | 目標 | 可行性 |
|------|------|--------|
| 0.8B **FP16** + 官方 temp=1.0, pp=2.0 | 全精度下是否仍 thinking loop | ✅（1.6GB） |
| 0.8B **8-bit** + 官方參數 | 中間量化精度表現 | ✅（~1.2GB） |
| 9B FP16 + thinking mode | `<think>` 生成率是否提高 | ❌（~18GB，超出 16GB RAM） |

若 FP16 版本在官方參數下表現正常，即可確認「**保守參數是量化的代價，不是模型的限制**」。

## License

MIT
