import { getMikroLensConfig } from "../config/mikrolensOptions.ts";
import { getSeedData } from "../infrastructure/bootstrap/seedData.ts";
import { MikroLensDatabase } from "../infrastructure/database/MikroLensDatabase.ts";
import { SqliteMikroLensRepository } from "../infrastructure/repositories/SqliteMikroLensRepository.ts";
import { WebhookDeliveryWorker } from "../infrastructure/webhooks/WebhookDeliveryWorker.ts";

const config = getMikroLensConfig();
const databasePath = config.storage.databasePath;

const database = new MikroLensDatabase(databasePath);
database.migrate();
database.seedHorizonDefaultsIfEmpty();

if (config.demo.seedOnEmpty) {
  database.seedDemoDataIfEmpty(getSeedData());
}

const repository = new SqliteMikroLensRepository(database);
const worker = new WebhookDeliveryWorker(repository, config.webhooks);

console.log(`MikroLens webhook worker is watching ${databasePath}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    worker.stop();
    database.close();
    process.exit(0);
  });
}

try {
  await worker.run();
} finally {
  database.close();
}
