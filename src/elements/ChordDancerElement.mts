import { ChordHelper } from "../core/ChordHelper.mjs";
import { ChordHistory } from "../core/ChordHistory.mjs";
import { ChordPlayer } from "../core/ChordPlayer.mjs";
import { defineElement } from "../core/dom.mjs";
import type { Chord } from "../core/types.mjs";
import { EditingPosition, noPosition, historicPosition, updatedPosition, retainedPosition } from "../core/EditingPosition.mjs";
import { type ChordGraphElement, initChordGraphElement } from "./ChordGraphElement.mjs";
import { type ChordPickerElement, initChordPickerElement } from "./ChordPickerElement.mjs";
import { type ChordSheetElement, initChordSheetElement } from "./ChordSheetElement.mjs";
import { type EditingPanelElement, initEditingPanelElement } from "./EditingPanelElement.mjs";
import { type VolumeSliderElement, initVolumeSliderElement } from "./VolumeSliderElement.mjs";

class ChordDancerElement extends HTMLElement {
    #chordHistory: ChordHistory;
    #chordPlayer: ChordPlayer;
    #volumeSlider: VolumeSliderElement;
    #chordPicker: ChordPickerElement;
    #editingPanel: EditingPanelElement;
    #chordGraph: ChordGraphElement;
    #chordSheet: ChordSheetElement;

    #undoButton: HTMLButtonElement;
    #redoButton: HTMLButtonElement;
    #clearButton: HTMLButtonElement;
    #playButton: HTMLButtonElement;
    #stopButton: HTMLButtonElement;

