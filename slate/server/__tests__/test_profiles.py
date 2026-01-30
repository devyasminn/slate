"""Tests for profile endpoints."""


def test_get_profiles_returns_list(client):
    """GET /api/profiles returns a profiles list."""
    response = client.get("/api/profiles")
    assert response.status_code == 200
    
    data = response.json()
    assert "profiles" in data
    assert isinstance(data["profiles"], list)
