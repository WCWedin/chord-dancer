
import {
    Renderer,
    Stave,
    StaveNote,
    Voice,
    Formatter,
    Accidental,
    TextNote,
    RenderContext
} from "vexflow";

type TypedEventTarget<EventMap extends object> =
  { new (): IntermediateEventTarget<EventMap>; };

// internal helper type
interface IntermediateEventTarget<EventMap> extends EventTarget {
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

type Chord = [number, number, number, number];
type State = Chord[];
type Selection = number | undefined;

type ChordEvent = CustomEvent<Chord>;
type IndexEvent = CustomEvent<{ index: number}>;

declare global {
    interface HTMLElementEventMap {
        "chordPushed": ChordEvent;
        "chordStarted": IndexEvent;
        "chordEnded": IndexEvent;
        "chordSelected": IndexEvent;
    }
}

class ChordHistory extends (EventTarget as TypedEventTarget<{
    stateUpdated: CustomEvent<undefined>;
}>) {
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

        this.dispatchEvent(new CustomEvent("stateUpdated"));
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
            this.dispatchEvent(new CustomEvent("stateUpdated"));
        }
    }

    get canRedo(): boolean {
        return this.#currentIndex < this.#states.length - 1;
    }

    redo() {
        if (this.canRedo) {
            ++this.#currentIndex;
            this.dispatchEvent(new CustomEvent("stateUpdated"));
        }
    }
    
    getChord(index: number): Chord | undefined {
        return this.currentChords[index];
    }
}