    #editingPosition: EditingPosition = new EditingPosition();

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
            editing-panel,
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
                editing-panel,
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
                }`);

                style.insertRule(`
                chord-picker[editing],
                editing-panel,
                chord-graph[editing] {
                    --theme-color: var(--edit-color);
                }`);
            }

            { // Add button and form control rules.
                style.insertRule(`
                button,
                chord-picker::part(control) {
                    margin: 0 0.4em;
                }`);

                style.insertRule(`
                button,
                chord-picker::part(control),
                editing-panel::part(button),
                chord-graph::part(panel-button) {
                    border: var(--border);
                    background-color: var(--button-background-color);
                }`);

                style.insertRule(`
                button,
                chord-picker::part(control),
                editing-panel::part(button),
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
                editing-panel::part(button):focus-visible:not(:hover, :active, :disabled),
                chord-graph::part(button):focus-visible:not(:hover, :active, :disabled)
                {
                    background-color: var(--button-active-background-color);
                }`);

                style.insertRule(`
                button:hover:not(:active, :disabled),
                chord-picker::part(control):hover:not(:active, :disabled),
                editing-panel::part(button):hover:not(:active, :disabled),
                chord-graph::part(button):hover:not(:active, :disabled)
                {
                    background-color: var(--button-hover-background-color);
                }`);

                style.insertRule(`
                button:active:not(:disabled),
                chord-picker::part(button):active:not(:disabled),
                editing-panel::part(button):active:not(:disabled),
                chord-graph::part(button):active:not(:disabled)
                {
                    background-color: var(--button-active-background-color);
                }`);

                style.insertRule(`
                button:disabled,
                chord-picker::part(button):disabled,
                editing-panel::part(button):disabled,
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
            this.#chordPicker.addEventListener("chordPicked", event => {
                this.#editingPanel.setAttribute("new-root", event.detail[0].toString());
                this.#editingPanel.setAttribute("new-third", event.detail[1].toString());
                this.#editingPanel.setAttribute("new-fifth", event.detail[2].toString());
                this.#editingPanel.setAttribute("new-octave", event.detail[3].toString());

                this.#chordGraph.setAttribute("root", event.detail[0].toString());
                this.#chordGraph.setAttribute("third", event.detail[1].toString());
                this.#chordGraph.setAttribute("fifth", event.detail[2].toString());
                this.#chordGraph.setAttribute("octave", event.detail[3].toString());

                this.#chordPlayer.playChord(...event.detail);
            });
        }

        { // Add editing panel
            this.#editingPanel = body.appendChild(document.createElement("editing-panel"));
            this.#editingPanel.addEventListener("stopEditing", () => {
                this.#handleDeselection();
            });
            this.#editingPanel.addEventListener("updateChord", (event) => {
                const position = this.#editingPosition.position!;
                this.#chordHistory.edit(position, event.detail)
            });
            this.#editingPanel.addEventListener("insertChordBefore", (event) => {
                const position = this.#editingPosition.position;
                this.#editingPosition.positionType = historicPosition;
                this.#chordHistory.insertBefore(position, event.detail);
            });
            this.#editingPanel.addEventListener("insertChordAfter", (event) => {
                const position = this.#editingPosition.position;
                this.#editingPosition.positionType = historicPosition;
                this.#chordHistory.insertAfter(position, event.detail)
            });
            this.#editingPanel.addEventListener("deleteChord", () => {
                const position = this.#editingPosition.position;
                this.#editingPosition.positionType = historicPosition;
                this.#chordHistory.delete(position);
            });
        }

        { // Add chord graph.
            this.#chordGraph = body.appendChild(document.createElement("chord-graph"));
            this.#chordGraph.addEventListener("chordPicked", event => {
                if (this.#editingPosition.positionType === noPosition) this.#pushChord(event);
                else this.#chordPicker.pickChord(event.detail);
            });
        }

        { // Add edit buttons.
            const editButtons = body.appendChild(document.createElement("div"));
            editButtons.classList.add("buttons");

            this.#undoButton = editButtons.appendChild(document.createElement("button"));
            this.#undoButton.tabIndex = 0;
            this.#undoButton.append(document.createTextNode("Undo"));
            this.#undoButton.addEventListener("click", () => {
                this.#editingPosition.positionType = historicPosition;
                this.#chordHistory.undo();
            });

            this.#redoButton = editButtons.appendChild(document.createElement("button"));
            this.#redoButton.tabIndex = 0;
            this.#redoButton.append(document.createTextNode("Redo"));
            this.#redoButton.addEventListener("click", () => {
                this.#editingPosition.positionType = historicPosition;
                this.#chordHistory.redo();
            });

            this.#clearButton = editButtons.appendChild(document.createElement("button"));
            this.#clearButton.tabIndex = 0;
            this.#clearButton.append(document.createTextNode("Clear"));
            this.#clearButton.addEventListener("click", () => {
                this.#editingPosition.positionType = historicPosition;
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
                this.#editingPosition.position = event.detail.index;
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
        if (this.#editingPosition.positionType === noPosition) this.#chordHistory.push(event.detail);
        else {
            this.#editingPanel.setAttribute("new-root", event.detail[0].toString());
            this.#editingPanel.setAttribute("new-third", event.detail[1].toString());
            this.#editingPanel.setAttribute("new-fifth", event.detail[2].toString());
            this.#editingPanel.setAttribute("new-octave", event.detail[3].toString());
        };
    }

    #handleDeselection() {
        if (this.#editingPosition.positionType !== noPosition) {
            this.#editingPosition.positionType = noPosition;
            this.#updateUI();
        }
    }

    #setChord(root: number, third: number, fifth: number, octave: number, isNew: boolean) {
        if (isNew) {
            this.#chordGraph.setAttribute("root", root.toString());
            this.#chordGraph.setAttribute("third", third.toString());
            this.#chordGraph.setAttribute("fifth", fifth.toString());
            this.#chordGraph.setAttribute("octave", octave.toString());

            this.#editingPanel.setAttribute("new-root", root.toString());
            this.#editingPanel.setAttribute("new-third", third.toString());
            this.#editingPanel.setAttribute("new-fifth", fifth.toString());
            this.#editingPanel.setAttribute("new-octave", octave.toString());
        }

        this.#editingPanel.setAttribute("root", root.toString());
        this.#editingPanel.setAttribute("third", third.toString());
        this.#editingPanel.setAttribute("fifth", fifth.toString());
        this.#editingPanel.setAttribute("octave", octave.toString());

        this.#chordPicker.setAttribute("root", root.toString());
        this.#chordPicker.setAttribute("third", third.toString());
        this.#chordPicker.setAttribute("fifth", fifth.toString());
        this.#chordPicker.setAttribute("octave", octave.toString());
    }

    #clearEditingStatus() {
        this.#chordPicker.removeAttribute("editing");
        this.#chordGraph.removeAttribute("editing");
        this.#editingPanel.setAttribute("disabled", "");
        this.#chordSheet.clearSelection();
    }

    #updateUI() {
        this.#chordPlayer.stopPlayback();
        this.#stopButton.disabled = true;

        this.#undoButton.disabled = !this.#chordHistory.canUndo;
        this.#redoButton.disabled = !this.#chordHistory.canRedo;

        this.#chordSheet.chords = this.#chordHistory.currentChords;

        { // Manage editing position
            if (this.#editingPosition.positionType === historicPosition) {
                this.#editingPosition.position = this.#chordHistory.selectedIndex;
            }

            if (
                this.#editingPosition.position !== undefined
                && this.#editingPosition.position >= this.#chordHistory.length
            ) {
                this.#editingPosition.positionType = noPosition;
            }
        }

        if (this.#chordHistory.latestChord === undefined) { // Reset UI
            this.#clearEditingStatus();
            this.#clearButton.disabled = true;
            this.#playButton.disabled = true;
            this.#setChord(0, ChordHelper.thirds.maj, ChordHelper.fifths.perf, 0, true);
        } else {
            this.#clearButton.disabled = false;
            this.#playButton.disabled = false;

            if (this.#editingPosition.position !== undefined) { // Use selected chord
                this.#editingPanel.removeAttribute("disabled");
                this.#chordPicker.setAttribute("editing", "");
                this.#chordGraph.setAttribute("editing", "");

                const chord = this.#chordHistory.getChord(this.#editingPosition.position)!;
                const isNew = this.#editingPosition.positionType === updatedPosition;
                this.#setChord(...chord, isNew);
                this.#chordPlayer.playChord(...chord);
                this.#chordSheet.selectChord(this.#editingPosition.position);
                if (isNew) this.#editingPosition.positionType == retainedPosition;
            } else { // Use latest chord
                this.#clearEditingStatus();
                this.#setChord(...this.#chordHistory.latestChord, true);
                this.#chordPlayer.playChord(...this.#chordHistory.latestChord);
            }
        }
    }
}

export function initChordDancerElement() {
    initVolumeSliderElement();
    initChordPickerElement();
    initEditingPanelElement();
    initChordGraphElement();
    initChordSheetElement();
    defineElement("chord-dancer", ChordDancerElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-dancer": ChordDancerElement;
    }
}
