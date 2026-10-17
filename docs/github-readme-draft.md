# Big Evolution Model

An artificial life simulation with evolving neural agents, individual learning, and spatial memory in a hex-grid world.

Big Evolution explores how behavior develops through inherited neural parameters, mutation, individual experience, and competition for renewable food. Agents manage energy, carry and digest food, reproduce, and die in a shared environment. The browser interface lets you observe individuals, inspect their decisions, and compare experiments.

**Status:** experimental prototype · **Current implementation:** 0.31.3 · **Interface:** Russian.

## What is implemented

- A finite hex-grid world with rivers, lakes, food-source clusters, and scattered bushes.
- Neural action evaluation with an inherited genetic base and lifetime learning through Expected SARSA(λ).
- Personal short-term and long-term spatial memory. Offspring inherit genes; acquired experience and remembered locations remain individual.
- Visible food sources, including empty ones, and local perception of other agents.
- Energy expenditure, digestion, starvation, environmental injuries, reproduction, and a finite lifespan.
- Seeded experiments, genome exports and analysis, mechanism checks, and versioned performance benchmarks.
- One Web Worker for the main simulation, separate from the browser interface. Simulation updates themselves remain single-threaded.

The default world has 48×32 hexes, 150 founders, a population limit of 1,000, and 384 food sources. These are initial conditions and limits, not a guarantee of a stable population.

The current genome schema is v11: 975 neural parameters, 13 cognitive traits, and 2 inherited mutation regulators — 990 values in total.

## Run locally

From the repository root:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/).

The browser application uses JavaScript ES modules, HTML, CSS, and Canvas, with no external runtime libraries or required build step. Python is used here to serve static files and run development tools.

## Run checks

With Python 3, Node.js, and Git available:

```sh
python tools/verify-local.py
```

For a selected group:

```sh
python tools/verify-local.py --only static
python tools/verify-local.py --only mechanisms
```

Long experiments and full benchmark series are separate from the short local verification suite.

## Project layout

```text
dist/    Browser application and simulation modules
docs/    Model reference, architecture, decisions, and update protocols
tests/   Node.js tests
tools/   Verification, analysis, source export, and benchmark tools
```

The current project keeps its application source modules in `dist/`; this directory is served directly.

## Model and experiments

The model uses simplified physiology and ecology. Individual learning and genetic evolution are separate mechanisms. The long-term aim is to explore the emergence of social behavior, groups, and leadership; these are research directions, not implemented features.

Version 0.31.3 still uses discrete world steps and one immediate action per agent turn. Action durations, substeps, and a small inherited reconsideration network are under design. They are not part of this release.

For details, see the [current model reference](mechanics-reference.md), [architecture](architecture.md), [update history](updates/README.md), and [future time-model discussion](next-action-time.md). Most development documentation and explanatory code comments are currently in Russian.

## Development

Start with [START_HERE](START_HERE.md). Changes to model behavior should include a documented contract and mechanism checks. Performance changes should be assessed with comparable workloads and explicit version information.

---

Draft for review. Before moving this file to the repository root as `README.md`, prefix the documentation links above with `docs/`, choose a license, and add a real screenshot of the running world. No screenshot, license, GitHub release, or repository publication has been created by this draft.
