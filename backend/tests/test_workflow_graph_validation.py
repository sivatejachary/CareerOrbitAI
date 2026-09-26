import pytest
from backend.app.services.workflow_validator import validate_workflow_graph
from backend.app.services.workflow_service import get_default_workflow_graph

def test_default_workflow_graph_is_valid():
    graph = get_default_workflow_graph()
    res = validate_workflow_graph(graph)
    assert res.is_valid is True
    assert len(res.errors) == 0
    assert res.node_count >= 5
    assert res.edge_count >= 5

def test_missing_start_node_fails():
    graph = get_default_workflow_graph()
    graph["nodes"] = [n for n in graph["nodes"] if n["type"] != "APPLICATION_RECEIVED"]
    res = validate_workflow_graph(graph)
    assert res.is_valid is False
    assert any("start step" in err.lower() for err in res.errors)

def test_missing_end_node_fails():
    graph = get_default_workflow_graph()
    graph["nodes"] = [n for n in graph["nodes"] if n["type"] != "END"]
    res = validate_workflow_graph(graph)
    assert res.is_valid is False
    assert any("terminal step" in err.lower() for err in res.errors)

def test_cycle_detection_fails():
    graph = get_default_workflow_graph()
    # Add a cycle: node_end -> node_start
    graph["edges"].append({"id": "e_cycle", "source": "node_end", "target": "node_start"})
    res = validate_workflow_graph(graph)
    assert res.is_valid is False
    assert any("cycle" in err.lower() or "transition" in err.lower() for err in res.errors)

def test_unreachable_node_fails():
    graph = get_default_workflow_graph()
    # Add an island node not connected to anything
    graph["nodes"].append({
        "id": "node_island",
        "type": "HR_REVIEW",
        "title": "Orphaned Review",
        "position": {"x": 500, "y": 500},
        "config": {}
    })
    res = validate_workflow_graph(graph)
    assert res.is_valid is False
    assert any("unreachable" in err.lower() for err in res.errors)

def test_duplicate_node_id_fails():
    graph = get_default_workflow_graph()
    dup_node = dict(graph["nodes"][0])
    graph["nodes"].append(dup_node)
    res = validate_workflow_graph(graph)
    assert res.is_valid is False
    assert any("duplicate node id" in err.lower() for err in res.errors)
