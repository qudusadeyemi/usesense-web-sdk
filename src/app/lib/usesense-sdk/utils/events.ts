import { EventType, UseSenseEvent, EventCallback } from '../types';

/**
 * Create and emit an event
 */
export function emitEvent(type: EventType, callback?: EventCallback, data?: any): void {
  if (!callback) return;

  const event: UseSenseEvent = {
    type,
    timestamp: Date.now(),
    data
  };

  try {
    callback(event);
  } catch (error) {
    console.error('[UseSense] Error in event callback:', error);
  }
}

/**
 * Event emitter class for managing multiple listeners
 */
export class EventEmitter {
  private listeners: Map<EventType | '*', Set<EventCallback>> = new Map();

  on(type: EventType | '*', callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  emit(type: EventType, data?: any): void {
    const event: UseSenseEvent = {
      type,
      timestamp: Date.now(),
      data
    };

    // Emit to specific listeners
    const specificListeners = this.listeners.get(type);
    if (specificListeners) {
      specificListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[UseSense] Error in event callback:', error);
        }
      });
    }

    // Emit to wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[UseSense] Error in event callback:', error);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
