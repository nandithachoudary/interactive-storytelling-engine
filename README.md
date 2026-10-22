# Interactive Storytelling Engine

A branching interactive storytelling platform built with Next.js, React, TypeScript, and Tailwind CSS. Explore stories, make choices that influence what happens next, discover different endings, and revisit earlier decisions.

## Features

- **Interactive branching stories** with choices that lead to different scenes and endings.
- **Reusable story engine** supporting conditional choices, state-dependent branches, and story progression.
- **Undo and replay** to revisit decisions and explore alternative paths.
- **Progress persistence** using browser local storage, with story-specific progress restoration.
- **Ending discovery** to track the endings you have reached.
- **Story library** with searchable stories and genre filters.
- **Story validation** to detect invalid scene references, unreachable scenes, and structural issues.
- **Automated tests** covering the engine, validation, state management, persistence, and player flows.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Zod
- Vitest

## Getting Started

### Prerequisites

Install [Node.js](https://nodejs.org/) and npm.

### Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/nandithachoudary/interactive-storytelling-engine.git
cd interactive-storytelling-engine
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Tests

Run the automated test suite:

```bash
npm test
```

## Production Build

Create a production build:

```bash
npm run build
```

## Project Structure

- `app/` — Next.js pages and application layout.
- `components/` — Story library, story details, and story player UI.
- `content/` — JSON story definitions.
- `engine/` — Story schema, runtime, state, history, conditions, and validation.
- `lib/` — Story library utilities and progress persistence.
- `public/` — Static assets.

## Adding Stories

Story content is stored as JSON files in the `content/` directory. Story definitions are validated against the engine's schema and graph validation rules.

## License

No license has been specified yet.