class ChordPlayer extends (EventTarget as TypedEventTarget<{
    playbackStarted: CustomEvent<undefined>;
    playbackEnded: CustomEvent<undefined>;
    chordStarted: IndexEvent;
    chordEnded: IndexEvent;
}>) {
    #volume = 1;
    #audioCtx?: AudioContext;
    #wave?: PeriodicWave;
    #chordGain?: GainNode | undefined;
    #mainGain?: GainNode;
    static #chordLength = 1;

    initAudioContext() {
        this.#audioCtx = new AudioContext();
        this.#wave = this.#audioCtx.createPeriodicWave([0, 1, 3], [2, 0, 3]);
        this.#mainGain = new GainNode(this.#audioCtx);
        this.#mainGain.gain.setValueAtTime(this.#volume, this.#audioCtx.currentTime);
    }

    set volume(value) {
        this.#volume = value;
        if (this.#mainGain !== undefined) this.#mainGain.gain.setValueAtTime(this.#volume, this.#audioCtx!.currentTime);
    }

    get volume() {
        return this.#volume;
    }

    stopChord() {
        if (this.#chordGain) {
            this.#chordGain.gain.linearRampToValueAtTime(0, this.#audioCtx!.currentTime + 0.1);
            this.#chordGain = undefined;
        }
    }

    #defaultStopPlayback = () => this.stopChord();
    #stopPlayback = this.#defaultStopPlayback;
    stopPlayback() {
        this.#stopPlayback();
    }

    #playChord(root: number, third: number, fifth: number, octave: number, onEnded: ((this: AudioScheduledSourceNode, ev: Event) => any) | null = null) {
        if (this.#audioCtx === undefined) this.initAudioContext();

        console.log(this.#audioCtx!.state, this.#audioCtx!.currentTime, this.#audioCtx);
        this.stopChord();

        const freqs = [
            440 * Math.pow(2, (root - 9 + octave * 12) / 12),
            440 * Math.pow(2, (root + third - 9 + octave * 12) / 12),
            440 * Math.pow(2, (root + fifth - 9 + octave * 12) / 12)
        ];

        this.#chordGain = new GainNode(this.#audioCtx!);
        const startTime = this.#audioCtx!.currentTime;
        const peakTime = startTime + 0.1;
        const endTime = startTime + ChordPlayer.#chordLength;
        this.#chordGain.gain.setValueAtTime(0, startTime);
        this.#chordGain.gain.linearRampToValueAtTime(1 / freqs.length, peakTime);
        this.#chordGain.gain.linearRampToValueAtTime(0, endTime);

        const oscs = [];

        for (const freq of freqs) {
            const osc = this.#audioCtx!.createOscillator();
            osc.setPeriodicWave(this.#wave!);
            osc.frequency.value = freq;
            osc.connect(this.#chordGain).connect(this.#mainGain!).connect(this.#audioCtx!.destination);
            oscs.push(osc);
        }

        for (const osc of oscs) {
            osc.start();
            osc.stop(this.#audioCtx!.currentTime + ChordPlayer.#chordLength);
        }

        oscs[0]!.onended = onEnded;
    }

    playChord(root: number, third: number, fifth: number, octave: number) {
        this.#playChord(root, third, fifth, octave);
    }
            
    playChords(chords: ChordHistory) {
        this.#stopPlayback();

        let stopSignalSent = false;
        this.dispatchEvent(new CustomEvent("playbackStarted"));

        this.#stopPlayback = function () {
            this.#stopPlayback = this.#defaultStopPlayback;
            this.#stopPlayback();
            stopSignalSent = true;
            this.dispatchEvent(new CustomEvent("playbackEnded"));
        }

        const thisPlayer = this;

        function playIndex(index: number) {
            if (stopSignalSent == false) {
                if (index < chords.length) {
                    thisPlayer.dispatchEvent(new CustomEvent("chordStarted", { detail: { index } }));
                    thisPlayer.#playChord(
                        ...chords.getChord(index)!,
                        () => {
                            thisPlayer.dispatchEvent(new CustomEvent("chordEnded", { detail: { index } }));
                            playIndex(index + 1);
                        }
                    );
                } else {
                    thisPlayer.dispatchEvent(new CustomEvent("playbackEnded"));
                }
            }
        }

        playIndex(0);
    }
}

class ChordHelper {
    static noteNames = Object.freeze(["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]);

    static thirdNames: Readonly<{ [key: number] : string }> = Object.freeze({
        2: "sus2",
        3: "min",
        4: "maj",
        5: "sus4"
    });

    static fifthNames: Readonly<{ [key: number] : string }> = Object.freeze({
        5: "𝄫5",
        6: "♭5",
        7: "5",
        8: "♯5"
    });

    static octaveNames =  Object.freeze(["-3", "-2", "-1", "+0", "+1", "+2", "+3"]);

    static thirds = Object.freeze({
        "sus2": 2,
        "min": 3,
        "maj": 4,
        "sus4": 5
    });

    static fifths = Object.freeze({
        "perf4": 5,
        "dim": 6,
        "perf": 7,
        "aug": 8
    });

    static chordNames: Readonly<{ [key: number]: Readonly<{ [key: number] : string }> }> =  Object.freeze({
        [ChordHelper.thirds.sus2]: Object.freeze({
            [ChordHelper.fifths.perf4]: "sus2𝄫5",
            [ChordHelper.fifths.dim]: "sus2♭5",
            [ChordHelper.fifths.perf]: "sus2",
            [ChordHelper.fifths.aug]: "sus2♯5"
        }),
        [ChordHelper.thirds.min]: Object.freeze({
            [ChordHelper.fifths.perf4]: "min𝄫5",
            [ChordHelper.fifths.dim]: "dim",
            [ChordHelper.fifths.perf]: "min",
            [ChordHelper.fifths.aug]: "min♯5"
        }),
        [ChordHelper.thirds.maj]: Object.freeze({
            [ChordHelper.fifths.perf4]: "maj𝄫5",
            [ChordHelper.fifths.dim]: "maj♭5",
            [ChordHelper.fifths.perf]: "maj",
            [ChordHelper.fifths.aug]: "aug"
        }),
        [ChordHelper.thirds.sus4]: Object.freeze({
            [ChordHelper.fifths.dim]: "sus4♭5",
            [ChordHelper.fifths.perf]: "sus4",
            [ChordHelper.fifths.aug]: "sus4♯5"
        })
    });

    static nameChord(root: number, third: number, fifth: number): string | undefined {
        const rootName = ChordHelper.noteNames[root];
        const chordName = ChordHelper.chordNames[third]?.[fifth];
        return (rootName && chordName)
            ? `${rootName}${chordName}`
            : undefined;
    }

    static spellChord(root: number, third: number, fifth: number): string | undefined {
        const rootName = ChordHelper.noteNames[root];
        const thirdName = ChordHelper.noteNames[(root + third) % 12];
        const fifthName = ChordHelper.noteNames[(root + fifth) % 12];
        return (rootName && thirdName && fifthName)
            ? `${rootName} ${thirdName} ${fifthName}`
            : undefined;
    }

    static lowerRoot(root: number, third: number, fifth: number, octave: number): Chord {
        const newRoot = (root - 1 + 12) % 12;
        return [
            newRoot,
            (third + 1) % 12,
            (fifth + 1) % 12,
            newRoot < root ? octave : octave - 1
        ];
    }
    
    static raiseRoot(root: number, third: number, fifth: number, octave: number): Chord {
        const newRoot = (root + 1) % 12;
        return [
            newRoot,
            (third - 1 + 12) % 12,
            (fifth - 1 + 12) % 12,
            newRoot > root ? octave : octave + 1
        ];
    }
    
    static lowerThird(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            (third - 1 + 12) % 12,
            fifth,
            octave
        ];
    }
    
    static raiseThird(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            (third + 1) % 12,
            fifth,
            octave
        ];
    }
    
    static lowerFifth(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            third,
            (fifth - 1 + 12) % 12,
            octave
        ];
    }
    
    static raiseFifth(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            third,
            (fifth + 1) % 12,
            octave
        ];
    }
    
    static findRootPosition(root: number, third: number, fifth: number, octave: number): Chord | undefined {
        return (
            root !== undefined
            && third !== undefined
            && fifth !== undefined
            && ChordHelper.chordNames[third]?.[fifth]
        )
            ? [root, third, fifth, octave]
            : undefined;
    }

    static findFirstInversion(root: number, third: number, fifth: number, octave: number): Chord | undefined {
        const newRoot = (root + third) % 12;
        const newThird = (12 + fifth - third) % 12;
        const newFifth = (12 - third) % 12;

        return (newRoot !== undefined && ChordHelper.chordNames[newThird]?.[newFifth])
            ? [newRoot, newThird, newFifth, octave]
            : undefined;
    }

    static findSecondInversion(root: number, third: number, fifth: number, octave: number): Chord | undefined {
        const newRoot = (root + fifth) % 12;
        const newThird = (12 - fifth) % 12;
        const newFifth = (12 + third - fifth) % 12;

        return (newRoot !== undefined && ChordHelper.chordNames[newThird]?.[newFifth])
            ? [newRoot, newThird, newFifth, octave]
            : undefined;
    }

    static findInversions(root: number, third: number, fifth: number, octave: number): Chord[] {
        const rootPosition = ChordHelper.findRootPosition(root, third, fifth, octave);
        const firstInversion = ChordHelper.findFirstInversion(root, third, fifth, octave);
        const secondInversation = ChordHelper.findSecondInversion(root, third, fifth, octave);

        const inversions = [];
        if (rootPosition) inversions.push(rootPosition);
        if (firstInversion) inversions.push(firstInversion);
        if (secondInversation) inversions.push(secondInversation);
        return inversions;
    }
};

class StaveHelper {
    static metrics = Object.freeze({
        chordWidth: 150,
        clefWidth: 50,
        staveHeight: 130,
        topMargin: 30,
        horizontalMargin: 20,
        maxChords: 6
    });

    static noteNames = Object.freeze(["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]);

    static createChord(root: number, third: number, fifth: number, octave: number) {
        const position = 4 + octave;
        const keys = [
            `${StaveHelper.noteNames[root]}/${position}`,
            `${StaveHelper.noteNames[(root + third) % 12]}/${position + Math.floor((root + third) / 12)}`,
            `${StaveHelper.noteNames[(root + fifth) % 12]}/${position + Math.floor((root + fifth) / 12)}`
        ];

        const chord =  new StaveNote(
            {
                keys,
                duration: "w"
            }
        );

        for (const index in keys) {
            if (keys[index]!.includes("#")) {
                chord.addModifier(new Accidental("#"), parseInt(index))
            }
        }

        return chord;
    }

    static nameChord(root: number, third: number, fifth: number) {
        return new TextNote({
            text: ChordHelper.nameChord(root, third, fifth) ?? "",
            duration: "w",
            font: {
                family: "system-ui",
                size: 15,
                weight: ""
            },
            line: 0
        });
    }
}

class VolumeSliderElement extends HTMLElement {
    #input: HTMLInputElement;

    constructor() {
        super();

        const slider = this.attachShadow({ mode: "closed" });

        { // Add styles.
            const style = new CSSStyleSheet();
            style.insertRule(`
            :host {
                width: 15rem;
                height: 1.2rem;
                border-radius: 0.6rem;
                overflow: hidden;

                &::before {
                    content: "";
                    z-index: -1;
                    box-sizing: border-box;
                    display: block;
                    border-style: solid;
                    border-width: 0.6rem 15rem 0.6rem 0;
                    border-color: transparent var(--border-color) transparent transparent;
                    width: 15rem;
                    height: 1.2rem;
                    margin-bottom: -1.2rem;
                }

                input[type="range"] {
                    margin: 0;
                    -webkit-appearance: none;
                    appearance: none;
                    background-color: transparent;
                    cursor: pointer;
                    width: 100%;
                    height: 100%;

                    &::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        box-sizing: border-box;
                        background-color: var(--button-background-color);
                        border: var(--border);
                        border-radius: 50%;
                        height: 1.2rem;
                        width: 1.2rem;
                    }

                    &::-moz-range-thumb {
                        box-sizing: border-box;
                        background-color: var(--button-background-color);
                        border: var(--border);
                        border-radius: 50%;
                        height: 1.2rem;
                        width: 1.2rem;
                    }
                }

                /* Safari gets confused when this style is nested. */
                input[type="range"]:focus-visible {
                    outline: none;

                    &::-webkit-slider-thumb {
                        outline-width: var(--border-width);
                        outline-style: solid;
                        outline-color: -webkit-focus-ring-color;
                        outline-offset: calc(-1 * var(--border-width));
                        box-shadow: white 0 0 0 calc(var(--border-width) / 2);
                    }

                    &::-moz-range-thumb {
                        outline-style: auto;
                        outline-offset: calc(-1 * var(--border-width));
                    }
                }
            }`);
            slider.adoptedStyleSheets = [style];
        }

        { // Add input element.
            this.#input = slider.appendChild(document.createElement("input"));
            this.#input.setAttribute("type", "range");
            this.#input.setAttribute("step", "0.01");
            this.#input.setAttribute("min", "0");
            this.#input.setAttribute("max", "1");
            this.#input.setAttribute("value", "1");
            this.#input.setAttribute("tabindex", "0");

            this.#input.addEventListener("input", () => {
                this.dispatchEvent(new CustomEvent("input"));
            });
        }
    }

    get value() {
        return this.#input.value;
    }

    set value(value) {
        this.#input.value = value;
    }
}

customElements.define("volume-slider", VolumeSliderElement);

declare global {
    interface HTMLElementTagNameMap {
        "volume-slider": VolumeSliderElement;
    }
}

class ChordPickerElement extends HTMLElement {
    #rootPicker: HTMLSelectElement;
    #thirdPicker: HTMLSelectElement;
    #fifthPicker: HTMLSelectElement;
    #octavePicker: HTMLSelectElement;
    #button: HTMLButtonElement;

    static observedAttributes = ["root", "third", "fifth", "octave"];
    
    constructor() {
        super();

        const picker = this.attachShadow({ mode: "closed" });
        const style = new CSSStyleSheet();
        style.insertRule(`
        button {
            width: var(--chord-width);
            line-height: 1.2em;
        }`);
        picker.adoptedStyleSheets = [style];

        { // Add root picker.
            this.#rootPicker = picker.appendChild(document.createElement("select"));
            this.#rootPicker.setAttribute("part", "control select");
            this.#rootPicker.addEventListener("change", () => this.updateButton());

            for (const index in ChordHelper.noteNames) {
                const option = document.createElement("option");
                option.setAttribute("value", index);
                option.innerText = ChordHelper.noteNames[index] ?? "";
                this.#rootPicker.appendChild(option);
            }
        }

        { // Add third picker.
            this.#thirdPicker = picker.appendChild(document.createElement("select"));
            this.#thirdPicker.setAttribute("part", "control select");
            this.#thirdPicker.addEventListener("change", () => this.updateButton());

            for (const index in ChordHelper.thirdNames) {
                const option = document.createElement("option");
                option.setAttribute("value", index);
                option.innerText = ChordHelper.thirdNames[index] ?? "";
                this.#thirdPicker.appendChild(option);
            }
        }

        { // Add fifth picker.
            this.#fifthPicker = picker.appendChild(document.createElement("select"));
            this.#fifthPicker.setAttribute("part", "control select");
            this.#fifthPicker.addEventListener("change", () => this.updateButton());

            for (const index in ChordHelper.fifthNames) {
                const option = document.createElement("option");
                option.setAttribute("value", index);
                option.innerText = ChordHelper.fifthNames[index] ?? "";
                this.#fifthPicker.appendChild(option);
                
            }
        }

        { // Add octave picker.
            this.#octavePicker = picker.appendChild(document.createElement("select"));
            this.#octavePicker.setAttribute("part", "control select");

            for (const name of ChordHelper.octaveNames.toReversed()) {
                const index = parseInt(name);
                const option = document.createElement("option");
                option.setAttribute("value", index.toString());
                option.innerText = name;
                this.#octavePicker.appendChild(option);
            }
        }

        { // Add submit button.
            this.#button = picker.appendChild(document.createElement("button"));
            this.#button.setAttribute("tabindex", "0");
            this.#button.setAttribute("part", "control button");
            this.#button.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "chordPushed",
                    {
                        bubbles: true,
                        detail: [
                            parseInt(this.#rootPicker.value),
                            parseInt(this.#thirdPicker.value),
                            parseInt(this.#fifthPicker.value),
                            parseInt(this.#octavePicker.value)
                        ]
                    }
                ));
            });
        }
    }

    updateButton() {
        const root = parseInt(this.#rootPicker.value);
        const third = parseInt(this.#thirdPicker.value);
        const fifth = parseInt(this.#fifthPicker.value);
        const chordName = ChordHelper.nameChord(root, third, fifth);
        const chordSpelling = ChordHelper.spellChord(root, third, fifth);
        if (chordName) {
            this.#button.innerText = `${chordName} (${chordSpelling})`;
            this.#button.disabled = false;
        } else {
            this.#button.innerText = "Chord undefined";
            this.#button.disabled = true;
        }
    }

    takeFocus() {
        this.#rootPicker.focus();
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "root") this.#rootPicker.value = newValue;
        if (name === "third") this.#thirdPicker.value = newValue;
        if (name === "fifth") this.#fifthPicker.value = newValue;
        if (name === "octave") this.#octavePicker.value = newValue;
        this.updateButton();
    }
}

customElements.define("chord-picker", ChordPickerElement);

declare global {
    interface HTMLElementTagNameMap {
        "chord-picker": ChordPickerElement;
    }
}

class ChordButtonElement extends HTMLElement {
    #root?: number;
    #third?: number;
    #fifth?: number;
    #octave: number = 0;

    #chord;
    #button;

    static observedAttributes = ["root", "third", "fifth", "octave"];

    constructor() {
        super();

        this.#chord = this.attachShadow({ mode: "closed" });
        
        { // Add button.
            this.#button = document.createElement("button");
            this.#button.setAttribute("tabindex", "0");
            this.#button.setAttribute("part", "button");
            this.#button.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "chordPushed",
                    {
                        bubbles: true,
                        detail: [
                            this.#root,
                            this.#third,
                            this.#fifth,
                            this.#octave
                        ]
                    }
                ));
            });
        }
    }

    #updateButton() {
        if (
            this.#root === undefined
            || this.#third === undefined
            || this.#fifth === undefined
        ) return;

        const chordName = ChordHelper.nameChord(this.#root, this.#third, this.#fifth);
        const chordSpelling = ChordHelper.spellChord(this.#root!, this.#third!, this.#fifth!);
        this.#button.innerText = `${chordName} (${chordSpelling})`;
        if (chordName) {
            this.#chord.appendChild(this.#button);
        } else if (this.#chord.contains(this.#button)) {
            this.#chord.removeChild(this.#button);
        }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "root") this.#root = parseInt(newValue);
        if (name === "third") this.#third = parseInt(newValue);
        if (name === "fifth") this.#fifth = parseInt(newValue);
        if (name === "octave") this.#octave = parseInt(newValue);
        this.#updateButton();
    }
}

