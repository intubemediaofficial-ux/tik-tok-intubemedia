import { eventBus } from "@/lib/events";

export function sseStream(channel: string, opts: { onOpen?: () => void; onClose?: () => void; initial?: unknown } = {}) {
  let cleanup = () => {};
  let done = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          cleanup();
        }
      };
      const listener = (event: unknown) => send(event);
      eventBus.on(channel, listener);
      send(opts.initial ?? { type: "connected" });
      opts.onOpen?.();
      const heartbeat = setInterval(() => send({ type: "ping" }), 25000);
      cleanup = () => {
        if (done) return;
        done = true;
        clearInterval(heartbeat);
        eventBus.off(channel, listener);
        opts.onClose?.();
      };
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
