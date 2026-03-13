# 回答品質對比 — 完整回答記錄

測試日期：2026-03-13
模型均使用 Non-Thinking 模式 (`enable_thinking: false`)

---

## 1. 簡單問答

**Prompt**: `What is 2+2? Reply with just the number.`
**Parameters**: max_tokens=16, temperature=0.1

### 0.8B
```
4
```

### 9B
```
4
```

**評價**: 平手 — 兩者都正確且簡潔。

---

## 2. 分類/路由

**Prompt**: `Classify this text into one category (coding/chat/reasoning/creative): "Help me write a Python function to sort a list". Reply with one word only.`
**Parameters**: max_tokens=8, temperature=0.1

### 0.8B
```
coding
```

### 9B
```
coding
```

**評價**: 平手 — 兩者都正確分類。

---

## 3. 翻譯

**Prompt**: `Translate to Traditional Chinese: "The quick brown fox jumps over the lazy dog"`
**Parameters**: max_tokens=64, temperature=0.3

### 0.8B
```
「快跑的棕狐狸跳過懶狗」
```

### 9B
```
敏捷的棕色狐狸跳過了懶惰的狗。
```

**評價**: **9B 勝** — 0.8B 把 "quick" 翻成「快跑」不精確（應為「敏捷」），且缺少「的」使句子不自然。9B 翻譯流暢自然。

---

## 4. 摘要

**Prompt**: `Summarize this in 2 sentences: "Artificial intelligence has transformed many industries..."`
**Parameters**: max_tokens=128, temperature=0.5

### 0.8B
```
Artificial intelligence has revolutionized industries by enabling earlier disease diagnosis, detecting fraud, and optimizing transportation safety, yet these advancements also raise significant concerns regarding job displacement, privacy, and algorithmic bias. Researchers and policymakers are currently working together to develop frameworks that maximize AI benefits while minimizing its risks.
```

### 9B
```
Artificial intelligence has revolutionized industries like healthcare, finance, and transportation by enhancing diagnosis, fraud detection, and autonomous navigation. Despite these significant benefits, experts are actively developing frameworks to address critical concerns regarding job displacement, privacy, and algorithmic bias.
```

**評價**: 平手 — 兩者都正確摘要為兩句話，涵蓋 AI 的好處和風險。9B 稍微更簡潔。

---

## 5. 程式碼生成

**Prompt**: `Write a TypeScript function called fibonacci that returns the nth fibonacci number using memoization. Include the type signature. Code only, no explanation.`
**Parameters**: max_tokens=512, temperature=0.3

### 0.8B
```typescript
const fibonacci = (n: number): number => {
  const memo = new Map<number, number>();
  memo.set(0, 0);
  memo.set(1, 1);
  for (let i = 2; i < n; i++) {
    memo.set(i, memo.get(i - 1) + memo.get(i - 2));
  }
  return memo.get(n);
};
```

### 9B
```typescript
function fibonacci(n: number): number {
  const memo: Map<number, number> = new Map();

  function calculate(index: number): number {
    if (index <= 1) return index;
    if (memo.has(index)) return memo.get(index)!;

    const result = calculate(index - 1) + calculate(index - 2);
    memo.set(index, result);
    return result;
  }

  return calculate(n);
}
```

**評價**: **9B 勝**
- 0.8B 有 bug：`i < n` 應為 `i <= n`（fibonacci(5) 會回傳 undefined）；`memo.get()` 可能回傳 `undefined` 但型別標為 `number`
- 9B 正確：遞迴 + memo closure，有 `!` 斷言處理 Map.get() 的 undefined

---

## 6. 創意寫作

**Prompt**: `Write a haiku about programming in the rain.`
**Parameters**: max_tokens=64, temperature=0.9

### 0.8B
```
Light blurs your eyes as you work
A line of code streams through the rain
The rain hits the screen, and code flows
```

### 9B
```
Code glows in the dark
Raindrops tap a steady rhythm
Debugging in the storm
```

**評價**: **9B 勝**
- 0.8B 不符合 haiku 格式（5-7-5 音節），更像自由詩
- 9B 接近標準 haiku 結構（5-7-6，略偏），意象鮮明

---

## 7. 邏輯推理（經典過河問題）

**Prompt**: `A farmer has a fox, a chicken, and a bag of grain...`
**Parameters**: max_tokens=512, temperature=0.3

### 0.8B
```
Here is a step-by-step explanation of how the farmer can get his food across the river using the specific rules provided.

### The Scenario
1.  **The Items:**
    *   **Fox:** Can eat the Chicken.
    *   **Chicken:** Can eat the Grain.
    *   **Bag of Grain:** Can be carried by the farmer.
2.  **The Boat:** Can carry the Farmer and **one item** at a time.
3.  **The Goal:** Get the Chicken, the Grain, and the Farmer across the river.

---

### Step-by-Step Solution

#### Step 1: The Farmer brings the Bag of Grain to the boat.
*   The farmer puts the bag of grain into the boat.
*   He then leaves the boat and walks back to the riverbank to take the Chicken.
*   *Result:* The farmer is now on the riverbank with the Chicken.

#### Step 2: The Farmer brings the Chicken to the boat.
*   The farmer takes the Chicken from the riverbank into the boat.
*   He then leaves the boat to take the Bag of Grain across the river.
*   *Result:* The farmer is now on the riverbank with the Bag of Grain.

#### Step 3: The Farmer takes the Chicken to the boat.
[... 重複 Step 2-3 的動作，陷入迴圈 ...]
```

