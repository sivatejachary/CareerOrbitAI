from typing import List, Dict, Any, Set, Union
from collections import defaultdict, deque
from backend.app.schemas.workflow import WorkflowGraphData, WorkflowValidationResult

def validate_workflow_graph(graph_data: Union[WorkflowGraphData, Dict[str, Any]]) -> WorkflowValidationResult:
    if isinstance(graph_data, dict):
        nodes_raw = graph_data.get("nodes", [])
        edges_raw = graph_data.get("edges", [])
    else:
        nodes_raw = [n.model_dump() for n in graph_data.nodes]
        edges_raw = [e.model_dump() for e in graph_data.edges]

    errors: List[str] = []
    warnings: List[str] = []

    if not nodes_raw:
        return WorkflowValidationResult(
            is_valid=False,
            errors=["Workflow graph must contain at least one start and one end step."],
            node_count=0,
            edge_count=0
        )

    # 1. Unique Node Identifiers
    node_ids = set()
    node_map = {}
    for node in nodes_raw:
        nid = node.get("id")
        if not nid:
            errors.append("Every node must have a non-empty 'id'.")
            continue
        if nid in node_ids:
            errors.append(f"Duplicate node ID detected: '{nid}'. All node IDs must be unique.")
        node_ids.add(nid)
        node_map[nid] = node

    # 2. Start & Terminal Nodes
    start_nodes = [n for n in nodes_raw if n.get("type") == "APPLICATION_RECEIVED"]
    if len(start_nodes) == 0:
        errors.append("Missing required start step: Exactly one 'Application Received' step must be present.")
    elif len(start_nodes) > 1:
        errors.append(f"Multiple start steps detected ({len(start_nodes)}). Exactly one 'Application Received' step is allowed.")

    end_nodes = [n for n in nodes_raw if n.get("type") == "END"]
    if len(end_nodes) == 0:
        errors.append("Missing terminal step: At least one 'End' step must be present in the workflow.")

    # 3. Edge Integrity & Adjacency
    outgoing_edges = defaultdict(list)
    incoming_edges = defaultdict(list)

    for edge in edges_raw:
        src = edge.get("source")
        tgt = edge.get("target")

        if src not in node_ids:
            errors.append(f"Edge references invalid source node: '{src}'.")
        if tgt not in node_ids:
            errors.append(f"Edge references invalid target node: '{tgt}'.")

        if src in node_ids and tgt in node_ids:
            outgoing_edges[src].append(edge)
            incoming_edges[tgt].append(edge)

    # Start node cannot have incoming edges
    for sn in start_nodes:
        if len(incoming_edges[sn["id"]]) > 0:
            errors.append(f"Start step '{sn.get('title', sn['id'])}' cannot have incoming transitions.")

    # End nodes cannot have outgoing edges
    for en in end_nodes:
        if len(outgoing_edges[en["id"]]) > 0:
            errors.append(f"Terminal 'End' step '{en.get('title', en['id'])}' cannot have outgoing transitions.")

    # Non-terminal nodes must have at least one outgoing edge
    for nid, node in node_map.items():
        if node.get("type") != "END" and len(outgoing_edges[nid]) == 0:
            errors.append(f"Dead end detected: Step '{node.get('title', nid)}' has no outgoing transitions.")

    # 4. Reachability from Start Node (Forward traversal)
    if start_nodes:
        start_id = start_nodes[0]["id"]
        visited = set()
        queue = deque([start_id])
        visited.add(start_id)

        while queue:
            curr = queue.popleft()
            for edge in outgoing_edges[curr]:
                nxt = edge.get("target")
                if nxt and nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)

        unreachable = node_ids - visited
        if unreachable:
            for un_id in unreachable:
                un_title = node_map.get(un_id, {}).get("title", un_id)
                errors.append(f"Unreachable step: '{un_title}' (ID: {un_id}) cannot be reached from the start step.")

    # 5. Cycle Detection (Must be a Directed Acyclic Graph)
    # Retries belong to step policies, not arbitrary infinite graph loops
    in_degree = {nid: 0 for nid in node_ids}
    for src in outgoing_edges:
        for edge in outgoing_edges[src]:
            tgt = edge.get("target")
            if tgt in in_degree:
                in_degree[tgt] += 1

    zero_in = deque([nid for nid, deg in in_degree.items() if deg == 0])
    topo_visited_count = 0

    while zero_in:
        curr = zero_in.popleft()
        topo_visited_count += 1
        for edge in outgoing_edges[curr]:
            tgt = edge.get("target")
            if tgt in in_degree:
                in_degree[tgt] -= 1
                if in_degree[tgt] == 0:
                    zero_in.append(tgt)

    if topo_visited_count < len(node_ids):
        errors.append(
            "Cycle detected in workflow graph: The workflow contains an illegal loop. "
            "Graph transitions must form a directed acyclic process. Step retries must be configured via the step's retry policy."
        )

    # 6. Node-Specific Rules
    for nid, node in node_map.items():
        ntype = node.get("type")
        cfg = node.get("config", {})

        # Condition nodes
        if ntype == "CONDITION":
            edges_from_cond = outgoing_edges[nid]
            handles = [e.get("source_handle") for e in edges_from_cond]
            # Must have at least a default or true/false branch
            if not handles or not any(h in ["DEFAULT", "ELSE", "default", "else"] for h in handles if h):
                warnings.append(f"Condition step '{node.get('title', nid)}' is missing an explicit 'DEFAULT' fallback path.")

        # AI Calling nodes (Section 14)
        if ntype == "AI_CALLING":
            purpose = cfg.get("purpose") or "INITIAL_SCREENING"
            valid_purposes = [
                "INITIAL_SCREENING", "SCHEDULE_INTERVIEW", "RESULT_NOTIFICATION",
                "RESULT_AND_SCHEDULING", "INTERVIEW_REMINDER", "REQUEST_CLARIFICATION",
                "FINAL_SELECTION_NOTIFICATION"
            ]
            if purpose not in valid_purposes:
                errors.append(f"AI Calling step '{node.get('title', nid)}' has invalid communication purpose: '{purpose}'.")

            # Check template syntax
            tpl = cfg.get("first_message_template") or ""
            if tpl.count("{{") != tpl.count("}}"):
                errors.append(f"AI Calling step '{node.get('title', nid)}' has malformed variable brackets in opening template.")

            # Unsafe result announcements without approval
            if purpose in ["RESULT_NOTIFICATION", "RESULT_AND_SCHEDULING", "FINAL_SELECTION_NOTIFICATION"]:
                if not cfg.get("required_approval"):
                    warnings.append(
                        f"AI Calling step '{node.get('title', nid)}' announces hiring results without requiring explicit human approval."
                    )

            # Check outgoing fallback transitions
            edges_from_call = outgoing_edges[nid]
            if edges_from_call:
                handles = [e.get("source_handle") for e in edges_from_call]
                has_default = any(h in ["DEFAULT", "default", "OBJECTIVE_COMPLETED"] or not h for h in handles)
                if not has_default:
                    warnings.append(
                        f"AI Calling step '{node.get('title', nid)}' has no default or 'OBJECTIVE_COMPLETED' fallback transition."
                    )

    return WorkflowValidationResult(
        is_valid=(len(errors) == 0),
        errors=errors,
        warnings=warnings,
        node_count=len(nodes_raw),
        edge_count=len(edges_raw)
    )
