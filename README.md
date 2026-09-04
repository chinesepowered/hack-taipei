# 阿嬤的錢包 Grandma's Wallet

> 在詐騙集團拿到錢之前，先接起電話的 AI 代理人。拒絕不是寫在提示詞裡，是寫在智慧合約裡。

**BUILDMODE GEN-AI HACKATHON 2026 · FUTUREMODE × SITCON**
主賽道：Track 05 AI for Taiwan / Social Impact 台灣與社會影響
贊助商挑戰：國泰金控 Cathay Financial — AI Agent × 區塊鏈金融

| 項目 | 連結 |
|---|---|
| 評選影片（2 分鐘） | _錄製中，9/5 晚上上傳後補連結_ |
| 作品展示網址 | 無（本機 Demo；部署版須先設定 `DEMO_KEY`，見執行方式） |
| 鏈上錢包合約（Base Sepolia） | [0x6375461086204bd26700fa2ab2bec77f005d7a57](https://sepolia.basescan.org/address/0x6375461086204bd26700fa2ab2bec77f005d7a57) |
| 授權 | MIT（見 [LICENSE](./LICENSE)） |
| Demo 腳本與備援 | [DEMO.md](./DEMO.md) |

## 隊伍

**T162 Chill Agents**

| 成員 | 負責 |
|---|---|
| Nelson Lai（[chinesepowered](https://github.com/chinesepowered)） | 語音代理人、詐騙防護盾、GuardedWallet 合約、家人共簽頁面、Track 04 影片生成管線 |
| Kun / Han Min Thu（[buzzboyekh](https://github.com/buzzboyekh)） | 產品方向與賽道策略、評選影片旁白、文件、測試與穩定性修補 |
| Eric 千緯 | 家人共簽手機 Demo、現場展示與簡報 |

## 摘要（100–200 字）

台灣每年詐騙財損超過新台幣 500 億元，受害最深的是長輩：假冒孫子、假冒檢警的一通電話，就能讓她慌張地跑去匯款，家人往往事後才知道。阿嬤的錢包是一個「用講的」錢包代理人「豆豆」：長輩開擴音，豆豆陪她一起聽電話；每一筆付款前，詐騙防護盾先用 165 反詐宣導整理出的手法規則比對，再由 LLM 給出風險分數和白話解釋。錢放在 Base 鏈上的 GuardedWallet 智慧合約裡：白名單、額度內直接付；其他一律變成提案，要兩位家人在鏈上核准才放行，一位就能擋下，額度只有家人能改。拒絕不是寫在提示詞裡，是寫在合約裡：就算阿嬤被說服，錢也匯不出去。

**Summary (EN).** Taiwan loses over NT$50 billion a year to fraud, and elders are hit hardest: one "Grandma, it's me, I'm in trouble" call sends her to the ATM before the family knows. Grandma's Wallet is a voice agent, 豆豆, that listens to the call with her. Before any payment, a Scam Shield scores the story against fraud patterns distilled from Taiwan's 165 anti-fraud hotline, then an LLM explains the risk in plain Taiwanese Mandarin. The money sits in a GuardedWallet contract on Base: allowlisted recipients within a daily limit pay directly; anything else becomes a proposal that needs two family guardians to approve on-chain, and any one can block. The refusal isn't a prompt. It's a smart contract.

---

## 一、問題

台灣每年因詐騙造成的財損超過新台幣 500 億元（來源：內政部警政署 [165 打詐儀錶板](https://165dashboard.tw)，2024 年全年財損統計）。受害最深的是長輩：

- 「阿嬤，我是你孫子，我出事了，今天一定要匯 30 萬。」這類假冒親友、假冒檢警的電話，長輩在慌張之下往往直接跑去 ATM。
- 家人通常在錢已經匯出之後才知道。
- 銀行的防詐機制大多是事後攔阻，而且長輩看不懂 App 裡的警語與風險等級。

我們要解決的問題很單純：**讓長輩在付錢的那一刻，身邊有一個會講她的語言、會幫她踩煞車、而且錢真的動不了的人。**

## 二、解法

阿嬤的錢包是一個「用講的」錢包代理人「豆豆」（一隻米格魯），搭配一個上鏈的守護錢包合約：

1. **語音代理人 豆豆**：長輩用手機或喇叭直接說「幫我付 20 元給阿明」，豆豆用親切的台灣口語回應、確認、執行。把電話開擴音，豆豆會陪她一起聽。
2. **詐騙防護盾 Scam Shield**：每一筆付款前，先由規則層比對從 165 反詐宣導整理出的 9 類手法（假冒親友、假冒檢警、假投資、解除分期、假冒銀行、假中獎、感情詐騙、催促保密、不明收款帳戶），再由 LLM 結構化輸出風險分數與白話解釋。高風險交易會被暫停，豆豆用長輩聽得懂的方式解釋為什麼可疑，並主動提議「我幫你打給孫子確認好不好？」
3. **守護錢包合約 GuardedWallet**：錢放在鏈上的智慧合約裡。常用收款人白名單 + 每日額度內才能直接付；其他交易一律變成提案，要 2 位家人在鏈上核准才放行，任 1 位家人就能擋下。額度只有家人能改。**就算阿嬤被說服，錢也匯不出去。**
4. **家人共簽頁面**：家人手機看到豆豆整理好的判斷、來電者說了什麼，按一下「核准」或「擋下」，簽章直接上鏈。決定一出來，豆豆會立刻告訴阿嬤。

### Demo 流程（3 分鐘，完整台詞見 [DEMO.md](./DEMO.md)）

1. 阿嬤請豆豆付 20 元菜錢給阿明：低風險、直接付款、BaseScan 看得到。
2. 評審扮演詐騙者打電話給阿嬤，阿嬤請豆豆匯 30 萬給「孫子」。
3. 風險條衝紅、豆豆變擔心，解釋這像假冒親友，付款自動變成家人提案。
4. 家人手機按「擋下」，鏈上 `ProposalRejected`。
5. 豆豆主動告訴阿嬤「媽媽把那筆錢擋下來了，錢沒有動」。

---

## 三、系統架構

```
┌──────────────┐  WebRTC 雙向語音   ┌───────────────────────────────┐
│  阿嬤的手機   │ ◄───────────────► │  OpenAI Realtime               │
│  (瀏覽器)    │                   │  gpt-realtime-2.1-mini          │
│  豆豆 + 風險條│                   │  豆豆的耳朵、嘴巴、判斷            │
└──────┬───────┘                   └─────────────┬─────────────────┘
       │ POST /api/realtime/session 只發短效 client secret │ function calls
       │ 瀏覽器代為執行 tool，金鑰不離開伺服器      ▼
       ├──── POST /api/shield ────► ┌───────────────────────────────┐
       │                            │  詐騙防護盾 Scam Shield          │
       │                            │  規則層 (9 類手法) + gpt-5.6-luna  │
       │                            │  structured output               │
       │                            └───────────────────────────────┘
       ├──── POST /api/wallet/pay ─►┌───────────────────────────────┐
       │                            │  GuardedWallet.sol               │
       │                            │  Base Sepolia · USDC              │
       │                            │  白名單 · 每日額度 · 2-of-N 共簽    │
       │                            └─────────────▲─────────────────┘
       │                                          │ approve / reject（伺服器代家人簽章，Demo 用）
       ├──── GET /api/wallet/balance (每 8 秒) ────┤
       └──── GET /api/proposals/:id (輪詢) ◄──── 家人共簽頁面 /family ── POST /api/proposals/:id
```

### 技術選型

| 層 | 技術 | 說明 |
|---|---|---|
| 前端 / API | Next.js 16（App Router）、TypeScript、pnpm | `/` 阿嬤頁面、`/family` 家人頁面、API routes |
| 即時語音與代理人 | OpenAI Realtime API（`gpt-realtime-2.1-mini`，WebRTC） | 語音進、語音出、可打斷、function calling；伺服器只發短效 client secret |
| 詐騙偵測 | 規則引擎 + `gpt-5.6-luna` structured outputs | 模型失敗時自動退回規則層，不會中斷 Demo。可用 `SHIELD_BASE_URL` 指到任何 OpenAI 相容端點 |
| 智慧合約 | Solidity 0.8、solc-js 編譯、viem 部署 | 不需要 Foundry，`pnpm compile` 直接出 ABI |
| 區塊鏈 | Base Sepolia、Circle 測試 USDC | 出塊 2 秒，水龍頭好拿，BaseScan 可即時展示 |
| 錢包互動 | viem | agent 與家人金鑰在伺服器端簽章（Demo 用），未來換成家人自己的 passkey / 錢包 |
| 吉祥物 | 手繪 SVG 米格魯「豆豆」 | 表情跟著代理人狀態變：聽、想、說、擔心、開心 |

### 為什麼選 Base Sepolia

- 水龍頭最好拿：Coinbase Developer Platform faucet 每天可領測試 ETH，Circle faucet 可直接領 Base Sepolia 上的測試 USDC。
- EVM 相容、Gas 便宜、出塊快，現場 Demo 不用等。
- BaseScan 可以直接秀給評審看被合約擋下的交易。

### 為什麼要區塊鏈

「拒絕」必須是阿嬤和 AI 都改不掉的規則。放在 prompt 裡可以被說服，放在合約裡不行。每一次攔截都有可稽核的鏈上紀錄，包含當時的風險分數。銀行可以把自己加進共簽人，變成一個託管型的守護錢包產品。

---

## 四、執行方式

### 環境需求

- Node.js 22+（使用 import attributes 與 `--env-file`；開發時使用 24）、pnpm 9+（開發時使用 11）
- 一把有 Base Sepolia 測試 ETH 的 agent 金鑰（家人金鑰可由 `pnpm fund` 自動補 gas）
- OpenAI API key

### 1. 安裝

```bash
git clone https://github.com/chinesepowered/hack-taipei.git
cd hack-taipei
pnpm install
cp .env.example .env
```

### 2. 設定環境變數（`.env`）

```bash
OPENAI_API_KEY=            # 必填：Realtime 語音代理人 + Scam Shield
REALTIME_MODEL=gpt-realtime-2.1-mini
REALTIME_VOICE=marin
SHIELD_MODEL=gpt-5.6-luna
SHIELD_BASE_URL=           # 選填：把 Scam Shield 指到其他 OpenAI 相容端點
SHIELD_API_KEY=            # 選填

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.basescan.org
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

OWNER_PRIVATE_KEY=         # agent 金鑰（含 0x），部署合約並呼叫 pay / propose。勿用主網私鑰
GUARDIAN1_PRIVATE_KEY=     # 家人 1（媽媽）
GUARDIAN2_PRIVATE_KEY=     # 家人 2（孫子小凱）
NEXT_PUBLIC_WALLET_ADDRESS=      # pnpm deploy 之後填入
DAILY_LIMIT_USDC=200
GUARDIAN_THRESHOLD=2
DEMO_KEY=                  # 選填：設了之後，付款與家人決定的 API 要帶同一把 key（部署到公網時必填）
```

只想看不想部署：把 README 上方的合約地址填進 `NEXT_PUBLIC_WALLET_ADDRESS`，不填任何私鑰，`pnpm dev` 之後 `/family` 與餘額都能唯讀顯示。

產生測試金鑰：

```bash
node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts');for(const n of ['OWNER','GUARDIAN1','GUARDIAN2']){const k=generatePrivateKey();console.log(n+'_PRIVATE_KEY='+k+'  # '+privateKeyToAccount(k).address)}"
```

### 3. 編譯、補 gas、部署合約

```bash
pnpm compile      # solc-js → lib/chain/GuardedWallet.json
pnpm fund         # 從 agent 金鑰轉一點 ETH 給兩位家人付 gas
pnpm deploy       # 部署到 Base Sepolia，並把常用聯絡人加入白名單
```

部署後把印出的 `NEXT_PUBLIC_WALLET_ADDRESS` 填回 `.env`，再到 https://faucet.circle.com 領測試 USDC 打進合約地址。

### 4. 啟動

```bash
pnpm dev
```

- 阿嬤頁面：http://localhost:3000 （按「跟豆豆說話」，允許麥克風）
- 家人共簽頁面：http://localhost:3000/family

### 5. 測試

```bash
pnpm test         # 詐騙防護盾規則層、模型失敗退回規則層、聯絡人解析（vitest，不需金鑰）
pnpm test:chain   # GuardedWallet 狀態機測試：對 Base Sepolia 新部署一個合約跑 2-of-2 核准、重複核准、非家人、超額、擋下後核准（需要 .env 金鑰與測試 ETH）
pnpm typecheck    # tsc
pnpm smoke        # 對已部署合約跑一次：提案 → 家人擋下 → 白名單小額付款
```

環境沒有 Foundry，合約測試以 viem 直接對測試網部署驗證，不是本機 EVM；`pnpm test` 本身不碰鏈。

### 專案結構

```
.
├── app/
│   ├── page.tsx                 # 阿嬤頁面：豆豆、風險條、錢包、對話
│   ├── family/page.tsx          # 家人共簽頁面
│   ├── layout.tsx / globals.css
│   └── api/
│       ├── realtime/session/    # 發 Realtime client secret（含 persona 與 tools）
│       ├── shield/              # 詐騙風險評分
│       ├── wallet/balance/      # 鏈上餘額與額度
│       ├── wallet/pay/          # 直接付款或建立家人提案
│       └── proposals/           # 列表、單筆查詢、家人核准／擋下
├── components/
│   ├── Beagle.tsx               # 豆豆 SVG，六種表情
│   └── RiskMeter.tsx
├── lib/
│   ├── agent/instructions.ts    # 豆豆的 persona 與 tool 定義
│   ├── realtime/client.ts       # 瀏覽器端 WebRTC session 與 tool 執行
│   ├── shield/                  # patterns.ts 規則層、assess.ts LLM 層、測試
│   ├── chain/                   # viem client、合約呼叫（含 RPC 延遲重試）、編譯後 ABI
│   ├── contacts.ts              # 阿嬤的聯絡人與白名單
│   └── store.ts                 # 提案的鏈下說明（.data/proposals.json）
├── contracts/GuardedWallet.sol
├── scripts/                     # compile / fund / deploy / smoke
├── slides_en.html · slides_tw.html
├── DEMO.md                      # 3 分鐘台詞、評審問答、備援
└── hackathon.md                 # 賽事資訊整理
```

---

## 五、預先開發揭露

依大會規定，說明本作品使用的既有程式、模型、資料與第三方素材：

| 類別 | 內容 |
|---|---|
| 賽前準備 | 無既有程式碼；所有程式於 2026/09/04–09/06 賽期內完成（第一個程式 commit 9/4 14:33）。開發過程使用 AI 編程代理（Claude Code、Codex）協助撰寫與審查，所有設計決策、合約邏輯與驗證由隊員負責 |
| 模型 | OpenAI `gpt-realtime-2.1-mini`（語音代理人）、`gpt-5.6-luna`（詐騙防護盾）、`gpt-4o-mini-transcribe`（對話字幕） |
| 資料 | 165 反詐騙宣導公開資料整理而成的詐騙手法清單（`lib/shield/patterns.ts`） |
| 開源套件 | Next.js、React、viem、zod、solc-js、tsx、vitest、ffmpeg-static（影片串接） |
| 影片生成 | GMI Cloud 上的 Wan 3.0 Video Prime（image-to-video），備援 wan2.7-i2v；僅用於 Track 04 MV |
| 區塊鏈 | Base Sepolia 測試網、Circle 測試 USDC |

## 六、素材來源與授權

| 素材 | 來源 | 授權 |
|---|---|---|
| 程式碼與豆豆 SVG | 本隊伍 | MIT |
| 詐騙手法清單 | 內政部警政署 165 全民防騙網公開資訊，由本隊整理 | 政府資料開放授權 |
| 字型 | Noto Sans TC、Inter（Google Fonts） | SIL OFL 1.1 |
| solc-js | ethereum/solc-js | MIT（編譯器本體 solc 為 GPL-3.0，僅作為建置工具，不隨作品散布） |
| ffmpeg-static | eugeneware/ffmpeg-static | 套件 MIT；內含 ffmpeg 二進位為 GPL/LGPL，僅作為建置工具 |
| Wan 3.0 Video Prime（GMI Cloud） | 影片生成 API | 依 GMI Cloud 服務條款；產出僅用於 Track 04 作品 |
| 官方角色 LUNA、志奇、X-01／02／03、指定歌曲《CSFCCA LIVE AI》 | 科幻協會 × 大腕影業 Track 04 素材包 | 主辦方所有，僅限本賽事使用與改作，不入庫、不散布；依規則，Track 04 作品之著作財產權讓與主辦方 |

## 附：Track 04 科幻音樂 MV《從第一個 Prompt 到最後一個鏡頭》

同隊另外參加 CSFCCA LIVE AI「02 科幻音樂 MV」。9 個鏡頭 × 15 秒，對應官方指定歌曲 2 分 14 秒，使用官方角色 LUNA、志奇與 X-01／X-02／X-03 機器人。以 GMI Cloud 的 Wan 3.0 Video Prime 生成（image-to-video，官方設定稿作第一幀），ffmpeg 串接並套上官方音樂。

- 分鏡與 Prompt：`film/storyboard.json`；生成紀錄（request id、版本比較）：`film/requests.json`
- 管線：`pnpm film dry-run | submit-one <id> | submit | poll | stitch`，創作理念 PDF：`pnpm concept`
- 官方素材依規範僅供本賽事使用，不入庫（`.gitignore` 排除 `film/assets/`、`film/refs/`、`*.zip`）；生成影片與 PDF 輸出於 `film/out/`（不入庫）
- MV 本身依 Track 04 規則著作財產權讓與主辦方；本 repo 內以 MIT 授權的是生成管線程式碼與分鏡，不含 MV 成品

## 七、下一步

- 家人用自己的 passkey 或錢包簽核准，不再由伺服器保管金鑰。
- 高風險通話直接轉接 165 反詐騙專線。
- 台語、客語原生語音。
- 家人都不在線時，提案冷卻 24 小時後可由阿嬤本人到分行解鎖。
- 串接銀行託管帳戶，銀行成為共簽人之一。

## 授權

MIT License © 2026 阿嬤的錢包團隊
