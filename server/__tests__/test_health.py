"""Smoke tests for server health."""


def test_health_returns_200(client):
    """Server is up and responding."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_has_status_key(client):
    """Health response has expected structure."""
    response = client.get("/health")
    data = response.json()
    assert "status" in data
