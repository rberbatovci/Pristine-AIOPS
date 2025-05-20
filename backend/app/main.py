from fastapi import FastAPI
from app.users import routes as users
from app.devices import routes as devices
from app.syslogs import routes as syslogs
from app.traps import routes as traps
from app.netflow import routes as netflow
from app.signals import routes as signals
from app.db.session import engine
from sqlalchemy.ext.asyncio import AsyncEngine
from fastapi.middleware.cors import CORSMiddleware
from app.core.logging import LOGGING_CONFIG
import logging.config
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

logging.config.dictConfig(LOGGING_CONFIG)

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000",  
    "http://localhost",
    "http://127.0.0.1:3000",
    "http://127.0.0.1",
    "http://192.168.1.191:3000",
    "http://192.168.1.191",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(devices.router)
app.include_router(syslogs.router)
app.include_router(traps.router)
app.include_router(netflow.router)
app.include_router(signals.router)

async def create_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("startup")
async def startup_event():
    await create_tables(engine)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)