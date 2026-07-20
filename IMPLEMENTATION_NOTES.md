# Issues 1–11: Implementation Notes

## 1. One simulation clock

FastAPI starts one server-owned background task in its lifespan. It advances the orchestrator every 100 ms and broadcasts snapshots. WebSocket clients only subscribe, so opening extra tabs does not speed up the simulation.

## 2. Public viewing, protected operation

Telemetry remains public. Login returns an operator JWT. Every endpoint that changes state or injects a transaction requires the JWT.

A database is intentionally not used for the hackathon's single operator account. JWT is the session proof; environment variables are the current credential source. A professional multi-user version should use a user database or external identity provider.

## 3. Secret removal

The Gemini integration and hardcoded key were removed from runtime code. The current MVP uses deterministic local explanations and needs no Gemini key.

## 4. Recoverable thermal failures

A crashed node no longer continues heating. It cools even while the anomaly flag remains active and recovers after reaching a safe temperature. The outage overlay no longer blocks the control panel, and emergency stop/reset actions are shown.

## 5. Non-blocking explanations

No external LLM call occurs in the 100 ms simulation loop. Thermal recommendations are generated locally and instantly from node state.

## 6. Fair AI-versus-legacy comparison

Each generated transaction is copied into both virtual clusters:

- identical seeded task stream
- identical node capacity
- identical processing decay
- identical thermal rules

Only routing and power-management policy differ. Telemetry reports measured p95 latency, failures, throughput, maximum temperature, active nodes, and cost for each cluster.

## 7. Real cost chart

The backend calculates `legacy_cost` and `optimized_cost`. The chart plots those values directly; it no longer invents random increments in the browser.

## 8. Why zero savings must not reset the chart

Zero savings is a valid business result. It can occur at startup, while both strategies cost the same, or before the AI strategy has created a measurable advantage.

The old chart treated `savedCost === 0` as proof that Reset was clicked. Because telemetry arrives repeatedly, the chart could erase itself again and again even though no reset happened.

The backend now owns a `run_id`. A real reset:

1. clears tasks, nodes, costs, failures, transaction counters, charts, and routing history;
2. increments `run_id`;
3. immediately broadcasts a fresh zero-state snapshot.

The frontend clears chart and animation history only when `run_id` changes. The `force_reset_ui` browser event still gives instant visual feedback while the reset request completes.

## 9. Why inferred particles were inaccurate

Previously the backend routed a task but did not tell the browser which node received it. The browser guessed:

- heavy AI task → Node 1
- light AI task → Node 2
- legacy task → random node

Those guesses became false when a node was overloaded, warning, crashed, or when the scaler was selected.

The backend now emits a routing event containing the actual AI destination and actual legacy destination. The canvas chooses the currently displayed strategy and animates the particle to that exact node. The manual transaction result displays the same destination, reason, and simulated latency.

## 10. Honest manual transaction language

Risk classification and routing are now separate concepts:

- The explainable risk engine produces a score, factors, risk level, and required workload.
- The selected routing strategy—AI or legacy—chooses the node.
- The response states the actual strategy, destination, routing reason, and latency.
- It never says “AI analyzed” when the live view is using legacy routing.
- Both AI and legacy route results are returned for side-by-side inspection.

## 11. Explainable scoring

The 12-row Random Forest demonstration was replaced with deterministic rules visible to judges. Example:

```text
Very large amount          +30
VPN / Tor origin           +35
Very new account           +20
High-risk MCC              +25
Total risk score           110
Decision                   Deep fraud-check path
```

This is an explainable MVP risk/workload classifier, not a claim of a production fraud model. A future production model should be trained and validated using representative labeled transaction data, then compared against this rules baseline.