customElements.define("chord-button", ChordButtonElement);

declare global {
    interface HTMLElementTagNameMap {
        "chord-button": ChordButtonElement;
    }
}

class ChordCollectionElement extends HTMLElement {
    #root?: number;
    #third?: number;
    #fifth?: number;
    #octave: number = 0;

    #collection;
    #firstChord;
    #secondChord;
    #thirdChord;

    static observedAttributes = ["root", "third", "fifth", "octave"];

    constructor() {
        super();

        this.#collection = this.attachShadow({ mode: "closed" });

        { // Create chord buttons, but don't append them yet.
            this.#firstChord = document.createElement("chord-button");
            this.#firstChord.setAttribute("exportparts", "button");
            this.#firstChord.setAttribute("part", "chord");
            this.#firstChord.addEventListener("chordPushed", event => this.#pushChord(event));
            this.#secondChord = document.createElement("chord-button");
            this.#secondChord.setAttribute("exportparts", "button");
            this.#secondChord.setAttribute("part", "chord");
            this.#secondChord.addEventListener("chordPushed", event => this.#pushChord(event));
            this.#thirdChord = document.createElement("chord-button");
            this.#thirdChord.setAttribute("exportparts", "button");
            this.#thirdChord.setAttribute("part", "chord");
            this.#thirdChord.addEventListener("chordPushed", event => this.#pushChord(event));
        }
    }

