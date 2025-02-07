import { ChordHelper } from "../core/ChordHelper.mjs";
import type { Chord } from "../core/types.mjs";
import { type ChordCollectionElement, initChordCollectionElement } from "./ChordCollectionElement.mjs";
import { type EditingPanelElement, initEditingPanelElement } from "./EditingPanelElement.mjs";
import { type OctaveControlElement, initOctaveControlElement } from "./OctaveControlElement.mjs";

export class ChordGraphElement extends HTMLElement {
    #root?: number;
    #third?: number;
    #fifth?: number;
    #octave: number = 0;
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

    static observedAttributes = ["root", "third", "fifth", "octave", "editing"];

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
                table.addEventListener("chordPushed", (event) => this.dispatchEvent(new CustomEvent<Chord>(
                    "chordPushed",
                    {
                        bubbles: true,
                        detail: event.detail
                    }
                )));
                table.addEventListener("octaveIncreased", () => {
                    ++this.#octave;
                    this.setAttribute("octave", this.#octave.toString());
                    this.#dispatchOctaveChange();
                });
                table.addEventListener("octaveDecreased", () => {
                    --this.#octave;
                    this.setAttribute("octave", this.#octave.toString());
                    this.#dispatchOctaveChange();
                });
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
            this.#updateOctave();
            this.#updateChordCollections();
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
        if (this.#root === undefined
            || this.#third === undefined
            || this.#fifth === undefined
            || this.#octave === undefined) return;

        this.#updateChordCollection(this.#raiseRootCollection, ...ChordHelper.raiseRoot(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#raiseThirdCollection, ...ChordHelper.raiseThird(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#lowerFifthCollection, ...ChordHelper.lowerFifth(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#currentChordCollection, this.#root, this.#third, this.#fifth, this.#octave);
        this.#updateChordCollection(this.#raiseFifthCollection, ...ChordHelper.raiseFifth(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#lowerThirdCollection, ...ChordHelper.lowerThird(this.#root, this.#third, this.#fifth, this.#octave));
        this.#updateChordCollection(this.#lowerRootCollection, ...ChordHelper.lowerRoot(this.#root, this.#third, this.#fifth, this.#octave));
    }

    #updateOctave() {
        this.#octaveControl.setAttribute("octave", this.#octave.toString());
    }

    #updateEditingPanel() {
        if (this.#editing) {
            this.#editingPanel.removeAttribute("disabled");
        } else {
            this.#editingPanel.setAttribute("disabled", "");
        }
    }

    #dispatchOctaveChange() {
        this.dispatchEvent(new CustomEvent<Chord>(
            this.#editing ? "chordPushed" : "chordPicked",
            {
                bubbles: true,
                detail: [
                    this.#root!,
                    this.#third!,
                    this.#fifth!,
                    this.#octave
                ]
            }
        ));
    }
}

export function initChordGraphElement() {
    initChordCollectionElement();
    initEditingPanelElement();
    initOctaveControlElement();
    customElements.define("chord-graph", ChordGraphElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-graph": ChordGraphElement;
    }
}
