import { ChordHelper } from "../core/ChordHelper.mjs";
import { ChordHistory } from "../core/ChordHistory.mjs";
import { ChordPlayer } from "../core/ChordPlayer.mjs";
import type { Chord } from "../core/types.mjs";
import { type ChordGraphElement, initChordGraphElement } from "./ChordGraphElement.mjs";
import { type ChordPickerElement, initChordPickerElement } from "./ChordPickerElement.mjs";
import { type ChordSheetElement, initChordSheetElement } from "./ChordSheetElement.mjs";
import { type VolumeSliderElement, initVolumeSliderElement } from "./VolumeSliderElement.mjs";

class ChordDancerElement extends HTMLElement {
    #chordHistory: ChordHistory;
    #chordPlayer: ChordPlayer;
    #volumeSlider: VolumeSliderElement;
    #chordPicker: ChordPickerElement;
    #chordGraph: ChordGraphElement;
    #chordSheet: ChordSheetElement;

    #undoButton: HTMLButtonElement;
    #redoButton: HTMLButtonElement;
    #clearButton: HTMLButtonElement;
    #playButton: HTMLButtonElement;
    #stopButton: HTMLButtonElement;

    #editingIndex: number | undefined = undefined;

    constructor() {
        super();

        const dancer = this.attachShadow({ mode: "closed" });
        const body = dancer.appendChild(document.createElement("div"));
        body.id = "body";

        { // Add styles.
            const style = new CSSStyleSheet();

            style.insertRule(`
            #body,
            chord-picker,
            chord-graph {
                --border: var(--border-width) solid var(--border-color);
            }`);

            { // Add layout rules.
                style.insertRule(`
                #body {
                    display: flex;
                    font-size: 1.2rem;
                    flex-direction: column;
                    align-items: center;
                }`);

                style.insertRule(`
                .buttons, chord-picker {
                    margin: 1em 0;
                }`);

                style.insertRule(`
                chord-sheet {
                    width: 100%;
                }`);
            }

            { // Add color rules.
                style.insertRule(`
                #body,
                chord-picker,
                chord-graph {
                    --button-text-color: oklch(from var(--theme-color) 30% 30% h);
                    --button-background-color: oklch(from var(--theme-color) 98% 2% h);
                    --button-active-background-color: oklch(from var(--theme-color) 94% 10% h);
                    --button-hover-background-color: oklch(from var(--theme-color) 90% 10% h);
                    --border-color: oklch(from var(--theme-color) 80% 20% h);
                    --button-disabled-text-color: oklch(from var(--theme-color) 80% 10% h);
                    --button-disabled-border-color: oklch(from var(--theme-color) 90% 10% h);
                    --button-disabled-background-color: oklch(from var(--theme-color) 95% 2% h);
                }`);

                style.insertRule(`
                chord-sheet {
                    --playing-color: oklch(from var(--theme-color) 60% 30% h);
                    --playing-text-color: oklch(from var(--theme-color) 50% 50% h);
                    --selected-color: oklch(from var(--edit-color) 60% 30% h);
                    --selected-text-color: oklch(from var(--edit-color) 50% 50% h);

                    &[inserting] {
                        --edit-color: var(--insert-color);
                    }
                }`);

                style.insertRule(`
                chord-picker,
                chord-graph {
                    &[editing] {
                        --theme-color: var(--edit-color);
                    }

                    &[inserting] {
                        --theme-color: var(--insert-color);
                    }
                }`);
            }

            { // Add button rules.
                style.insertRule(`
                button,
                chord-picker::part(control) {
                    margin: 0 0.4em;
                }`);

                style.insertRule(`
                button,
                chord-picker::part(control),
                chord-graph::part(panel-button) {
                    border: var(--border);
                    background-color: var(--button-background-color);
                }`);

                style.insertRule(`
                button,
                chord-picker::part(control),
                chord-graph::part(button) {
                    color: var(--button-text-color);
                    border-radius: var(--border-radius);
                    padding: 0.25em 0.4em;
                    font-size: 1em;
                }`);


                // Nesting/is on pseudo-elements isn't supported: https://github.com/w3c/csswg-drafts/issues/9702
                style.insertRule(`
                button:focus-visible:not(:hover, :active, :disabled),
                chord-picker::part(control):focus-visible:not(:hover, :active, :disabled),
                chord-graph::part(button):focus-visible:not(:hover, :active, :disabled)
                {
                    background-color: var(--button-active-background-color);
                }`);

                style.insertRule(`
                button:hover:not(:active, :disabled),
                chord-picker::part(control):hover:not(:active, :disabled),
                chord-graph::part(button):hover:not(:active, :disabled)
                {
                    background-color: var(--button-hover-background-color);
                }`);

                style.insertRule(`
                button:active:not(:disabled),
                chord-picker::part(button):active:not(:disabled),
                chord-graph::part(button):active:not(:disabled)
                {
                    background-color: var(--button-active-background-color);
                }`);

                style.insertRule(`
                button:disabled,
                chord-graph::part(panel-button):disabled {
                    color: var(--button-disabled-text-color);
                    border-color: var(--button-disabled-border-color);
                    background-color: var(--button-disabled-background-color);
                }`);
            }
            dancer.adoptedStyleSheets = [style];
        }

        { // Add chord history.
            this.#chordHistory = new ChordHistory();
            this.#chordHistory.addEventListener("stateUpdated", () => {
                this.#updateUI();
            });
        }

        { // Add chord player.
            this.#chordPlayer = new ChordPlayer();

            this.#chordPlayer.addEventListener("chordStarted", event => {
                this.#chordSheet.playChord(event.detail.index);
            });
            this.#chordPlayer.addEventListener("chordEnded", event => {
                this.#chordSheet.stopChord(event.detail.index);
            });
            this.#chordPlayer.addEventListener("playbackStarted", () => {
                this.#stopButton.disabled = false;
            });
            this.#chordPlayer.addEventListener("playbackEnded", () => {
                this.#stopButton.disabled = true;
                this.#chordSheet.stopPlayback();
            });
        }

        { // Add volume slider.
            this.#volumeSlider = body.appendChild(document.createElement("volume-slider"));
            this.#volumeSlider.value = this.#chordPlayer.volume.toString();
            this.#volumeSlider.addEventListener("input", () => this.#chordPlayer.volume = parseFloat(this.#volumeSlider.value));
        }

        { // Add chord picker.
            this.#chordPicker = body.appendChild(document.createElement("chord-picker"));
            this.#chordPicker.addEventListener("chordPushed", event => {
                this.#pushChord(event);
            });
        }

        { // Add chord graph.
            this.#chordGraph = body.appendChild(document.createElement("chord-graph"));
            this.#chordGraph.addEventListener("stopEditing", () => {
                this.#handleDeselection();
            });
            this.#chordGraph.addEventListener("chordPushed", event => {
                this.#pushChord(event);
            });
            this.#chordGraph.addEventListener("octaveIncreased", () => {
                if (this.#editingIndex === undefined) this.#chordHistory.increaseOctave();
                else this.#chordHistory.increaseOctave(this.#editingIndex);
            });
            this.#chordGraph.addEventListener("octaveDecreased", () => {
                if (this.#editingIndex === undefined) this.#chordHistory.decreaseOctave();
                else this.#chordHistory.decreaseOctave(this.#editingIndex);
            });
        }

        { // Add edit buttons.
            const editButtons = body.appendChild(document.createElement("div"));
            editButtons.classList.add("buttons");

            this.#undoButton = editButtons.appendChild(document.createElement("button"));
            this.#undoButton.tabIndex = 0;
            this.#undoButton.append(document.createTextNode("Undo"));
            this.#undoButton.addEventListener("click", () => {
                this.#editingIndex = -1;
                this.#chordHistory.undo();
            });

            this.#redoButton = editButtons.appendChild(document.createElement("button"));
            this.#redoButton.tabIndex = 0;
            this.#redoButton.append(document.createTextNode("Redo"));
            this.#redoButton.addEventListener("click", () => {
                this.#editingIndex = -1;
                this.#chordHistory.redo();
            });

            this.#clearButton = editButtons.appendChild(document.createElement("button"));
            this.#clearButton.tabIndex = 0;
            this.#clearButton.append(document.createTextNode("Clear"));
            this.#clearButton.addEventListener("click", () => {
                this.#editingIndex = undefined;
                this.#chordHistory.clear();
            });
        }

        { // Add player buttons.
            const playerButtons = body.appendChild(document.createElement("div"));
            playerButtons.classList.add("buttons");

            this.#playButton = playerButtons.appendChild(document.createElement("button"));
            this.#playButton.tabIndex = 0;
            this.#playButton.append(document.createTextNode("Play"));
            this.#playButton.addEventListener("click", () => this.#chordPlayer.playChords(this.#chordHistory));

            this.#stopButton = playerButtons.appendChild(document.createElement("button"));
            this.#stopButton.tabIndex = 0;
            this.#stopButton.append(document.createTextNode("Stop"));
            this.#stopButton.addEventListener("click", () => this.#chordPlayer.stopPlayback());
        }

        { // Add chord sheet.
            this.#chordSheet = body.appendChild(document.createElement("chord-sheet"));
            this.#chordSheet.addEventListener("chordSelected", (event) => {
                this.#editingIndex = event.detail.index;
                this.#updateUI();
            });
            this.#chordSheet.addEventListener("chordDeselected", () => this.#handleDeselection());
            this.#chordSheet.addEventListener("selectionCleared", () => this.#handleDeselection());
            this.#chordSheet.addEventListener("chordPicked", () => {
                this.#chordPicker.takeFocus();
            });
        }

        this.#updateUI();
    }

    #pushChord(event: CustomEvent<Chord>) {
        if (this.#editingIndex === undefined) this.#chordHistory.push(event.detail);
        else this.#chordHistory.edit(this.#editingIndex, event.detail);
    }

    #handleDeselection() {
        if (this.#editingIndex !== undefined) {
            this.#editingIndex = undefined;
            this.#updateUI();
        }
    }

    #setChord(root: number, third: number, fifth: number, octave: number) {
        this.#chordGraph.setAttribute("root", root.toString());
        this.#chordGraph.setAttribute("third", third.toString());
        this.#chordGraph.setAttribute("fifth", fifth.toString());
        this.#chordGraph.setAttribute("octave", octave.toString());

        this.#chordPicker.setAttribute("root", root.toString());
        this.#chordPicker.setAttribute("third", third.toString());
        this.#chordPicker.setAttribute("fifth", fifth.toString());
        this.#chordPicker.setAttribute("octave", octave.toString());
    }

    #updateUI() {
        this.#chordPlayer.stopPlayback();
        this.#stopButton.disabled = true;

        if (this.#editingIndex === -1) this.#editingIndex = this.#chordHistory.selectedIndex;
        if (this.#editingIndex !== undefined) {
            this.#chordPicker.setAttribute("editing", "");
            this.#chordGraph.setAttribute("editing", "");
        } else {
            this.#chordPicker.removeAttribute("editing");
            this.#chordGraph.removeAttribute("editing");
        }

        if (this.#chordHistory.latestChord &&
            (
                this.#editingIndex === undefined
                || this.#editingIndex < this.#chordHistory.length
            )) {
            const chord = this.#editingIndex !== undefined
                ? this.#chordHistory.getChord(this.#editingIndex)!
                : this.#chordHistory.latestChord;
            this.#setChord(...chord);
            this.#chordGraph.setAttribute("active-chord", "");
            this.#chordPlayer.playChord(...chord);
            this.#clearButton.disabled = false;
            this.#playButton.disabled = false;
        } else {
            this.#setChord(0, ChordHelper.thirds.maj, ChordHelper.fifths.perf, 0);
            this.#chordGraph.removeAttribute("active-chord");
            this.#clearButton.disabled = true;
            this.#playButton.disabled = true;
        }

        this.#undoButton.disabled = !this.#chordHistory.canUndo;
        this.#redoButton.disabled = !this.#chordHistory.canRedo;

        this.#chordSheet.chords = this.#chordHistory.currentChords;
        if (this.#editingIndex !== undefined) this.#chordSheet.selectChord(this.#editingIndex);
        else this.#chordSheet.clearSelection();
    }
}

export function initChordDancerElement() {
    initChordGraphElement();
    initChordPickerElement();
    initChordSheetElement();
    initVolumeSliderElement();
    customElements.define("chord-dancer", ChordDancerElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-dancer": ChordDancerElement;
    }
}