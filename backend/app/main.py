from fastapi import FastAPI
from app.users import routes as users
from app.devices import routes as devices
from app.syslogs import events as syslogEvents, signals as syslogSignals, mnemonics, regex, rules as syslogRules, tags as syslogTags, statistics as syslogStatistics
from app.traps import events as trapEvents, signals as trapSignals, snmptrapoids, tags as trapTags, statistics as trapStatistics, rules as trapRules, mibs
from app.netflow import routes as netflow
from app.devices import status
from app.devices import config
from app.geolocation import routes as geolocation
from app.telemetry import routes as telemetry
from app.db.session import engine
from sqlalchemy.ext.asyncio import AsyncEngine
from fastapi.middleware.cors import CORSMiddleware
from app.core.logging import LOGGING_CONFIG
import logging.config
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv
from fastapi import Request
from fastapi.responses import JSONResponse
from datetime import datetime

load_dotenv()

Base = declarative_base()

logging.config.dictConfig(LOGGING_CONFIG)

app = FastAPI()

@app.middleware("http")
async def expiration_middleware(request: Request, call_next):
    expiration_date = datetime(2025, 11, 3)
    now = datetime.now()

    if now >= expiration_date:
        return JSONResponse(
            status_code=403,
            content={"detail": "This application has expired as of October 1, 2025."}
        )
    
    response = await call_next(request)
    return response

# Configure CORS
origins = [
    "http://localhost:3000",  
    "http://localhost",
    "http://127.0.0.1:3000",
    "http://127.0.0.1",
    "http://192.168.1.201:3000",
    "http://192.168.1.201",
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

app.include_router(syslogEvents.router)
app.include_router(mnemonics.router)
app.include_router(regex.router)
app.include_router(syslogRules.router)
app.include_router(syslogTags.router)
app.include_router(syslogStatistics.router)
app.include_router(syslogSignals.router)

app.include_router(trapEvents.router)
app.include_router(snmptrapoids.router)
app.include_router(trapTags.router)
app.include_router(trapStatistics.router)
app.include_router(trapRules.router)
app.include_router(mibs.router)
app.include_router(trapSignals.router)
app.include_router(geolocation.router)

app.include_router(netflow.router)
app.include_router(status.router)
app.include_router(config.router)
#app.include_router(signals.router)
app.include_router(telemetry.router)

async def create_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("startup")
async def startup_event():
    await create_tables(engine)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)