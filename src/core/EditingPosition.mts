import { type Selection } from "./types.mjs"

export const noPosition: unique symbol = Symbol("noPosition");
export const historicPosition: unique symbol = Symbol("historicPosition");
export const updatedPosition: unique symbol = Symbol("updatedPosition");
export const retainedPosition: unique symbol = Symbol("retainedPosition");
export type positionType = typeof noPosition | typeof historicPosition | typeof updatedPosition | typeof retainedPosition;

export class EditingPosition {
    #positionType: positionType = noPosition;
    get positionType() {
        return this.#positionType;
    }
    set positionType(positionType) {
        this.#positionType = positionType;
        if (this.#positionType === noPosition || this.#positionType === historicPosition) {
            this.#position = null;
        }
    }

    #position: Selection = null;
    get position() {
        return this.#position;
    }
    set position(position) {
        this.#position = position;
        if (this.#position === null) {
            this.#positionType = noPosition;
        } else if (this.#positionType === noPosition || this.#positionType === historicPosition) {
            this.#positionType = updatedPosition
        }
    }
}