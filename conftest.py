"""
Global pytest configuration for KapasSetu AI.
Ensures a clean database state for every test so that tests can be run individually or all together.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))

os.environ["USE_SQLITE_FALLBACK"] = "True"
os.environ["SQLITE_URL"] = f"sqlite:///{(BACKEND_DIR / 'test_shared.db').as_posix()}"

from app.database import Base, engine
from app.main import seed_initial_vidarbha_ecosystem


@pytest.fixture(autouse=True)
def reset_db_state():
    """Reset and re-seed the Vidarbha database state before every test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_vidarbha_ecosystem()
    yield
