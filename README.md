# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# Amortization Calculator - React App

Professional amortization calculator built with React, TypeScript, and Vite. Deployed on Netlify.

## Features

- Standard loan amortization calculations
- Balloon loan support with separate amortization and balloon terms
- Interest-only payment options
- Payment breakdown charts using Recharts
- Professional PDF export with clean layout
- JSON import/export for saving/loading loan scenarios
- Responsive design with TailwindCSS

## Live Demo

Visit the live application: [https://amortizationcalculator.netlify.app](https://amortizationcalculator.netlify.app)

## Development

This app uses:
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Recharts for data visualization
- Lucide React for icons

## Build and Deploy

```bash
npm install
npm run build
```

Automatically deploys to Netlify when pushed to the main branch.

## Technical Details

- PDF output optimized with print media queries
- Grid-based table layouts for professional loan documentation
- Date formatting in M/D/YYYY format
- Currency formatting with proper locale support
- Page breaks for multi-page PDF output

---

*Last updated: August 11, 2025 - Force rebuild for Netlify deployment*

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
