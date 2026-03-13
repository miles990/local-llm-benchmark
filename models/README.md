# 測試模型資訊

## Qwen3.5-0.8B-MLX-4bit

| 項目 | 規格 |
|------|------|
| 來源 | [mlx-community/Qwen3.5-0.8B-MLX-4bit](https://huggingface.co/mlx-community/Qwen3.5-0.8B-MLX-4bit) |
| 基礎模型 | Qwen3.5-0.8B |
| 參數量 | 0.8B（8 億） |
| 架構 | Gated DeltaNet 混合架構（3:1 線性/完整注意力） |
| 量化 | 4-bit MLX 格式 |
| 磁碟大小 | 622 MB |
| 原生 Context | 262,144 tokens |
| 框架 | MLX（Apple Silicon 原生） |

### 適用場景
- 路由/分類（~100ms 回應）
- 簡單問答
- 快速摘要
- 低延遲 API 回覆

### 已知限制
- 程式碼生成有 bug 風險（邊界條件處理差）
- 邏輯推理不可靠（會產生重複混亂的步驟）
- 創意寫作不遵守格式要求（如 haiku 結構）
- 翻譯精度不如 9B

---

## Qwen3.5-9B-MLX-4bit

| 項目 | 規格 |
|------|------|
| 來源 | [mlx-community/Qwen3.5-9B-MLX-4bit](https://huggingface.co/mlx-community/Qwen3.5-9B-MLX-4bit) |
| 基礎模型 | Qwen3.5-9B |
| 參數量 | 9B（90 億） |
| 架構 | Gated DeltaNet 混合架構（3:1 線性/完整注意力） |
| 量化 | 4-bit MLX 格式 |
| 磁碟大小 | 5.6 GB |
| 原生 Context | 262,144 tokens |
| 框架 | MLX（Apple Silicon 原生） |

### 適用場景
- 程式碼生成（正確率高）
- 邏輯/數學推理
- 翻譯（自然流暢）
- 創意寫作（遵守格式）
- 長文理解與摘要
- Tool Calling

### 已知限制
- 速度約為 0.8B 的 1/6
- 複雜推理（如過河問題）在 512 token 內可能無法完成
- 佔用記憶體較多（~5.6GB）

---

## Qwen3.5-0.8B（FP16）— 已刪除

| 項目 | 規格 |
|------|------|
| 參數量 | 0.8B |
| 量化 | 無（FP16 全精度） |
| 磁碟大小 | 1.6 GB |
| 狀態 | **已刪除** — 比 4-bit 版本大 2.5 倍但無品質優勢，載入時間更長（206s vs 24s） |

### 刪除原因
在 16GB RAM 的環境下，FP16 全精度的 0.8B 模型沒有使用價值：
1. 磁碟佔用是 4-bit 版的 2.5 倍（1.6GB vs 622MB）
2. 首次載入時間是 4-bit 版的 8.5 倍（206s vs 24s）
3. 0.8B 規模的模型，FP16 vs 4-bit 的品質差異可忽略不計

---

## 模型架構：Gated DeltaNet

Qwen3.5 系列使用 Gated DeltaNet 混合架構：

```
每 4 層 Transformer Block：
├── Block 1: Gated DeltaNet（線性注意力，O(n) 複雜度）
├── Block 2: Gated DeltaNet
├── Block 3: Gated DeltaNet
└── Block 4: Full Softmax Attention（O(n²) 複雜度）
```

- **線性注意力層（75%）**：記憶體複雜度恆定，高效處理長 context
- **完整注意力層（25%）**：精確的資訊檢索，保證關鍵位置的推理品質
- 支援 262K 原生 context，可透過 YaRN 擴展至 1M+

## Thinking Mode 設定

Qwen3.5 支援 thinking / non-thinking 模式，透過 `chat_template_kwargs` 控制：

```json
// Non-thinking（推薦用於大多數場景）
{ "chat_template_kwargs": { "enable_thinking": false } }

// Thinking（用於需要深度推理的場景）
{ "chat_template_kwargs": { "enable_thinking": true } }
```

**注意**：Qwen3.5 預設開啟 thinking，必須明確傳 `false` 才能關閉。
小模型（0.8B）的 thinking 品質有限，建議保持關閉。
