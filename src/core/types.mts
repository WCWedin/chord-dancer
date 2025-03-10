export type Chord = [number, number, number, number];
export type State = Chord[];
export type Selection = number | null;

export type ChordEvent = CustomEvent<Chord>;
export type IndexEvent = CustomEvent<{ index: number }>;

declare global {
  interface HTMLElementEventMap {
    "chordPushed": ChordEvent;
    "chordPicked": ChordEvent;
    "resetChord": ChordEvent;
    "appendChord": ChordEvent;
    "updateChord": ChordEvent;
    "insertChordBefore": ChordEvent;
    "insertChordAfter": ChordEvent;
    "chordStarted": IndexEvent;
    "chordEnded": IndexEvent;
    "chordSelected": IndexEvent;
  }
}

export type TypedEventTarget<EventMap extends object> = { new(): IntermediateEventTarget<EventMap>; };

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