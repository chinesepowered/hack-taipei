# 執行與部署說明 Setup

完整的安裝、金鑰、部署、測試步驟。評審只想看作品介紹請回 [README.md](./README.md)。

## 環境需求

- Node.js 20+（開發時使用 24）、pnpm 9+（開發時使用 11）
- OpenAI API key
- 一把有 Base Sepolia 測試 ETH 的 agent 金鑰；家人金鑰可由 `pnpm fund` 自動補 gas

## 1. 安裝

```bash
git clone https://github.com/chinesepowered/hack-taipei.git
cd hack-taipei
pnpm install
cp .env.example .env
```

## 2. 環境變數（`.env`）

```bash
OPENAI_API_KEY=            # 必填：Realtime 語音代理人 + Scam Shield
REALTIME_MODEL=gpt-realtime-2.1-mini
REALTIME_VOICE=marin
SHIELD_MODEL=gpt-5.6-luna
SHIELD_BASE_URL=           # 選填：把 Scam Shield 指到其他 OpenAI 相容端點
SHIELD_API_KEY=            # 選填

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org   # 另有三個公開 RPC 自動備援
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.basescan.org
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

OWNER_PRIVATE_KEY=         # agent 金鑰（含 0x），部署合約並呼叫 pay / propose。勿用主網私鑰
GUARDIAN1_PRIVATE_KEY=     # 家人 1（媽媽）
GUARDIAN2_PRIVATE_KEY=     # 家人 2（孫子小凱）
NEXT_PUBLIC_WALLET_ADDRESS=      # pnpm deploy 之後填入；或直接用已部署的 0x6375461086204bd26700fa2ab2bec77f005d7a57
DAILY_LIMIT_USDC=200
GUARDIAN_THRESHOLD=2
```

產生測試金鑰：

```bash
node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts');for(const n of ['OWNER','GUARDIAN1','GUARDIAN2']){const k=generatePrivateKey();console.log(n+'_PRIVATE_KEY='+k+'  # '+privateKeyToAccount(k).address)}"
```

測試 ETH：https://portal.cdp.coinbase.com/products/faucet（給 OWNER 地址）。測試 USDC：https://faucet.circle.com（選 Base Sepolia，打進合約地址）。

## 3. 編譯、補 gas、部署合約

```bash
pnpm compile      # solc-js → lib/chain/GuardedWallet.json（不需要 Foundry）
pnpm fund         # 從 agent 金鑰轉 0.003 ETH 給兩位家人付 gas
pnpm deploy       # 部署到 Base Sepolia，並把常用聯絡人加入白名單
```

部署後把印出的 `NEXT_PUBLIC_WALLET_ADDRESS` 填回 `.env`。

## 4. 啟動

```bash
pnpm dev
```

- 阿嬤頁面：http://localhost:3000 （按「跟豆豆說話」，允許麥克風；預設「按住說話」模式，安靜房間可切「自動聽」）
- 家人共簽頁面：http://localhost:3000/family

## 5. 測試

```bash
pnpm test         # 詐騙防護盾規則層與聯絡人解析（vitest）
pnpm typecheck    # tsc
pnpm build        # Next.js production build
pnpm smoke        # 對已部署合約跑一次：提案 → 家人擋下 → 白名單小額付款
```

合約沒有本機 EVM 單元測試（環境無 Foundry），改以 `pnpm smoke` 在 Base Sepolia 上做端到端驗證。

## 專案結構

```
.
├── app/
│   ├── page.tsx                 # 阿嬤頁面：豆豆、風險條、錢包、對話、按住說話
│   ├── family/page.tsx          # 家人共簽頁面
│   ├── layout.tsx / globals.css
│   └── api/
│       ├── realtime/session/    # 發 Realtime client secret（含 persona、tools、turn 模式）
│       ├── shield/              # 詐騙風險評分
│       ├── wallet/balance/      # 鏈上餘額與額度
│       ├── wallet/pay/          # 直接付款或建立家人提案
│       └── proposals/           # 列表、單筆查詢、家人核准／擋下
├── components/
│   ├── Beagle.tsx               # 豆豆 SVG，六種表情
│   └── RiskMeter.tsx
├── lib/
│   ├── agent/instructions.ts    # 豆豆的 persona 與 tool 定義
│   ├── realtime/client.ts       # 瀏覽器端 WebRTC session、tool 執行、push-to-talk
│   ├── shield/                  # patterns.ts 規則層、assess.ts LLM 層、測試
│   ├── chain/                   # viem client（RPC 備援）、合約呼叫（含重試）、編譯後 ABI
│   ├── contacts.ts              # 阿嬤的聯絡人與白名單
│   └── store.ts                 # 提案的鏈下說明（.data/proposals.json）
├── contracts/GuardedWallet.sol
├── scripts/                     # compile / fund / deploy / smoke / film / concept
├── film/                        # Track 04 音樂 MV：分鏡、生成紀錄、簡報、PDF 產生器
├── slides_en.html · slides_tw.html
├── DEMO.md                      # 3 分鐘台詞、評審問答、備援、2 分鐘影片分鏡
└── hackathon.md                 # 賽事資訊整理
```

## Track 04 音樂 MV 管線

```bash
pnpm film dry-run          # 印出所有 payload，不花錢
pnpm film submit-one 01    # 先送一鏡驗證
pnpm film submit           # 送出其餘、輪詢、下載（request id 即時落盤，不重複計費）
pnpm film stitch           # ffmpeg 串接 + 套官方音樂 → film/out/final.mp4
pnpm concept               # 創作理念 PDF → film/out/concept.pdf
```

需要 `.env` 的 `GMI_API_KEY`。官方素材放在 `film/assets/`（不入庫）。
