from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, config, providers, bot, conversations, wizard, faq, permissions, prompts, channel_providers, analytics, plugins, cost_tracking
import db

_bot_instance = None

def set_bot_instance(bot):
    global _bot_instance
    _bot_instance = bot

def get_bot_instance():
    return _bot_instance

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    await db.sync_env_to_db()
    yield
    await db.close_db()


def create_app() -> FastAPI:
    app = FastAPI(title="SparkSage API", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://sparksage-frontend-angel.vercel.app",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, tags=["auth"])
    app.include_router(config.router, prefix="/api/config", tags=["config"])
    app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
    app.include_router(bot.router, prefix="/api/bot", tags=["bot"])
    app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
    app.include_router(wizard.router, prefix="/api/wizard", tags=["wizard"])
    app.include_router(faq.router, prefix="/api/faqs", tags=["faq"])
    app.include_router(permissions.router, prefix="/api/permissions", tags=["permissions"])
    app.include_router(prompts.router, prefix="/api/prompts", tags=["prompts"])
    app.include_router(channel_providers.router, prefix="/api/channel-providers", tags=["channel-providers"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(plugins.router, prefix="/api/plugins", tags=["plugins"])
    app.include_router(cost_tracking.router, prefix="/api/cost_tracking", tags=["cost_tracking"])
    print("FAQ, Permissions, Prompts, Channel Providers, Analytics, and Plugins routers included in FastAPI")

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/faqs/health")
    async def faq_health():
        return {"status": "faq_ok"}

    @app.get("/api/permissions/health")
    async def permissions_health():
        return {"status": "permissions_ok"}

    return app
