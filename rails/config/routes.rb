Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  match "editor/*path", to: "spa#show", via: :all
end
