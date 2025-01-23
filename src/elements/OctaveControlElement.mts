export class OctaveControlElement extends HTMLElement {
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
                this.dispatchEvent(new Event(
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
                this.dispatchEvent(new Event(
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

export function initOctaveControlElement() {
    customElements.define("octave-control", OctaveControlElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "octave-control": OctaveControlElement;
    }
}
