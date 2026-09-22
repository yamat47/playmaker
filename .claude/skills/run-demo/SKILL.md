---
name: run-demo
description: Playmaker の demo playground を Docker コンテナで起動し、ブラウザで表示・操作して変更を目視確認する。src/browser や demo/ の変更を実際の画面で確かめたいとき、demo を起動・スクリーンショットしたいとき、「動かして確認して」と言われたときに使う。
---

# demo を起動して目視確認する

dev サーバーは Docker の `dev` サービスで動く。ホストで `pnpm dev` は実行できない。

## 手順

1. 起動する。dev サーバーが応答を返すまで待ってから戻る（healthcheck）。すでに起動済みでも問題ない
   ```sh
   make up
   ```
2. `make up` が失敗したら `docker compose -f docker/compose.yaml logs --tail 50 dev` で原因を見る
   （`node_modules` が空なら `make install`、イメージが古ければ `make setup`）
3. ブラウザ（chrome-devtools MCP など）で http://localhost:5173/ を開き、変更箇所を操作して確かめる。
   コンソールエラーも確認する
4. ソースを編集すると自動でリロードされる（ホスト側の編集はポーリングで拾う）。
   `library/vite.config.ts` や依存を変えたときは `make down && make up`
5. 確認が終わったら、ユーザーが使い続けると言っていない限り `make down` で止める

## 注意

- ポート 5173 が使用中だと起動に失敗する（`--strictPort`）。Dev Containers 内で別に
  `pnpm dev` を動かしていないか確認する
- 目視確認はテストの代わりではない。振る舞いは `make test` で担保する（`.claude/rules/testing.md`）
