# 阿嬤的錢包 Grandma's Wallet

> 在詐騙集團拿到錢之前，先接起電話的 AI 代理人。

**BUILDMODE GEN-AI HACKATHON 2026 · FUTUREMODE × SITCON**
主賽道：Track 02 AI for Everyday Life 日常生活 AI
贊助商挑戰：國泰金控 Cathay Financial — AI Agent × 區塊鏈金融

| 項目 | 連結 |
|---|---|
| 評選影片（2 分鐘） | _TODO：YouTube 連結_ |
| 作品展示網址 | _TODO：Demo 網址_ |
| 鏈上錢包合約（Base Sepolia） | _TODO：BaseScan 連結_ |
| 授權 | MIT（見 [LICENSE](./LICENSE)） |

## 隊伍

| 成員 | 負責 |
|---|---|
| _TODO_ | 語音代理人、詐騙偵測 |
| _TODO_ | 智慧合約、家人共簽 App |
| _TODO_ | 前端、影片、簡報 |

---

## 一、問題

台灣每年因詐騙造成的財損超過新台幣 500 億元（來源：內政部警政署 165 打詐儀錶板，簡報前請再次核對最新數字）。受害最深的是長輩：

- 「阿嬤，我是你孫子，我出事了，今天一定要匯 30 萬。」這類假冒親友、假冒檢警的電話，長輩在慌張之下往往直接跑去 ATM。
- 家人通常在錢已經匯出之後才知道。
- 銀行的防詐機制大多是「事後攔阻」，而且長輩看不懂 App 裡的英文警語與風險等級。

我們要解決的問題很單純：**讓長輩在付錢的那一刻，身邊有一個會講她的語言、會幫她踩煞車、而且錢真的動不了的人。**

## 二、解法

阿嬤的錢包是一個「用講的」錢包代理人，搭配一個上鏈的守護錢包合約：

1. **語音代理人**：長輩用手機或喇叭直接說「幫我轉 30 萬給阿明」，代理人用親切的中文（或台語）回應、確認、執行。
2. **詐騙防護盾 Scam Shield**：每一筆轉出前，LLM 會依 165 常見詐騙手法（假冒親友、假冒檢警、投資群組、猜猜我是誰⋯）給出風險分數。高風險交易會被暫停，代理人會用長輩聽得懂的方式解釋為什麼可疑，並主動提議「我幫你打給你孫子確認好不好？」
3. **守護錢包合約 GuardedWallet**：錢放在鏈上的智慧合約裡。設有每日額度、常用收款人白名單；超過額度或不在白名單的交易，必須由 2 位家人在鏈上共簽才會放行。**就算長輩被說服，錢也匯不出去。**
4. **家人共簽 App**：家人手機收到一鍵通知，看到代理人整理好的通話摘要與風險理由，按一下「核准」或「擋下」，簽章直接上鏈。

### Demo 流程（3 分鐘）

1. 評審扮演詐騙者打電話給「阿嬤」。
2. 阿嬤對代理人說要匯錢。
3. 代理人暫停交易、解釋風險，並請家人共簽。
4. 家人手機收到通知，按下「擋下」。
5. 打開 BaseScan，看到交易被合約拒絕；再示範一筆白名單內的小額付款順利完成。

---

## 三、系統架構

```
┌──────────────┐   語音（雙向即時）   ┌──────────────────────┐
│  阿嬤的手機   │ ◄─────────────────► │  語音代理人 Voice Agent │
│  (瀏覽器)    │                     │  OpenAI Realtime API   │
└──────────────┘                     │  (備援：Gemini Live)   │
                                     └──────────┬───────────┘
                                                │ tool call: pay / check / explain
                                                ▼
                                     ┌──────────────────────┐
                                     │  詐騙防護盾 Scam Shield │
                                     │  規則 + LLM 風險評分    │
                                     │  (165 詐騙手法知識庫)   │
                                     └──────────┬───────────┘
                                   低風險 ▼               ▼ 高風險
                        ┌──────────────────┐    ┌──────────────────┐
                        │ GuardedWallet.sol │◄───│  家人共簽 App     │
                        │ Base Sepolia      │    │  一鍵核准／擋下   │
                        │ USDC・每日額度     │    │  (wagmi + viem)  │
                        │ 白名單・2-of-N 共簽│    └──────────────────┘
                        └──────────────────┘
```

### 技術選型

