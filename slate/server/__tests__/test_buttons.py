"""Tests for button endpoints."""


def test_create_and_list_buttons(client, profile_id):
    """Create a button and verify it appears in the list."""
    payload = {
        "id": "btn-test-1",
        "label": "Test Button",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://example.com"},
    }
    
    # Create
    response = client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    assert response.status_code == 200
    assert response.json().get("status") == "created"
    
    # List and verify
    response = client.get(f"/api/buttons?profileId={profile_id}")
    assert response.status_code == 200
    
    buttons = response.json()["buttons"]
    assert any(b["id"] == "btn-test-1" for b in buttons)


def test_update_button(client, profile_id):
    """Update a button's label."""
    # Setup: create button
    payload = {
        "id": "btn-update",
        "label": "Original",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://old.com"},
    }
    client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    
    # Update
    payload["label"] = "Updated"
    response = client.put(f"/api/buttons/btn-update?profileId={profile_id}", json=payload)
    
    assert response.status_code == 200
    assert response.json()["button"]["label"] == "Updated"


def test_delete_button(client, profile_id):
    """Delete a button."""
    # Setup
    payload = {
        "id": "btn-delete",
        "label": "To Delete",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://delete.com"},
    }
    client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    
    # Delete
    response = client.delete(f"/api/buttons/btn-delete?profileId={profile_id}")
    
    assert response.status_code == 200
    assert response.json().get("status") == "deleted"


def test_duplicate_button_id_returns_409(client, profile_id):
    """
    Creating a button with duplicate ID returns 409 Conflict.
    
    Contract: routes.py raises HTTPException(status_code=409)
    """
    payload = {
        "id": "btn-dup",
        "label": "First",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://first.com"},
    }
    
    # First creation succeeds
    response = client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    assert response.status_code == 200
    
    # Second creation with same ID fails with 409
    response = client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    assert response.status_code == 409
