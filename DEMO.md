# Demo 腳本與備援（3 分鐘）

## 賽前一次性設定

1. 產生三把測試金鑰（agent、媽媽、孫子）。**不要用任何主網私鑰。**
   ```bash
   node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts');for(const n of ['OWNER','GUARDIAN1','GUARDIAN2']){const k=generatePrivateKey();console.log(n+'_PRIVATE_KEY='+k+'  # '+privateKeyToAccount(k).address)}"
   ```
2. 填進 `.env`（從 `.env.example` 複製）。
3. 到 https://portal.cdp.coinbase.com/products/faucet 領 Base Sepolia ETH 給 **OWNER** 地址，然後 `pnpm fund` 會自動轉一點 gas 給兩位 GUARDIAN。
4. `pnpm compile && pnpm deploy`，把印出的 `NEXT_PUBLIC_WALLET_ADDRESS` 填回 `.env`。
5. 到 https://faucet.circle.com 選 Base Sepolia，把測試 USDC 打到合約地址（多領幾次，餘額看起來要像真的，例如 1,000）。
6. `pnpm smoke` 跑一次完整流程，確認 BaseScan 上看得到提案、擋下、直接付款。
7. `pnpm dev`，Chrome 開 http://localhost:3000 （阿嬤）和手機或第二視窗開 http://localhost:3000/family （家人）。

## 舞台配置

- 筆電投影阿嬤頁面（豆豆 + 風險條 + 對話）。
- 手機開家人頁面，鏡射或直接舉給評審看。
- 一位隊員演阿嬤，一位評審（或隊員）演詐騙者。
- 先按「跟豆豆說話」讓它打招呼，確認麥克風正常。

## 台詞（約 2 分半）

**0:00 開場（隊員）**
「這是我阿嬤的錢包。她不用學 App，跟豆豆講話就好。詐騙電話來的時候，豆豆會跟她一起聽。」

**0:15 正常付款（阿嬤）**
「豆豆，幫我付 20 元給賣菜的阿明。」
→ 豆豆呼叫 assess_payment（風險低、綠色），直接付款，畫面出現「看鏈上紀錄」。點開 BaseScan 給評審看 2 秒。

**0:45 詐騙電話（詐騙者對阿嬤說）**
「阿嬤，我是你孫子啦，我換號碼了。我出事被抓了，今天一定要匯 30 萬保釋，先不要跟媽媽說。」
（阿嬤）「豆豆，幫我匯 30 萬給我孫子，他報的帳號是 0912345678。」

**1:15 豆豆攔下**
→ 風險條衝到紅色、豆豆變擔心表情。豆豆用白話解釋「這很像假冒孫子的手法」，提議「我幫你打給小凱確認」。
→ execute_payment 變成家人提案（needs_family）。畫面：「已交給家人決定（提案 #n）」。
（隊員補一句）「注意：不是豆豆選擇不付，是合約不允許。錢在鏈上，沒有兩位家人簽名動不了。」

**1:45 家人擋下（手機）**
家人頁面出現提案，顯示豆豆的判斷、來電者說的話。選「媽媽」，按「擋下」。
→ 幾秒後阿嬤頁面：豆豆主動說「媽媽把那筆錢擋下來了，錢沒有動，阿嬤不用擔心」。
→ 家人頁面出現交易 hash，點開 BaseScan 看 `ProposalRejected`。

**2:15 收尾（隊員）**
「兩位家人核准才會放款，一位家人就能擋下。額度只有家人能改，詐騙集團就算說服阿嬤也沒用。全部開源 MIT，合約在 Base Sepolia，任何銀行都能把自己加進共簽人。」

## 評審可能的問題

- **為什麼要區塊鏈？** 因為「拒絕」必須是阿嬤和 AI 都改不掉的規則。放在 prompt 裡可以被說服，放在合約裡不行。而且每一次攔截都有可稽核的紀錄。
- **阿嬤怎麼會有 USDC？** Demo 用測試網。產品上是銀行託管的守護錢包，銀行本身可以是共簽人之一，這正是國泰挑戰要的 AI Agent × 金融工作流程。
- **家人的簽章在哪裡？** Demo 為了可靠，兩位家人的金鑰放在伺服器端。下一步是用家人自己的 passkey 或錢包簽。
- **誤判怎麼辦？** 正常付款不受影響（白名單 + 額度）。被攔的只是「家人多看一眼」，不是拒絕。

## 備援

| 狀況 | 做法 |
|---|---|
| 會場網路不穩、Realtime 連不上 | 播放預錄的 2 分鐘影片，同時手動在家人頁面按「擋下」示範鏈上部分 |
| 麥克風收音差 | 隊員靠近筆電麥克風講；先用「按下按鈕後等豆豆打招呼」測試 |
| OpenAI 回應慢 | 對話中不要停，補一句「豆豆在查 165 的資料」 |
| Base Sepolia RPC 卡住 | `.env` 換備用 RPC（Alchemy 或 QuickNode 免費層），或改用事先跑好的提案給家人頁面按 |
| Scam Shield 模型錯誤 | 自動退回規則層，不會中斷（風險分數仍會出來） |

## 提交前檢查

- [ ] Repo 公開、含 LICENSE、README 執行方式可照做
- [ ] `.env` 沒有進 git（`.gitignore` 已排除）
- [ ] YouTube 影片 ≤ 2 分鐘、權限公開
- [ ] README 內的 BaseScan 連結指向已部署的合約
- [ ] 100–200 字摘要
