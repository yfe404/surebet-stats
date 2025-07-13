# Surebet Arbitrage Aggregator

This Apify actor aggregates unique bookmaker combinations (pairs, triples, etc.) from surebet opportunities, tracks their occurrence frequency, and stores them in a persistent dataset on a daily schedule.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Local Testing](#local-testing)
- [Deployment](#deployment)
- [Usage](#usage)
- [Data Model](#data-model)
- [Logging](#logging)
- [License](#license)

---

## Features

- **Scheduled Execution**: Runs daily at midnight in the Europe/Prague timezone.
- **Task-Based Input**: Calls a preconfigured scraper **Task** (`oddspedia-scan-surebets`)—no runtime input needed.
- **Combination Extraction**: Generates all unique, order‑insensitive bookmaker combinations (size ≥ 2) per event.
- **Deduplication**: Uses a SHA‑256 hash store (`STATE` key‑value store) to avoid reprocessing the same event-timestamp combination.
- **Frequency Tracking**: Maintains occurrence counts for each bookmaker combination in a separate `COUNTS` key‑value store.
- **Persistent Storage**: Appends new combinations with timestamps into the default dataset for long‑term analysis.

---

## Prerequisites

- **Node.js** v16+ (tested with v24.4.0)
- **Apify CLI** for local development and testing
- An existing Apify **Task** called `oddspedia-scan-surebets` (or similar) that scrapes surebet data and writes to its default dataset

---

## Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd surebet-arbitrage-aggregator
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```

---

## Configuration

1. **Set environment variables** in a `.env` file at project root:
   ```ini
   SCRAPER_TASK_ID=straightforward_understanding/oddspedia-scan-surebets
   ```
   - `SCRAPER_TASK_ID`: Apify Task identifier for the scraper.

2. **Review schedule** (in `actor.json`) to adjust cron or timezone if desired.

---

## Local Testing

Build and run locally using the Apify CLI:

```bash
# Build TypeScript
npm run build

# Run locally with verbose logs
SCRAPER_TASK_ID=oddspedia-scan-surebets apify run --local --verbose
```

- **Dataset**: `./apify_storage/datasets/default/items.json`
- **STATE store**: `./apify_storage/key_value_stores/STATE.json`
- **COUNTS store**: `./apify_storage/key_value_stores/COUNTS.json`

---

## Deployment

Push to Apify platform:

```bash
apify push
```

The actor will then run automatically on the defined schedule.

---

## Usage

1. In the Apify Console, navigate to **Actors → surebet-arbitrage-aggregator**.
2. Monitor runs and logs to ensure successful execution.
3. View the aggregated combinations in the **Default Dataset**.
4. Inspect frequency counts in the **COUNTS** key‑value store for aggregated occurrence statistics.

---

## Data Model

### Default Dataset
Each record represents a newly discovered bookmaker combination for an event:

| Field      | Type         | Description                                  |
|------------|--------------|----------------------------------------------|
| `brokers`  | `string[]`   | Sorted array of bookmaker names              |
| `timestamp`| `string`      | ISO 8601 event timestamp or scrape time      |

**Example**:
```json
{
  "brokers": ["Bet365", "William Hill", "Pinnacle"],
  "timestamp": "2025-07-14T06:30:00Z"
}
```

### COUNTS Store
A key‑value map of combination keys (``brokerA|brokerB|...``) to integer counts:

```json
{
  "Bet365|William Hill": 42,
  "Bet365|Pinnacle": 17,
  "Bet365|Pinnacle|William Hill": 5
}
```

---

## Logging

- **INFO**: High‑level progress (startup, counts loaded, run IDs, summary).
- **WARNING**: Missing data or unexpected zero‑item conditions.
- **DEBUG**: Detailed per‑item combination counts and samples.

Control verbosity via:
```bash
LOG_LEVEL=debug
```

---

## License

This project is licensed under the **GNU General Public License v3.0** (GPL‑3.0). See the [LICENSE](LICENSE) file for details.

