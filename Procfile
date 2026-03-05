# FastAPI backend (dashboard)
web: uvicorn asgi:app --host 0.0.0.0 --port ${PORT}

# Discord bot process
worker: python bot.py

# Frontend (React/Vue app)
frontend: npm run build --prefix frontend && npx serve -s frontend/build