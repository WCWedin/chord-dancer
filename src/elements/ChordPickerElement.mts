import { ChordHelper } from "../core/ChordHelper.mjs";
import { defineElement } from "../core/dom.mjs";
import type { Chord } from "../core/types.mjs";

export class ChordPickerElement extends HTMLElement {
    #rootPicker: HTMLSelectElement;
    #thirdPicker: HTMLSelectElement;
    #fifthPicker: HTMLSelectElement;
    #octavePicker: HTMLSelectElement;

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
    }

    takeFocus() {
        this.#rootPicker.focus();
    }

    #handleChordPicked() {
        this.dispatchEvent(new CustomEvent<Chord>("chordPicked", { detail: this.#chord }));
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        if (name === "root") this.#rootPicker.value = newValue;
        if (name === "third") this.#thirdPicker.value = newValue;
        if (name === "fifth") this.#fifthPicker.value = newValue;
        if (name === "octave") this.#octavePicker.value = newValue;
    }

    pickChord(chord: Chord) {
        this.#rootPicker.value = chord[0].toString();
        this.#thirdPicker.value = chord[1].toString();
        this.#fifthPicker.value = chord[2].toString();
        this.#octavePicker.value = chord[3].toString();
        this.#handleChordPicked();
    }
}

export function initChordPickerElement() {
    defineElement("chord-picker", ChordPickerElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-picker": ChordPickerElement;
    }
}
