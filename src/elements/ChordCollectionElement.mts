import { ChordHelper } from "../core/ChordHelper.mjs";
import { initChordButtonElement } from "./ChordButtonElement.mjs"
import type { Chord, ChordEvent } from "../core/types.mjs";

export class ChordCollectionElement extends HTMLElement {
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
        ) as ChordEvent);
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
        if (this.#root === undefined
            || this.#third === undefined
            || this.#fifth === undefined) return;

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

export function initChordCollectionElement() {
    initChordButtonElement();
    customElements.define("chord-collection", ChordCollectionElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-collection": ChordCollectionElement;
    }
}
