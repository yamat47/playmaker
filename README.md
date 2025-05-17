# Playmaker

Playmaker is a simple web-based tool for drawing American football plays.  
It uses HTML, CSS, and pure JavaScript to render a football field and player positions.  
This repository provides the foundation for building play diagrams and is designed to be extended or embedded as a view component.  
Data persistence and advanced features should be implemented in separate repositories.

## Features

- Renders an American football field in the browser
- Displays player positions as draggable circles (future extension)
- Pure HTML, CSS, and JavaScript (no frontend frameworks)
- Simple Node.js server for local development

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone this repository:

   ```sh
   git clone https://github.com/yamat47/playmaker.git
   cd playmaker
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

### Running the Demo

Start the local server:

```sh
node server.js
```

Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

You should see a football field with several player circles rendered.

## Project Structure

```
/playmaker
  ├── index.html      # Main HTML file
  ├── style.css       # Styles for field and players
  ├── main.js         # JavaScript for rendering players
  ├── server.js       # Express server for static files
  └── package.json    # Project dependencies
```

## License

MIT License
