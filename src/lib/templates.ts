// src/lib/templates.ts
export type CodeFile = { contents: string };
export type Template = {
	files: Record<string, CodeFile>;
	entry: string;
	visibleFiles: string[];
};

export const VITE_REACT_TEMPLATE: Template = {
	files: {
		'App.jsx': {
			contents: `export default function App() {\n  const data = "world"\n  return <h1>Hello {data}</h1>\n}`
		},
		'index.jsx': {
			contents: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\n\nconst root = createRoot(document.getElementById("root"));\nroot.render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);`
		},
		'index.html': {
			contents: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/index.jsx"></script>\n  </body>\n</html>`
		},
		'package.json': {
			contents: `{\n    "scripts": {\n        "dev": "vite",\n        "build": "vite build",\n        "preview": "vite preview"\n    },\n    "dependencies": {\n        "react": "^18.2.0",\n        "react-dom": "^18.2.0"\n    },\n    "devDependencies": {\n        "@vitejs/plugin-react": "3.1.0",\n        "vite": "4.1.4",\n        "esbuild-wasm": "0.17.12"\n    }\n}`
		},
		'vite.config.js': {
			contents: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\n// https://vitejs.dev/config/\nexport default defineConfig({\n  plugins: [react()],\n});`
		}
	},
	entry: 'App.jsx',
	visibleFiles: ['App.jsx', 'index.jsx', 'index.html']
};