    #pushChord(event: CustomEvent<Chord>) {
        this.dispatchEvent(new CustomEvent<Chord>(
            "chordPushed",
            {
                bubbles: true,
                detail: event.detail
            }
        ));
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "root") {
            this.#root = parseInt(newValue);
            this.#updateChords();
        }
        if (name === "third") {
            this.#third = parseInt(newValue);
            this.#updateChords();
        }
        if (name === "fifth") {
            this.#fifth = parseInt(newValue);
            this.#updateChords();
        }
        if (name === "octave") {
            this.#octave = parseInt(newValue);
            this.#updateChords();
        }
    }

    #updateChords() {
        if (
            this.#root === undefined
            || this.#third === undefined
            || this.#fifth === undefined
        ) return;

        const inversions = ChordHelper.findInversions(this.#root, this.#third, this.#fifth, this.#octave);

        if (inversions[0]) {
            this.#firstChord.setAttribute("root", inversions[0][0].toString());
            this.#firstChord.setAttribute("third", inversions[0][1].toString());
            this.#firstChord.setAttribute("fifth", inversions[0][2].toString());
            this.#firstChord.setAttribute("octave", inversions[0][3].toString());
            this.#collection.appendChild(this.#firstChord);
        } else if (this.#collection.contains(this.#firstChord)) {
            this.#collection.removeChild(this.#firstChord);
        }

        if (inversions[1]) {
            this.#secondChord.setAttribute("root", inversions[1][0].toString());
            this.#secondChord.setAttribute("third", inversions[1][1].toString());
            this.#secondChord.setAttribute("fifth", inversions[1][2].toString());
            this.#secondChord.setAttribute("octave", inversions[1][3].toString());
            this.#collection.appendChild(this.#secondChord);
        } else if (this.#collection.contains(this.#secondChord)) {
            this.#collection.removeChild(this.#secondChord);
        }

        if (inversions[2]) {
            this.#thirdChord.setAttribute("root", inversions[2][0].toString());
            this.#thirdChord.setAttribute("third", inversions[2][1].toString());
            this.#thirdChord.setAttribute("fifth", inversions[2][2].toString());
            this.#thirdChord.setAttribute("octave", inversions[2][3].toString());
            this.#collection.appendChild(this.#thirdChord);
        } else if (this.#collection.contains(this.#thirdChord)) {
            this.#collection.removeChild(this.#thirdChord);
        }
    }
}

customElements.define("chord-collection", ChordCollectionElement);

declare global {
    interface HTMLElementTagNameMap {
        "chord-collection": ChordCollectionElement;
    }
}

class OctaveControlElement extends HTMLElement {
    #octave: number = 0;
    #disabled: boolean = false;

    #upButton;
    #downButton;

    static observedAttributes = ["octave", "disabled"];

    constructor() {
        super();

        const control = this.attachShadow({ mode: "closed" });

        { // Add up button.
            this.#upButton = control.appendChild(document.createElement("button"));
            this.#upButton.setAttribute("tabindex", "0");
            this.#upButton.setAttribute("part", "button");
            this.#upButton.innerText = "Octave Up";
            this.#upButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "octaveIncreased",
                    {
                        bubbles: true
                    }
                ));
            });
        }

        { // Add down button.
            this.#downButton = control.appendChild(document.createElement("button"));
            this.#downButton.setAttribute("tabindex", "0");
            this.#downButton.setAttribute("part", "button");
            this.#downButton.innerText = "Octave Down";
            this.#downButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "octaveDecreased",
                    {
                        bubbles: true
                    }
                ));
            });
        }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "octave") {
            this.#octave = parseInt(newValue);
            this.#updateOctave();
        }

        if (name === "disabled") {
            this.#disabled = newValue !== null;
            this.#updateOctave();
        }
    }

    #updateOctave() {
        this.#downButton.disabled = this.#disabled || this.#octave <= -3;
        this.#upButton.disabled = this.#disabled || this.#octave >= 3;
    }
}

customElements.define("octave-control", OctaveControlElement);

declare global {
    interface HTMLElementTagNameMap {
        "octave-control": OctaveControlElement;
    }
}

class EditingPanelElement extends HTMLElement {
    #disabled: boolean = false;
    #panel;
    #stopButton;
    #updateButton;
    #insertBeforeButton;
    #insertAfterButton;
    #deleteButton;

    static observedAttributes = ["disabled"];

