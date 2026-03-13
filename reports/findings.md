# 關鍵發現與建議

## 發現 1：小模型速度優勢在 Model Pinning 後才有意義

**問題**：oMLX 預設只將一個模型載入記憶體，切換模型時的磁碟載入延遲（24-200 秒）完全抵消了小模型的速度優勢。

**解決**：透過 `model_settings.json` 設定 `is_pinned: true`，讓多個模型同時常駐記憶體。Pin 後 0.8B 的切換延遲從 24s 降為 0.14s。

**適用條件**：RAM 足夠容納所有 pinned 模型（本案例 6.1GB / 16GB）。

## 發現 2：FP16 量化的小模型無使用價值

Qwen3.5-0.8B（FP16, 1.6GB）比 Qwen3.5-0.8B-MLX-4bit（622MB）載入慢 8.5 倍（206s vs 24s），且推理品質差異可忽略。在 16GB RAM 環境下，FP16 的 0.8B 無論速度還是品質都沒有優勢。

**建議**：統一使用 4-bit MLX 量化版本。

## 發現 3：0.8B 品質天花板明確

0.8B 在以下場景可靠：
- ✅ 分類 / 路由（最佳用途）
- ✅ 簡單問答
- ✅ 摘要
- ✅ 閱讀理解（意外表現好）

0.8B 在以下場景不可靠：
- ❌ 程式碼生成（有 bug）
- ❌ 邏輯推理（會迴圈重複）
- ❌ 創意寫作（不遵守格式）
- ❌ 翻譯（精度不足）

## 發現 4：兩次測試結果高度一致

速度波動在 ±15% 以內（0.8B: 100.2 → 108.6 tok/s，9B: 17.3 → 18.1 tok/s），品質結果完全一致。測試方法可靠。

## 發現 5：autoRouteProfile 是正確的架構決策

用 0.8B 做快速分類（~100ms），再用 9B 執行實際任務的兩階段架構是最佳策略：
- 路由開銷：~100ms（pin 後）
- 品質保證：9B 處理所有需要品質的場景
- 資源效率：只在需要時才用 9B

## 發現 6：官方推薦參數不適合 0.8B 小模型（Run 3）

Qwen HuggingFace 官方為 0.8B 推薦的 `temp=1.0, top_p=1.0, pp=2.0` 在實測中導致嚴重問題：

| 問題 | 表現 | 影響 |
|------|------|------|
| **Thinking loop** | 模型輸出 "Thinking Process:" 純文字思考，不停止 | 創意寫作 164s / 24,854 tok、邏輯推理 231s / 32,767 tok |
| **分類錯誤** | temp=1.0 讓分類不穩定（"coding" → "reasoning"） | 路由架構可靠性下降 |
| **翻譯品質下降** | 更多隨機性導致更差的譯文 | 「跳得最快速的快狐，過去懶狗」 |

HuggingFace 文件也警告 0.8B「more prone to entering thinking loops」。

**建議**：0.8B 使用保守參數（temp=0.7, top_p=0.8, pp=1.5）而非官方推薦。官方參數更適合 ≥9B 的模型。

## 發現 7：9B-reasoning profile 是推理場景最佳選擇（Run 3）

官方新增的 non-thinking reasoning 配置（temp=1.0, top_p=1.0, top_k=40, pp=2.0）表現優異：

| 場景 | 9B (general) | 9B-reasoning | 9B-thinking | 勝出 |
|------|-------------|-------------|-------------|------|
| 邏輯推理 | 36.5s / 1,000 tok | **19.3s / 629 tok** | timeout (600s) | **9B-reasoning** |
| 數學推理 | 16.9s / 558 tok | **16.3s / 553 tok** | 53s / 1,797 tok | **9B-reasoning** |

**關鍵優勢**：
- 比 general profile 快 **47%**（邏輯推理）
- 答案更簡潔（629 tok vs 1,000 tok）
- 不會觸發 thinking loop
- 不需要 `<think>` 標籤解析，更穩定

## 發現 8：Thinking mode 在 oMLX 上不可靠（Run 3）

9B thinking mode（`enable_thinking: true`）有兩個結構性問題：

1. **`<think>` 標籤生成不穩定**：約 50% 機率不生成 `<think>` 標籤
2. **不生成 `<think>` 時進入 thinking loop**：思考以純文字洩漏到 content 中，消耗所有 max_tokens 或觸發 timeout

| 場景 | 結果 | `<think>` 標籤 | reasoning_content |
|------|------|---------------|-------------------|
| 邏輯推理 | **timeout (600s)** | ❌ 未生成 | 無 |
| 數學推理 | ✅ 53s（含 3,535 chars 思考） | ✅ 正常 | 有 |

**根因分析**：oMLX 的 `ThinkingParser` 使用 regex `<think>(.*?)</think>` 解析。模型不輸出 `<think>` 時，所有思考文字進入 content 欄位，oMLX 無法分離。

**建議**：推理場景用 **9B-reasoning**（non-thinking + reasoning 參數），避免 thinking mode。Thinking mode 僅在確認 `<think>` 標籤可靠的場景使用。

---

## 三次測試速度一致性

| 指標 | Run 1 | Run 2 | Run 3（官方）| 說明 |
|------|-------|-------|-------------|------|
| 9B avg tok/s | 17.3 | 18.1 | 17.2 | 高度穩定 |
| 0.8B avg tok/s | 100.2 | 108.6 | 112.4* | *被 thinking loop 拉高，不可比 |

9B 的生成速度（~17-18 tok/s）跨三次測試高度一致，驗證測試方法可靠。

---

## 未來測試方向

1. **更大模型**：若 RAM 升級，測試 27B / 35B-A3B 的性價比
2. **並發測試**：多個同時請求的 oMLX 表現
3. **長 context 壓力測試**：128K+ context 的 prefill 速度
4. **Thinking mode 穩定性**：不同 prompt 格式對 `<think>` 標籤生成率的影響
5. **9B-reasoning 邊界測試**：更複雜的推理場景（多步數學、程式碼 debugging）
