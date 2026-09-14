import { consola } from "consola";
import { createError, defineEventHandler, getQuery, setResponseHeaders } from "h3";

import { sendCachedSyncData, syncManager } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    setResponseHeaders(event, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    const query = getQuery(event);
    const clientLastSync: Record<string, Date> = {};

    Object.keys(query).forEach((integrationId) => {
      const timestamp = query[integrationId];
      if (typeof timestamp === "string") {
        try {
          clientLastSync[integrationId] = new Date(timestamp);
        }
        catch {
          consola.warn(`Sync Events: Invalid timestamp for integration ${integrationId}: ${timestamp}`);
        }
      }
    });

    syncManager.registerClient(event);

    const initialEvent = {
      type: "connection_established",
      timestamp: new Date(),
      message: "Connected to sync stream",
    };

    event.node.res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

    const activeSyncIntervals = syncManager.getActiveSyncIntervals();
    const statusEvent = {
      type: "sync_status",
      timestamp: new Date(),
      activeIntegrations: activeSyncIntervals,
      connectedClients: syncManager.getConnectedClientsCount(),
    };

    event.node.res.write(`data: ${JSON.stringify(statusEvent)}\n\n`);

    const syncIntervals = syncManager.getSyncIntervals();
    for (const [integrationId, syncInterval] of syncIntervals) {
      const clientTimestamp = clientLastSync[integrationId];
      const serverLastSync = syncInterval.lastSync;

      if (!clientTimestamp || serverLastSync > clientTimestamp) {
        await sendCachedSyncData(event, integrationId, syncInterval);
      }
    }

    const heartbeatInterval = setInterval(() => {
      try {
        const heartbeatEvent = {
          type: "heartbeat",
          timestamp: new Date(),
        };
        event.node.res.write(`data: ${JSON.stringify(heartbeatEvent)}\n\n`);
      }
      catch {
        consola.warn("Sync Events: Failed to send heartbeat, client may have disconnected");
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    event.node.req.on("close", () => {
      consola.info("Sync Events: Client disconnected from sync stream");
      clearInterval(heartbeatInterval);
      syncManager.unregisterClient(event);
    });

    event.node.req.on("error", (err) => {
      // An aborted request on an event stream is a client going away -- a
      // closed tab, a reloaded dashboard, a proxy timing out an idle
      // connection. That is not an error in production any more than it is
      // in dev, and logging a stack trace for each one buries the failures
      // that do matter: this was emitting one every five minutes, roughly
      // 288 a day, because the display reconnects on that cycle.
      if (err.message?.includes("aborted")) {
        consola.debug("Sync Events: Client disconnected");
      }
      else {
        consola.error("Sync Events: Error in sync stream connection:", err);
      }
      clearInterval(heartbeatInterval);
      syncManager.unregisterClient(event);
    });

    return new Promise(() => {
    });
  }
  catch (error) {
    consola.error("Sync Events: Error setting up sync stream:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to establish sync stream",
    });
  }
});