    constructor() {
        super();

        this.#panel = this.attachShadow({ mode: "closed" });

        { // Add stop button. 
            this.#stopButton = this.#panel.appendChild(document.createElement("button"));
            this.#stopButton.setAttribute("tabindex", "0");
            this.#stopButton.setAttribute("part", "button");
            this.#stopButton.innerText = "Stop Editing";
            this.#stopButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "stop",
                    {
                        bubbles: true
                    }
                ));
            });
        }
        
        { // Add update button. 
            this.#updateButton = this.#panel.appendChild(document.createElement("button"));
            this.#updateButton.setAttribute("tabindex", "0");
            this.#updateButton.setAttribute("part", "button");
            this.#updateButton.innerText = "Update";
            this.#updateButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "updateChord",
                    {
                        bubbles: true
                    }
                ));
            });
        }
        
        { // Add insert before button. 
            this.#insertBeforeButton = this.#panel.appendChild(document.createElement("button"));
            this.#insertBeforeButton.setAttribute("tabindex", "0");
            this.#insertBeforeButton.setAttribute("part", "button");
            this.#insertBeforeButton.innerText = "Insert Before";
            this.#insertBeforeButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "insertChordBefore",
                    {
                        bubbles: true
                    }
                ));
            });
        }
        
        { // Add insert after button. 
            this.#insertAfterButton = this.#panel.appendChild(document.createElement("button"));
            this.#insertAfterButton.setAttribute("tabindex", "0");
            this.#insertAfterButton.setAttribute("part", "button");
            this.#insertAfterButton.innerText = "Insert After";
            this.#insertAfterButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "insertChordAfter",
                    {
                        bubbles: true
                    }
                ));
            });
        }
        
        { // Add delete button. 
            this.#deleteButton = this.#panel.appendChild(document.createElement("button"));
            this.#deleteButton.setAttribute("tabindex", "0");
            this.#deleteButton.setAttribute("part", "button");
            this.#deleteButton.innerText = "Delete";
            this.#deleteButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent(
                    "deleteChord",
                    {
                        bubbles: true
                    }
                ));
            });
        }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "disabled") {
            this.#disabled = newValue !== null;
            this.#updateButtons();
        }
    }

    #updateButtons() {
        if (this.#disabled) {
            this.#panel.removeChild(this.#stopButton);
            this.#panel.removeChild(this.#updateButton);
            this.#panel.removeChild(this.#insertBeforeButton);
            this.#panel.removeChild(this.#insertAfterButton);
            this.#panel.removeChild(this.#deleteButton);
        } else {
            this.#panel.appendChild(this.#stopButton);
            this.#panel.appendChild(this.#updateButton);
            this.#panel.appendChild(this.#insertBeforeButton);
            this.#panel.appendChild(this.#insertAfterButton);
            this.#panel.appendChild(this.#deleteButton);
        }
    }
}

customElements.define("editing-panel", EditingPanelElement);

declare global {
    interface HTMLElementTagNameMap {
        "editing-panel": EditingPanelElement;
    }
}

class ChordGraphElement extends HTMLElement {
    #root?: number;
    #third?: number;
    #fifth?: number;
    #octave: number = 0;
    #activeChord: boolean = false;
    #editing: boolean = false;

    #currentChordCollection: ChordCollectionElement;
    #raiseRootCollection: ChordCollectionElement;
    #lowerRootCollection: ChordCollectionElement;
    #raiseThirdCollection: ChordCollectionElement;
    #lowerThirdCollection: ChordCollectionElement;
    #raiseFifthCollection: ChordCollectionElement;
    #lowerFifthCollection: ChordCollectionElement;

    #editingPanel: EditingPanelElement;
    #octaveControl: OctaveControlElement;

    static observedAttributes = ["root", "third", "fifth", "octave", "active-chord", "editing"];

    constructor() {
        super();

        const graph = this.attachShadow({ mode: "closed" });
        
        { // Add styles.
            const style = new CSSStyleSheet();
            style.insertRule(`
            :host > * {
                display: table;
                border-spacing: 0.75em;

                & > * {
                    display: table-row;

                    & > * {
                        display: table-cell;
                        vertical-align: middle;
                        width: var(--chord-width);
                        height: 6em;
                    }
                }
            }`);
            style.insertRule(`
            chord-collection {
                border: var(--border);
                border-radius: var(--border-radius);
                background-color: var(--button-background-color);
                padding: 0 0.25em;
            }`);
            style.insertRule(`
            chord-collection {
                border: var(--border);
                border-radius: var(--border-radius);
                background-color: var(--button-background-color);
                padding: 0 0.25em;
            }`);
            style.insertRule(`
            editing-panel::part(button),
            chord-collection::part(button),
            octave-control::part(button) {
                margin: 0.25em 0;
                width: 100%;
            }`);
            style.insertRule(`
            chord-collection::part(button) {
                border: 0;
                line-height: 0.9em;
                text-align: left;
                cursor: pointer;
                background-color: transparent;
            }`);
            graph.adoptedStyleSheets = [style];
        }

        { // Add table.
            const table = graph.appendChild(document.createElement("div"));

            { // Add top-level event handlers.
                table.addEventListener("chordPushed", (event) =>  this.dispatchEvent(new CustomEvent<Chord>(
                    "chordPushed",
                    {
                        bubbles: true,
                        detail: event.detail
                    }
                )));
                table.addEventListener("octaveIncreased", () => this.dispatchEvent(new Event(
                    "octaveIncreased",
                    {
                        bubbles: true
                    }
                )));
                table.addEventListener("octaveDecreased", () => this.dispatchEvent(new Event(
                    "octaveDecreased",
                    {
                        bubbles: true
                    }
                )));
                table.addEventListener("stop", () => this.dispatchEvent(new Event(
                    "stopEditing",
                    {
                        bubbles: true
                    }
                )));
            }

            const editingPanelExportedParts = "button, button:panel-button";
            const octaveControlExportedParts = "button, button:panel-button";
            const chordCollectionExportedParts = "button";

            { // Add top row.
                const topRow = table.appendChild(document.createElement("div"));
                this.#editingPanel = topRow.appendChild(document.createElement("editing-panel"));
                this.#editingPanel.setAttribute("exportparts", editingPanelExportedParts);
                this.#editingPanel.setAttribute("disabled", "");
                this.#raiseRootCollection = topRow.appendChild(document.createElement("chord-collection"));
                this.#raiseRootCollection.setAttribute("exportparts", chordCollectionExportedParts);
                this.#raiseThirdCollection = topRow.appendChild(document.createElement("chord-collection"));
                this.#raiseThirdCollection.setAttribute("exportparts", chordCollectionExportedParts);
            }

            { // Add middle row.
                const middleRow = table.appendChild(document.createElement("div"));
                this.#lowerFifthCollection = middleRow.appendChild(document.createElement("chord-collection"));
                this.#lowerFifthCollection.setAttribute("exportparts", chordCollectionExportedParts);
                this.#currentChordCollection = middleRow.appendChild(document.createElement("chord-collection"));
                this.#currentChordCollection.setAttribute("exportparts", chordCollectionExportedParts);
                this.#raiseFifthCollection = middleRow.appendChild(document.createElement("chord-collection"));
                this.#raiseFifthCollection.setAttribute("exportparts", chordCollectionExportedParts);
            }
            
            { // Add bottom row.
                const bottomRow = table.appendChild(document.createElement("div"));
                this.#lowerThirdCollection = bottomRow.appendChild(document.createElement("chord-collection"));
                this.#lowerThirdCollection.setAttribute("exportparts", chordCollectionExportedParts);
                this.#lowerRootCollection = bottomRow.appendChild(document.createElement("chord-collection"));
                this.#lowerRootCollection.setAttribute("exportparts", chordCollectionExportedParts);
                this.#octaveControl = bottomRow.appendChild(document.createElement("octave-control"));
                this.#octaveControl.setAttribute("exportparts", octaveControlExportedParts);
            }
        }
    }
    
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "root") {
            this.#root = parseInt(newValue);
            this.#updateChordCollections();
        }
        if (name === "third") {
            this.#third = parseInt(newValue);
            this.#updateChordCollections();
        }
        if (name === "fifth") {
            this.#fifth = parseInt(newValue);
            this.#updateChordCollections();
        }
        if (name === "octave") {
            this.#octave = parseInt(newValue);
            this.#updateChordCollections();
            this.#updateOctave();
        }
        if (name === "active-chord") {
            this.#activeChord = newValue !== null;
            this.#updateOctave();
        }
        if (name === "editing") {
            this.#editing = newValue !== null;
            this.#updateEditingPanel();
        }
    }

    #updateChordCollection(chordCollection: ChordCollectionElement, root: number, third: number, fifth: number, octave: number) {
        chordCollection.setAttribute("root", root.toString());
        chordCollection.setAttribute("third", third.toString());
        chordCollection.setAttribute("fifth", fifth.toString());
        chordCollection.setAttribute("octave", octave.toString());
    }

    #updateChordCollections() {
        if (
            this.#root === undefined
            || this.#third === undefined
            || this.#fifth === undefined
            || this.#octave === undefined
        ) return;

        this.#updateChordCollection(this.#raiseRootCollection, ...ChordHelper.raiseRoot(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#raiseThirdCollection, ...ChordHelper.raiseThird(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#lowerFifthCollection, ...ChordHelper.lowerFifth(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#currentChordCollection, this.#root, this.#third, this.#fifth, this.#octave);
        this.#updateChordCollection(this.#raiseFifthCollection, ...ChordHelper.raiseFifth(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#lowerThirdCollection, ...ChordHelper.lowerThird(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#lowerRootCollection, ...ChordHelper.lowerRoot(this.#root, this.#third, this.#fifth, this.#octave));
    }

    #updateOctave() {
        if (this.#activeChord) {
            this.#octaveControl.removeAttribute("disabled");
        } else {
            this.#octaveControl.setAttribute("disabled", "");
        }
        this.#octaveControl.setAttribute("octave", this.#octave.toString());
    }

    #updateEditingPanel() {
        if (this.#editing) {
            this.#editingPanel.removeAttribute("disabled");
        } else {
            this.#editingPanel.setAttribute("disabled", "");
        }
    }
}

