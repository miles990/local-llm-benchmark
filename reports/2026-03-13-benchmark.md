# oMLX Benchmark Report — 2026-03-13

## 測試環境

| 項目 | 規格 |
|------|------|
| 機器 | MacBook Pro (Mac14,10, MNWC3TA/A) |
| 晶片 | Apple M2 Pro（12 核：8P + 4E） |
| 記憶體 | 16 GB 統一記憶體 |
| 系統 | macOS 26.2 (Build 25C56) |
| 推理伺服器 | oMLX 0.2.8（Homebrew launchd 服務） |
| API | OpenAI-compatible `/v1/chat/completions`（streaming） |
| 模型存放 | `~/.omlx/models/` |
| 快取 | oMLX SSD KV cache 啟用，hot cache 4GB |

## 測試模型

| 模型 | 參數量 | 量化 | 大小 | Pin | 架構 |
|------|-------|------|------|-----|------|
| Qwen3.5-0.8B-MLX-4bit | 0.8B | 4-bit MLX | 622 MB | ✅ | Gated DeltaNet (3:1) |
| Qwen3.5-9B-MLX-4bit | 9B | 4-bit MLX | 5.6 GB | ✅ | Gated DeltaNet (3:1) |

兩個模型均透過 `model_settings.json` 設定 `is_pinned: true`，確保常駐記憶體、切換零延遲。

## 測試方法

### 工具
- 自動化腳本：`scripts/omlx-benchmark.ts`（TypeScript，npx tsx 執行）
- 透過 OpenAI-compatible streaming API 測試
- 每個場景間 500ms 冷卻，避免 oMLX 佇列壓力

