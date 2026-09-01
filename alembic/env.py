import os
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
import asyncio
import os

from dotenv import load_dotenv

load_dotenv()
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so autogenerate can detect them
from app.db.session import Base
from app.models.user import User, RefreshToken  # noqa: F401

target_metadata = Base.metadata

# Read DATABASE_URL from environment (never from alembic.ini)
def get_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    # asyncpg does not accept libpq's sslmode parameter
    url = url.replace("?sslmode=require&channel_binding=require", "")
    url = url.replace("?sslmode=require", "")
    url = url.replace("&sslmode=require", "")
    url = url.replace("&channel_binding=require", "")

    return url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(
    get_url(),
    poolclass=pool.NullPool,
    connect_args={"ssl": "require"},
)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
