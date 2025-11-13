import pytest
from fastapi.testclient import TestClient

from src.app import app, activities


@pytest.fixture
def client():
    return TestClient(app)


def test_get_activities(client):
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    # should return the activities dict
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_and_unregister_flow(client):
    activity = "Chess Club"
    email = "tester@example.com"

    # ensure not already signed up
    if email in activities[activity]["participants"]:
        activities[activity]["participants"].remove(email)

    # signup
    resp = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp.status_code == 200
    assert email in activities[activity]["participants"]

    # signing up again should fail with 400
    resp2 = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp2.status_code == 400

    # unregister
    resp3 = client.delete(f"/activities/{activity}/unregister", params={"email": email})
    assert resp3.status_code == 200
    assert email not in activities[activity]["participants"]


def test_signup_invalid_activity(client):
    resp = client.post("/activities/NoSuchActivity/signup", params={"email": "a@b.com"})
    assert resp.status_code == 404


def test_unregister_invalid_activity(client):
    resp = client.delete("/activities/NoSuchActivity/unregister", params={"email": "a@b.com"})
    assert resp.status_code == 404
