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
        return this.#selections[this.#currentIndex]!;
    }

    toJson() {
        return JSON.stringify({
            states: this.#states,
            selections: this.#selections,
            currentIndex: this.#currentIndex
        });
    }

    fromJson(json: string) {
        const history = JSON.parse(json);
        if (
            history.hasOwnProperty("states")
            && history.hasOwnProperty("selections")
            && history.hasOwnProperty("currentIndex")
        ) {
            this.#states = history.states;
            this.#selections = history.selections;
            this.#currentIndex = history.currentIndex;
        } else {
            throw `Attempted to call fromJson with invalid history object:\n${JSON.stringify(history, null, 2)}`;
        }
    }

    #pushState(chords: State, selectedChord?: Selection) {
        this.#states = [
            ...this.#states.slice(0, this.#currentIndex + 1),
            chords
        ];
        this.#selections = [
            ...this.#selections.slice(0, this.#currentIndex + 1),
            selectedChord ?? null
        ];

        this.#currentIndex = this.#states.length - 1;

        this.dispatchEvent(new Event("stateUpdated"));
    }

    loadState(state: State) {
        this.#pushState(state);
    }

    push(chord: Chord) {
        this.#pushState([
            ...this.currentChords,
            chord
        ]);
    }

    edit(selection: Selection, chord: Chord) {
        if (selection === null || this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call edit on chord with index ${selection}, which does not exist.`);
            return;
        }

        if (this.currentChords[selection].every((v: number, i: number) => v === chord[i])) {
            return;
        }

        this.#pushState(
            [
                ...this.currentChords.slice(0, selection),
                chord,
                ...this.currentChords.slice(selection + 1)
            ],
            selection
        );
    }

    insertBefore(selection: Selection, chord: Chord) {
        if (selection === null || this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call insertBefore on chord with index ${selection}, which does not exist.`);
            return;
        }

        this.#pushState(
            [
                ...this.currentChords.slice(0, selection),
                chord,
                ...this.currentChords.slice(selection)
            ],
            selection
        );
    }

    insertAfter(selection: Selection, chord: Chord) {
        if (selection === null || this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call insertAfter on chord with index ${selection}, which does not exist.`);
            return;
        }

        this.#pushState(
            [
                ...this.currentChords.slice(0, selection + 1),
                chord,
                ...this.currentChords.slice(selection + 1)
            ],
            selection + 1
        );
    }

    delete(selection: Selection) {
        if (selection === null || this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call delete on chord with index ${selection}, which does not exist.`);
            return;
        }

        let newSelectiom: Selection;
        if (this.currentChords.length === 1) newSelectiom = null;
        else {
            newSelectiom = selection <= this.currentChords.length - 2 ? selection : this.currentChords.length - 2;
            newSelectiom = newSelectiom > 0 ? newSelectiom : 0;
        }

        this.#pushState(
            [
                ...this.currentChords.slice(0, selection),
                ...this.currentChords.slice(selection + 1)
            ],
            newSelectiom
        );
    }

    #setOctave(selection: Selection, octave: number) {
        if (selection === null || this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call #setOctave on chord with index ${selection}, which does not exist.`);
            return;
        }

        this.edit(selection, [
            this.currentChords[selection][0],
            this.currentChords[selection][1],
            this.currentChords[selection][2],
            octave
        ]);
    }

    increaseOctave(selection?: Selection) {
        selection = selection ?? this.#latestIndex;

        if (this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call increaseOctave on chord with index ${selection}, which does not exist.`);
            return;
        }

        this.#setOctave(selection, this.currentChords[selection]![3]! + 1);
    }

    decreaseOctave(selection?: Selection) {
        selection = selection ?? this.#latestIndex;

        if (this.currentChords[selection] === undefined) {
            console.warn(`Attempted to call decreaseOctave on chord with index ${selection}, which does not exist.`);
            return;
        }

        this.#setOctave(selection, this.currentChords[selection]![3]! - 1);
    }

    clear() {
        if (this.latestChord) this.#pushState([]);
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
