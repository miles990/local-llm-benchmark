# oMLX Benchmark Report — Run 3: 官方推薦參數測試

**日期**：2026-03-13
**目的**：使用 Qwen HuggingFace 官方推薦參數重新測試，並與 Run 1/2（自訂參數）對比

## 參數來源

- **0.8B**: https://huggingface.co/Qwen/Qwen3.5-0.8B
- **9B**: https://huggingface.co/Qwen/Qwen3.5-9B

## 測試 Profiles（4 種配置）

| Profile | 模型 | temp | top_p | top_k | pp | thinking | max_tokens | 來源 |
|---------|------|------|-------|-------|-----|----------|-----------|------|
| 0.8B | 0.8B-MLX-4bit | **1.0** | **1.0** | 20 | **2.0** | false | 32,768 | 官方 non-thinking text |
| 9B | 9B-MLX-4bit | 0.7 | 0.8 | 20 | 1.5 | false | 32,768 | 官方 non-thinking general |
| 9B-reasoning | 9B-MLX-4bit | **1.0** | **1.0** | **40** | **2.0** | false | 81,920 | 官方 non-thinking reasoning |
| 9B-thinking | 9B-MLX-4bit | 1.0 | 0.95 | 20 | 1.5 | **true** | 81,920 | 官方 thinking general |

### 與 Run 1/2 的參數差異

| 設定 | Run 1/2 | Run 3 (官方) | 差異 |
|------|---------|-------------|------|
| **0.8B temp** | 0.1~0.9 (per-scenario) | **1.0** (固定) | 大幅提高 |
| **0.8B top_p** | 未設定 | **1.0** | 新增 |
| **0.8B pp** | 未設定 | **2.0** | 新增 |
| **0.8B max_tokens** | 8~512 (per-scenario) | **32,768** | 大幅提高 |
| **9B max_tokens** | 8~512 (per-scenario) | **32,768** | 大幅提高 |
| **暖機** | 無 | ✅ 每模型先發一個請求 | 新增 |
| **9B-reasoning** | 不存在 | 新增 profile | 新增 |
| **9B-thinking** | 不存在 | 新增 profile | 新增 |

---

## 速度測試結果

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
| 邏輯推理 | 9B-reasoning | 774ms | 19.3s | 629 | 32.5 | stop |
| 邏輯推理 | 9B-thinking | — | **600s** ⚠️ | 0 | — | **timeout** |
| 數學推理 | 0.8B | 6.1s | 11.5s | 1,074 | 93.8 | stop |
| 數學推理 | 9B | 462ms | 16.9s | 558 | 33.1 | stop |
| 數學推理 | 9B-reasoning | 456ms | 16.3s | 553 | 33.9 | stop |
| 數學推理 | 9B-thinking | 459ms | 53.0s | 1,797 | 33.9 | stop 💭 |
| 閱讀理解 | 0.8B | 310ms | 1.2s | 194 | 160.0 | stop |
| 閱讀理解 | 9B | 1.3s | 3.0s | 60 | 20.0 | stop |
| Tool Calling | 9B | 2.3s | 2.3s | 1 | 0.4 | tool_calls |

---

## 品質對比

### 0.8B：官方參數 vs 之前自訂參數

| 場景 | Run 1/2（自訂參數）| Run 3（官方參數）| 變化 |
|------|-----------------|----------------|------|
| 簡單問答 | ✅ "4" | ✅ "4" | 相同 |
| 分類/路由 | ✅ "coding" | ❌ **"reasoning"** | 退化 |
| 翻譯 | ⚠️ 「快跑的棕狐狸跳過懶狗」 | ❌ **「跳得最快速的快狐，過去懶狗」** | 更差 |
| 摘要 | ✅ 完整準確 | ✅ 完整準確 | 相同 |
| 程式碼 | ❌ off-by-one bug | ❌ **幻覺 import** `{ number } from "number"` | 仍差 |
| 創意寫作 | ❌ 不遵守 haiku | ❌ **thinking loop** 24,854 tok / 164s | 嚴重退化 |
| 邏輯推理 | ❌ 混亂重複 | ❌ **thinking loop** 32,767 tok / 231s | 嚴重退化 |
| 數學推理 | ⚠️ 機械式 | ✅ 正確（67.5 km/h） | 改善 |
| 閱讀理解 | ✅ 完整有引據 | ✅ 完整有引據 | 相同 |

**結論**：0.8B 用官方高溫度參數（temp=1.0, pp=2.0）導致 thinking loop 和分類錯誤。HuggingFace 文件也警告 0.8B「more prone to entering thinking loops」。

### 9B：各 Profile 推理場景對比

| 場景 | 9B (general) | 9B-reasoning | 9B-thinking | 勝出 |
|------|-------------|-------------|-------------|------|
| 邏輯推理 | 36.5s / 1000tok | **19.3s / 629tok** | timeout | **9B-reasoning** |
| 數學推理 | 16.9s / 558tok | **16.3s / 553tok** | 53s / 1797tok (含💭) | **9B-reasoning** |

