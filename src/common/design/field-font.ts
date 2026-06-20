// フィールド描画（ヤード数字・選手ラベル）のフォントは同梱フォントに固定し、
// 外部からの差し替えを許さない（PRD 6.5 のテーマ可変対象は「色」のみ）。
// 実体は styles.css の @font-face が内部専用名 "Playmaker Saira" で定義する
// （サブセット woff2 を CSS へ inline）。未収録グリフのみ sans-serif へ逃がす。
//
// ctx.font は CSS var() を解釈できないため、レンダラはこの定数を直接書く。
// 色 CSS 変数と違いテーマ IF には載せない＝外部指定不可を型レベルで保証する。
export const FIELD_FONT_FAMILY = '"Playmaker Saira", sans-serif';
