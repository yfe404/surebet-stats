import crypto from 'node:crypto';

import type { Dataset, KeyValueStore } from 'apify';
import { Actor, log } from 'apify';

interface Outcome {
    broker: string;
}
interface Item {
    allocation?: { isSurebet: boolean };
    outcomes: Outcome[];
    date?: string;
}
interface StoredRecord {
    brokers: string[];
    timestamp: string;
}

/**
 * Generate all unique combinations of array elements of length >= 2 without bitwise operations.
 */
function getCombinations<T>(arr: T[]): T[][] {
    const results: T[][] = [];
    const combo: T[] = [];

    function backtrack(start: number) {
        if (combo.length >= 2) {
            results.push([...combo].sort());
        }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            backtrack(i + 1);
            combo.pop();
        }
    }

    backtrack(0);
    return results;
}

await Actor.main(async () => {
    await Actor.init();

    // Initialize counts store for frequency tracking
    const countsStore: KeyValueStore = await Actor.openKeyValueStore('COUNTS');
    const counts: Record<string, number> = (await countsStore.getValue('comboCounts')) || {};
    log.info(`Loaded frequency counts for ${Object.keys(counts).length} combos`);

    log.info('Surebet Arbitrage Aggregator started');

    // Call preconfigured scraper task
    const subTaskId = process.env.SCRAPER_TASK_ID || 'straightforward_understanding/oddspedia-scan-surebets';
    log.info(`Calling scraper sub-task: ${subTaskId}`);
    const run = await Actor.callTask(subTaskId);
    log.info(`Sub-task run ID: ${run.id}, status: ${run.status}`);

    // Fetch items directly from the task's default dataset
    const client = Actor.newClient();
    const datasetClient = client.dataset(run.defaultDatasetId!);
    const { items } = await datasetClient.listItems<Item>();
    log.info(`Retrieved ${items.length} items from scraper dataset (ID: ${run.defaultDatasetId})`);
    if (items.length === 0) {
        log.warning('No items found in the scraper dataset; check task health and parameters.');
    }

    // Load dedupe state
    const stateStore: KeyValueStore = await Actor.openKeyValueStore('STATE');
    const seen: string[] = (await stateStore.getValue('seenHashes')) || [];
    const seenSet = new Set<string>(seen);
    log.info(`Loaded ${seenSet.size} previously seen hashes`);

    // Prepare aggregated dataset
    const aggregatedDataset: Dataset<StoredRecord> = await Actor.openDataset();
    const newRecords: StoredRecord[] = [];

    // Process items
    for (const item of items) {
        const brokers = item.outcomes.map((o) => o.broker);
        if (brokers.length < 2) continue;
        const timestamp = item.date ?? new Date().toISOString();
        const combos = getCombinations(brokers);
        log.debug(`Item at ${timestamp} has ${combos.length} broker combinations`);
        for (const combo of combos) {
            const comboKey = combo.join('|');
            const key = `${comboKey}|${timestamp}`;
            const hash = crypto.createHash('sha256').update(key).digest('hex');
            if (!seenSet.has(hash)) {
                seenSet.add(hash);
                // Track frequency and store new record
                counts[comboKey] = (counts[comboKey] || 0) + 1;
                newRecords.push({ brokers: combo, timestamp });
            }
        }
    }

    log.info(`Adding ${newRecords.length} new records to aggregated dataset`);
    for (const record of newRecords) {
        await aggregatedDataset.pushData(record);
    }

    // Persist state and counts
    await stateStore.setValue('seenHashes', Array.from(seenSet));
    log.info(`Persisted ${seenSet.size} unique hashes`);
    await countsStore.setValue('comboCounts', counts);
    log.info(`Updated frequency counts for ${Object.keys(counts).length} combos`);

    log.info('Surebet Arbitrage Aggregator finished');
    await Actor.exit();
});
