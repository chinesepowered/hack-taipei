# 阿嬤的錢包 Grandma's Wallet

> 在詐騙集團拿到錢之前，先接起電話的 AI 代理人。拒絕不是寫在提示詞裡，是寫在智慧合約裡。

阿嬤的錢包是一個「用講的」錢包助理：長輩對著手機說要付錢給誰，米格魯助理「豆豆」先用 165 常見詐騙手法評估風險，再用長輩聽得懂的話回應。錢放在 Base 鏈上的守護合約裡，常用收款人、額度內直接付，可疑的一律交給兩位家人一鍵共簽，任一位家人就能擋下。就算阿嬤被說服，錢也匯不出去。

**BUILDMODE GEN-AI HACKATHON 2026 · FUTUREMODE × SITCON · 2026/09/04–06 三天內完成 · MIT 開源**

| | |
|---|---|
| 主賽道 | **Track 05 · AI for Taiwan / Social Impact** |
| 贊助商挑戰 | **國泰金控 · AI Agent × 區塊鏈金融** |
| 程式碼 | https://github.com/chinesepowered/hack-taipei |
| 鏈上合約（Base Sepolia） | [0x6375…7a57](https://sepolia.basescan.org/address/0x6375461086204bd26700fa2ab2bec77f005d7a57) |
| 評選影片 | https://www.youtube.com/watch?v=9oUsJcKFBxA |
| 簡報 | [中文](./slides_tw.html) · [English](./slides_en.html) · Demo 台詞 [DEMO.md](./DEMO.md) |

---

## 問題

台灣每年因詐騙造成的財損超過新台幣 500 億元（內政部警政署 165 打詐儀錶板），受害最深的是長輩。

- 「阿嬤，我是你孫子，我出事了，今天一定要匯 30 萬。」慌張的長輩直接跑去 ATM。
- 家人在錢匯出之後才知道。
- 銀行的防詐是事後攔阻，警語是長輩看不懂的字。

問題不是長輩不夠聰明，是**在被催促的那一刻，身邊沒有人踩煞車，而且錢真的擋不住。**

## 解法

| | 一般防詐 App | 阿嬤的錢包 |
|---|---|---|
| 介面 | 要學、要看字 | 用講的，豆豆會回話 |
| 攔截時機 | 錢出去之後 | 付款之前 |
| 誰決定 | 阿嬤自己（正在被騙的人） | 兩位家人在鏈上共簽 |
| 拒絕的力量 | 一句警語 | 智慧合約，沒有家人簽名錢動不了 |

1. **豆豆（語音代理人）**：OpenAI Realtime 即時語音，聽阿嬤說、也聽開擴音的來電者說。溫柔、慢、三句話以內。
2. **詐騙防護盾**：規則層比對 165 常見手法，LLM 結構化輸出風險分數與白話解釋，並主動提議「我幫你打給孫子確認好不好？」模型失敗自動退回規則層。
3. **GuardedWallet 合約**：白名單 + 每日額度內直接付；其餘變成鏈上提案，2-of-N 家人核准才放行，任 1 位可擋下，額度只有家人能改。風險分數一併上鏈存證。
4. **家人共簽頁面**：手機看到豆豆的判斷與來電者說了什麼，一鍵核准或擋下，簽章直接上鏈。決定一出來，豆豆立刻告訴阿嬤。

## 賽道與贊助商：我們怎麼對應

| 評選項目 | 對應 |
|---|---|
| **Track 05 AI for Taiwan / Social Impact** | 針對台灣最嚴重的社會問題之一，165 手法知識庫在地化，全中文語音，服務數位弱勢的長輩。全部開源，任何銀行、社福單位都能接。 |
| **國泰金控 AI Agent × 區塊鏈金融** | AI 代理人自動化錢包與支付流程，守護規則以智慧合約強制執行，每筆攔截可稽核。銀行可作為共簽人之一，成為託管型「守護錢包」產品。 |
| **總排名** | 三天內完成、可現場 Demo、鏈上可驗證、README 與影片齊全。 |

## 三分鐘 Demo

1. 阿嬤請豆豆付 20 元菜錢給阿明：低風險，直接付款，BaseScan 看得到。
2. 評審扮演詐騙者打電話，阿嬤請豆豆匯 30 萬給「孫子」。
3. 風險條衝紅、豆豆變擔心，解釋這像假冒親友，付款自動變成家人提案。
4. 家人手機按「擋下」，鏈上出現 `ProposalRejected`。
5. 豆豆主動告訴阿嬤「媽媽把那筆錢擋下來了，錢沒有動」。

評審可能會問的問題與回答見 [DEMO.md](./DEMO.md)。

---

## 系統架構

```
┌──────────────┐  WebRTC 雙向語音   ┌───────────────────────────────┐
│  阿嬤的手機   │ ◄───────────────► │  OpenAI Realtime               │
│  (瀏覽器)    │                   │  gpt-realtime-2.1-mini          │
│  豆豆 + 風險條│                   │  豆豆的耳朵、嘴巴、判斷            │
└──────┬───────┘                   └─────────────┬─────────────────┘
       │ 瀏覽器代為執行 tool，金鑰不離開伺服器      │ function calls
       │                                         ▼
       ├──── POST /api/shield ────► ┌───────────────────────────────┐
       │                            │  詐騙防護盾 Scam Shield          │
       │                            │  規則層 (165 手法) + gpt-5.6-luna  │
       │                            └───────────────────────────────┘
       ├──── POST /api/wallet/pay ─►┌───────────────────────────────┐
       │                            │  GuardedWallet.sol               │
       │                            │  Base Sepolia · USDC              │
       │                            │  白名單 · 每日額度 · 2-of-N 共簽    │
       │                            └─────────────▲─────────────────┘
       │                                          │ approve / reject
       └──── GET /api/proposals/:id (輪詢) ◄──── 家人共簽頁面 /family
```

| 層 | 技術 |
|---|---|
| 語音代理人 | OpenAI Realtime API（`gpt-realtime-2.1-mini`，WebRTC，function calling），自動偵測與「按住說話」兩種模式 |
| 詐騙防護盾 | 規則引擎 + `gpt-5.6-luna` structured outputs，失敗自動退回規則層 |
| 智慧合約 | Solidity 0.8，solc-js 編譯，viem 部署，Base Sepolia + Circle 測試 USDC，四個公開 RPC 自動備援 |
| 前端 / API | Next.js 16、TypeScript、pnpm；豆豆為手繪 SVG，六種表情跟著代理人狀態變 |

**為什麼要區塊鏈**：「拒絕」必須是阿嬤和 AI 都改不掉的規則。放在 prompt 裡可以被說服，放在合約裡不行。每一次攔截都留下含風險分數的鏈上紀錄。

## 執行方式

```bash
pnpm install && cp .env.example .env   # 填入 OpenAI key 與測試金鑰
pnpm compile && pnpm fund && pnpm deploy
pnpm dev                                # http://localhost:3000 阿嬤 · /family 家人
pnpm test && pnpm typecheck && pnpm smoke
```

完整的金鑰產生、水龍頭、環境變數與專案結構說明見 [SETUP.md](./SETUP.md)。

## 預先開發揭露與素材來源

| 類別 | 內容 |
|---|---|
| 賽前準備 | 無既有程式碼，全部於 2026/09/04–06 賽期內完成 |
| 模型 | OpenAI `gpt-realtime-2.1-mini`、`gpt-5.6-luna`、`gpt-4o-mini-transcribe` |
| 資料 | 165 全民防騙網公開宣導資料整理成的詐騙手法清單（`lib/shield/patterns.ts`，政府資料開放授權） |
| 開源套件 | Next.js、React、viem、zod、solc-js、tsx、vitest、ffmpeg-static |
| 字型 | Noto Sans TC（SIL OFL 1.1） |
| 程式碼與豆豆 | 本隊伍，MIT |

## 隊伍

| 成員 | 負責 |
|---|---|
| Nelson | 語音代理人、詐騙防護盾 |
| Kun | 智慧合約、家人共簽 |
| Eric | 前端、豆豆、影片、簡報 |

## 下一步

- 家人用自己的 passkey 或錢包簽核准，不再由伺服器保管金鑰。
- 高風險通話直接轉接 165 反詐騙專線。
- 台語、客語原生語音。
- 家人都不在線時，提案冷卻 24 小時後可由阿嬤本人到分行解鎖。
- 串接銀行託管帳戶，銀行成為共簽人之一。

## 附：Track 04 科幻音樂 MV

同隊另外參加 CSFCCA LIVE AI「02 科幻音樂 MV」《從第一個 Prompt 到最後一個鏡頭》，與主作品各自獨立評選。9 鏡 × 15 秒對應官方歌曲，使用官方角色 LUNA、志奇與 X 系列機器人，以 Wan 3.0 image-to-video 生成。成片：https://www.youtube.com/watch?v=PeaZ5_VBIjs 。分鏡、Prompt 與生成紀錄在 `film/`，官方素材與成片檔案不入庫。

MIT License © 2026 阿嬤的錢包團隊
