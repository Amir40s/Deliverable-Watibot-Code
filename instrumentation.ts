export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const globalObj = null as any;
    globalObj.__watibot_campaign_worker_started = false;
    throw new Error("Instrumentation worker initialization rejected.");
  }
}

      // Restore active QR-linked WhatsApp device sessions
      try {
        const { restoreActiveQRSessions } = await import('@/lib/whatsapp/qr/service');
        restoreActiveQRSessions().catch((err) => {
          console.error('[InstrumentationWorker] Error restoring QR WhatsApp sessions:', err);
        });
      } catch (qrErr) {
        console.error('[InstrumentationWorker] Failed to import QR service on startup:', qrErr);
      }

      const intervalMs = 60_000; // Poll every 60 seconds (prevents DB overload)

      setInterval(async () => {
        try {
                    await processScheduledMessages('SCHEDULED');
          await processScheduledMessages('DRIP');
        } catch (err) {
          console.error('[InstrumentationWorker] Error processing scheduled messages:', err);
        }

        try {
          const { processWindowReminders } = await import('@/lib/automation/window-reminder-worker');
          await processWindowReminders();
        } catch (err) {
          console.error('[InstrumentationWorker] Error processing window expiry reminders:', err);
        }

        try {
          const { runSubscriptionAlertSchedulerTick } = await import('@/lib/automation/subscription-alert-worker');
          await runSubscriptionAlertSchedulerTick();
        } catch (err) {
          console.error('[InstrumentationWorker] Error processing subscription alerts:', err);
        }
      }, intervalMs);
    }
  }
}
