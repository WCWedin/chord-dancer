export function defineElement(name: string, constructor: CustomElementConstructor) {
    if (customElements.get(name) === constructor) return;
    customElements.define(name, constructor);
}