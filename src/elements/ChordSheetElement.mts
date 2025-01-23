import { Renderer, StaveNote, TextNote, RenderContext, Stave, Voice, Formatter } from "vexflow";
import { StaveHelper } from "../core/StaveHelper.mjs";
import type { State, IndexEvent } from "../core/types.mjs";

export class ChordSheetElement extends HTMLElement {
    #container;
    #width = 0;
    #selectedChords = new Set();

    constructor() {
        super();

        const sheet = this.attachShadow({ mode: "closed" });
        const style = new CSSStyleSheet();
        style.insertRule(`
        div {
            display: flex;
            justify-content: center;
            width: 100% !important;
        }`);
        style.insertRule(`
        .vf-stavenote.selected:not(.playing) {
            fill: var(--selected-color);

            & + text {
                fill: var(--selected-text-color);
            }
        }`);
        style.insertRule(`
        .vf-stavenote.playing {
            fill: var(--playing-color);

            & + text {
                fill: var(--playing-text-color);
            }
        }`);
        style.insertRule(`
        .vf-stavenote, text {
            cursor: pointer;
        }`);
        sheet.adoptedStyleSheets = [style];

        this.#container = document.createElement("div");
        this.#container.addEventListener("click", () => {
            this.clearSelection();
            this.dispatchEvent(new Event("selectionCleared"));
        });
        sheet.appendChild(this.#container);

        const resizeObserver = new ResizeObserver((entries) => {
            this.#width = entries[0]!.contentBoxSize[0]!.inlineSize;
            this.#render();
        });

        resizeObserver.observe(this);
    }

    #chords: State = [];

    set chords(newChords: State) {
        if (this.#chords === newChords) return;
        this.#chords = newChords;
        this.#render();
    }

    get #staveWidth() {
        return this.#width - StaveHelper.metrics.horizontalMargin * 2;
    }

    playChord(index: number) {
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.add("playing");
    }

    stopChord(index: number) {
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.remove("playing");
    }

    stopPlayback() {
        this.#container.querySelectorAll(".vf-stavenote.playing")?.forEach(chord => chord.classList.remove("playing"));
    }

    selectChord(index: number) {
        this.clearSelection();
        this.#selectedChords.add(index);
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.add("selected");
    }

    #selectChord(index: number) {
        this.selectChord(index);
        this.dispatchEvent(new CustomEvent("chordSelected", { detail: { index } }) as IndexEvent);
    }

    deselectChord(index: number) {
        this.#selectedChords.delete(index);
        this.#container.querySelectorAll(".vf-stavenote")?.[index]?.classList.remove("selected");
    }

    #deselectChord(index: number) {
        this.deselectChord(index);
        this.dispatchEvent(new CustomEvent("chordDeselected", { detail: { index } }) as IndexEvent);
    }

    clearSelection() {
        this.#selectedChords.clear();
        this.#container.querySelectorAll(".vf-stavenote.selected")?.forEach(chord => chord.classList.remove("selected"));
    }

    chordClicked(index: number, event: Event) {
        if (this.#selectedChords.has(index)) {
            this.#deselectChord(index);
        } else {
            this.#selectChord(index);
        }
        event.stopPropagation();
    }

    #render() {
        const notes = this.#chords.map(chord => StaveHelper.createChord(...chord));
        const chordNames = this.#chords.map(chord => StaveHelper.nameChord(chord[0], chord[1], chord[2]));

        const maxChords = Math.floor((this.#staveWidth) / StaveHelper.metrics.chordWidth);
        const staveCount = Math.max(1, Math.ceil(notes.length / maxChords));

        this.#container.textContent = "";
        const renderer = new Renderer(this.#container, Renderer.Backends.SVG);
        const canvasWidth = this.#width;
        const canvasHeight = StaveHelper.metrics.topMargin + staveCount * StaveHelper.metrics.staveHeight;
        renderer.resize(canvasWidth, canvasHeight);
        const context = renderer.getContext();

        for (let staveIndex = 0; staveIndex < staveCount || staveIndex === 0; ++staveIndex) {
            const staveNotes = notes.slice(staveIndex * maxChords, (staveIndex + 1) * maxChords);
            const staveChordNames = chordNames.slice(staveIndex * maxChords, (staveIndex + 1) * maxChords);
            const top = StaveHelper.metrics.topMargin + staveIndex * (StaveHelper.metrics.staveHeight);
            this.#renderStave(staveNotes, staveChordNames, context, top);
        }

        const chordElements = this.#container.querySelectorAll(".vf-stavenote");

        for (const index of chordElements.keys()) {
            const chordElement = chordElements[index]!;
            if (this.#selectedChords.has(index)) {
                chordElement.classList.add("selected");
            }
            chordElement.setAttribute("pointer-events", "bounding-box");
            chordElement.addEventListener("click", (event) => this.chordClicked(index, event));
            const chordLabel = chordElement.nextSibling! as SVGTextElement;
            chordLabel.addEventListener("click", (event) => this.chordClicked(index, event));
            chordLabel.addEventListener("focus", () => {
                if (chordLabel.matches(":focus-visible")
                    && !this.#selectedChords.has(index)) {
                    this.#selectChord(index);
                }
            });
            chordLabel.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    this.dispatchEvent(new CustomEvent("chordPicked", { detail: { index } }) as IndexEvent);
                    event.preventDefault();
                }
            });
            chordLabel.setAttribute("tabindex", "0");
        }
    }

    #renderStave(notes: StaveNote[], chordNames: TextNote[], context: RenderContext, top: number) {
        const noteWidth = (this.#staveWidth - StaveHelper.metrics.clefWidth) / notes.length;
        for (const noteIndex in notes) {
            const measureWidth = noteWidth;
            const leftEdge = StaveHelper.metrics.horizontalMargin + noteWidth * parseInt(noteIndex);
            const stave = new Stave(leftEdge, top, measureWidth);
            stave.setContext(context);
            if (noteIndex === "0") {
                stave.addClef("treble");
            }

            const voice = new Voice({ num_beats: 1, beat_value: 1 }).setContext(context);
            voice.addTickables([notes[noteIndex]!]).setStave(stave);

            const chordNameVoice = new Voice({ num_beats: 1, beat_value: 1 }).setContext(context);
            chordNames[noteIndex]!.setStave(stave);
            chordNameVoice.addTickables([chordNames[noteIndex]!]).setStave(stave);

            new Formatter().joinVoices([voice, chordNameVoice]).formatToStave([voice, chordNameVoice], stave);
            stave.draw();
            voice.draw();
            chordNameVoice.draw();
        }
    }
}

export function initChordSheetElement() {
    customElements.define("chord-sheet", ChordSheetElement);
}

declare global {
    interface HTMLElementTagNameMap {
        "chord-sheet": ChordSheetElement;
    }
}
