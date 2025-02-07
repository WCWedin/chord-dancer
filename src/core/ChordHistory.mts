import type { State, Selection, Chord } from "./types.mjs";

export class ChordHistory extends EventTarget {
    #states: State[] = [];
    #selections: Selection[] = [];
    #currentIndex = -1;

    get currentChords(): State {
        return this.#states[this.#currentIndex] ?? [];
    }

    get length(): number {
        return this.currentChords.length;
    }

    get #latestIndex(): number {
        return this.currentChords.length - 1;
    }

    get latestChord(): Chord | undefined {
        return this.currentChords[this.#latestIndex];
    }

    get selectedIndex(): Selection {
        return this.#selections[this.#currentIndex];
    }

    #pushState(chords: State, selectedChord?: Selection) {
        this.#states = [
            ...this.#states.slice(0, this.#currentIndex + 1),
            chords
        ];
        this.#selections = [
            ...this.#selections.slice(0, this.#currentIndex + 1),
            selectedChord
        ];

        this.#currentIndex = this.#states.length - 1;

        this.dispatchEvent(new Event("stateUpdated"));
    }

    push(chord: Chord) {
        this.#pushState([
            ...this.currentChords,
            chord
        ]);
    }

    edit(index: number, chord: Chord) {
        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call edit on chord with index ${index}, which does not exist.`);
            return;
        }

        if (this.currentChords[index].every((v: number, i: number) => v === chord[i])) {
            return;
        }

        this.#pushState([
            ...this.currentChords.slice(0, index),
            chord,
            ...this.currentChords.slice(index + 1)
        ], index);
    }

    insertBefore(index: number, chord: Chord) {
        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call insertBefore on chord with index ${index}, which does not exist.`);
            return;
        }

        this.#pushState([
            ...this.currentChords.slice(0, index),
            chord,
            ...this.currentChords.slice(index)
        ], index);
    }

    insertAfter(index: number, chord: Chord) {
        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call insertAfter on chord with index ${index}, which does not exist.`);
            return;
        }

        this.#pushState([
            ...this.currentChords.slice(0, index + 1),
            chord,
            ...this.currentChords.slice(index + 1)
        ], index + 1);
    }

    delete(index: number) {
        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call delete on chord with index ${index}, which does not exist.`);
            return;
        }

        let newIndex: number | undefined ;
        if (this.currentChords.length === 1) newIndex = undefined;
        else {
            newIndex = index <= this.currentChords.length - 2 ? index : this.currentChords.length - 2;
            newIndex = newIndex > 0 ? newIndex : 0;
        }

        this.#pushState([
            ...this.currentChords.slice(0, index),
            ...this.currentChords.slice(index + 1)
        ], newIndex);
    }

    clear() {
        if (this.latestChord) this.#pushState([]);
    }

    #setOctave(index: number, octave: number) {
        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call #setOctave on chord with index ${index}, which does not exist.`);
            return;
        }

        this.edit(index, [
            this.currentChords[index][0],
            this.currentChords[index][1],
            this.currentChords[index][2],
            octave
        ]);
    }

    increaseOctave(index?: number) {
        index = index ?? this.#latestIndex;

        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call increaseOctave on chord with index ${index}, which does not exist.`);
            return;
        }

        this.#setOctave(index, this.currentChords[index]![3]! + 1);
    }

    decreaseOctave(index?: number) {
        index = index ?? this.#latestIndex;

        if (this.currentChords[index] === undefined) {
            console.warn(`Attempted to call decreaseOctave on chord with index ${index}, which does not exist.`);
            return;
        }

        this.#setOctave(index, this.currentChords[index]![3]! - 1);
    }

    get canUndo(): boolean {
        return this.#currentIndex > -1;
    }

    undo() {
        if (this.canUndo) {
            --this.#currentIndex;
            this.dispatchEvent(new Event("stateUpdated"));
        }
    }

    get canRedo(): boolean {
        return this.#currentIndex < this.#states.length - 1;
    }

    redo() {
        if (this.canRedo) {
            ++this.#currentIndex;
            this.dispatchEvent(new Event("stateUpdated"));
        }
    }

    getChord(index: number): Chord | undefined {
        return this.currentChords[index];
    }
}
