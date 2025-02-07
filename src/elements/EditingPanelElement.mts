import { ChordHelper } from "../core/ChordHelper.mjs";
import { defineElement } from "../core/dom.mjs";
import type { Chord } from "../core/types.mjs";

export class EditingPanelElement extends HTMLElement {
    #disabled: boolean = false;
    #panel: HTMLDivElement;
    #editRow: HTMLDivElement;
    #stopButton: HTMLButtonElement;
    #updateButton: HTMLButtonElement;
    #insertBeforeButton: HTMLButtonElement;
    #insertAfterButton: HTMLButtonElement;
    #deleteButton: HTMLButtonElement;
    #stopChordSpan: HTMLSpanElement;
    #updateChordSpan: HTMLSpanElement;
    #insertBeforeChordSpan: HTMLSpanElement;
    #insertAfterChordSpan: HTMLSpanElement;
    #deleteChordSpan: HTMLSpanElement;

    #root?: number;
    #third?: number;
    #fifth?: number;
    #octave?: number;
    #newRoot?: number;
    #newThird?: number;
    #newFifth?: number;
    #newOctave?: number;

    static observedAttributes = [
        "root", "third", "fifth", "octave",
        "new-root", "new-third", "new-fifth", "new-octave",
        "disabled"
    ];

    constructor() {
        super();

        const shadowRoot = this.attachShadow({ mode: "closed" })
        this.#panel = shadowRoot.appendChild(document.createElement("div"));
        this.#panel.classList.add("panel");

        { // Add styles.
            const style = new CSSStyleSheet();
            style.insertRule(`
            .panel {
                display: flex;
                flex-direction: column;
                gap: 0.25em;
                align-items: center;

                & > div {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: 1fr;
                    gap: 0.25em;
                }

                & > button {
                    flex-grow: 0;
                }
            }`);
            shadowRoot.adoptedStyleSheets = [style];
        }

        { // Add stop button. 
            this.#stopButton = this.#panel.appendChild(document.createElement("button"));
            this.#stopButton.setAttribute("tabindex", "0");
            this.#stopButton.setAttribute("part", "button");
            this.#stopButton.innerText = "Stop Editing ";
            this.#stopChordSpan = this.#stopButton.appendChild(document.createElement("span"));
            this.#stopButton.addEventListener("click", () => {
                this.dispatchEvent(new Event(
                    "stopEditing",
                    {
                        bubbles: true
                    }
                ));
            });
        }
        { // Add edit row.
            this.#editRow = this.#panel.appendChild(document.createElement("div"));


            { // Add update button. 
                this.#updateButton = this.#editRow.appendChild(document.createElement("button"));
                this.#updateButton.setAttribute("tabindex", "0");
                this.#updateButton.setAttribute("part", "button");
                this.#updateButton.innerText = "Update to ";
                this.#updateChordSpan = this.#updateButton.appendChild(document.createElement("span"));
                this.#updateButton.addEventListener("click", () => {
                    this.dispatchEvent(new CustomEvent<Chord>(
                        "updateChord",
                        {
                            bubbles: true,
                            detail: [
                                this.#newRoot!,
                                this.#newThird!,
                                this.#newFifth!,
                                this.#newOctave!
                            ]
                        }
                    ));
                });
            }

            { // Add insert before button. 
                this.#insertBeforeButton = this.#editRow.appendChild(document.createElement("button"));
                this.#insertBeforeButton.setAttribute("tabindex", "0");
                this.#insertBeforeButton.setAttribute("part", "button");
                this.#insertBeforeButton.innerText = "Insert ";
                this.#insertBeforeChordSpan = this.#insertBeforeButton.appendChild(document.createElement("span"));
                this.#insertBeforeButton.appendChild(document.createTextNode(" Before"));
                this.#insertBeforeButton.addEventListener("click", () => {
                    this.dispatchEvent(new CustomEvent<Chord>(
                        "insertChordBefore",
                        {
                            bubbles: true,
                            detail: [
                                this.#newRoot!,
                                this.#newThird!,
                                this.#newFifth!,
                                this.#newOctave!
                            ]
                        }
                    ));
                });
            }

            { // Add insert after button. 
                this.#insertAfterButton = this.#editRow.appendChild(document.createElement("button"));
                this.#insertAfterButton.setAttribute("tabindex", "0");
                this.#insertAfterButton.setAttribute("part", "button");
                this.#insertAfterButton.innerText = "Insert ";
                this.#insertAfterChordSpan = this.#insertAfterButton.appendChild(document.createElement("span"));
                this.#insertAfterButton.appendChild(document.createTextNode(" After"));
                this.#insertAfterButton.addEventListener("click", () => {
                    this.dispatchEvent(new CustomEvent<Chord>(
                        "insertChordAfter",
                        {
                            bubbles: true,
                            detail: [
                                this.#newRoot!,
                                this.#newThird!,
                                this.#newFifth!,
                                this.#newOctave!
                            ]
                        }
                    ));
                });
            }
        }

        { // Add delete button. 
            this.#deleteButton = this.#panel.appendChild(document.createElement("button"));
            this.#deleteButton.setAttribute("tabindex", "0");
            this.#deleteButton.setAttribute("part", "button");
            this.#deleteButton.innerText = "Delete ";
            this.#deleteChordSpan = this.#deleteButton.appendChild(document.createElement("span"));
            this.#deleteButton.addEventListener("click", () => {
                this.dispatchEvent(new Event(
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

        if (name === "disabled") this.#disabled = newValue !== null;
        if (name === "root") this.#root = parseInt(newValue);
        if (name === "third") this.#third = parseInt(newValue);
        if (name === "fifth") this.#fifth = parseInt(newValue);
        if (name === "octave") this.#octave = parseInt(newValue);
        if (name === "new-root") this.#newRoot = parseInt(newValue);
        if (name === "new-third") this.#newThird = parseInt(newValue);
        if (name === "new-fifth") this.#newFifth = parseInt(newValue);
        if (name === "new-octave") this.#newOctave = parseInt(newValue);

        this.#updateButtons();
    }

    #updateButtons() {
        if (this.#disabled) {
            if (this.#panel.contains(this.#stopButton)) this.#panel.removeChild(this.#stopButton);
            if (this.#panel.contains(this.#editRow)) this.#panel.removeChild(this.#editRow);
            if (this.#panel.contains(this.#deleteButton)) this.#panel.removeChild(this.#deleteButton);
        } else {
            this.#panel.appendChild(this.#stopButton);

            const oldChordName = `${ChordHelper.nameChord(this.#root, this.#third, this.#fifth)} (${this.#octave})`;
            this.#stopChordSpan.innerText = oldChordName;

            if (
                this.#newRoot !== undefined
                && this.#newThird !== undefined
                && this.#newFifth !== undefined
                && this.#newOctave !== undefined
            ) {
                this.#panel.appendChild(this.#editRow);

                const newChordName = `${ChordHelper.nameChord(this.#newRoot, this.#newThird, this.#newFifth)} (${this.#newOctave})`;
                this.#updateChordSpan.innerText = newChordName;
                this.#insertBeforeChordSpan.innerText = newChordName;
                this.#insertAfterChordSpan.innerText = newChordName;
            }

            this.#panel.appendChild(this.#deleteButton);
            this.#deleteChordSpan.innerText = oldChordName;
        }
    }
}

export function initEditingPanelElement() {
    defineElement("editing-panel", EditingPanelElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "editing-panel": EditingPanelElement;
    }
}
