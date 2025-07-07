from sqlalchemy.ext.asyncio import AsyncSession
from app.users.models import User
from .schemas import UserCreate, UserUpdate
from sqlalchemy import select
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def create_user_in_db(db: AsyncSession, user: UserCreate):

    hashed_pw = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw,
        is_staff=user.is_staff
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalars().first()

async def get_user(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)

async def update_user(db: AsyncSession, user_id: int, user_update: UserUpdate) -> User | None:
    db_user = await db.get(User, user_id)
    if db_user:
        for key, value in user_update.dict(exclude_unset=True).items():
            if key == "password" and value:
                setattr(db_user, "hashed_password", hash_password(value))
            else:
                setattr(db_user, key, value)
        await db.commit()
        await db.refresh(db_user)
    return db_user