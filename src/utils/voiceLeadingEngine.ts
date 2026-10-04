import {
  calculateErgonomicCost,
  STANDARD_OPEN_STRING_MIDI,
  type ErgonomicFretboardVoicing,
} from "./ergonomicsEngine";

export interface VoiceLeadingVoicing extends ErgonomicFretboardVoicing {
  anchorFret: number;
  individualCost?: number;
}

export interface VoicePitch {
  stringIndex: number;
  fret: number;
  midi: number;
}

export interface VoiceExtremes {
  bass?: VoicePitch;
  soprano?: VoicePitch;
}

export interface VoiceLeadingCostOptions {
  fretShiftWeight?: number;
  retainedNoteBonus?: number;
}

export interface ProgressionPathOptions extends VoiceLeadingCostOptions {
  voicingCost?: (voicing: VoiceLeadingVoicing) => number;
}

export function voicingPitches(voicing: Pick<VoiceLeadingVoicing, "fretPositions">): VoicePitch[] {
  if (voicing.fretPositions.length !== STANDARD_OPEN_STRING_MIDI.length) return [];
  return voicing.fretPositions.flatMap((fret, stringIndex) => {
    if (fret === "x") return [];
    return [{ stringIndex, fret, midi: STANDARD_OPEN_STRING_MIDI[stringIndex] + fret }];
  });
}

export function identifySopranoAndBass(voicing: Pick<VoiceLeadingVoicing, "fretPositions">): VoiceExtremes {
  const pitches = voicingPitches(voicing);
  if (pitches.length === 0) return {};
  const firstPitch = pitches[0];
  return {
    bass: pitches.reduce((lowest, pitch) => pitch.midi < lowest.midi ? pitch : lowest, firstPitch),
    soprano: pitches.reduce((highest, pitch) => pitch.midi > highest.midi ? pitch : highest, firstPitch),
  };
}

function retainedPositionCount(previous: VoiceLeadingVoicing, next: VoiceLeadingVoicing): number {
  return previous.fretPositions.reduce<number>((count, fret, stringIndex) => {
    if (fret === "x") return count;
    return fret === next.fretPositions[stringIndex] ? count + 1 : count;
  }, 0);
}

export function calculateVoiceLeadingCost(
  previous: VoiceLeadingVoicing,
  next: VoiceLeadingVoicing,
  options: VoiceLeadingCostOptions = {},
): number {
  const previousSoprano = identifySopranoAndBass(previous).soprano;
  const nextSoprano = identifySopranoAndBass(next).soprano;
  if (!previousSoprano || !nextSoprano) return Number.POSITIVE_INFINITY;
  const sopranoLeap = nextSoprano.midi - previousSoprano.midi;
  const fretShiftWeight = options.fretShiftWeight ?? 2;
  const retainedNoteBonus = options.retainedNoteBonus ?? 1.5;
  const sopranoCost = sopranoLeap ** 2;
  const fretShiftCost = Math.abs(next.anchorFret - previous.anchorFret) * fretShiftWeight;
  const retainedCost = retainedPositionCount(previous, next) * retainedNoteBonus;
  return Math.max(0, sopranoCost + fretShiftCost - retainedCost);
}

function localCost(voicing: VoiceLeadingVoicing, options: ProgressionPathOptions): number {
  return options.voicingCost?.(voicing) ?? voicing.individualCost ?? calculateErgonomicCost(voicing);
}

export function findOptimalProgressionPath<T extends VoiceLeadingVoicing>(
  candidateLayers: readonly (readonly T[])[],
  options: ProgressionPathOptions = {},
): T[] {
  if (candidateLayers.length === 0 || candidateLayers.some((layer) => layer.length === 0)) return [];

  const costLayers: number[][] = [];
  const predecessorLayers: number[][] = [];
  const firstCosts = candidateLayers[0].map((voicing) => localCost(voicing, options));
  costLayers.push(firstCosts);
  predecessorLayers.push(candidateLayers[0].map(() => -1));

  for (let layerIndex = 1; layerIndex < candidateLayers.length; layerIndex += 1) {
    const previousCandidates = candidateLayers[layerIndex - 1];
    const currentCandidates = candidateLayers[layerIndex];
    const previousCosts = costLayers[layerIndex - 1];
    const currentCosts = currentCandidates.map(() => Number.POSITIVE_INFINITY);
    const predecessors = currentCandidates.map(() => -1);

    currentCandidates.forEach((current, currentIndex) => {
      const noteCost = localCost(current, options);
      if (!Number.isFinite(noteCost)) return;
      previousCandidates.forEach((previous, previousIndex) => {
        if (!Number.isFinite(previousCosts[previousIndex])) return;
        const transition = calculateVoiceLeadingCost(previous, current, options);
        const total = previousCosts[previousIndex] + transition + noteCost;
        if (total < currentCosts[currentIndex]) {
          currentCosts[currentIndex] = total;
          predecessors[currentIndex] = previousIndex;
        }
      });
    });
    costLayers.push(currentCosts);
    predecessorLayers.push(predecessors);
  }

  const finalCosts = costLayers.at(-1) ?? [];
  let bestIndex = -1;
  finalCosts.forEach((cost, index) => {
    if (Number.isFinite(cost) && (bestIndex < 0 || cost < finalCosts[bestIndex])) bestIndex = index;
  });
  if (bestIndex < 0) return [];

  const path = new Array<T>(candidateLayers.length);
  for (let layerIndex = candidateLayers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    path[layerIndex] = candidateLayers[layerIndex][bestIndex];
    bestIndex = predecessorLayers[layerIndex][bestIndex];
  }
  return path;
}
