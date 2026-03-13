# Profile 總表

所有模型為 **Qwen3.5 4-bit MLX 量化版本**，運行於 oMLX 推理伺服器。

## 場景 → Profile 對應

| 場景 | 推薦 Profile | 模型 | 理由 |
|------|-------------|------|------|
| 簡單問答 | [**fast**](fast.json) | 0.8B | 81ms，品質與 9B 相同 |
| 分類/路由 | [**fast**](fast.json) | 0.8B | 109ms，保守參數下分類穩定 |
| 摘要 | [**fast**](fast.json) | 0.8B | 469ms，品質與 9B 相同，速度快 6x |
| 閱讀理解 | [**fast**](fast.json) | 0.8B | 1.2s，引據比 9B 更完整 |
| 翻譯 | [**default**](default.json) | 9B | 0.8B 翻譯不精確 |
| 程式碼生成 | [**default**](default.json) | 9B | 0.8B 有 bug / 幻覺 import |
| 創意寫作 | [**creative**](creative.json) | 9B | 0.8B 不遵守格式 |
| Tool Calling | [**default**](default.json) | 9B | 僅 9B 支援 |
| 邏輯推理 | [**reasoning**](reasoning.json) | 9B | 19.3s，比 general 快 47% |
| 數學推理 | [**reasoning**](reasoning.json) | 9B | 16.3s，最快且正確 |

## Profile 參數總覽

| 參數 | [fast](fast.json) | [default](default.json) | [reasoning](reasoning.json) | [creative](creative.json) | [thinking](thinking.json) | [thinking-code](thinking-code.json) |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| 模型 | 0.8B | 9B | 9B | 9B | 9B | 9B |
| temperature | 0.7 | 0.7 | 1.0 | 0.7 | 1.0 | 0.6 |
| top_p | 0.8 | 0.8 | 1.0 | 0.8 | 0.95 | 0.95 |
| top_k | 20 | 20 | 40 | 20 | 20 | 20 |
| presence_penalty | 1.5 | 1.5 | 2.0 | 1.5 | 1.5 | 0.0 |
| enable_thinking | false | false | false | false | true | true |
| tools_enabled | false | true | true | false | true | true |
| max_tokens | 32,768 | 32,768 | 81,920 | 32,768 | 81,920 | 81,920 |
| timeout | 30s | 600s | 600s | 600s | 600s | 600s |
| 狀態 | ✅ 推薦 | ✅ 推薦 | ✅ 推薦 | ✅ 推薦 | ⚠️ 不推薦 | ⚠️ 不推薦 |

## 備註

- **fast**：刻意偏離官方推薦值（temp=1.0, pp=2.0），因 4-bit 量化下導致 thinking loop
- **reasoning**：符合官方 Non-Thinking Hard Reasoning 建議，比 thinking mode 快 47% 且 100% 穩定
- **thinking / thinking-code**：`<think>` 標籤生成率 ~50%，失敗時進入 thinking loop，推薦改用 reasoning
