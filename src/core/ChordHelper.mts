import type { Chord } from "./types.mjs";

export class ChordHelper {
    static noteNames = Object.freeze(["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]);

    static thirdNames: Readonly<{ [key: number]: string; }> = Object.freeze({
        2: "sus2",
        3: "min",
        4: "maj",
        5: "sus4"
    });

    static fifthNames: Readonly<{ [key: number]: string; }> = Object.freeze({
        5: "𝄫5",
        6: "♭5",
        7: "5",
        8: "♯5"
    });

    static octaveNames = Object.freeze(["-3", "-2", "-1", "+0", "+1", "+2", "+3"]);

    static thirds = Object.freeze({
        "sus2": 2,
        "min": 3,
        "maj": 4,
        "sus4": 5
    });

    static fifths = Object.freeze({
        "perf4": 5,
        "dim": 6,
        "perf": 7,
        "aug": 8
    });

    static chordNames: Readonly<{ [key: number]: Readonly<{ [key: number]: string; }>; }> = Object.freeze({
        [ChordHelper.thirds.sus2]: Object.freeze({
            [ChordHelper.fifths.perf4]: "sus2𝄫5",
            [ChordHelper.fifths.dim]: "sus2♭5",
            [ChordHelper.fifths.perf]: "sus2",
            [ChordHelper.fifths.aug]: "sus2♯5"
        }),
        [ChordHelper.thirds.min]: Object.freeze({
            [ChordHelper.fifths.perf4]: "min𝄫5",
            [ChordHelper.fifths.dim]: "dim",
            [ChordHelper.fifths.perf]: "min",
            [ChordHelper.fifths.aug]: "min♯5"
        }),
        [ChordHelper.thirds.maj]: Object.freeze({
            [ChordHelper.fifths.perf4]: "maj𝄫5",
            [ChordHelper.fifths.dim]: "maj♭5",
            [ChordHelper.fifths.perf]: "maj",
            [ChordHelper.fifths.aug]: "aug"
        }),
        [ChordHelper.thirds.sus4]: Object.freeze({
            [ChordHelper.fifths.dim]: "sus4♭5",
            [ChordHelper.fifths.perf]: "sus4",
            [ChordHelper.fifths.aug]: "sus4♯5"
        })
    });

    static nameChord(root: number, third: number, fifth: number): string | undefined {
        const rootName = ChordHelper.noteNames[root];
        const chordName = ChordHelper.chordNames[third]?.[fifth];
        return (rootName && chordName)
            ? `${rootName}${chordName}`
            : undefined;
    }

    static spellChord(root: number, third: number, fifth: number): string | undefined {
        const rootName = ChordHelper.noteNames[root];
        const thirdName = ChordHelper.noteNames[(root + third) % 12];
        const fifthName = ChordHelper.noteNames[(root + fifth) % 12];
        return (rootName && thirdName && fifthName)
            ? `${rootName} ${thirdName} ${fifthName}`
            : undefined;
    }

    static lowerRoot(root: number, third: number, fifth: number, octave: number): Chord {
        const newRoot = (root - 1 + 12) % 12;
        return [
            newRoot,
            (third + 1) % 12,
            (fifth + 1) % 12,
            newRoot < root ? octave : octave - 1
        ];
    }

    static raiseRoot(root: number, third: number, fifth: number, octave: number): Chord {
        const newRoot = (root + 1) % 12;
        return [
            newRoot,
            (third - 1 + 12) % 12,
            (fifth - 1 + 12) % 12,
            newRoot > root ? octave : octave + 1
        ];
    }

    static lowerThird(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            (third - 1 + 12) % 12,
            fifth,
            octave
        ];
    }

    static raiseThird(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            (third + 1) % 12,
            fifth,
            octave
        ];
    }

    static lowerFifth(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            third,
            (fifth - 1 + 12) % 12,
            octave
        ];
    }

    static raiseFifth(root: number, third: number, fifth: number, octave: number): Chord {
        return [
            root,
            third,
            (fifth + 1) % 12,
            octave
        ];
    }

    static findRootPosition(root: number, third: number, fifth: number, octave: number): Chord | undefined {
        return (
            root !== undefined
            && third !== undefined
            && fifth !== undefined
            && ChordHelper.chordNames[third]?.[fifth]
        )
            ? [root, third, fifth, octave]
            : undefined;
    }

    static findFirstInversion(root: number, third: number, fifth: number, octave: number): Chord | undefined {
        const newRoot = (root + third) % 12;
        const newThird = (12 + fifth - third) % 12;
        const newFifth = (12 - third) % 12;

        return (newRoot !== undefined && ChordHelper.chordNames[newThird]?.[newFifth])
            ? [newRoot, newThird, newFifth, octave]
            : undefined;
    }

    static findSecondInversion(root: number, third: number, fifth: number, octave: number): Chord | undefined {
        const newRoot = (root + fifth) % 12;
        const newThird = (12 - fifth) % 12;
        const newFifth = (12 + third - fifth) % 12;

        return (newRoot !== undefined && ChordHelper.chordNames[newThird]?.[newFifth])
            ? [newRoot, newThird, newFifth, octave]
            : undefined;
    }

    static findInversions(root: number, third: number, fifth: number, octave: number): Chord[] {
        const rootPosition = ChordHelper.findRootPosition(root, third, fifth, octave);
        const firstInversion = ChordHelper.findFirstInversion(root, third, fifth, octave);
        const secondInversation = ChordHelper.findSecondInversion(root, third, fifth, octave);

        const inversions = [];
        if (rootPosition) inversions.push(rootPosition);
        if (firstInversion) inversions.push(firstInversion);
        if (secondInversation) inversions.push(secondInversation);
        return inversions;
    }
}
