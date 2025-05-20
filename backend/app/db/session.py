# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from opensearchpy import OpenSearch

Base = declarative_base()

DATABASE_URL = "postgresql+asyncpg://PristineAdmin:PristinePassword@postgresql:5432/fpristine"

engine = create_async_engine(DATABASE_URL)

async_session_maker = sessionmaker(  # Renamed for clarity
    autocommit=False, autoflush=False, bind=engine, class_=AsyncSession
)

# Initialize OpenSearch client
opensearch_client = OpenSearch(
    hosts=[{'host': 'OpenSearch', 'port': 9200}],
    http_compress=True,  # enables gzip compression for requests
    use_ssl=False,
    verify_certs=False,
    ssl_show_warn=False,
    timeout=30
)

async def get_db():
    async with async_session_maker() as db:
        try:
            yield db
        finally:
            await db.close()