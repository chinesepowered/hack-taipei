# 0G Taipei Hackathon · 3 分鐘 Pitch（Kun）

賽道：B 有身份的 Agent（+ C 見章放款）。一句話：**豆豆有身分了，它的每一次判斷都帶著章。**

## 台詞（Background → Link → Impact → 收尾）

**Background（0:00–0:35）**
> 上週我們在 BUILDMODE 做了阿嬤的錢包：AI 聽阿嬤的電話，判斷是不是詐騙，錢放在合約裡，兩位家人共簽才動得了。它擋住了三十萬。
> 但有一個洞。家人憑什麼相信 AI 的判斷？那是一個中心化 API 的回傳值，誰都看不到裡面發生什麼，也沒有人能驗。而且阿嬤的通話內容，躺在我們的伺服器上。
> 台灣一年詐騙財損逾 500 億，最需要證明的那一跳，剛好是最沒有證明的那一跳。

**Link（0:35–2:10，現場操作）**
> 今天防護盾跑在 0G Compute Network 上：豆豆用自己的錢包付算力，模型在 TeeML provider 的隔離環境裡跑，回應帶 provider 簽章，我們自己驗。
> *（阿嬤頁面：跑詐騙劇本，風險條衝紅，風險條下面出現「推理在 0G 隔離環境完成 · TEE 已驗證」）*
> 豆豆在 0G Galileo 上有身分，Agentic ID #1，合約 0x8da5。這次判斷，它簽成一枚章：哪個 agent、哪個模型、輸入的雜湊、輸出的雜湊、TEE 有沒有驗過、分數。章的指紋寫進鏈上提案的 memo。
> *（家人頁面：提案卡片顯示「這個判斷有章」，按「離線驗證這枚章」→ ✓ 簽章有效）*
> 現在把 Wi-Fi 關掉。
> *（終端機：`pnpm verify-stamp --proposal 0` → VALID；開網路加 `--onchain` → 簽章者就是 Agentic ID #1 的 executor）*
> 驗證是簽章還原，不是交易。不用 gas，不用網路，任何人都能驗。家人是看到章才簽名，合約是看到家人簽名才放款。

**Impact（2:10–2:40）**
> 這不只是阿嬤的錢包。任何「AI 判斷、合約放款」的流程都是同一條路：貸款審核、保險理賠、供應鏈付款。Agent 之間要互相雇用，中間沒有人在看，「我信你」就不能是安全模型。每一跳都要有章。
> 我們用兩天做出的東西，今天用三個環境變數搬到 0G 上，再加一枚章。全部開源 MIT。

**收尾（2:40–3:00，對 JT）**
> 下一步三十天：換成 0G 官方的 ERC-7857 合約與 oracle；家人改用自己的錢包簽；mainnet Router 上用 0GM 模型；申請 Guild on 0G。錢包、身分、證明今天已經全部在 0G 上了。我們想把「見章放款」做成任何銀行都能接的守護錢包。謝謝。

## 評審會問的

- **TEE 的證明你們驗到哪一層？** 誠實答：SDK 的 `processResponse()` 驗 TeeML provider 對回應的簽章，這個結果簽進章裡；enclave attestation 要用 0G 的 dstack 驗證器追到底，這一版沒做。章證明的是「豆豆這把金鑰對這個輸入雜湊簽下這個分數」加上「provider 簽章我們驗過」。
- **章跟 Agentic ID 怎麼綁？** 章裡有 `agent_id_contract` 與 `agent_id_token`；`--onchain` 會讀合約的 `executorOf(tokenId)` 比對簽章者。合約是我們今天照 ERC-7857 的形狀寫的 demo 版（mint / ownerOf / executorOf / authorizeUsage / transfer / clone），沒有 oracle。
- **為什麼不把整段對話上鏈？** 隱私。鏈上只有雜湊、分數與章的指紋。通話內容在 TEE 裡處理，`private` 模式連 provider 都讀不到 prompt。
- **家人的簽章在哪裡？** Demo 為了穩定放在伺服器端代簽，README 有揭露；正式版換成家人自己的 passkey。這跟今天的主題無關，先講清楚。
- **模型換掉會怎樣？** 章裡記 `model`；換模型就是不同的章，驗證器一眼看得出來。

## 上台前 60 秒

```bash
pnpm dev                       # 阿嬤 http://localhost:3000 · 家人 /family
curl -s localhost:3000/api/agent | head -c 400     # 豆豆身分 + 防護盾設定，確認 base_url 是 0G
```
跑一次詐騙劇本 → 家人頁看到「這個判斷有章」→ `pnpm verify-stamp --proposal <id>` 看到 VALID。
如果 0G provider 逾時（testnet 只有一台 qwen2.5-omni-7b，第一次要 20 到 40 秒）：防護盾自動退回規則層，chip 會變灰「沒有硬體證明」，講一句「這就是為什麼章上要寫 tee_verified」。第一次評估前先在後台打一次 `/api/shield` 暖機。
