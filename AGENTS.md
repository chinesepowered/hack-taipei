# 給人和 AI 代理的共同規則（隊伍自訂）

三個人加上 AI 編程代理一起推同一條 `main`，所以規則要短、要硬：

1. **官方素材不入庫。** 科幻協會／大腕影業的角色圖、歌曲、PDF 只能在本機 `film/assets/`、`film/refs/`，`.gitignore` 已排除，`*.zip` 也排除。若不小心 commit 了，要用 `git filter-repo` 從歷史移除，不是只 `git rm`。
2. **金鑰只在 `.env`。** `OWNER_PRIVATE_KEY`、兩把 `GUARDIAN*_PRIVATE_KEY`、`OPENAI_API_KEY` 不進程式碼、不進 commit、不進截圖。只有 `NEXT_PUBLIC_*` 可以到瀏覽器。
3. **推之前跑 `pnpm typecheck && pnpm test`。** 改到合約要另外跑 `pnpm test:chain`。
4. **不改別人正在動的檔案。** 合約、鏈層、語音層歸 Nelson；文件、測試、頁面狀態與樣式走 `polish/*` 分支開 PR。
5. **AI 代理寫的程式碼一律由人看過再 merge。** README 的預先開發揭露已註明使用 AI 編程代理；不要讓它變成不實陳述。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
