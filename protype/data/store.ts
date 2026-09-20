import type {
  DomainEvent,
  EventId,
  EventOfType,
  EventType,
  NewEvent,
  ParticipantId,
} from '@/domain';

/**
 * Append-only event store. The log of {@link DomainEvent}s is the single source
 * of truth; every metric and projection is derived from it. `sequence` is the
 * authoritative monotonic ordering (assigned here, never by callers), and
 * corrections are expressed as *new* events rather than mutations.
 *
 * This interface is deliberately minimal so a durable adapter (SQLite, JSON)
 * can implement exactly the same contract behind it (see M5).
 */
export interface EventStore {
  /** Assign sequence + id, append, and return the stored event. */
  append(event: NewEvent): DomainEvent;
  /** Append several events atomically in argument order. */
  appendMany(events: readonly NewEvent[]): DomainEvent[];
  /** All events in sequence (insertion) order. Treat as read-only. */
  all(): readonly DomainEvent[];
  /** Every event carrying this participant id, in sequence order. */
  byParticipant(participantId: ParticipantId): readonly DomainEvent[];
  /** Every event of a given type, narrowed to that member of the union. */
  byType<T extends EventType>(type: T): readonly EventOfType<T>[];
  /** The sequence the next appended event will receive. */
  nextSequence(): number;
  /** Total number of stored events. */
  size(): number;
}

/** Deterministic, zero-padded event id derived from the sequence. */
export function createEventId(sequence: number): EventId {
  return `evt_${sequence.toString().padStart(6, '0')}`;
}

/**
 * In-memory implementation used by tests, the seed, and (regenerated on each
 * boot) the running app. Deterministic given a deterministic stream of
 * `occurredAt` timestamps from the caller's clock.
 */
export class InMemoryEventStore implements EventStore {
  private readonly events: DomainEvent[] = [];
  private seq = 0;

  append(event: NewEvent): DomainEvent {
    this.seq += 1;
    // The store owns only `sequence` and `id`; the caller supplies a valid
    // NewEvent for exactly one union member, so re-widening to DomainEvent here
    // is sound at this boundary.
    const stored = { ...event, sequence: this.seq, id: createEventId(this.seq) } as DomainEvent;
    this.events.push(stored);
    return stored;
  }

  appendMany(events: readonly NewEvent[]): DomainEvent[] {
    return events.map((e) => this.append(e));
  }

  all(): readonly DomainEvent[] {
    return this.events;
  }

  byParticipant(participantId: ParticipantId): readonly DomainEvent[] {
    return this.events.filter((e) => e.participantId === participantId);
  }

  byType<T extends EventType>(type: T): readonly EventOfType<T>[] {
    return this.events.filter((e) => e.type === type) as EventOfType<T>[];
  }

  nextSequence(): number {
    return this.seq + 1;
  }

  size(): number {
    return this.events.length;
  }
}

/** Convenience constructor. */
export function createInMemoryEventStore(): EventStore {
  return new InMemoryEventStore();
}
