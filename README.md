# Local LLM Benchmark

Apple Silicon 上本地 LLM 推理效能與品質的系統化基準測試。

使用 [oMLX](https://github.com/jundot/omlx) 推理伺服器，透過 OpenAI-compatible API 測試不同大小的量化模型在各種使用場景下的表現。

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

## 測試模型

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

### 結論

- **0.8B 適合**：路由分類、簡單問答、速度優先的場景
- **9B 適合**：程式碼、推理、翻譯、創意等需要品質的場景
- **9B-reasoning**：推理場景比 general 快 47%，比 thinking 穩定
- **最佳策略**：fast profile 用 0.8B 做路由（~100ms），其他 profile 用 9B 拿品質

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

## License

MIT
