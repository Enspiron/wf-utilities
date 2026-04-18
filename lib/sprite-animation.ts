export type AtlasEntry = {
  n: string;
  w: number;
  h: number;
  x: number;
  y: number;
  r?: boolean;
  fx?: number;
  fy?: number;
  fw?: number;
  fh?: number;
};

export type TimelineSequence = {
  begin: number | string;
  end: number | string;
  name: string;
  kind?: string;
  target?: string;
};

export type SpriteMetadata = {
  atlas: AtlasEntry[];
  timeline: {
    sequences: TimelineSequence[];
  };
  parts: {
    i?: Array<{ p?: string }>;
    g?: Array<{
      s?: Array<{
        s: number;
        i: number;
        l?: Array<{
          t?: number;
          r?: number;
        }>;
      }>;
      t?: number;
    }>;
  };
};

export type MetadataFrame = {
  atlas: AtlasEntry;
  imageIndex: number;
  sourceFrame: number;
  delayMs: number;
};

type PartState = {
  id: number;
  referencingFrame: number;
  indexForPath: number;
  next?: PartState;
};

type Segment = {
  s: number;
  i: number;
  l?: Array<{
    t?: number;
    r?: number;
  }>;
};

type Graphic = {
  totalFrame: number;
  frames: Array<PartState | undefined>;
};

const FRAME_MASK = 0x3fffffff;

function toNumber(value: number | string | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSegmentKind(value: number): number {
  return value >>> 30;
}

function getSegmentStart(value: number): number {
  return value & FRAME_MASK;
}

function getDuration(value: number | undefined): number {
  if (value === undefined || value === null) return 1;
  return Math.max(1, value & 0xffff);
}

function getFutureFrame(loopKind: number, frame: number, offset: number, totalFrames: number): number {
  if (loopKind === 0) return frame;
  if (loopKind === 1) return Math.ceil(Math.min(frame + offset, Math.max(0, totalFrames - 1)));
  if (loopKind === 2 && totalFrames > 0) return (frame + offset) % totalFrames;
  return 0;
}

function addFrame(graphic: Graphic, frameIndex: number, state: Omit<PartState, 'next'>) {
  if (frameIndex < 0 || frameIndex >= graphic.frames.length) return;
  graphic.frames[frameIndex] = {
    ...state,
    next: graphic.frames[frameIndex],
  };
}

function addImageSegment(graphic: Graphic, segment: Segment) {
  const startFrame = getSegmentStart(segment.s);
  let elapsed = 0;
  for (const record of segment.l || []) {
    const duration = getDuration(record.t);
    for (let offset = 0; offset < duration; offset += 1) {
      addFrame(graphic, startFrame + elapsed + offset, {
        id: segment.i,
        referencingFrame: 0,
        indexForPath: 0,
      });
    }
    elapsed += duration;
  }
}

function addGraphicSegment(
  graphic: Graphic,
  segment: Segment,
  descriptors: NonNullable<SpriteMetadata['parts']['g']>,
  indexForPath: number
) {
  const childId = segment.i;
  const childTotalFrames = Math.max(1, toNumber(descriptors[childId]?.t, 1));
  const startFrame = getSegmentStart(segment.s);
  let elapsed = 0;

  for (const record of segment.l || []) {
    const duration = getDuration(record.t);
    const reference = record.r ?? 0;
    const loopKind = reference >>> 30;
    const referenceFrame = reference & FRAME_MASK;

    for (let offset = 0; offset < duration; offset += 1) {
      addFrame(graphic, startFrame + elapsed + offset, {
        id: childId,
        referencingFrame: getFutureFrame(loopKind, referenceFrame, offset, childTotalFrames),
        indexForPath,
      });
    }

    elapsed += duration;
  }
}

function buildGraphics(parts: SpriteMetadata['parts']): Graphic[] {
  const descriptors = parts.g || [];
  return descriptors.map((descriptor) => {
    const graphic: Graphic = {
      totalFrame: Math.max(1, toNumber(descriptor.t, 1)),
      frames: new Array(Math.max(1, toNumber(descriptor.t, 1))),
    };
    const segments = descriptor.s || [];

    for (let index = 1; index <= segments.length; index += 1) {
      const segment = segments[segments.length - index];
      const kind = getSegmentKind(segment.s);

      if (kind === 0) {
        addImageSegment(graphic, segment);
      } else if (kind === 2) {
        addGraphicSegment(graphic, segment, descriptors, index);
      }
    }

    return graphic;
  });
}

function resolveFinalFrame(graphics: Graphic[], graphicIndex: number, frameIndex: number, depth = 0): PartState | null {
  if (depth > 24) return null;

  let state = graphics[graphicIndex]?.frames[frameIndex];
  while (state) {
    if (state.indexForPath === 0) return state;

    const resolved = resolveFinalFrame(graphics, state.id, state.referencingFrame, depth + 1);
    if (resolved) return resolved;

    state = state.next;
  }

  return null;
}

export function buildMetadataFrames(
  metadata: SpriteMetadata,
  sequence: TimelineSequence,
  frameMs: number
): MetadataFrame[] {
  const begin = Math.max(1, Math.floor(toNumber(sequence.begin, 1)));
  const end = Math.max(begin, Math.floor(toNumber(sequence.end, begin)));
  const delay = Math.max(1, Math.round(frameMs));
  const atlasByName = new Map(metadata.atlas.map((entry) => [entry.n, entry]));
  const imageAtlas = (metadata.parts.i || []).map((image) => (image.p ? atlasByName.get(image.p) : undefined));
  const graphics = buildGraphics(metadata.parts);
  const frames: MetadataFrame[] = [];

  for (let sourceFrame = begin; sourceFrame <= end; sourceFrame += 1) {
    const finalState = resolveFinalFrame(graphics, 0, sourceFrame - 1);
    if (!finalState) continue;

    const atlas = imageAtlas[finalState.id];
    if (!atlas) continue;

    const last = frames.at(-1);
    if (last?.imageIndex === finalState.id) {
      last.delayMs += delay;
    } else {
      frames.push({
        atlas,
        imageIndex: finalState.id,
        sourceFrame,
        delayMs: delay,
      });
    }
  }

  return frames;
}

export function getMetadataFrameCount(metadata: SpriteMetadata, sequence: TimelineSequence, frameMs = 16): number {
  return buildMetadataFrames(metadata, sequence, frameMs).length;
}

export function chooseDefaultSequence(metadata: SpriteMetadata, frameMs = 16): TimelineSequence | null {
  const sequences = metadata.timeline.sequences || [];
  if (sequences.length === 0) return null;

  const candidates = sequences.map((sequence) => ({
    sequence,
    frameCount: getMetadataFrameCount(metadata, sequence, frameMs),
  }));
  const preferredNames = ['neutral', 'idle', 'wait', 'stand'];

  for (const preferredName of preferredNames) {
    const match = candidates.find(({ frameCount, sequence }) => (
      frameCount > 1 && sequence.name.toLowerCase() === preferredName
    ));
    if (match) return match.sequence;
  }

  return (
    candidates.find(({ frameCount, sequence }) => frameCount > 1 && sequence.kind === 'loop')?.sequence ||
    candidates.find(({ frameCount }) => frameCount > 1)?.sequence ||
    sequences[0]
  );
}
