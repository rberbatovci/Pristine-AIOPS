# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from opensearchpy import OpenSearch
import redis
import os
from dotenv import load_dotenv

# Load .env for PostgreSQL and Redis only
load_dotenv()

Base = declarative_base()

# PostgreSQL
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB")

DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, class_=AsyncSession
)

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# OpenSearch multi-node (hardcoded)
opensearch_nodes = [
    {"host": "opensearch-node1", "port": 9200},
    {"host": "opensearch-node2", "port": 9200},
    {"host": "opensearch-node3", "port": 9200},
]

opensearch_client = OpenSearch(
    hosts=opensearch_nodes,
    http_compress=True,
    use_ssl=False,
    verify_certs=False,
    ssl_show_warn=False,
    timeout=30
)

# Dependency for FastAPI
async def get_db():
    async with async_session_maker() as db:
        try:
            yield db
        finally:
            await db.close()
