import { ChordHelper } from "../core/ChordHelper.mjs";
import type { Chord, ChordEvent } from "../core/types.mjs";

export class ChordPickerElement extends HTMLElement {
    #rootPicker: HTMLSelectElement;
    #thirdPicker: HTMLSelectElement;
    #fifthPicker: HTMLSelectElement;
    #octavePicker: HTMLSelectElement;
    #submitButton: HTMLButtonElement;
    #resetButton: HTMLButtonElement;

    static observedAttributes = ["root", "third", "fifth", "octave"];

    get #chord(): Chord {
        return [
            parseInt(this.#rootPicker.value),
            parseInt(this.#thirdPicker.value),
            parseInt(this.#fifthPicker.value),
            parseInt(this.#octavePicker.value)
        ]
    }

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
            this.#rootPicker.addEventListener("change", () => {
                this.#handleChordPicked();
                this.#updateButton();
            });

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
            this.#thirdPicker.addEventListener("change", () => {
                this.#handleChordPicked();
                this.#updateButton();
            });

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
            this.#fifthPicker.addEventListener("change", () => {
                this.#handleChordPicked();
                this.#updateButton();
            });

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
            this.#octavePicker.addEventListener("change", () => {
                this.#handleChordPicked();
            });

            for (const name of ChordHelper.octaveNames.toReversed()) {
                const index = parseInt(name);
                const option = document.createElement("option");
                option.setAttribute("value", index.toString());
                option.innerText = name;
                this.#octavePicker.appendChild(option);
            }
        }

        { // Add submit button.
            this.#submitButton = picker.appendChild(document.createElement("button"));
            this.#submitButton.setAttribute("tabindex", "0");
            this.#submitButton.setAttribute("part", "control button");
            this.#submitButton.addEventListener("click", () => {
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
                ) as ChordEvent);
            });
        }

        { // Add reset button.
            this.#resetButton = picker.appendChild(document.createElement("button"));
            this.#resetButton.setAttribute("tabindex", "0");
            this.#resetButton.setAttribute("part", "control button");
            this.#resetButton.innerText = "Reset";
            this.#resetButton.addEventListener("click", () => this.#reset());
        }
    }

    takeFocus() {
        this.#rootPicker.focus();
    }

    #updateButton() {
        const root = parseInt(this.#rootPicker.value);
        const third = parseInt(this.#thirdPicker.value);
        const fifth = parseInt(this.#fifthPicker.value);
        const chordName = ChordHelper.nameChord(root, third, fifth);
        const chordSpelling = ChordHelper.spellChord(root, third, fifth);
        if (chordName) {
            this.#submitButton.innerText = `${chordName} (${chordSpelling})`;
            this.#submitButton.disabled = false;
        } else {
            this.#submitButton.innerText = "Chord undefined";
            this.#submitButton.disabled = true;
        }
    }

    #handleChordPicked() {
        this.dispatchEvent(new CustomEvent<Chord>("chordPicked", { detail: this.#chord }));
        this.#updateResetButton();
    }

    #updateResetButton() {
        this.#resetButton.disabled = 
            this.#rootPicker.value === this.getAttribute("root")
            && this.#thirdPicker.value === this.getAttribute("third")
            && this.#fifthPicker.value === this.getAttribute("fifth")
            && this.#octavePicker.value === this.getAttribute("octave");
    }

    #reset() {
        this.#rootPicker.value = this.getAttribute("root")!;
        this.#thirdPicker.value = this.getAttribute("third")!;
        this.#fifthPicker.value = this.getAttribute("fifth")!;
        this.#octavePicker.value = this.getAttribute("octave")!;

        this.dispatchEvent(new CustomEvent<Chord>("chordPicked", { detail: this.#chord }));
        this.#resetButton.disabled = true;
        this.#updateButton();
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "root") this.#rootPicker.value = newValue;
        if (name === "third") this.#thirdPicker.value = newValue;
        if (name === "fifth") this.#fifthPicker.value = newValue;
        if (name === "octave") this.#octavePicker.value = newValue;

        this.#resetButton.disabled = true;
        this.#updateButton();
    }

    pickChord(chord: Chord) {
        this.#rootPicker.value = chord[0].toString();
        this.#thirdPicker.value = chord[1].toString();
        this.#fifthPicker.value = chord[2].toString();
        this.#octavePicker.value = chord[3].toString();
        this.#updateResetButton();
    }
}

export function initChordPickerElement() {
    customElements.define("chord-picker", ChordPickerElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-picker": ChordPickerElement;
    }
}