### 共用參數
```json
{
  "stream": true,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

### 測試場景（10 個，5 類別）

| # | 場景 | 類別 | max_tokens | temperature | 測試目的 |
|---|------|------|-----------|-------------|---------|
| 1 | 簡單問答 | 日常 | 16 | 0.1 | 最小延遲 |
| 2 | 分類/路由 | 日常 | 8 | 0.1 | autoRouteProfile 場景 |
| 3 | 翻譯 | 日常 | 64 | 0.3 | 語言精確度 |
| 4 | 摘要 | 中等 | 128 | 0.5 | 文本理解 |
| 5 | 程式碼生成 | 中等 | 512 | 0.3 | 程式碼正確性 |
| 6 | 創意寫作 | 中等 | 64 | 0.9 | 格式遵守 |
| 7 | 邏輯推理 | 推理 | 512 | 0.3 | 多步驟推理 |
| 8 | 數學推理 | 推理 | 256 | 0.1 | 計算與洞察 |
| 9 | 長 prompt 理解 | 長文 | 256 | 0.3 | Context 處理 |
| 10 | Tool Calling | 工具 | 256 | 0.1 | 函數呼叫 |

### 測量指標
- **Prefill (ms)**: Time to first token — prompt 處理延遲
- **Total (ms)**: 請求開始到完成的總時間
- **tok/s**: tokens per second — 生成吞吐量
- **Response Length**: 回應字元數

---

## 速度測試結果

### Run 1

| 場景 | 0.8B prefill | 0.8B total | 0.8B tok/s | 9B prefill | 9B total | 9B tok/s | 0.8B 快幾倍 |
|------|-------------|-----------|-----------|-----------|---------|---------|------------|
| 簡單問答 | 2.4s⚠️ | 2.4s | 0.4 | 291ms | 343ms | 2.9 | 9B 更快 |
| 分類/路由 | 87ms | 100ms | 20 | 448ms | 492ms | 2 | **4.9x** |
| 翻譯 | 91ms | 152ms | 72.5 | 296ms | 673ms | 17.8 | **4.4x** |
| 摘要 | 586ms | 912ms | 71.3 | 754ms | 2.9s | 19.6 | **3.2x** |
| 程式碼生成 | 74ms | 1.0s | 191 | 451ms | 10.5s | 30.3 | **10.5x** |
| 創意寫作 | 182ms | 320ms | 87.4 | 365ms | 952ms | 20 | **3.0x** |
| 邏輯推理 | 107ms | 2.6s | 196.6 | 598ms | 16.1s | 31.8 | **6.2x** |
| 數學推理 | 102ms | 1.3s | 191.4 | 461ms | 8.2s | 31.2 | **6.3x** |
| 長 prompt | 210ms | 1.2s | 168.2 | 1.6s | 3.2s | 17 | **2.7x** |
| Tool Calling | 349ms | 349ms | 2.9 | 2.4s | 2.4s | 0.4 | **6.9x** |

**Run 1 平均**: 0.8B = 100.2 tok/s, 9B = 17.3 tok/s

### Run 2

| 場景 | 0.8B prefill | 0.8B total | 0.8B tok/s | 9B prefill | 9B total | 9B tok/s | 0.8B 快幾倍 |
|------|-------------|-----------|-----------|-----------|---------|---------|------------|
| 簡單問答 | 2.4s⚠️ | 2.4s | 0.4 | 300ms | 344ms | 2.9 | 9B 更快 |
| 分類/路由 | 91ms | 107ms | 18.7 | 445ms | 488ms | 2 | **4.6x** |
| 翻譯 | 80ms | 134ms | 74.9 | 293ms | 629ms | 17.5 | **4.7x** |
| 摘要 | 125ms | 352ms | 127.8 | 748ms | 2.4s | 22.9 | **6.8x** |
| 程式碼生成 | 97ms | 897ms | 182.9 | 440ms | 9.4s | 31.7 | **10.5x** |
| 創意寫作 | 71ms | 219ms | 132.4 | 294ms | 967ms | 22.7 | **4.4x** |
| 邏輯推理 | 114ms | 2.5s | 194.6 | 604ms | 15.9s | 32.1 | **6.4x** |
| 數學推理 | 96ms | 1.3s | 191.4 | 455ms | 8.1s | 31.6 | **6.2x** |
| 長 prompt | 209ms | 1.0s | 159.4 | 1.6s | 3.2s | 17 | **3.2x** |
| Tool Calling | 328ms | 328ms | 3 | 2.4s | 2.4s | 0.4 | **7.3x** |

**Run 2 平均**: 0.8B = 108.6 tok/s, 9B = 18.1 tok/s

### 兩次一致性對比

| 指標 | Run 1 | Run 2 | 差異 |
|------|-------|-------|------|
| 0.8B avg tok/s | 100.2 | 108.6 | +8% |
| 0.8B avg prefill | 419ms | 360ms | -14% |
| 9B avg tok/s | 17.3 | 18.1 | +5% |
| 9B avg prefill | 762ms | 749ms | -2% |

波動在 ±15% 以內，結果高度一致。Run 2 略快，可能是 oMLX SSD KV cache 命中。

### Run 3（官方推薦參數）

Run 3 使用 Qwen HuggingFace 官方推薦參數，新增 9B-reasoning 和 9B-thinking profile。
詳細報告見 `reports/2026-03-13-run3-official-params.md`。

| 場景 | Profile | Prefill | Total | Tokens | tok/s | Finish |
|------|---------|---------|-------|--------|-------|--------|
| 簡單問答 | 0.8B | 72ms | 81ms | 1 | 12.4 | stop |
| 簡單問答 | 9B | 303ms | 345ms | 1 | 2.9 | stop |
| 分類/路由 | 0.8B | 93ms | 109ms | 2 | 18.4 | stop |
| 分類/路由 | 9B | 435ms | 478ms | 1 | 2.1 | stop |
| 翻譯 | 0.8B | 81ms | 150ms | 13 | 86.8 | stop |
| 翻譯 | 9B | 300ms | 670ms | 12 | 17.9 | stop |
| 摘要 | 0.8B | 147ms | 469ms | 66 | 140.9 | stop |
| 摘要 | 9B | 754ms | 2.5s | 60 | 23.5 | stop |
| 程式碼生成 | 0.8B | 88ms | 1.8s | 369 | 205.5 | stop |
| 程式碼生成 | 9B | 443ms | 3.3s | 99 | 30.0 | stop |
| 創意寫作 | 0.8B | 73ms | **163.7s** ⚠️ | 24,854 | 151.8 | stop |
| 創意寫作 | 9B | 776ms | 1.4s | 20 | 14.5 | stop |
| 邏輯推理 | 0.8B | 117ms | **230.5s** ⚠️ | 32,767 | 142.2 | **length** |
| 邏輯推理 | 9B | 5.6s | 36.5s | 1,000 | 27.4 | stop |
| 邏輯推理 | 9B-reasoning | 774ms | **19.3s** | 629 | 32.5 | stop |
| 邏輯推理 | 9B-thinking | — | **600s** ⚠️ | 0 | — | **timeout** |
| 數學推理 | 0.8B | 6.1s | 11.5s | 1,074 | 93.8 | stop |
| 數學推理 | 9B | 462ms | 16.9s | 558 | 33.1 | stop |
| 數學推理 | 9B-reasoning | 456ms | **16.3s** | 553 | 33.9 | stop |
| 數學推理 | 9B-thinking | 459ms | 53.0s | 1,797 | 33.9 | stop 💭 |
| 閱讀理解 | 0.8B | 310ms | 1.2s | 194 | 160.0 | stop |
| 閱讀理解 | 9B | 1.3s | 3.0s | 60 | 20.0 | stop |
| Tool Calling | 9B | 2.3s | 2.3s | 1 | 0.4 | tool_calls |

**Run 3 關鍵發現**：
- 0.8B 使用官方高溫參數（temp=1.0, pp=2.0）導致 **thinking loop**（創意寫作 164s、邏輯推理 231s）
- **9B-reasoning** 在推理場景比 general 快 47%，比 thinking 穩定
- 9B-thinking 的 `<think>` 標籤生成不穩定，邏輯推理場景 timeout

### 三次測試一致性

| 指標 | Run 1 | Run 2 | Run 3 | 說明 |
|------|-------|-------|-------|------|
| 9B avg tok/s | 17.3 | 18.1 | 17.2 | ±5%，高度穩定 |
| 9B avg prefill | 762ms | 749ms | 1.3s* | *含長 prompt 5.6s |
| 0.8B avg tok/s | 100.2 | 108.6 | 112.4* | *被 thinking loop 拉高 |

### 異常值：簡單問答 0.8B 2.4s

兩次測試中，0.8B 的第一個場景（簡單問答）都穩定在 2.4s，遠高於後續場景（~100ms）。推測為測試腳本首次請求觸發了某種初始化開銷（可能是 oMLX 的 batch scheduler 預熱）。

---

## 品質測試結果

詳細回答見 `results/quality-responses.md`。

### 品質評分表

| 場景 | 0.8B | 9B | 勝出 | 說明 |
|------|------|------|------|------|
| 簡單問答 | ✅ | ✅ | 平手 | 都正確 |
| 分類/路由 | ✅ | ✅ | 平手 | 都正確 |
| 翻譯 | ⚠️ | ✅ | **9B** | 0.8B「快跑」不精確，9B「敏捷」自然 |
| 摘要 | ✅ | ✅ | 平手 | 都完整準確 |
| 程式碼 | ❌ | ✅ | **9B** | 0.8B 有邊界 bug（off-by-one） |
| 創意 | ❌ | ✅ | **9B** | 0.8B 不遵守 haiku 5-7-5 格式 |
| 邏輯推理 | ❌ | ⚠️ | **9B** | 0.8B 混亂重複；9B 方向正確但被截斷 |
| 數學推理 | ⚠️ | ✅ | **9B** | 9B 指出「不能直接平均」的洞察 |
| 閱讀理解 | ✅ | ✅ | **0.8B** | 0.8B 有引據，答案更完整 |

**總計**: 9B 勝 5 場，0.8B 勝 1 場，平手 3 場。

---

## 結論與建議

### 速度結論
- 0.8B 平均 **~108 tok/s**，9B 平均 **~18 tok/s**，速度比約 **6:1**
- 0.8B prefill 平均 ~360ms，9B 平均 ~749ms
- **Model pinning 是必要的** — 未 pin 時模型切換要 24-200 秒

### 品質結論
- **簡單任務（分類、問答、摘要）**：0.8B 品質足夠
- **需要精確度的任務（程式碼、推理、翻譯、創意）**：必須用 9B
- 0.8B 的推理能力不可靠（會產生重複和邏輯錯誤）

### 最佳 Profile 配置（Run 3 更新）

| Profile | 模型 | 場景 | 參數特點 | 理由 |
|---------|------|------|---------|------|
| **fast** | 0.8B | 路由分類、簡單問答 | temp=0.7, pp=1.5 | ~100ms 回應（官方高溫參數不穩定） |
| **default** | 9B | 一般任務 | temp=0.7, pp=1.5 | 品質與速度平衡 |
| **reasoning** ⭐ | 9B | 深度推理、數學 | temp=1.0, top_k=40, pp=2.0 | 比 thinking 快 47% 且更穩定 |
| **thinking** | 9B | 僅在需要時 | temp=1.0, pp=1.5 | ⚠️ `<think>` 不穩定，有 loop 風險 |
| **thinking-code** | 9B | 精確 coding | temp=0.6, pp=0.0 | 程式碼需要 9B 的正確性 |
| **creative** | 9B | 創意寫作 | temp=0.7, pp=1.5 | 對齊 non-thinking general |

### oMLX 配置建議

```json
// ~/.omlx/model_settings.json
{
  "models": {
    "Qwen3.5-9B-MLX-4bit": { "is_pinned": true },
    "Qwen3.5-0.8B-MLX-4bit": { "is_pinned": true }
  }
}
```

兩模型同時 pin 僅佔 ~6.1 GB（16GB RAM 完全足夠），消除切換延遲。
