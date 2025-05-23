Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    resources :players, only: [:index]
  end
  match "editor/*path", to: "spa#show", via: :all
end
