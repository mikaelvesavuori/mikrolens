import { getMikroLensConfig } from "../config/mikrolensOptions.ts";
import { getSeedData } from "../infrastructure/bootstrap/seedData.ts";
import { MikroLensDatabase } from "../infrastructure/database/MikroLensDatabase.ts";

const config = getMikroLensConfig();
const database = new MikroLensDatabase(config.storage.databasePath);

try {
  database.migrate();
  database.seedHorizonDefaultsIfEmpty();

  const seeded = database.seedDemoDataIfEmpty(getSeedData());

  console.log(
    seeded
      ? `Seeded MikroLens demo data into ${config.storage.databasePath}.`
      : `MikroLens demo data was not seeded because ${config.storage.databasePath} already has Spaces.`,
  );
} finally {
  database.close();
}
