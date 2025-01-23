export class EditingPanelElement extends HTMLElement {
    #disabled: boolean = false;
    #panel;
    #stopButton: HTMLButtonElement;
    #updateButton: HTMLButtonElement;
    #insertBeforeButton: HTMLButtonElement;
    #insertAfterButton: HTMLButtonElement;
    #deleteButton: HTMLButtonElement;

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
                this.dispatchEvent(new Event(
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
                this.dispatchEvent(new Event(
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
                this.dispatchEvent(new Event(
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
                this.dispatchEvent(new Event(
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

export function initEditingPanelElement() {
    customElements.define("editing-panel", EditingPanelElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "editing-panel": EditingPanelElement;
    }
}
