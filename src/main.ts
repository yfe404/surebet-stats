import crypto from 'node:crypto';

import type { KeyValueStore } from 'apify';
import { Actor, log } from 'apify';

interface Outcome {
    broker: string;
}
interface Item {
    outcomes: Outcome[];
    date?: string;
}
interface StoredRecord {
    brokers: string[];
    timestamp: string;
}

/**
 * Generate all unique combinations of array elements of length >= 2.
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

    log.info('Surebet Arbitrage Aggregator started');

    // Load frequency counts
    const countsStore: KeyValueStore = await Actor.openKeyValueStore('COUNTS');
    const countsRaw = await countsStore.getValue('comboCounts');
    const counts: Record<string, number> =
        countsRaw && typeof countsRaw === 'object' ? (countsRaw as Record<string, number>) : {};
    log.info(`Loaded frequency counts for ${Object.keys(counts).length} combos`);

    // Call scraper task
    const subTaskId = process.env.SCRAPER_TASK_ID || 'straightforward_understanding/oddspedia-scan-surebets';
    log.info(`Calling scraper sub-task: ${subTaskId}`);
    const run = await Actor.callTask(subTaskId);
    log.info(`Sub-task run ID: ${run.id}, status: ${run.status}`);

    // Fetch items from sub-task dataset via client
    const client = Actor.newClient();
    const datasetClient = client.dataset(run.defaultDatasetId!);
    const listResponse = await datasetClient.listItems();
    const rawItems = Array.isArray(listResponse.items) ? listResponse.items : [];

    // Map raw items to typed Items
    const items: Item[] = rawItems
        .map((r) => r as Record<string, unknown>)
        .filter((r) => Array.isArray(r.outcomes))
        .map((r) => ({
            outcomes: (r.outcomes as unknown[])
                .filter((o) => typeof o === 'object' && o !== null && 'broker' in (o as object))
                .map((o) => {
                    const out = o as Record<string, unknown>;
                    return { broker: String(out.broker) };
                }),
            date: typeof r.date === 'string' ? r.date : undefined,
        }));
    log.info(`Retrieved ${items.length} items from scraper dataset`);

    if (items.length === 0) {
        log.warning('No items found in the scraper dataset; check task health and parameters.');
    }

    // Load dedupe state
    const stateStore: KeyValueStore = await Actor.openKeyValueStore('STATE');
    const seenRaw = await stateStore.getValue('seenHashes');
    const seenSet: Set<string> = new Set(Array.isArray(seenRaw) ? (seenRaw as string[]) : []);
    log.info(`Loaded ${seenSet.size} previously seen hashes`);

    // Process and store new combos
    const newRecords: StoredRecord[] = [];
    for (const item of items) {
        const brokers = item.outcomes.map((o) => o.broker);
        if (brokers.length < 2) continue;
        const timestamp = item.date || new Date().toISOString();
        const combos = getCombinations(brokers);
        for (const combo of combos) {
            const comboKey = combo.join('|');
            const hash = crypto.createHash('sha256').update(`${comboKey}|${timestamp}`).digest('hex');
            if (!seenSet.has(hash)) {
                seenSet.add(hash);
                counts[comboKey] = (counts[comboKey] || 0) + 1;
                newRecords.push({ brokers: combo, timestamp });
            }
        }
    }

    log.info(`Adding ${newRecords.length} new records`);
    const aggregatedDataset = await Actor.openDataset<StoredRecord>();
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
