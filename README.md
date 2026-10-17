# Big Evolution Model

English · [Русский](README.ru.md)

An artificial life simulation with evolving neural agents, individual learning, and spatial memory in a hex-grid world.

Big Evolution explores how behavior develops through inherited neural parameters, mutation, individual experience, and competition for renewable food. Agents manage energy, carry and digest food, reproduce, and die in a shared environment. The browser interface lets you observe individuals, inspect their decisions, and compare experiments.

**Status:** experimental prototype · **Current implementation:** 0.33.0 · **Interface:** Russian.

## What is implemented

- A finite hex-grid world with rivers, lakes, food-source clusters, and scattered bushes.
- Neural action evaluation with an inherited genetic base and lifetime learning through Expected SARSA(λ).
- Personal short-term and long-term spatial memory. Offspring inherit genes; acquired experience and remembered locations remain individual.
- Visible food sources, including empty ones, and local perception of other agents.
- Energy expenditure, digestion, starvation, timed actions, reproduction, and a finite lifespan.
- Seeded experiments, genome exports and analysis, mechanism checks, and versioned performance benchmarks.
- A simulation coordinator separate from the browser interface, with up to four persistent workers for individual memory, attention, learning, and brain evaluation. New worlds offer Auto / 1 / 2 / 4 computation workers; one retains sequential execution.

The default world has 48×32 hexes, 150 founders, a population limit of 1,000, and 384 food sources. These are initial conditions and limits, not a guarantee of a stable population.

The current genome schema is v12: 1,376 main-brain parameters, 12 cognitive traits, 73 attention-network parameters, and 2 inherited mutation regulators — 1,463 values in total.

## Play in your browser

Open [Big Evolution Model](https://griseus4.github.io/big-evolution-model/) and click **«Наблюдать»** ("Observe"). No installation is needed; the simulation runs on your device.

## Run locally

1. Install Python 3.
2. Open a terminal in the extracted project folder and run:

   ```sh
   python -m http.server 8000 --bind 127.0.0.1 --directory dist
   ```

3. Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser.
4. Click **«Наблюдать»** ("Observe").

Keep the terminal open while using the application. Node.js is only required for development checks.

The browser application uses JavaScript ES modules, HTML, CSS, and Canvas, with no external runtime libraries or required build step. Python is used here to serve static files and run development tools.

## Run checks

With Python 3 and Node.js available, verify an extracted archive or a fresh repository:

```sh
python tools/verify-local.py --source-only
```

For a selected group:

```sh
python tools/verify-local.py --source-only --only static
python tools/verify-local.py --source-only --only mechanisms
```

The `--source-only` mode checks snapshot SHA-256 hashes and executable mechanisms; it explicitly skips comparison with historical Git commits and the Git working-tree diff. For the original repository with its complete history, use `python tools/verify-local.py` without this flag.

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

Version 0.32 uses discrete hexes and substeps, with timed actions and a small inherited attention network. Continuous space and continuous time remain a separate future direction.

For details, see the [current model reference](docs/mechanics-reference.md), [architecture](docs/architecture.md), [update history](docs/updates/README.md), and [future time-model discussion](docs/next-action-time.md). Most development documentation and explanatory code comments are currently in Russian.

## Development

Start with [START_HERE](docs/START_HERE.md). Changes to model behavior should include a documented contract and mechanism checks. Performance changes should be assessed with comparable workloads and explicit version information.

## Upload to GitHub

Unpack the distribution and upload the extracted project contents to the repository root. See [upload instructions](docs/github-upload.md). The ZIP contains source files, not Git history or hosting configuration.

## License

A license has not been selected for this release.


Version 0.32 adds ten substeps per time unit, action durations and interruption, a heritable attention network, and energy costs for decisions. Old genomes cannot initialize a new world. A population cap blocks new births from starting; births already underway may finish above it.

Version 0.33 parallelizes individual cognition while preserving the 0.32 model, genome schema, learning, and random-number order. The local release has not been published by this update. See [implementation and short measurements](docs/updates/v033-parallel-world.md).
