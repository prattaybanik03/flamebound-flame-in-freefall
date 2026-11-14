# FlameBound web app

Next.js 16 app deployed on Vercel. See the [project README](../README.md) for what FlameBound does, the method and the data.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # BCMS engine, verdict and explanation tests (Node test runner)
npm run build   # production build
```

- Scoring engine: `src/lib/bcms.ts`. Cited 1 g vs microgravity evidence: `src/lib/verdict.ts`. Ranking explanations: `src/lib/explain.ts`.
- Data bundle: `public/data/flamebound.json`, built by `../scripts/build_app_data.py` from NASA PSI.
- Optional environment variable: copy `.env.example` to `.env.local`. No key is needed to run the app; rankings never call an SI model.
