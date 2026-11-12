"""Data/configuration regression tests use synthetic personal data, never user data."""
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import config
import paths
from main import build_app


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for name in list(os.environ):
        if name.startswith("SLATE_"):
            monkeypatch.delenv(name)


def qa_data(monkeypatch, root):
    session = str(uuid4())
    data = root / session / "data"
    data.mkdir(parents=True)
    (data / ".slate-qa-session").write_text(session, encoding="utf-8")
    monkeypatch.setenv("SLATE_ENV", "qa")
    monkeypatch.setenv("SLATE_QA_SESSION", session)
    monkeypatch.setenv("SLATE_DATA_DIR", str(data))
    return data


def test_normal_defaults_and_explicit_override(monkeypatch, tmp_path):
    monkeypatch.setattr(paths, "is_frozen", lambda: False)
    assert paths.get_data_dir() == Path(paths.__file__).parent / "data"
    monkeypatch.setattr(paths, "is_frozen", lambda: True)
    assert paths.get_data_dir() == Path(paths.user_data_dir("Slate", appauthor=False))
    monkeypatch.setenv("SLATE_DATA_DIR", str(tmp_path / "custom"))
    assert paths.get_data_dir() == tmp_path / "custom"
    assert not (tmp_path / "custom").exists()


@pytest.mark.parametrize("override", [None, "", "relative/data"])
def test_qa_requires_explicit_absolute_data(monkeypatch, override):
    monkeypatch.setenv("SLATE_ENV", "qa")
    monkeypatch.setenv("SLATE_QA_SESSION", str(uuid4()))
    if override is not None:
        monkeypatch.setenv("SLATE_DATA_DIR", override)
    with pytest.raises(ValueError, match="absolute SLATE_DATA_DIR"):
        paths.get_data_dir()


def test_qa_requires_valid_session_and_matching_marker(monkeypatch, tmp_path):
    data = qa_data(monkeypatch, tmp_path)
    assert paths.get_data_dir() == data
    (data / ".slate-qa-session").unlink()
    with pytest.raises(ValueError, match="matching session marker"):
        paths.get_data_dir()
    monkeypatch.setenv("SLATE_QA_SESSION", "invalid")
    with pytest.raises(ValueError, match="UUID"):
        paths.get_data_dir()


def test_qa_refuses_personal_and_development_overlap(monkeypatch, tmp_path):
    monkeypatch.setattr(paths, "user_data_dir", lambda *args, **kwargs: str(tmp_path / "personal"))
    data = qa_data(monkeypatch, tmp_path / "personal")
    with pytest.raises(ValueError, match="overlaps"):
        paths.get_data_dir()
    monkeypatch.setenv("SLATE_DATA_DIR", str(Path(paths.__file__).parent / "data"))
    with pytest.raises(ValueError, match="overlaps"):
        paths.get_data_dir()
    monkeypatch.setenv("SLATE_DATA_DIR", str(tmp_path))
    with pytest.raises(ValueError, match="overlaps"):
        paths.get_data_dir()
    assert not (data / "slate.db").exists()


def test_qa_refuses_linked_persistent_files(monkeypatch, tmp_path):
    data = qa_data(monkeypatch, tmp_path)
    personal = tmp_path / "personal.db"
    personal.write_bytes(b"untouched")
    os.link(personal, data / "slate.db")
    with pytest.raises(ValueError, match="linked files"):
        paths.get_data_dir()
    assert personal.read_bytes() == b"untouched"


def test_qa_marker_cannot_silently_fall_back(monkeypatch, tmp_path):
    qa_data(monkeypatch, tmp_path)
    monkeypatch.delenv("SLATE_ENV")
    with pytest.raises(ValueError, match="requires SLATE_ENV=qa"):
        paths.get_data_dir()


def test_frozen_qa_build_cannot_fall_back_or_open_source_data(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "_slate_qa_build", True, raising=False)
    with pytest.raises(ValueError, match="QA sidecar requires"):
        paths.get_data_dir()
    protected = tmp_path / "source-data"
    monkeypatch.setattr(sys, "_slate_development_data_dir", str(protected), raising=False)
    qa_data(monkeypatch, protected)
    with pytest.raises(ValueError, match="overlaps"):
        paths.get_data_dir()


def test_config_requires_owner_and_keeps_all_persistence_in_qa(monkeypatch, tmp_path):
    data = qa_data(monkeypatch, tmp_path)
    command = [sys.executable, "-c", "import config; print(config.HOST); print(config.DATABASE_FILE); print(config.TOKENS_FILE)"]
    cwd = Path(paths.__file__).parent
    failed = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    assert failed.returncode != 0
    assert "Tauri-owned" in failed.stderr
    assert not (data / "slate.db").exists()
    for name, value in {"SLATE_OWNER": "tauri", "SLATE_INSTANCE_ID": "test-instance",
                        "SLATE_LIFECYCLE_TOKEN": "private", "SLATE_PARENT_PID": str(os.getpid())}.items():
        monkeypatch.setenv(name, value)
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=True)
    assert result.stdout.splitlines() == ["127.0.0.1", str(data / "slate.db"), str(data / "tokens.json")]


