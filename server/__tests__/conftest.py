"""Shared fixtures for server tests."""
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import build_app


@pytest.fixture
def client(tmp_path: Path):
    """Create a test client with isolated temporary database."""
    db_file = tmp_path / "test.db"
    tokens_file = tmp_path / "tokens.json"
    
    app = build_app(
        database_file=db_file,
        tokens_file=tokens_file,
        testing=True,
    )
    return TestClient(app)


@pytest.fixture
def profile_id(client):
    """
    Get or create a profile ID for tests.
    
    Defensive: validates response structure before accessing data.
    """
    response = client.get("/api/profiles")
    assert response.status_code == 200, f"Failed to get profiles: {response.text}"
    
    data = response.json()
    assert "profiles" in data, f"Unexpected response format: {data}"
    
    profiles = data["profiles"]
    if profiles:
        return profiles[0]["id"]
    
    # No profiles exist, create one
    response = client.post("/api/profiles", json={"name": "Test Profile"})
    assert response.status_code == 200, f"Failed to create profile: {response.text}"
    return response.json()["profile"]["id"]
