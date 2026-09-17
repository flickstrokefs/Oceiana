ARIEL standalone Framer export

Run: npm install
Then: npm run dev
Open: http://localhost:5173

This uses the static serve package rather than Vite because the exported Framer runtime contains bundled .mjs files that should be served as-is.