| 層 | 技術 | 說明 |
|---|---|---|
| 前端 / 代理人服務 | Next.js 15、TypeScript、pnpm | 阿嬤介面、家人介面、API route |
| 即時語音 | OpenAI Realtime API（gpt-realtime） | 語音進、語音出，支援打斷與 function calling |
| 語音備援 | Gemini Live API（Flash 原生語音） | 若 OpenAI 額度或延遲有問題時切換 |
| 語音生成（影片用） | ElevenLabs（選用） | 複製隊員阿嬤的聲音做評選影片旁白 |
| 詐騙偵測 | LLM 結構化輸出 + 規則引擎 | 輸出 `risk_score`、`pattern`、`explanation_zh` |
| 區塊鏈 | Base Sepolia、Solidity、Foundry | `GuardedWallet.sol`，USDC 測試幣來自 Circle faucet |
| 錢包互動 | viem、wagmi | 家人簽章、讀取鏈上狀態 |

### 為什麼選 Base Sepolia

- 水龍頭最好拿：Coinbase Developer Platform faucet 每天可領測試 ETH，Circle faucet 可直接領 Base Sepolia 上的測試 USDC。
- EVM 相容、Gas 便宜、出塊快（2 秒），現場 Demo 不用等。
- BaseScan 可以直接秀給評審看被合約擋下的交易。

---

## 四、執行方式

### 環境需求

- Node.js 20+、pnpm 9+
- Foundry（`forge`、`cast`）
- 一個有 Base Sepolia 測試 ETH 的部署錢包

### 1. 安裝

```bash
git clone https://github.com/_TODO_/grandmas-wallet.git
cd grandmas-wallet
pnpm install
cp .env.example .env
```

### 2. 設定環境變數（`.env`）

```bash
OPENAI_API_KEY=            # 語音代理人（必填）
GEMINI_API_KEY=            # 語音備援（選填）
ELEVENLABS_API_KEY=        # 影片旁白（選填）

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=      # 部署合約用，勿用主網私鑰
NEXT_PUBLIC_WALLET_ADDRESS=      # 部署後填入 GuardedWallet 地址
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia USDC
```

### 3. 部署合約

```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

部署後把 `GuardedWallet` 地址填回 `.env`，並用 Circle faucet 領測試 USDC 轉進合約。

### 4. 啟動

```bash
pnpm dev
```

- 阿嬤介面：http://localhost:3000
- 家人共簽介面：http://localhost:3000/family
- 允許瀏覽器使用麥克風後，按下「跟阿嬤的錢包說話」即可開始。

### 5. 測試

```bash
pnpm test          # 前端與 Scam Shield 單元測試
cd contracts && forge test -vv   # 合約測試（額度、白名單、共簽）
```

### 專案結構

```
.
├── app/                 # Next.js App Router
│   ├── page.tsx         # 阿嬤介面（語音）
│   ├── family/          # 家人共簽介面
│   └── api/
│       ├── realtime/    # 語音代理人 session 與 tool 處理
│       └── shield/      # 詐騙風險評分
├── lib/
│   ├── shield/          # 規則 + prompt + 165 詐騙手法知識庫
│   └── chain/           # viem client、合約 ABI
├── contracts/           # Foundry 專案：GuardedWallet.sol
├── public/
├── slides_en.html       # 英文簡報
├── slides_tw.html       # 中文簡報
└── hackathon.md         # 賽事資訊整理
```

---

## 五、預先開發揭露

依大會規定，說明本作品使用的既有程式、模型、資料與第三方素材：

| 類別 | 內容 |
|---|---|
| 賽前準備 | 無既有程式碼；所有程式於 2026/09/04–09/06 賽期內完成 |
| 模型 | OpenAI gpt-realtime、（備援）Gemini Flash Live、（選用）ElevenLabs 語音 |
| 資料 | 165 反詐騙宣導公開資料整理而成的詐騙手法清單（`lib/shield/patterns.json`） |
| 開源套件 | Next.js、viem、wagmi、OpenZeppelin Contracts、Foundry |
| 區塊鏈 | Base Sepolia 測試網、Circle 測試 USDC |

## 六、素材來源與授權

| 素材 | 來源 | 授權 |
|---|---|---|
| 程式碼 | 本隊伍 | MIT |
| 詐騙手法清單 | 內政部警政署 165 全民防騙網公開資訊，由本隊整理 | 政府資料開放授權 |
| 圖示 | Lucide Icons | ISC |
| 字型 | Noto Sans TC（Google Fonts） | SIL OFL 1.1 |
| 影片旁白聲音 | 隊員家人授權複製之聲音 | 僅用於本作品 |

## 七、下一步

- 串接銀行 API 或國泰 CubeWallet 等真實帳戶，而不只是測試網。
- 高風險通話直接轉接 165 反詐騙專線。
- 台語、客語原生語音模型。
- 讓長輩的錢包能在沒有家人共簽的情況下，於冷卻期後自動解鎖，避免家人不在線時無法用錢。

## 授權

MIT License © 2026 阿嬤的錢包團隊
