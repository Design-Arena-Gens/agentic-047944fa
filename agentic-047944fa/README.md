## Orion Agent Mission Control

Orion is a web-based autonomous operator that helps you define a mission goal, plan the work, and execute with AI-assisted reasoning. The dashboard keeps a running conversation, live plan tracking, and recommended next steps.

### Features
- Real-time chat interface with the autonomous agent (goal aware, conversation memory).
- Structured plan output that tracks progress and confidence.
- Suggested next actions and source attributions when available.
- Graceful offline fallback that generates heuristic plans if an OpenAI key is not provided.

### Prerequisites
- Node.js 18.17 or newer.
- Optional: `OPENAI_API_KEY` if you want full model-powered reasoning. Without it Orion switches to a rule-based fallback.

### Local Development
```bash
npm install
OPENAI_API_KEY=your-key npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Environment Variables
Create a `.env.local` file:
```bash
OPENAI_API_KEY=sk-...
# Optional override for the deployed model
OPENAI_MODEL=gpt-4o-mini
```

### Production Build
```bash
npm run build
npm run start
```

### Deployment
The project is optimised for Vercel:
```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-047944fa
```

After deployment verify:
```bash
curl https://agentic-047944fa.vercel.app
```

### Tech Stack
- Next.js App Router + TypeScript
- Tailwind CSS UI with glassmorphism accents
- OpenAI SDK (with deterministic JSON contract)

### Notes
- Responses are parsed as JSON – the system prompt instructs the model to obey the schema. If parsing fails, Orion falls back to the local heuristic planner.
- All state lives client-side; reset the session by refreshing the page.
