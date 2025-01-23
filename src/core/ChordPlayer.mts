import type { ChordHistory } from "./ChordHistory.mjs";
import type { TypedEventTarget, IndexEvent } from "./types.mjs";

export class ChordPlayer extends (EventTarget as TypedEventTarget<{
    chordStarted: IndexEvent;
    chordEnded: IndexEvent;
}>) {
    #volume = 1;
    #audioCtx?: AudioContext;
    #wave?: PeriodicWave;
    #chordGain?: GainNode | undefined;
    #mainGain?: GainNode;
    static #chordLength = 1;

    initAudioContext() {
        this.#audioCtx = new AudioContext();
        this.#wave = this.#audioCtx.createPeriodicWave([0, 1, 3], [2, 0, 3]);
        this.#mainGain = new GainNode(this.#audioCtx);
        this.#mainGain.gain.setValueAtTime(this.#volume, this.#audioCtx.currentTime);
    }

    set volume(value) {
        this.#volume = value;
        if (this.#mainGain !== undefined) this.#mainGain.gain.setValueAtTime(this.#volume, this.#audioCtx!.currentTime);
    }

    get volume() {
        return this.#volume;
    }

    stopChord() {
        if (this.#chordGain) {
            this.#chordGain.gain.linearRampToValueAtTime(0, this.#audioCtx!.currentTime + 0.1);
            this.#chordGain = undefined;
        }
    }

    #defaultStopPlayback = () => this.stopChord();
    #stopPlayback = this.#defaultStopPlayback;
    stopPlayback() {
        this.#stopPlayback();
    }

    #playChord(root: number, third: number, fifth: number, octave: number, onEnded: ((this: AudioScheduledSourceNode, ev: Event) => any) | null = null) {
        if (this.#audioCtx === undefined) this.initAudioContext();

        console.log(this.#audioCtx!.state, this.#audioCtx!.currentTime, this.#audioCtx);
        this.stopChord();

        const freqs = [
            440 * Math.pow(2, (root - 9 + octave * 12) / 12),
            440 * Math.pow(2, (root + third - 9 + octave * 12) / 12),
            440 * Math.pow(2, (root + fifth - 9 + octave * 12) / 12)
        ];

        this.#chordGain = new GainNode(this.#audioCtx!);
        const startTime = this.#audioCtx!.currentTime;
        const peakTime = startTime + 0.1;
        const endTime = startTime + ChordPlayer.#chordLength;
        this.#chordGain.gain.setValueAtTime(0, startTime);
        this.#chordGain.gain.linearRampToValueAtTime(1 / freqs.length, peakTime);
        this.#chordGain.gain.linearRampToValueAtTime(0, endTime);

        const oscs = [];

        for (const freq of freqs) {
            const osc = this.#audioCtx!.createOscillator();
            osc.setPeriodicWave(this.#wave!);
            osc.frequency.value = freq;
            osc.connect(this.#chordGain).connect(this.#mainGain!).connect(this.#audioCtx!.destination);
            oscs.push(osc);
        }

        for (const osc of oscs) {
            osc.start();
            osc.stop(this.#audioCtx!.currentTime + ChordPlayer.#chordLength);
        }

        oscs[0]!.onended = onEnded;
    }

    playChord(root: number, third: number, fifth: number, octave: number) {
        this.#playChord(root, third, fifth, octave);
    }

    playChords(chords: ChordHistory) {
        this.#stopPlayback();

        let stopSignalSent = false;
        this.dispatchEvent(new Event("playbackStarted"));

        this.#stopPlayback = function () {
            this.#stopPlayback = this.#defaultStopPlayback;
            this.#stopPlayback();
            stopSignalSent = true;
            this.dispatchEvent(new Event("playbackEnded"));
        };

        const thisPlayer = this;

        function playIndex(index: number) {
            if (stopSignalSent == false) {
                if (index < chords.length) {
                    thisPlayer.dispatchEvent(new CustomEvent("chordStarted", { detail: { index } }) as IndexEvent);
                    thisPlayer.#playChord(
                        ...chords.getChord(index)!,
                        () => {
                            thisPlayer.dispatchEvent(new CustomEvent("chordEnded", { detail: { index } }) as IndexEvent);
                            playIndex(index + 1);
                        }
                    );
                } else {
                    thisPlayer.dispatchEvent(new Event("playbackEnded"));
                }
            }
        }

        playIndex(0);
    }
}
