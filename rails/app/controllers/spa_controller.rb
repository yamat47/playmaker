# frozen_string_literal: true

# This controller handles the rendering of the single page application (SPA) for the Rails application.
class SpaController < ApplicationController
  def show
    render file: Rails.root.join("public", "spa", "spa-index.html")
  end
end