customElements.define("chord-graph", ChordGraphElement);

declare global {
    interface HTMLElementTagNameMap {
        "chord-graph": ChordGraphElement;
    }
}

class ChordSheetElement extends HTMLElement {
    #container;
    #width = 0;
    #selectedChords = new Set();

    constructor() {
        super();

        const sheet = this.attachShadow({ mode: "closed" });
        const style = new CSSStyleSheet();
        style.insertRule(`
        div {
            display: flex;
            justify-content: center;
            width: 100% !important;
        }`);
        style.insertRule(`
        .vf-stavenote.selected:not(.playing) {
            fill: var(--selected-color);

            & + text {
                fill: var(--selected-text-color);
            }
        }`);
        style.insertRule(`
        .vf-stavenote.playing {
            fill: var(--playing-color);

            & + text {
                fill: var(--playing-text-color);
            }
        }`);
        style.insertRule(`
        .vf-stavenote, text {
            cursor: pointer;
        }`);
        sheet.adoptedStyleSheets = [style];

        this.#container = document.createElement("div");
        this.#container.addEventListener("click", () => {
            this.clearSelection();
            this.dispatchEvent(new CustomEvent("selectionCleared"));
        });
        sheet.appendChild(this.#container);

        const resizeObserver = new ResizeObserver((entries) => {
            this.#width = entries[0]!.contentBoxSize[0]!.inlineSize;
            this.#render();
        });

        resizeObserver.observe(this);
    }

    #chords: State = [];

    set chords(newChords: State) {
        if (this.#chords === newChords) return;
        this.#chords = newChords;
        this.#render();
    }

    get #staveWidth() {
        return this.#width - StaveHelper.metrics.horizontalMargin * 2;
    }

    playChord(index: number) {
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.add("playing");
    }

    stopChord(index: number) {
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.remove("playing");
    }

    stopPlayback() {
        this.#container.querySelectorAll(".vf-stavenote.playing")?.forEach(chord => chord.classList.remove("playing"));
    }

    selectChord(index: number) {
        this.clearSelection()
        this.#selectedChords.add(index);
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.add("selected");
    }

    #selectChord(index: number) {
        this.selectChord(index);
        this.dispatchEvent(new CustomEvent("chordSelected", { detail: { index } }));
    }

    deselectChord(index: number) {
        this.#selectedChords.delete(index);
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.remove("selected");
    }

    #deselectChord(index: number) {
        this.deselectChord(index);
        this.dispatchEvent(new CustomEvent("chordDeselected", { detail: { index } }));
    }

    clearSelection() {
        this.#selectedChords.clear();
        this.#container.querySelectorAll(".vf-stavenote.selected")?.forEach(chord => chord.classList.remove("selected"));
    }

    chordClicked(index: number, event: Event) {
        if (this.#selectedChords.has(index)) {
            this.#deselectChord(index);
        } else {
            this.#selectChord(index);
        }
        event.stopPropagation();
    }

    #render() {
        const notes = this.#chords.map(chord => StaveHelper.createChord(...chord));
        const chordNames = this.#chords.map(chord => StaveHelper.nameChord(chord[0], chord[1], chord[2]));
        
        const maxChords = Math.floor((this.#staveWidth) / StaveHelper.metrics.chordWidth);
        const staveCount = Math.max(1, Math.ceil(notes.length / maxChords));

        this.#container.textContent = "";
        const renderer = new Renderer(this.#container, Renderer.Backends.SVG);
        const canvasWidth = this.#width;
        const canvasHeight = StaveHelper.metrics.topMargin + staveCount * StaveHelper.metrics.staveHeight;
        renderer.resize(canvasWidth, canvasHeight);
        const context = renderer.getContext();

        for (let staveIndex = 0; staveIndex < staveCount || staveIndex === 0; ++staveIndex) {
            const staveNotes = notes.slice(staveIndex * maxChords, (staveIndex + 1) * maxChords);
            const staveChordNames = chordNames.slice(staveIndex * maxChords, (staveIndex + 1) * maxChords);
            const top = StaveHelper.metrics.topMargin + staveIndex * (StaveHelper.metrics.staveHeight);
            this.#renderStave(staveNotes, staveChordNames, context, top);
        }

        const chordElements = this.#container.querySelectorAll(".vf-stavenote");

        for (const index of chordElements.keys()) {
            const chordElement = chordElements[index]!;
            if (this.#selectedChords.has(index)) {
                chordElement.classList.add("selected");
            }
            chordElement.setAttribute("pointer-events", "bounding-box");
            chordElement.addEventListener("click", (event) => this.chordClicked(index, event));
            const chordLabel = chordElement.nextSibling! as SVGTextElement;
            chordLabel.addEventListener("click", (event) => this.chordClicked(index, event));
            chordLabel.addEventListener("focus", () => {
                if (
                    chordLabel.matches(":focus-visible")
                    && !this.#selectedChords.has(index)
                ) {
                    this.#selectChord(index);
                }
            });
            chordLabel.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    this.dispatchEvent(new CustomEvent("chordPicked", { detail: { index } }));
                    event.preventDefault();
                }
            });
            chordLabel.setAttribute("tabindex", "0");
        }
    }

    #renderStave(notes: StaveNote[], chordNames: TextNote[], context: RenderContext, top: number) {
        const noteWidth = (this.#staveWidth - StaveHelper.metrics.clefWidth) / notes.length;
        for (const noteIndex in notes) {
            const measureWidth = noteWidth;
            const leftEdge = StaveHelper.metrics.horizontalMargin + noteWidth * parseInt(noteIndex);
            const stave = new Stave(leftEdge, top, measureWidth);
            stave.setContext(context);
            if (noteIndex === "0") {
                stave.addClef("treble");
            }

            const voice = new Voice({ num_beats: 1, beat_value: 1 }).setContext(context);
            voice.addTickables([notes[noteIndex]!]).setStave(stave);

            const chordNameVoice = new Voice({ num_beats: 1, beat_value: 1 }).setContext(context);
            chordNames[noteIndex]!.setStave(stave);
            chordNameVoice.addTickables([chordNames[noteIndex]!]).setStave(stave);

            new Formatter().joinVoices([voice, chordNameVoice]).formatToStave([voice, chordNameVoice], stave);
            stave.draw();
            voice.draw();
            chordNameVoice.draw();
        }
    }
}

