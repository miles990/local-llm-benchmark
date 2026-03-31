# Profile 總表

所有模型為 **Qwen3.5 4-bit MLX 量化版本**，運行於 oMLX 推理伺服器。

## 場景 → Profile 對應

| 場景 | 推薦 Profile | 模型 | 理由 |
|------|-------------|------|------|
| 簡單問答 | [**4B**](4B.json) | 4B | 248ms，可靠度 10/10 |
| 分類/路由 | [**4B**](4B.json) | 4B | 352ms，答對 coding（0.8B 答錯） |
| 翻譯 | [**4B**](4B.json) | 4B | 421ms，精確翻譯（0.8B 囉嗦） |
| 摘要 | [**4B**](4B.json) | 4B | 1.8s，品質穩定 |
| 程式碼生成 | [**4B**](4B.json) | 4B | 2.5s，完整 memoization（0.8B 只有 stub） |
| 創意寫作 | [**4B**](4B.json) | 4B | 586ms，正確 haiku（0.8B 格式錯） |
| 閱讀理解 | [**4B**](4B.json) | 4B | 3.4s，品質與 0.8B 相近 |
| Tool Calling | [**4B**](4B.json) | 4B | 1.4s，支援 tool calling |
| 邏輯推理 | [**4B**](4B.json) | 4B | 12.5s，0.8B 會 thinking loop 237s |
| 數學推理 | [**4B**](4B.json) | 4B | 9.5s，與 0.8B 平手但更可靠 |

> **2026-03-31 更新**：基於 4B benchmark 結果（[run-4](../results/run-4-4B-benchmark.json)），Akari 全場景統一使用 4B conservative profile。0.8B 雖快 3-4x 但品質不穩定（分類答錯、code 只有 stub、推理 loop）。9B profiles 保留供參考。

## Profile 參數總覽

| 參數 | [fast](fast.json) | [4B](4B.json) | [4B-reasoning](4B-reasoning.json) | [default](default.json) | [reasoning](reasoning.json) | [creative](creative.json) | [thinking](thinking.json) | [thinking-code](thinking-code.json) |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 模型 | 0.8B | **4B** | **4B** | 9B | 9B | 9B | 9B | 9B |
| temperature | 0.7 | 0.7 | 1.0 | 0.7 | 1.0 | 0.7 | 1.0 | 0.6 |
| top_p | 0.8 | 0.8 | 1.0 | 0.8 | 1.0 | 0.8 | 0.95 | 0.95 |
| top_k | 20 | 20 | 40 | 20 | 40 | 20 | 20 | 20 |
| presence_penalty | 1.5 | 1.5 | 2.0 | 1.5 | 2.0 | 1.5 | 1.5 | 0.0 |
| enable_thinking | false | false | false | false | false | false | true | true |
| tools_enabled | false | true | true | true | true | false | true | true |
| max_tokens | 32,768 | 32,768 | 81,920 | 32,768 | 81,920 | 32,768 | 81,920 | 81,920 |
| timeout | 30s | 600s | 600s | 600s | 600s | 600s | 600s | 600s |
| 狀態 | ✅ 可用 | ✅ **推薦** | ⚠️ 不推薦 | ✅ 可用 | ✅ 可用 | ✅ 可用 | ⚠️ 不推薦 | ⚠️ 不推薦 |

## 備註

- **4B**（推薦）：conservative params，10/10 成功率，零 thinking loop，品質明顯優於 0.8B
- **4B-reasoning**：高溫參數在 4-bit 4B 下會 thinking loop（跟 0.8B 同問題），不推薦
- **fast**（0.8B）：速度快 3-4x 但品質不穩定 — 分類答錯、code 有 bug、推理會 loop
- **default/reasoning**（9B）：品質最佳但速度慢，保留供需要高品質的場景
- **thinking / thinking-code**：`<think>` 標籤生成率 ~50%，失敗時進入 thinking loop
