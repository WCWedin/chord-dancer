import { StaveNote, Accidental, TextNote } from "vexflow";
import { ChordHelper } from "./ChordHelper.mjs";

export class StaveHelper {
    static metrics = Object.freeze({
        chordWidth: 150,
        clefWidth: 50,
        staveHeight: 130,
        topMargin: 30,
        horizontalMargin: 20,
        maxChords: 6
    });

    static noteNames = Object.freeze(["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]);

    static createChord(root: number, third: number, fifth: number, octave: number) {
        const position = 4 + octave;
        const keys = [
            `${StaveHelper.noteNames[root]}/${position}`,
            `${StaveHelper.noteNames[(root + third) % 12]}/${position + Math.floor((root + third) / 12)}`,
            `${StaveHelper.noteNames[(root + fifth) % 12]}/${position + Math.floor((root + fifth) / 12)}`
        ];

        const chord = new StaveNote(
            {
                keys,
                duration: "w"
            }
        );

        for (const index in keys) {
            if (keys[index]!.includes("#")) {
                chord.addModifier(new Accidental("#"), parseInt(index));
            }
        }

        return chord;
    }

    static nameChord(root: number, third: number, fifth: number) {
        return new TextNote({
            text: ChordHelper.nameChord(root, third, fifth) ?? "",
            duration: "w",
            font: {
                family: "system-ui",
                size: 15,
                weight: ""
            },
            line: 0
        });
    }
}
