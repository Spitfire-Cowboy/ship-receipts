# arXiv Research Map: Math & Reputation Foundations for Ship Receipts

**Date:** 2026-02-25
**Author:** Campion
**Scope:** Literature backing for local scoring engine, proof envelopes, and anti-gaming controls.

---

## Method

Queried ~2.95M arXiv paper metadata (ChromaDB, `nomic-embed-text` embeddings) across 8 search axes: reputation systems, Sybil resistance, anomaly detection in scoring, probabilistic calibration, verifiable logs, game-theoretic mechanism design, collusion detection, and Byzantine fault tolerance. Deduplicated and ranked by direct applicability.

---

## Paper Map (19 papers, 6 categories)

### Category 1: Reputation Systems

| ID | Title | arXiv | Year | Applicability |
|----|-------|-------|------|---------------|
| R1 | The Challenge of Decentralized Marketplaces | 1703.05713 | 2017 | Centralized vs decentralized trust architecture tradeoffs |
| R2 | A Reputation System for Multi-Agent Marketplaces | 1905.08036 | 2019 | Transaction-weighted ratings analogous to receipt scoring |
| R3 | Reputation Gaming in Stack Overflow | 2111.07101 | 2024 | Empirical taxonomy of 4 fraud types in dev reputation |
| R4 | Trust in Motion: Trust Ascendancy in OSS | 2210.02656 | 2022 | Time-varying trust models; contribution-to-trust pipeline |
| R5 | ARMS: Actor Reputation Metric Systems for OSS Supply Chain | 2505.18760 | 2026 | **Most directly relevant** — proposes exactly this kind of system |
| R6 | Sandi: Accountability and Anti-Manipulation | 2401.16759 | 2025 | Downvote-only reputation; integrity + anti-manipulation |

### Category 2: Trust Scoring Under Adversarial Behavior

Year column uses the first arXiv submission year for each paper.

| ID | Title | arXiv | Year | Applicability |
|----|-------|-------|------|---------------|
| R7 | The Influence of Trust Score on Cooperative Behavior | 1910.09895 | 2019 | Validates receipt-level (not aggregate-only) scoring |
| R8 | Decentralized Trust Management: Risk Analysis & Aggregation | 1909.11355 | 2019 | Sparse-to-global trust aggregation via transitive trust |
| R9 | Strategic Evaluation: Subjects, Evaluators, and Society | 2310.03655 | 2023 | Framework for gaming vs honest improvement distinction |
| R10 | Optimal Rating Design under Moral Hazard | 2008.09529 | 2020 | Scoring function robustness to strategic manipulation |

### Category 3: Anomaly / Fraud Detection

| ID | Title | arXiv | Year | Applicability |
|----|-------|-------|------|---------------|
| R11 | Trustworthy Anomaly Detection: A Survey | 2202.07787 | 2022 | Meta-trust: trusting the gaming-detection system itself |
| R12 | Graph-Based Fraud Detection Methods | 1910.11299 | 2022 | Receipt attestation graph → collusion subgraph detection |

### Category 4: Probabilistic Confidence / Proxy Metrics

| ID | Title | arXiv | Year | Applicability |
|----|-------|-------|------|---------------|
| R13 | Pareto Optimal Proxy Metrics | 2307.01000 | 2025 | Ship-receipt scores as proxies for builder quality |
| R14 | Choosing a Proxy Metric from Past Experiments | 2309.07893 | 2024 | Calibrating local score against long-term reputation |

### Category 5: Sybil Resistance / Collusion Detection

| ID | Title | arXiv | Year | Applicability |
|----|-------|-------|------|---------------|
| R15 | Sybil Detection using Graph Neural Networks (SYBILGAT) | 2409.08631 | 2024 | GAT-based Sybil detection on builder identity graph |
| R16 | Combating Collusion Rings is Hard but Possible | 2112.08444 | 2021 | Cycle detection for mutual-attestation collusion |
| R17 | Catch Me if I Can: Strategic Behaviour in Peer Assessment | 2010.04041 | 2020 | Statistical tests for attestor manipulation detection |