def test_importing_factory_opens_no_default_persistence(monkeypatch, tmp_path):
    monkeypatch.setenv("SLATE_DATA_DIR", str(tmp_path / "not-created"))
    subprocess.run([sys.executable, "-c", "import main"], cwd=Path(paths.__file__).parent, check=True)
    assert not (tmp_path / "not-created").exists()


def test_loopback_editor_origin_is_allowed(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "ENV", "qa")
    client = TestClient(build_app(tmp_path / "slate.db", tmp_path / "tokens.json"))
    response = client.options("/api/profiles", headers={
        "origin": "http://127.0.0.1:1420", "access-control-request-method": "POST",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1420"


def test_profile_mutations_and_tokens_are_isolated_across_repeated_sessions(monkeypatch, tmp_path):
    personal_dir = tmp_path / "synthetic-personal"
    personal = TestClient(build_app(personal_dir / "slate.db", personal_dir / "tokens.json", testing=True))
    personal.post("/api/profiles", json={"name": "Personal fixture"})
    token = personal.app.state.auth_service.issue_token()
    before = {p.name: p.read_bytes() for p in personal_dir.iterdir()}
    for _ in range(2):
        data = qa_data(monkeypatch, tmp_path)
        data = paths.get_data_dir()
        client = TestClient(build_app(data / "slate.db", data / "tokens.json", testing=True))
        assert client.get("/api/profiles").json() == {"profiles": []}
        profile = client.post("/api/profiles", json={"name": "QA"}).json()["profile"]
        assert client.put(f"/api/profiles/{profile['id']}", json={"name": "Edited QA"}).status_code == 200
        exported = client.get(f"/api/profiles/{profile['id']}/export").content
        assert client.post("/api/profiles/import", content=exported).status_code == 200
        assert client.delete(f"/api/profiles/{profile['id']}").status_code == 200
        assert not client.app.state.auth_service.validate_token(token)
        client.app.state.auth_service.issue_token()
    assert {p.name: p.read_bytes() for p in personal_dir.iterdir()} == before


def test_private_shutdown_rejects_other_sessions(monkeypatch, client):
    monkeypatch.setattr(config, "OWNER", "tauri")
    monkeypatch.setattr(config, "LIFECYCLE_TOKEN", "this-editor-only")
    stopped = []
    client.app.state.request_shutdown = lambda: stopped.append(True)
    for headers in ({}, {"x-slate-lifecycle-token": "another-editor"}):
        assert client.post("/api/lifecycle/shutdown", headers=headers).status_code == 403
    assert not stopped
    assert client.post("/api/lifecycle/shutdown", headers={"x-slate-lifecycle-token": "this-editor-only"}).status_code == 200
    assert stopped == [True]
    assert "token" not in client.get("/health").text.lower()


def test_personal_and_other_session_servers_reject_qa_mutations(monkeypatch, client):
    headers = {"x-slate-qa-session": "expected-session"}
    monkeypatch.setattr(config, "ENV", "prod")
    assert client.post("/api/profiles", headers=headers, json={"name": "QA"}).status_code == 409
    monkeypatch.setattr(config, "ENV", "qa")
    monkeypatch.setattr(config, "QA_SESSION", "another-session")
    assert client.post("/api/profiles", headers=headers, json={"name": "QA"}).status_code == 409
    assert client.get("/api/profiles").json()["profiles"] == []
    monkeypatch.setattr(config, "QA_SESSION", "expected-session")
    assert client.post("/api/profiles", headers=headers, json={"name": "QA"}).status_code == 200


def test_worker_exits_when_its_own_parent_dies(monkeypatch, tmp_path):
    parent = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    worker = None
    try:
        monkeypatch.setenv("SLATE_OWNER", "tauri")
        monkeypatch.setenv("SLATE_PARENT_PID", str(parent.pid))
        monkeypatch.setenv("SLATE_DATA_DIR", str(tmp_path / "worker"))
        worker = subprocess.Popen([
            sys.executable, "-u", "-c",
            "from lifecycle import watch_parent; import time; watch_parent(); print('ready', flush=True); time.sleep(30)",
        ], cwd=Path(paths.__file__).parent, stdout=subprocess.PIPE, text=True)
        assert worker.stdout.readline().strip() == "ready"
        parent.terminate()
        parent.wait(timeout=5)
        assert worker.wait(timeout=5) == 0
        assert not (tmp_path / "worker").exists()
    finally:
        for process in (worker, parent):
            if process is not None and process.poll() is None:
                process.kill()
                process.wait(timeout=5)
