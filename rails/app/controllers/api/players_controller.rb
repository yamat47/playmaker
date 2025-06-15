class Api::PlayersController < ApplicationController
  def index
    # アメフトのオフェンスフォーメーション（I-Formation）
    players = [
      # オフェンシブライン
      { id: "C", type: "player", position: { x: 450, y: 325 }, label: "C" },      # センター
      { id: "LG", type: "player", position: { x: 420, y: 325 }, label: "LG" },   # レフトガード
      { id: "RG", type: "player", position: { x: 480, y: 325 }, label: "RG" },   # ライトガード
      { id: "LT", type: "player", position: { x: 390, y: 325 }, label: "LT" },   # レフトタックル
      { id: "RT", type: "player", position: { x: 510, y: 325 }, label: "RT" },   # ライトタックル
      
      # スキルポジション
      { id: "QB", type: "player", position: { x: 450, y: 360 }, label: "QB" },   # クォーターバック
      { id: "FB", type: "player", position: { x: 450, y: 395 }, label: "FB" },   # フルバック
      { id: "HB", type: "player", position: { x: 450, y: 430 }, label: "HB" },   # ハーフバック
      
      # レシーバー
      { id: "WR1", type: "player", position: { x: 320, y: 325 }, label: "WR" },  # ワイドレシーバー（左）
      { id: "WR2", type: "player", position: { x: 580, y: 325 }, label: "WR" },  # ワイドレシーバー（右）
      { id: "TE", type: "player", position: { x: 540, y: 325 }, label: "TE" }    # タイトエンド
    ]
    render json: players
  end
end