### Category 6: Verifiable Logs / Append-Only Ledgers

| ID | Title | arXiv | Year | Applicability |
|----|-------|-------|------|---------------|
| R18 | Automatic Verification of Transparency Protocols | 2303.04500 | 2023 | Formal verification for append-only receipt ledger |
| R19 | IA-CCF: Individual Accountability for Permissioned Ledgers | 2105.13116 | 2022 | Actor-level accountability even under system compromise |

---

## Cross-Reference Matrix

| Paper | Local Scoring Engine | Proof Envelopes | Anti-Gaming |
|-------|---------------------|-----------------|-------------|
| R2 Multi-Agent Reputation | X | | |
| R3 SO Gaming | | | X |
| R5 ARMS | X | X | X |
| R6 Sandi | | | X |
| R7 Trust Score Influence | X | | |
| R9 Strategic Evaluation | | | X |
| R10 Optimal Rating | X | | X |
| R12 Graph Fraud | | | X |
| R13 Pareto Proxy | X | | |
| R14 Proxy Metrics | X | | |
| R15 SYBILGAT | | | X |
| R16 Collusion Rings | | | X |
| R17 Strategic Peer | | | X |

---

## Decision Matrix: Adopt / Park / Reject

### Adopt Now (v1 implementation)

| Concept | Source | Implementation |
|---------|--------|----------------|
| Proof-depth weighted scoring | R2, R5 | Base scoring table already in game-loop spec |
| Time-decay with half-life | R4, R10 | `2^(-age/90)` decay in proof envelope reputation weight |
| Content-hash dedup | R18 | Already in proof-envelope schema |
| Minimum proof threshold (anti-slop) | R9, R10 | 6-point minimum already specified |
| Streak multiplier with ceiling | R10 | Cap at 2.0x to limit gaming surface |
| Integrity multiplier for signed/checksummed work | R5, R6 | 1.5x for valid content_hash + checksum |

### Park (v2 consideration)

| Concept | Source | Why Park |
|---------|--------|----------|
| Graph-based collusion detection | R12, R16 | Requires attestation data volume we don't have yet |
| GNN Sybil detection | R15 | Needs identity graph density; premature for MVP |
| Proxy metric calibration | R13, R14 | Needs ground-truth outcome data to calibrate against |
| Downvote-only reputation | R6 | Interesting design but requires social layer |
| Transitive trust propagation | R8 | Needs multi-hop attestation chains |

### Reject (not suitable)

| Concept | Source | Why Reject |
|---------|--------|------------|
| Full Byzantine consensus | R19 | Overkill for single-authority ledger in v1 |
| Privacy-preserving reputation | R6 (partial) | Public auditability is a core design principle |

---

## Model Shortlist for v1 Implementation

1. **Local scoring:** Additive proof-element points + multiplicative streak/integrity bonuses. Formula: `floor(base × streak_mult × integrity_mult)`. Already specified in game-loop-local-v1.

2. **Global reputation:** Exponential time-decay sum of verification-depth-weighted receipts. Formula: `Σ 2^(-age/90) × depth`. Already specified in proofofship-reputation-model-v1.

3. **Anti-gaming layer (v1):**
   - Content-hash dedup (replay guard)
   - Minimum proof threshold (anti-slop)
   - Attestation graph monitoring (flag exclusive pairs, small closed groups)
   - Public auditability (all inputs visible)
   - Private repo exclusion (depth = 0.0)

4. **Anti-gaming layer (v2 roadmap):**
   - Cycle-free attestation enforcement (R16)
   - Statistical manipulator detection (R17)
   - Graph anomaly detection on attestation network (R12, R15)
   - Proxy metric calibration loop (R13, R14)

---

## References

All papers available via `https://arxiv.org/abs/<id>`.
