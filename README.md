# Surebet Arbitrage Aggregator

This Apify actor aggregates unique bookmaker combinations (pairs, triples, etc.) from surebet opportunities and stores them in a persistent dataset on a daily schedule.

---

## Table of Contents

* [Features](#features)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Configuration](#configuration)
* [Local Testing](#local-testing)
* [Deployment](#deployment)
* [Usage](#usage)
* [Data Model](#data-model)
* [Logging](#logging)
* [License](#license)

---

## Features

* Executes on a daily cron schedule (Europe/Prague timezone).
* Calls a preconfigured surebet-scraper task to fetch raw opportunities.
* Generates all unique combinations of bookmakers (size ≥ 2).
* Deduplicates entries across runs using a SHA‑256 hash store.
* Captures event timestamps to distinguish same-day occurrences.
* Persists results in a long‑term Apify dataset.

---

## Prerequisites

* [Node.js](https://nodejs.org/) v16+ (tested with v24.4.0)
* [Apify CLI](https://sdk.apify.com/cli) v2+ for local development
* An existing Apify **Task** that runs the surebet-scraper (e.g., `oddspedia-scan-surebets`)

---

## Installation

1. Clone the repo:

   ```bash
   git clone <your-repo-url>
   cd surebet-arbitrage-aggregator
   ```
2. Install dependencies:

   ```bash
   npm install
   ```

---

## Configuration

1. Rename `.env.example` to `.env` and edit:

   ```ini
   SCRAPER_TASK_ID=your-scraper-task-id
   ```
2. Adjust schedule or other settings in [`actor.json`](./actor.json) if needed.

---

## Local Testing

Run the actor locally against your task:

```bash
# Build TypeScript
npm run build

# Provide an .env file or pass env directly
SCRAPER_TASK_ID=oddspedia-scan-surebets apify run --local --verbose
```

* Output dataset: `./apify_storage/datasets/default/items.json`
* State KVS: `./apify_storage/key_value_stores/STATE.json`

---

## Deployment

Push to Apify platform:

```bash
apify push
```

The actor will run daily at midnight Europe/Prague by default.

---

## Usage

Monitor runs and view aggregated data in the Apify console under **Actors → surebet-arbitrage-aggregator → Datasets**.

---

## Data Model

Each record in the dataset has:

* `brokers` — Array of bookmaker names (sorted lexicographically).
* `timestamp` — ISO‑8601 string of the event date/time.

Example:

```json
{
  "brokers": ["Bet365", "William Hill"],
  "timestamp": "2025-07-12T18:30:00Z"
}
```

---

## Logging

* **INFO**: High‑level progress (startup, counts, shutdown).
* **WARNING**: Unusual conditions (zero items, count mismatches).
* **DEBUG**: Detailed internal state (sample items, combination counts).

Configure log level via environment variable:

```bash
LOG_LEVEL=debug
```

---

## License
GNU General Public License v3.0
