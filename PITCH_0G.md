# 0G Taipei Hackathon · 5 分鐘（照主辦的六個標題）

評分：元件整合 30 · 創意場景 25 · 技術實作 25 · 體驗展示 10 · 創新加分 10。投影 `slides_0g.html`（← → 換頁）。

**做了什麼（0:00–0:30）**
> 阿嬤的錢包：AI 守護代理人「豆豆」陪長輩聽電話、判斷詐騙，錢放在鏈上合約，可疑付款要兩位家人共簽。上週它擋住了 30 萬。今天豆豆有 0G 的身分，每一次判斷都帶著章，家人和合約見章才放款。

**解決什麼問題（0:30–1:00）**
> 台灣一年詐騙財損逾 500 億，長輩被催促的那一刻沒有人踩煞車。AI 可以判斷，但「家人憑什麼相信 AI」沒有答案：判斷是中心化 API 的回傳值，看不到、驗不了，通話內容還躺在別人的伺服器上。

**架構（1:00–1:40）**
> 四個 0G 元件各做一件事。防護盾推理跑在 0G Compute Network 的 TeeML provider，豆豆自己的錢包付算力，回應簽章由 SDK 驗證。豆豆是官方 Agentic ID #384，每次判斷簽成一枚章：模型、輸入輸出雜湊、TEE、分數。章上 0G Storage，rootHash 掛在提案。守護錢包在 0G Chain，提案 memo 帶 proof。金額不靠模型算，程式碼從阿嬤原話判讀。

**Why build on 0G（1:40–2:10）**
> 因為證明要活在 agent 之間，不能活在我們的伺服器裡。Agent 之間互相調用、沒有人在中間看，「我信你」就不是安全模型。0G 給的是身分、證明、可稽核：拒絕寫在合約裡，信任寫在章裡。

**Demo 完成了什麼（2:10–4:10，現場）**
> 1. 詐騙電話：風險條衝紅，「推理在 0G 隔離環境完成 · TEE 已驗證」。
> 2. 家人頁面一秒內出現卡片；區塊落地後「這個判斷有章」。按「離線驗證」：簽章有效 ✓、鏈上身分 = #384 ✓。按「從 0G Storage 抓回來重驗」：從網路抓回同一枚章，再驗一次 ✓。
> 3. 媽媽擋下：鏈上 ProposalRejected，阿嬤頁面立刻通知、收支紀錄更新。
> 加分：可驗證推理、兩個模型協作（Realtime 語音 + 0G 上的防護盾）、14 個測試。

**未來 Roadmap（4:10–4:40）**
> 豆豆搬進 0G sealed sandbox，官方 X-Agent-Proof 由 agentSeal 蓋章，家人核准變成鏈上 reputation；家人改用自己的錢包簽；mainnet Router + 0GM；Guild on 0G。錢包、身分、證明、儲存，今天已經全部在 0G 上。

---

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
> 豆豆在 0G 官方的 Agentic ID 上有身分：agent #384，ERC-8004，8004scan 查得到。這次判斷，它簽成一枚章：哪個 agent、哪個模型、輸入的雜湊、輸出的雜湊、TEE 有沒有驗過、分數。章的指紋寫進鏈上提案的 memo。
> *（家人頁面：提案卡片顯示「這個判斷有章」，按「離線驗證這枚章」→ ✓ 簽章有效）*
> 現在把 Wi-Fi 關掉。
> *（終端機：`pnpm verify-stamp --proposal 0` → VALID；開網路加 `--onchain` → 簽章者就是 Agentic ID #1 的 executor）*
> 驗證是簽章還原，不是交易。不用 gas，不用網路，任何人都能驗。家人是看到章才簽名，合約是看到家人簽名才放款。

**Impact（2:10–2:40）**
> 這不只是阿嬤的錢包。任何「AI 判斷、合約放款」的流程都是同一條路：貸款審核、保險理賠、供應鏈付款。Agent 之間要互相雇用，中間沒有人在看，「我信你」就不能是安全模型。每一跳都要有章。
> 我們用兩天做出的東西，今天用三個環境變數搬到 0G 上，再加一枚章。全部開源 MIT。

**收尾（2:40–3:00，對 JT）**
> 下一步三十天：把豆豆搬進 0G 的 sealed sandbox，讓每次回應由 agentSeal 蓋官方的 X-Agent-Proof，家人的核准變成鏈上 reputation；家人改用自己的錢包簽；mainnet Router 上用 0GM。錢包、身分（ERC-8004 #384）、證明今天已經全部在 0G 上了。我們想把「見章放款」做成任何銀行都能接的守護錢包。謝謝。

## 評審會問的

- **TEE 的證明你們驗到哪一層？** 誠實答：SDK 的 `processResponse()` 驗 TeeML provider 對回應的簽章，這個結果簽進章裡；enclave attestation 要用 0G 的 dstack 驗證器追到底，這一版沒做。章證明的是「豆豆這把金鑰對這個輸入雜湊簽下這個分數」加上「provider 簽章我們驗過」。
- **章跟 Agentic ID 怎麼綁？** 章裡有 `agent_id_contract` 與 `agent_id_token`（官方合約 0x3449…5648，agent #384）；`--onchain` 讀 `ownerOf(384)` 比對簽章者。豆豆是用官方 SDK 走 attestor 註冊的（ack 三個 trust root、deposit、mint-only deploy），agentSeal 是 0x535d…6477。官方的 X-Agent-Proof 要豆豆跑在 sealed sandbox 裡才會由 proxy 蓋章，那是下一步；今天的章由 owner 金鑰簽，綁定 #384。
- **為什麼不把整段對話上鏈？** 隱私。鏈上只有雜湊、分數與章的指紋。通話內容在 TEE 裡處理，`private` 模式連 provider 都讀不到 prompt。
- **家人的簽章在哪裡？** Demo 為了穩定放在伺服器端代簽，README 有揭露；正式版換成家人自己的 passkey。這跟今天的主題無關，先講清楚。
- **模型換掉會怎樣？** 章裡記 `model`；換模型就是不同的章，驗證器一眼看得出來。

## 上台前 60 秒

```bash
pnpm demo:start     # 重啟正式版（會先把佔用 3000 的程序關掉）；加 --rebuild 重新 build
pnpm demo:check     # 全綠才上台：server、豆豆 #384、0G 推理 TEE、錢包、家人金鑰、語音 session
pnpm demo:clean     # 把所有 pending 提案以媽媽身分擋下，家人頁面乾淨開場
```
0G testnet 的 provider 限制每分鐘 10 次請求：不要連按「請豆豆判斷」，兩次之間留 6 秒。程式碼遇到 429/503 會等一次再試，再不行才退回規則層。

### 舊版檢查

```bash
pnpm dev                       # 阿嬤 http://localhost:3000 · 家人 /family
curl -s localhost:3000/api/agent | head -c 400     # 豆豆身分 + 防護盾設定，確認 base_url 是 0G
```
跑一次詐騙劇本 → 家人頁看到「這個判斷有章」→ `pnpm verify-stamp --proposal <id>` 看到 VALID。
如果 0G provider 逾時（testnet 只有一台 qwen2.5-omni-7b，第一次要 20 到 40 秒）：防護盾自動退回規則層，chip 會變灰「沒有硬體證明」，講一句「這就是為什麼章上要寫 tee_verified」。第一次評估前先在後台打一次 `/api/shield` 暖機。
