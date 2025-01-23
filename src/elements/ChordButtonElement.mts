import { ChordHelper } from "../core/ChordHelper.mjs";
import type { ChordEvent } from "../core/types.mjs";

export class ChordButtonElement extends HTMLElement {
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
                ) as ChordEvent);
            });
        }
    }

    #updateButton() {
        if (this.#root === undefined
            || this.#third === undefined
            || this.#fifth === undefined) return;

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

export function initChordButtonElement() {
    customElements.define("chord-button", ChordButtonElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-button": ChordButtonElement;
    }
}
