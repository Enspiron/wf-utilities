declare module 'gifenc' {
  export type GifPaletteColor = [number, number, number] | [number, number, number, number];

  export type GifPalette = GifPaletteColor[];

  export type GifEncoder = {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: GifPalette | null;
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        repeat?: number;
        dispose?: number;
        colorDepth?: number;
      }
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoder;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    }
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;
}