**9B-reasoning**（temp=1.0, top_p=1.0, top_k=40, pp=2.0）在推理場景速度更快、更簡潔。

### 9B-thinking 問題

| 場景 | 結果 | 原因 |
|------|------|------|
| 邏輯推理 | **timeout (600s)** | 模型未生成 `<think>` 標籤，thinking 以純文字無限輸出 |
| 數學推理 | ✅ 53s（含 3,535 chars 思考） | `<think>` 標籤正常，`reasoning_content` 正確分離 |

Thinking mode 的 `<think>` 標籤生成**不穩定**，邏輯推理場景會觸發 thinking loop。

---

## 三次測試速度對比（0.8B vs 9B non-thinking）

### 0.8B 平均速度

| 指標 | Run 1 | Run 2 | Run 3（官方） | 差異 |
|------|-------|-------|-------------|------|
| avg tok/s | 100.2 | 108.6 | 112.4* | +12% |
| avg prefill | 419ms | 360ms | 790ms* | +120% ⚠️ |

*Run 3 的 avg prefill 被邏輯推理（6.1s）拖高，排除後為 ~130ms。
*Run 3 的 avg tok/s 被 thinking loop（142-205 tok/s）拉高，不可比。

### 9B 平均速度

| 指標 | Run 1 | Run 2 | Run 3（官方） | 差異 |
|------|-------|-------|-------------|------|
| avg tok/s | 17.3 | 18.1 | 17.2 | 穩定 |
| avg prefill | 762ms | 749ms | 1.3s* | — |

*Run 3 avg prefill 包含長 prompt（5.6s），前幾次測試限制了 max_tokens 所以 prompt 更短。

**結論**：9B 的生成速度（~17-18 tok/s）跨三次測試高度一致。

---

## 關鍵發現

### 發現 6：官方推薦參數不適合 0.8B 小模型（4-bit 量化下）

0.8B 官方推薦的 `temp=1.0, top_p=1.0, pp=2.0` 在 **4-bit MLX 量化版本**上會導致：
- **Thinking loop**：模型輸出 "Thinking Process:" 純文字思考，不停止（創意寫作 164s、邏輯推理 231s）
- **分類錯誤**：temp=1.0 讓 0.8B 的分類不穩定（"coding" → "reasoning"）
- **翻譯品質下降**：更多隨機性導致更差的譯文

**假設**：官方參數是在 FP16/BF16 全精度模型上調校的。4-bit 量化壓平了 softmax 機率分佈的峰值，高溫度在此基礎上進一步放大隨機性，導致小模型失控。小模型（0.8B）受影響更大，因為每個權重的精度損失佔比更高。

**建議**：4-bit 量化的 0.8B 使用保守參數（temp=0.7, top_p=0.8, pp=1.5）。待 FP16 版本驗證後可重新評估。

### 發現 7：9B-reasoning profile 是推理場景最佳選擇

官方新增的 non-thinking reasoning 配置（temp=1.0, top_p=1.0, top_k=40, pp=2.0）：
- 邏輯推理速度比 general 快 **47%**（19.3s vs 36.5s）
- 答案更簡潔（629 tok vs 1000 tok）
- 不會觸發 thinking loop

### 發現 8：Thinking mode 在 oMLX 上不可靠

9B thinking mode 有兩個問題：
1. `<think>` 標籤生成不穩定（50% 機率不生成）
2. 不生成 `<think>` 時會進入 thinking loop（消耗 600s timeout 或全部 max_tokens）

**假設**：`<think>` 是低頻特殊 token，4-bit 量化後其生成機率偏移更大，導致模型不穩定地觸發思考模式。

**建議**：推理場景用 **9B-reasoning**（non-thinking + reasoning 參數），避免 thinking mode。

---

## 最終 Profile 推薦

| Profile | 模型 | 場景 | 參數 | 理由 |
|---------|------|------|------|------|
| **fast** | 0.8B | 路由分類、簡單問答 | temp=0.7, top_p=0.8, pp=1.5 | 官方參數在 4-bit 量化下不穩定，保守設定更安全 |
| **default** | 9B | 一般任務 | temp=0.7, top_p=0.8, pp=1.5 | 官方 non-thinking general ✅ |
| **reasoning** ⭐ | 9B | 深度推理、數學 | temp=1.0, top_p=1.0, top_k=40, pp=2.0 | 官方 non-thinking reasoning，比 thinking mode 更快更穩 |
| **thinking** | 9B | 僅在需要時 | temp=1.0, top_p=0.95, pp=1.5 | `<think>` 在 4-bit 量化下不穩定，有 thinking loop 風險 |
| **thinking-code** | 9B | 精確 coding | temp=0.6, top_p=0.95, pp=0.0 | 官方 thinking coding |
| **creative** | 9B | 創意寫作 | temp=0.7, top_p=0.8, pp=1.5 | 對齊 non-thinking general |
