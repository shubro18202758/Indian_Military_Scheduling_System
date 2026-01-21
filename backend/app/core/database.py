from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# 1. Create the Async Engine
# This manages the connection pool to the PostgreSQL database.
engine = create_async_engine(settings.DATABASE_URL, echo=True)

# 2. Create Session Factory
# This is used to create new database sessions for each request.
SessionLocal = async_sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine, 
    class_=AsyncSession,
    expire_on_commit=False # Prevent attributes from expiring after commit (fixes MissingGreenlet error)
)

# 3. Define Base Class for Models
# All database models (tables) will inherit from this class.
class Base(DeclarativeBase):
    pass

# 4. Dependency Injection
# This function is used by FastAPI endpoints to get a database session.
# It ensures the session is closed after the request finishes.
async def get_db():
    async with SessionLocal() as session:
        yield session
