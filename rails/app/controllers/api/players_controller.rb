class Api::PlayersController < ApplicationController
  def index
    players = [
      { id: "X", type: "player", position: { x: 100, y: 100 }, label: "X" },
      { id: "Z", type: "player", position: { x: 300, y: 100 }, label: "Z" }
    ]
    render json: players
  end
end
