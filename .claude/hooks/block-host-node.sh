#!/bin/sh
# PreToolUse(Bash): ホストで Node ツールチェーンを直接叩くコマンドを止め、make を案内する。
# Node / pnpm はコンテナの中にしかないので、ホストで実行しても失敗するか、
# 別の版の Node で動いて darwin 用のバイナリを作ってしまう。

# Dev Containers の中で Claude Code を動かしている場合は素通しする
[ -n "$IN_CONTAINER" ] && exit 0

# heredoc の本文はコマンドではない（ファイルに書き出すドキュメントなど）ので判定から外す
commands=$(jq -r '.tool_input.command // empty' | awk '
  delim != "" { if ($0 == delim) delim = ""; next }
  { print }
  match($0, /<<-?[[:space:]]*["\047]?[A-Za-z_][A-Za-z0-9_]*/) {
    delim = substr($0, RSTART, RLENGTH)
    sub(/^<<-?[[:space:]]*["\047]?/, "", delim)
  }
')

# クォートの中も外す。docker run ... sh -c '...; pnpm ...' のようにコンテナへ渡す文字列や、
# commit メッセージの中身まで拾ってしまうため。複数行にまたがるクォートがあるので、行単位の
# sed ではなく全体を一度に読む perl で外す
# そのうえで、コマンドの先頭か ; & | ( の直後に現れたものだけを見る
# （make pnpm ARGS=... や docker compose run ... pnpm は通す）。env pnpm や FOO=1 pnpm のような
# 書き方は素通りする。誤って叩いたときに make へ誘導するためのもので、抜け道を塞ぐものではない
if printf '%s\n' "$commands" | perl -0pe "s/'[^']*'//gs; s/\"(?:[^\"\\\\]|\\\\.)*\"//gs" | grep -Eq '(^|[;&|(])[[:space:]]*(pnpm|npm|npx|node|corepack|vitest|tsc|biome|vite)([[:space:]]|$)'; then
  echo 'Node / pnpm はホストにありません。make 経由で実行してください（make check / make test / make pnpm ARGS="..." など。一覧は CLAUDE.md か make help）。' >&2
  exit 2
fi
exit 0
