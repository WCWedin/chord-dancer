import { ChordHelper } from "../core/ChordHelper.mjs";
import type { ChordEvent } from "../core/types.mjs";

export class ChordPickerElement extends HTMLElement {
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
                ) as ChordEvent);
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

export function initChordPickerElement() {
    customElements.define("chord-picker", ChordPickerElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-picker": ChordPickerElement;
    }
}
