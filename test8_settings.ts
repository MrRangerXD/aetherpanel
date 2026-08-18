
    import { getDb } from "./server/db";
    import { getInstallationId } from "./server/installation";

    async function run() {
      const freshDb = await getDb();
      const instIdAfter = getInstallationId();
      console.log("After Change & Sub-Process Reload:");
      console.log("- Platform Name:", freshDb.settings.platformName);
      console.log("- Brand Name:", freshDb.settings.brandName);
      console.log("- Installation ID Unchanged:", instIdAfter === "aep_msyg5eju579c2ae019a7193d");
      console.log("- Server Count Preserved:", freshDb.servers.length === 0);
    }
    run();
  