from __future__ import annotations

import json


def test_event_bus_matches_wildcards_persists_and_bounds_history(tmp_path, monkeypatch) -> None:
    from nova.node.event_bus import EventBus

    monkeypatch.setenv("NOVA_NODE_RUNTIME_DIR", str(tmp_path))
    seen = []
    bus = EventBus(channels=["tool.*", "governance.*"], max_events=2)
    bus.subscribe("tool.*", seen.append)

    bus.emit("tool.invoked", "started", {"tool_name": "code"})
    bus.emit("governance.receipt_verified", "verified", {"trace_id": "trace-1"})
    bus.emit("tool.completed", "completed", {"tool_name": "code"})

    assert [event.channel for event in seen] == ["tool.invoked", "tool.completed"]
    assert [event.channel for event in bus.history()] == ["governance.receipt_verified", "tool.completed"]
    assert [event.channel for event in bus.history("tool.")] == ["tool.completed"]

    lines = (tmp_path / "event-bus.jsonl").read_text(encoding="utf-8").splitlines()
    persisted = [json.loads(line) for line in lines]
    assert [event["channel"] for event in persisted] == [
        "tool.invoked",
        "governance.receipt_verified",
        "tool.completed",
    ]


def test_node_event_and_feature_manifest_routes(tmp_path, monkeypatch) -> None:
    from fastapi.testclient import TestClient
    import nova.api as nova_api
    from nova.node.event_bus import get_event_bus

    monkeypatch.setenv("NOVA_NODE_RUNTIME_DIR", str(tmp_path))
    get_event_bus().emit("node.online", "health_check", {"status": "ok"})

    client = TestClient(nova_api.app)
    events = client.get("/node/events").json()
    manifest = client.get("/node/feature-manifest").json()

    assert events["events"][-1]["channel"] == "node.online"
    assert "governance.*" in events["channels"]
    assert manifest["manifest"]["modules"]["core"] == [
        "file_search",
        "symbol_search",
        "patch_manager",
        "terminal",
        "test_runner",
        "git_panel",
    ]
    assert "on_tool_invoked" in manifest["manifest"]["runtime"]["hooks"]
    assert "tool.*" in manifest["manifest"]["event_bus"]["channels"]


def test_status_lists_event_bus_surface(tmp_path, monkeypatch) -> None:
    from nova.node.status import node_status

    monkeypatch.setenv("NOVA_NODE_RUNTIME_DIR", str(tmp_path))

    status = node_status()

    assert "/node/events" in status["endpoints"]
    assert "/node/feature-manifest" in status["endpoints"]
    assert status["governance_health"]["event_bus_events"] == 0
