export class VolumeSliderElement extends HTMLElement {
    #input: HTMLInputElement;

    constructor() {
        super();

        const slider = this.attachShadow({ mode: "closed" });

        { // Add styles.
            const style = new CSSStyleSheet();
            style.insertRule(`
            :host {
                width: 15rem;
                height: 1.2rem;
                border-radius: 0.6rem;
                overflow: hidden;

                &::before {
                    content: "";
                    z-index: -1;
                    box-sizing: border-box;
                    display: block;
                    border-style: solid;
                    border-width: 0.6rem 15rem 0.6rem 0;
                    border-color: transparent var(--border-color) transparent transparent;
                    width: 15rem;
                    height: 1.2rem;
                    margin-bottom: -1.2rem;
                }

                input[type="range"] {
                    margin: 0;
                    -webkit-appearance: none;
                    appearance: none;
                    background-color: transparent;
                    cursor: pointer;
                    width: 100%;
                    height: 100%;

                    &::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        box-sizing: border-box;
                        background-color: var(--button-background-color);
                        border: var(--border);
                        border-radius: 50%;
                        height: 1.2rem;
                        width: 1.2rem;
                    }

                    &::-moz-range-thumb {
                        box-sizing: border-box;
                        background-color: var(--button-background-color);
                        border: var(--border);
                        border-radius: 50%;
                        height: 1.2rem;
                        width: 1.2rem;
                    }
                }

                /* Safari gets confused when this style is nested. */
                input[type="range"]:focus-visible {
                    outline: none;

                    &::-webkit-slider-thumb {
                        outline-width: var(--border-width);
                        outline-style: solid;
                        outline-color: -webkit-focus-ring-color;
                        outline-offset: calc(-1 * var(--border-width));
                        box-shadow: white 0 0 0 calc(var(--border-width) / 2);
                    }

                    &::-moz-range-thumb {
                        outline-style: auto;
                        outline-offset: calc(-1 * var(--border-width));
                    }
                }
            }`);
            slider.adoptedStyleSheets = [style];
        }

        { // Add input element.
            this.#input = slider.appendChild(document.createElement("input"));
            this.#input.setAttribute("type", "range");
            this.#input.setAttribute("step", "0.01");
            this.#input.setAttribute("min", "0");
            this.#input.setAttribute("max", "1");
            this.#input.setAttribute("value", "1");
            this.#input.setAttribute("tabindex", "0");

            this.#input.addEventListener("input", () => {
                this.dispatchEvent(new Event("input"));
            });
        }
    }

    get value() {
        return this.#input.value;
    }

    set value(value) {
        this.#input.value = value;
    }
}

export function initVolumeSliderElement() {
    customElements.define("volume-slider", VolumeSliderElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "volume-slider": VolumeSliderElement;
    }
}
