from fastapi import FastAPI, Depends
from app.users import routes as users
from app.devices import routes as devices, scan as deviceScan
from app.syslogs import events as syslogEvents, signals as syslogSignals, mnemonics, regex, rules as syslogRules, tags as syslogTags, statistics as syslogStatistics
from app.traps import events as trapEvents, signals as trapSignals, snmptrapoids, tags as trapTags, statistics as trapStatistics, rules as trapRules, mibs
from app.netflow import routes as netflow, statistics as netflowStatistics
from app.devices import status
from app.devices import config
from app.geolocation import routes as geolocation
from app.telemetry import routes as telemetry, rules as telemetryRules, signals as telemetrySignals
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
from app.auth.keycloak import get_current_user

from opensearchpy.exceptions import NotFoundError
from fastapi.responses import JSONResponse

load_dotenv()

Base = declarative_base()

logging.config.dictConfig(LOGGING_CONFIG)

app = FastAPI(
    dependencies=[Depends(get_current_user)]
)

@app.middleware("http")
async def expiration_middleware(request: Request, call_next):
    expiration_date = datetime(2027, 4, 18)
    now = datetime.now()

    if now >= expiration_date:
        return JSONResponse(
            status_code=403,
            content={"detail": "This application has expired as of April 18th, 2026."}
        )
    
    response = await call_next(request)
    return response

# Configure CORS
origins = [
    # Local development (HTTP)
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.201:3000",

    # Local development (HTTPS)
    "https://localhost:3000",
    "https://127.0.0.1:3000",
    "https://192.168.1.201:3000",

    # Production / deployment
    "https://192.168.1.201",
    "http://192.168.1.201",

    # Production / Traefik frontend
    "https://frontend.pristine-aiops.local",
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
app.include_router(deviceScan.router)

app.include_router(syslogEvents.router)
app.include_router(mnemonics.router)
app.include_router(regex.router)
app.include_router(syslogRules.statefulRules)
app.include_router(syslogRules.severityLevel)
app.include_router(syslogTags.router)
app.include_router(syslogStatistics.router)
app.include_router(syslogStatistics.signalsRouter)
app.include_router(syslogSignals.router)

app.include_router(trapEvents.router)
app.include_router(snmptrapoids.router)
app.include_router(trapTags.router)
app.include_router(trapStatistics.router)
app.include_router(trapStatistics.signalsRouter)
app.include_router(trapRules.router)
app.include_router(mibs.router)
app.include_router(trapSignals.router)
app.include_router(geolocation.router)

app.include_router(netflowStatistics.router)
app.include_router(netflow.router)

app.include_router(status.router)
app.include_router(config.router)
#app.include_router(signals.router)

app.include_router(telemetry.router)
app.include_router(telemetryRules.router)
app.include_router(telemetrySignals.router)

async def create_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("startup")
async def startup_event():
    await create_tables(engine)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

@app.middleware("http")
async def expiration_middleware(request, call_next):
    try:
        response = await call_next(request)
        return response

    except NotFoundError as e:
        # ✅ Handle OpenSearch missing index globally
        if "index_not_found_exception" in str(e):
            return JSONResponse(
                status_code=200,
                content={
                    "results": [],
                    "total": 0,
                    "message": "Index does not exist yet"
                }
            )

        raise

    except Exception as e:
        # optional debug
        print("Unhandled error:", repr(e))
        raise