customElements.define("chord-sheet", ChordSheetElement);

declare global {
    interface HTMLElementTagNameMap {
        "chord-sheet": ChordSheetElement;
    }
}

class ChordDancerElement extends HTMLElement {
    #chordHistory: ChordHistory;
    #chordPlayer: ChordPlayer;
    #volumeSlider: VolumeSliderElement;
    #chordPicker: ChordPickerElement;
    #chordGraph: ChordGraphElement;
    #chordSheet: ChordSheetElement;

    #undoButton: HTMLButtonElement;
    #redoButton: HTMLButtonElement;
    #clearButton: HTMLButtonElement;
    #playButton: HTMLButtonElement;
    #stopButton: HTMLButtonElement;

    #editingIndex: number | undefined = undefined

    constructor() {
        super();

        const dancer = this.attachShadow({ mode: "closed" });
        const body = dancer.appendChild(document.createElement("div"));
        body.id = "body";

        { // Add styles.
            const style = new CSSStyleSheet();

            style.insertRule(`
            #body,
            chord-picker,
            chord-graph {
                --border: var(--border-width) solid var(--border-color);
            }`);

            { // Add layout rules.
                style.insertRule(`
                #body {
                    display: flex;
                    font-size: 1.2rem;
                    flex-direction: column;
                    align-items: center;
                }`);

                style.insertRule(`
                .buttons, chord-picker {
                    margin: 1em 0;
                }`);

                style.insertRule(`
                chord-sheet {
                    width: 100%;
                }`);
            }

            { // Add color rules.
                style.insertRule(`
                #body,
                chord-picker,
                chord-graph {
                    --button-text-color: oklch(from var(--theme-color) 30% 30% h);
                    --button-background-color: oklch(from var(--theme-color) 98% 2% h);
                    --button-active-background-color: oklch(from var(--theme-color) 94% 10% h);
                    --button-hover-background-color: oklch(from var(--theme-color) 90% 10% h);
                    --border-color: oklch(from var(--theme-color) 80% 20% h);
                    --button-disabled-text-color: oklch(from var(--theme-color) 80% 10% h);
                    --button-disabled-border-color: oklch(from var(--theme-color) 90% 10% h);
                    --button-disabled-background-color: oklch(from var(--theme-color) 95% 2% h);
                }`);

                style.insertRule(`
                chord-sheet {
                    --playing-color: oklch(from var(--theme-color) 60% 30% h);
                    --playing-text-color: oklch(from var(--theme-color) 50% 50% h);
                    --selected-color: oklch(from var(--edit-color) 60% 30% h);
                    --selected-text-color: oklch(from var(--edit-color) 50% 50% h);

                    &[inserting] {
                        --edit-color: var(--insert-color);
                    }
                }`);

                style.insertRule(`
                chord-picker,
                chord-graph {
                    &[editing] {
                        --theme-color: var(--edit-color);
                    }

                    &[inserting] {
                        --theme-color: var(--insert-color);
                    }
                }`);
            }

            { // Add button rules.
                style.insertRule(`
                button,
                chord-picker::part(control) {
                    margin: 0 0.4em;
                }`);

                style.insertRule(`
                button,
                chord-picker::part(control),
                chord-graph::part(panel-button) {
                    border: var(--border);
                    background-color: var(--button-background-color);
                }`);

                style.insertRule(`
                button,
                chord-picker::part(control),
                chord-graph::part(button) {
                    color: var(--button-text-color);
                    border-radius: var(--border-radius);
                    padding: 0.25em 0.4em;
                    font-size: 1em;
                }`);


                // Nesting/is on pseudo-elements isn't supported: https://github.com/w3c/csswg-drafts/issues/9702
                style.insertRule(`
                button:focus-visible:not(:hover, :active, :disabled),
                chord-picker::part(control):focus-visible:not(:hover, :active, :disabled),
                chord-graph::part(button):focus-visible:not(:hover, :active, :disabled)
                {
                    background-color: var(--button-active-background-color);
                }`);

                style.insertRule(`
                button:hover:not(:active, :disabled),
                chord-picker::part(control):hover:not(:active, :disabled),
                chord-graph::part(button):hover:not(:active, :disabled)
                {
                    background-color: var(--button-hover-background-color);
                }`);

                style.insertRule(`
                button:active:not(:disabled),
                chord-picker::part(button):active:not(:disabled),
                chord-graph::part(button):active:not(:disabled)
                {
                    background-color: var(--button-active-background-color);
                }`);

                style.insertRule(`
                button:disabled,
                chord-graph::part(panel-button):disabled {
                    color: var(--button-disabled-text-color);
                    border-color: var(--button-disabled-border-color);
                    background-color: var(--button-disabled-background-color);
                }`);
            }
            dancer.adoptedStyleSheets = [style];
        }

        { // Add chord history.
            this.#chordHistory = new ChordHistory();
            this.#chordHistory.addEventListener("stateUpdated", () => {
                this.#updateUI();
            });
        }
        
        { // Add chord player.
            this.#chordPlayer = new ChordPlayer();

            this.#chordPlayer.addEventListener("chordStarted", event => {
                this.#chordSheet.playChord(event.detail.index);
            });
            this.#chordPlayer.addEventListener("chordEnded", event => {
                this.#chordSheet.stopChord(event.detail.index);
            });
            this.#chordPlayer.addEventListener("playbackStarted", () => {
                this.#stopButton.disabled = false;
            });
            this.#chordPlayer.addEventListener("playbackEnded", () => {
                this.#stopButton.disabled = true;
                this.#chordSheet.stopPlayback();
            });
        }

        { // Add volume slider.
            this.#volumeSlider = body.appendChild(document.createElement("volume-slider"));
            this.#volumeSlider.value = this.#chordPlayer.volume.toString();
            this.#volumeSlider.addEventListener("input", () => this.#chordPlayer.volume = parseInt(this.#volumeSlider.value));
        }

        { // Add chord picker.
            this.#chordPicker = body.appendChild(document.createElement("chord-picker"));
            this.#chordPicker.addEventListener("chordPushed", event => {
                this.#pushChord(event);
            });
        }

        { // Add chord graph.
            this.#chordGraph = body.appendChild(document.createElement("chord-graph"));
            this.#chordGraph.addEventListener("stopEditing", () => {
                this.#handleDeselection();
            });
            this.#chordGraph.addEventListener("chordPushed", event => {
                this.#pushChord(event);
            });
            this.#chordGraph.addEventListener("octaveIncreased", () => {
                if (this.#editingIndex === undefined) this.#chordHistory.increaseOctave();
                else this.#chordHistory.increaseOctave(this.#editingIndex);
            });
            this.#chordGraph.addEventListener("octaveDecreased", () => {
                if (this.#editingIndex === undefined) this.#chordHistory.decreaseOctave();
                else this.#chordHistory.decreaseOctave(this.#editingIndex);
            });
        }

        { // Add edit buttons.
            const editButtons = body.appendChild(document.createElement("div"));
            editButtons.classList.add("buttons");
            
            this.#undoButton = editButtons.appendChild(document.createElement("button"));
            this.#undoButton.tabIndex = 0;
            this.#undoButton.append(document.createTextNode("Undo"));
            this.#undoButton.addEventListener("click", () => {
                this.#editingIndex = -1;
                this.#chordHistory.undo();
            });

            this.#redoButton = editButtons.appendChild(document.createElement("button"));
            this.#redoButton.tabIndex = 0;
            this.#redoButton.append(document.createTextNode("Redo"));
            this.#redoButton.addEventListener("click", () => {
                this.#editingIndex = -1;
                this.#chordHistory.redo();
            });

            this.#clearButton = editButtons.appendChild(document.createElement("button"));
            this.#clearButton.tabIndex = 0;
            this.#clearButton.append(document.createTextNode("Clear"));
            this.#clearButton.addEventListener("click", () => {
                this.#editingIndex = undefined;
                this.#chordHistory.clear();
            });
        }

        { // Add player buttons.
            const playerButtons = body.appendChild(document.createElement("div"));
            playerButtons.classList.add("buttons");

            this.#playButton = playerButtons.appendChild(document.createElement("button"));
            this.#playButton.tabIndex = 0;
            this.#playButton.append(document.createTextNode("Play"));
            this.#playButton.addEventListener("click", () => this.#chordPlayer.playChords(this.#chordHistory));
            
            this.#stopButton = playerButtons.appendChild(document.createElement("button"));
            this.#stopButton.tabIndex = 0;
            this.#stopButton.append(document.createTextNode("Stop"));
            this.#stopButton.addEventListener("click", () => this.#chordPlayer.stopPlayback());
        }

        { // Add chord sheet.
            this.#chordSheet = body.appendChild(document.createElement("chord-sheet"));
            this.#chordSheet.addEventListener("chordSelected", (event) => {
                this.#editingIndex = event.detail.index;
                this.#updateUI();
            });
            this.#chordSheet.addEventListener("chordDeselected", () => this.#handleDeselection());
            this.#chordSheet.addEventListener("selectionCleared", () => this.#handleDeselection());
            this.#chordSheet.addEventListener("chordPicked", () => {
                this.#chordPicker.takeFocus();
            });
        }
    
        this.#updateUI();
    }

    #pushChord(event: CustomEvent<Chord>) {
        if (this.#editingIndex === undefined) this.#chordHistory.push(event.detail);
        else this.#chordHistory.edit(this.#editingIndex, event.detail);
    }

    #handleDeselection() {
        if (this.#editingIndex !== undefined) {
            this.#editingIndex = undefined;
            this.#updateUI();
        }
    }

    #setChord(root: number, third: number, fifth: number, octave: number) {
        this.#chordGraph.setAttribute("root", root.toString());
        this.#chordGraph.setAttribute("third", third.toString());
        this.#chordGraph.setAttribute("fifth", fifth.toString());
        this.#chordGraph.setAttribute("octave", octave.toString());

        this.#chordPicker.setAttribute("root", root.toString());
        this.#chordPicker.setAttribute("third", third.toString());
        this.#chordPicker.setAttribute("fifth", fifth.toString());
        this.#chordPicker.setAttribute("octave", octave.toString());
    }

    #updateUI() {
        this.#chordPlayer.stopPlayback();
        this.#stopButton.disabled = true;

        if (this.#editingIndex === -1) this.#editingIndex = this.#chordHistory.selectedIndex;
        if (this.#editingIndex !== undefined) {
            this.#chordPicker.setAttribute("editing", "");
            this.#chordGraph.setAttribute("editing", "");
        } else {
            this.#chordPicker.removeAttribute("editing");
            this.#chordGraph.removeAttribute("editing");
        }

        if (
            this.#chordHistory.latestChord &&
            (
                this.#editingIndex === undefined
                || this.#editingIndex < this.#chordHistory.length
            )
        ) {
            const chord = this.#editingIndex !== undefined
                ? this.#chordHistory.getChord(this.#editingIndex)!
                : this.#chordHistory.latestChord;
            this.#setChord(...chord);
            this.#chordGraph.setAttribute("active-chord", "");
            this.#chordPlayer.playChord(...chord);
            this.#clearButton.disabled = false;
            this.#playButton.disabled = false;
        } else {
            this.#setChord(0, ChordHelper.thirds.maj, ChordHelper.fifths.perf, 0);
            this.#chordGraph.removeAttribute("active-chord");
            this.#clearButton.disabled = true;
            this.#playButton.disabled = true;
        }

        this.#undoButton.disabled = !this.#chordHistory.canUndo;
        this.#redoButton.disabled = !this.#chordHistory.canRedo;

        this.#chordSheet.chords = this.#chordHistory.currentChords;
        if (this.#editingIndex !== undefined) this.#chordSheet.selectChord(this.#editingIndex);
        else this.#chordSheet.clearSelection();
    }
}

customElements.define("chord-dancer", ChordDancerElement);

declare global {
    interface HTMLElementTagNameMap {
        "chord-dancer": ChordDancerElement;
    }
}