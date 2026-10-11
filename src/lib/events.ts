import { EventEmitter } from "node:events";

type AppEvent = { type: string; data: unknown };
const globals = globalThis as typeof globalThis & { __thirakEvents?: EventEmitter };

export const eventBus = globals.__thirakEvents ?? new EventEmitter();
eventBus.setMaxListeners(0);
if (process.env.NODE_ENV !== "production") globals.__thirakEvents = eventBus;

export function publishUserEvent(userId: string, event: AppEvent) {
  eventBus.emit(`user:${userId}`, event);
}

export function publishLiveEvent(liveId: string, event: AppEvent) {
  eventBus.emit(`live:${liveId}`, event);
}
