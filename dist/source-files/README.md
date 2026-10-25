# Big Evolution Model

English · [Русский](README.ru.md)

An artificial life simulation with evolving neural agents, individual learning, and spatial memory in a hex-grid world.

Big Evolution explores how behavior develops through inherited neural parameters, mutation, individual experience, and competition for renewable food. Agents manage energy, carry and digest food, reproduce, and die in a shared environment. The browser interface lets you observe individuals, inspect their decisions, and compare experiments. Version 0.52 adds an edge handle for statistics settings, local survival-curve controls and isolated chart updates. Calculations remain cached across tabs; paused worlds and completed experiments support background preparation. [Release notes](docs/updates/v052-local-chart-updates.md).

**Status:** experimental prototype · **Current implementation:** 0.54.11 · **Interface:** Russian.

0.54.11 explains automatic environment changes; handbook package A is complete. [Details](docs/updates/v054-guide-environment.md).

Patch 0.52.1 removes chart captions, including text generated on hover or point selection. Numerical tables and field help remain available. [Release notes](docs/updates/v052-no-chart-captions.md).

Version 0.49.0 adds compact chart templates with pinned settings. Dashboard filters and grouping remain shared; each editable template can override applicable birth periods, bin widths, life status and origin. Pins are saved in catalogue v2; existing v1 catalogues still load. World mechanics are unchanged. [User guide (Russian)](docs/analysis-builder-guide.md), [release notes](docs/updates/v049-chart-settings.md).

Version 0.46.0 adds digestion time per food portion to experiment settings and factors. Compare custom values, including combinations with genome sensitivities; the default remains 20 simulation steps. Compact `.beexp` archives and JSON import/export remain available. [Release notes](docs/updates/v046-digestion-experiments.md).

Version 0.44.0 adds genome files and optional numeric energy, health, and stomach sensitivity coefficients as experimental factors. Unspecified genes retain their original values; all combinations use the existing comparison tools. [Release notes](docs/updates/v044-genome-experiments.md).

Version 0.41.0 adds population statistics, approximate confidence bands, comparison histograms, and numerical summaries for the selected period. The statistics panel shares space with charts; large experiment JSON exports are assembled in chunks with progress and error reporting. [Release notes](docs/updates/v041-statistics-bands-export.md).

Version 0.40.0 groups experiment worlds by parameter combination, adds a single statistics panel opened by clicking, modal lifecycle notifications, and clear terrain/food/resident seed and export labels. [Interface update](docs/updates/v040-experiment-organization.md).

Version 0.37.1 keeps a fixed age scale while comparing survival cohorts and pins chart-line controls during scrolling. [Interface update](docs/updates/v037-fixed-survival-axis.md).

Version 0.37 adds whole-island movement and expanded behavioral and genetic statistics. Full world save/load is available in the top bar; automatic food changes are configured in the food-sources panel. See the [release notes](docs/updates/v037-moving-islands-statistics.md).

## What is implemented

- A finite hex-grid world with rivers, lakes, food-source clusters, and scattered bushes.
- Neural action evaluation with an inherited genetic base and lifetime learning through Expected SARSA(λ).
- Personal short-term and long-term spatial memory. Offspring inherit genes; acquired experience and remembered locations remain individual.
- Visible food sources, including empty ones, and local perception of other agents.
- Energy expenditure, digestion, starvation, timed actions, reproduction, and a finite lifespan.
- Seeded experiments, genome exports and analysis, mechanism checks, and versioned performance benchmarks.
- A simulation coordinator separate from the browser interface, with up to sixteen persistent workers for individual memory, attention, learning, and brain evaluation. The Performance panel offers Auto or 1 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 computation workers, including live switching without resetting the world; one retains sequential execution. Performance tests can compare one identical standard world across selected worker counts, with separate warmup, rotating order, full-result checks, and JSON export.

The default world has 48×32 hexes, 150 founders, a population limit of 1,000, and 384 food sources. These are initial conditions and limits, not a guarantee of a stable population.

The current genome schema is v14 with variable size. The main context starts with 4–6 hidden neurons and evolves a forward-only graph at birth; personal learning changes weights during life. Default growth limits are 64 hidden neurons and 4 layers. New genome/world files do not convert old saves; historical experiment results remain readable. [Release and usage](docs/updates/v053-structural-brain.md).

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

Version0.33.2 groups benchmark columns by version and worker count, runs each evaluator once per version, and reports speedup and scaling efficiency without automatic tuning. Central food periods are limited to10–300; sliders have larger round handles. [Release notes](docs/updates/v033-live-controls.md).

Version 0.34.0 exposes current activity counts on the seven visible hexes, including six movement directions relative to the observer. Observations share one boundary before decisions; identities, hidden body states and exact progress are excluded. This is an enabling mechanism for social behaviour, not a scripted flocking policy. Genome v12 is not converted. Benchmarks start a new model series; old JSON reports remain readable. [Release notes](docs/updates/v034-visible-activities.md).

Version 0.35.0 adds birth-cohort charts with minimum, median, mean and maximum, individual movement/eating rates, time-averaged inventory, reconsiderations, interruptions and survival to a selected age. A separate chart shows time-averaged food on the ground. The table is height-limited and paged. Observer counters do not change agent decisions or genome v13. [Details](docs/updates/v035-life-history-charts.md).

Version 0.37.0 adds whole-island food movement, reproduction and heritable-trait statistics, sensitivity distributions, potential food production and a four-substeps-per-second observation mode. [Release notes](docs/updates/v037-moving-islands-statistics.md).

Version 0.36.3 moves Play/Pause beside the main tabs and keeps the world running across sections. Life-history charts refresh while it runs; both automatic-food thresholds are 2 portions per model-time unit. [Release notes](docs/updates/v036-live-history.md).

Version 0.36.2 adds survival mean/median markers for completed lives, aligned help controls without pausing, and a question-based reference. [Release notes](docs/updates/v036-interface-help-survival.md).

Version 0.36.1 adds a wider panel with task screens, persistent world-save controls, a navigable reference, shared food controls and observation one substep every 0.5 seconds. [Release notes](docs/updates/v036-interface-screens.md).

Experiments: open **Опыты → Конструктор**, choose a template or configure parameter values (all combinations, up to 64 per seed; shared terrain seed 42), then start. Results use the shared **Статистика** page. Export results as a compact `.beexp` archive or plain JSON; import archives, JSON, or gzip JSON. Plans remain JSON. Completed attempts are stored in this browser as compressed blocks.
