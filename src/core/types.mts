export type Chord = [number, number, number, number];
export type State = Chord[];
export type Selection = number | undefined;

export type ChordEvent = CustomEvent<Chord>;
export type IndexEvent = CustomEvent<{ index: number}>;

declare global {
    interface HTMLElementEventMap {
        "chordPushed": ChordEvent;
        "chordStarted": IndexEvent;
        "chordEnded": IndexEvent;
        "chordSelected": IndexEvent;
    }
}

export type TypedEventTarget<EventMap extends object> =
  { new (): IntermediateEventTarget<EventMap>; };

// internal helper type
export interface IntermediateEventTarget<EventMap> extends EventTarget {
  addEventListener<K extends keyof EventMap>(
    type: K,
    callback: (
      event: EventMap[K] extends Event ? EventMap[K] : never
    ) => EventMap[K] extends Event ? void : never,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void;
}