### 9B
```
This is a classic logic puzzle known as the "River Crossing Problem." To solve it, we must ensure that at no point are the **Fox and Chicken** left alone together (without the farmer), nor are the **Chicken and Grain** left alone together.

Here is the step-by-step solution:

### The Scenario
*   **Start Bank:** Farmer, Fox, Chicken, Grain.
*   **End Bank:** Empty.
*   **Constraint:** The boat holds only the Farmer + 1 item.
*   **Danger Zones:**
    1.  Fox + Chicken (alone) → Fox eats Chicken.
    2.  Chicken + Grain (alone) → Chicken eats Grain.

---

### Step-by-Step Solution

**Step 1: Take the Chicken across.**
*   **Action:** Farmer takes the Chicken to the End Bank.
*   **State:**
    *   *Start Bank:* Fox, Grain. (Safe: Fox won't eat Grain).
    *   *End Bank:* Farmer, Chicken.
*   **Return:** Farmer returns alone to the Start Bank.

**Step 2: Take the Fox (or Grain) across.**
*   *Option A (Take Fox):* ... **This fails.**
*   *Option B (Take Grain):* ... **This fails.**
*   *Correction:* Wait, let's re-evaluate...
[被截斷 — 512 token 不夠完成]
```

**評價**: **9B 勝**（但兩者都未完成正確解答）
- 0.8B 完全錯誤：第一步就走錯（先帶 grain 而非 chicken），然後陷入重複迴圈
- 9B 正確識別了約束條件，第一步正確（先帶 chicken），但在分析第二步時 token 用完被截斷。推理方向正確但需要更多 token（或 thinking mode）

---

## 8. 數學推理

**Prompt**: `If a train travels at 60 km/h for 2.5 hours, then at 80 km/h for 1.5 hours, what is the average speed for the entire journey? Show your work.`
**Parameters**: max_tokens=256, temperature=0.1

### 0.8B
```
To find the average speed for the entire journey, we need to calculate the total distance traveled and the total time spent, then divide the total distance by the total time.

### Step 1: Calculate the total distance
*   **First leg:**
    d₁ = 60 km/h × 2.5 hours = 150 km

*   **Second leg:**
    d₂ = 80 km/h × 1.5 hours = 120 km

### Step 2: Calculate the total distance
Total Distance = d₁ + d₂
[被截斷]
```

### 9B
```
To find the average speed for the entire journey, we must use the definition of average speed:

Average Speed = Total Distance / Total Time

It is important to note that we cannot simply average the two speeds (60 + 80)/2 = 70) because the train spends different amounts of time at each speed. We must calculate the total distance traveled and divide it by the total time elapsed.

### Step 1: Calculate the distance for each segment

**Segment 1:**
*   Speed = 60 km/h, Time = 2.5 hours
*   Distance = 60 × 2.5 = 150 km

**Segment 2:**
*   Speed = 80 km/h, Time = 1.5 hours
[被截斷]
```

**評價**: **9B 勝**
- 兩者計算方向都正確，但都在 256 token 內被截斷
- 9B 額外指出了「不能直接平均兩個速度」的常見錯誤，展示了更深的理解
- 正確答案：(150+120)/(2.5+1.5) = 270/4 = 67.5 km/h

---

## 9. 長 prompt 理解

**Prompt**: 對話閱讀理解（Alice & Bob 討論資料庫選擇）
**Parameters**: max_tokens=256, temperature=0.3

### 0.8B
```
Based on the conversation provided, here are the answers to your questions:

**1. What database did they finally choose?**
They chose **PostgreSQL**.

**2. What was Bob's initial preference?**
Bob's initial preference was to use **MongoDB**.
*   *Evidence:* Bob explicitly states, "But we discussed using MongoDB last week because of the flexible schema."

**3. What will Alice do next?**
Alice will **draft the schema this week** (and Bob will set up the CI/CD pipeline with the new stack).
```

### 9B
```
Based on the conversation provided, here are the answers to your questions:

1.  **PostgreSQL** (specifically combined with Redis for real-time features).
2.  **MongoDB**.
3.  **Draft the schema**.
```

**評價**: **0.8B 勝**
- 0.8B 回答更完整：有引據（引用 Bob 的原話），Q3 附帶了 Bob 的後續行動
- 9B 回答正確但過於簡短，Q1 補充了 Redis 是額外加分
- 兩者事實正確性都 100%

---

## 總結表

| 場景 | 0.8B 品質 | 9B 品質 | 勝出 |
|------|----------|---------|------|
| 簡單問答 | ✅ 正確 | ✅ 正確 | 平手 |
| 分類/路由 | ✅ 正確 | ✅ 正確 | 平手 |
| 翻譯 | ⚠️ 不精確 | ✅ 自然準確 | **9B** |
| 摘要 | ✅ 完整 | ✅ 簡潔 | 平手 |
| 程式碼 | ❌ 有 bug | ✅ 正確 | **9B** |
| 創意寫作 | ❌ 不符格式 | ✅ 標準 haiku | **9B** |
| 邏輯推理 | ❌ 混亂重複 | ⚠️ 方向對被截斷 | **9B** |
| 數學推理 | ⚠️ 機械式 | ✅ 有洞察力 | **9B** |
| 閱讀理解 | ✅ 完整有引據 | ✅ 簡潔正確 | **0.8B** |
