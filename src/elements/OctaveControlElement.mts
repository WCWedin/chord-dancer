export class OctaveControlElement extends HTMLElement {
    #octave: number = 0;
    #octaveDisplay: HTMLDivElement;
    #octaveDisplayValue: HTMLSpanElement;
    #upButton: HTMLButtonElement;
    #downButton: HTMLButtonElement;

    static observedAttributes = ["octave", "disabled"];

    constructor() {
        super();

        const control = this.attachShadow({ mode: "closed" });

        { // Add styles.
            const style = new CSSStyleSheet();

            style.insertRule(`
            div {
                text-align: center;
            }`);

            control.adoptedStyleSheets = [style];
        }

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

        { // Add octave display.
            this.#octaveDisplay = control.appendChild(document.createElement("div"));
            this.#octaveDisplay.innerText = "Octave: ";
            this.#octaveDisplayValue = this.#octaveDisplay.appendChild(document.createElement("span"));
            this.#octaveDisplayValue.innerText = this.#octave.toString();
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
            this.#octaveDisplayValue.innerText = this.#octave.toString();
            this.#downButton.disabled = this.#octave <= -3;
            this.#upButton.disabled = this.#octave >= 3;
        }
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
