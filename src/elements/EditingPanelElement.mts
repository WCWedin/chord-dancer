import { ChordHelper } from "../core/ChordHelper.mjs";
import { defineElement } from "../core/dom.mjs";
import type { Chord } from "../core/types.mjs";

export class EditingPanelElement extends HTMLElement {
    #editing: boolean = false;
    #panel: HTMLDivElement;
    #stopButton: HTMLButtonElement;
    #resetButton: HTMLButtonElement;
    #appendButton: HTMLButtonElement;
    #updateButton: HTMLButtonElement;
    #insertBeforeButton: HTMLButtonElement;
    #insertAfterButton: HTMLButtonElement;
    #deleteButton: HTMLButtonElement;
    #stopChordSpan: HTMLSpanElement;
    #resetChordSpan: HTMLSpanElement;
    #updateChordSpan: HTMLSpanElement;
    #appendChordSpan: HTMLSpanElement;
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
        "editing"
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
                display: grid;
                gap: 0.5em;

                &[editing] {
                    grid-template-columns: 1fr 1fr 1fr;
                }
            }`);
            shadowRoot.adoptedStyleSheets = [style];
        }

        { // Create append button.
            this.#appendButton = document.createElement("button");
            this.#appendButton.setAttribute("tabindex", "0");
            this.#appendButton.setAttribute("part", "button");
            this.#appendButton.innerText = "Append ";
            this.#appendChordSpan = this.#appendButton.appendChild(document.createElement("span"));
            this.#appendButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent<Chord>(
                    "appendChord",
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

        { // Create insert before button. 
            this.#insertBeforeButton = document.createElement("button");
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

        { // Create update button. 
            this.#updateButton = document.createElement("button");
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

        { // Create insert after button. 
            this.#insertAfterButton = document.createElement("button");
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
            
        { // Create reset button.
            this.#resetButton = document.createElement("button");
            this.#resetButton.setAttribute("tabindex", "0");
            this.#resetButton.setAttribute("part", "button");
            this.#resetButton.innerText = "Reset to  ";
            this.#resetChordSpan = this.#resetButton.appendChild(document.createElement("span"));
            this.#resetButton.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent<Chord>(
                    "resetChord",
                    {
                        bubbles: true,
                        detail: [
                            this.#root!,
                            this.#third!,
                            this.#fifth!,
                            this.#octave!
                        ]
                    }
                ));
            });
        }

        { // Create stop button. 
            this.#stopButton = document.createElement("button");
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

        { // Create delete button. 
            this.#deleteButton = document.createElement("button");
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

        if (name === "editing") this.#editing = newValue !== null;
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
        if (this.#editing) {
            this.#panel.setAttribute("editing", "");
            if (this.#panel.contains(this.#appendButton)) this.#panel.removeChild(this.#appendButton);

            this.#panel.appendChild(this.#insertBeforeButton);
            this.#panel.appendChild(this.#updateButton);
            this.#panel.appendChild(this.#insertAfterButton);

            this.#panel.appendChild(this.#stopButton);
            this.#panel.appendChild(this.#resetButton);
            this.#panel.appendChild(this.#deleteButton);
        } else {
            this.#panel.removeAttribute("editing");
            if (this.#panel.contains(this.#insertBeforeButton)) this.#panel.removeChild(this.#insertBeforeButton);
            if (this.#panel.contains(this.#updateButton)) this.#panel.removeChild(this.#updateButton);
            if (this.#panel.contains(this.#insertAfterButton)) this.#panel.removeChild(this.#insertAfterButton);
            if (this.#panel.contains(this.#stopButton)) this.#panel.removeChild(this.#stopButton);
            if (this.#panel.contains(this.#deleteButton)) this.#panel.removeChild(this.#deleteButton);

            this.#panel.appendChild(this.#appendButton);
            this.#panel.appendChild(this.#resetButton);
        }

        const unchanged = 
            this.#root === this.#newRoot
            && this.#third === this.#newThird
            && this.#fifth === this.#newFifth
            && this.#octave === this.#newOctave;
        this.#updateButton.disabled = unchanged;
        this.#resetButton.disabled = unchanged;

        const oldChordName = `${ChordHelper.nameChord(this.#root, this.#third, this.#fifth)} (${this.#octave})`;
        this.#stopChordSpan.innerText = oldChordName;
        this.#resetChordSpan.innerText = oldChordName;
        this.#deleteChordSpan.innerText = oldChordName;

        if (
            this.#newRoot !== undefined
            && this.#newThird !== undefined
            && this.#newFifth !== undefined
            && this.#newOctave !== undefined
        ) {

            const newChordName = `${ChordHelper.nameChord(this.#newRoot, this.#newThird, this.#newFifth)} (${this.#newOctave})`;
            this.#appendChordSpan.innerText = newChordName;
            this.#updateChordSpan.innerText = newChordName;
            this.#insertBeforeChordSpan.innerText = newChordName;
            this.#insertAfterChordSpan.innerText = newChordName;
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
