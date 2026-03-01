'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, User, Image as ImageIcon, BookOpen, Loader2, Download, Monitor, Layers, Copy, MoveHorizontal, MoveVertical, Maximize2, Languages, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FaceData {
  ui?: {
    files: string[];
  };
  story?: {
    files: string[];
  };
}

interface FaceUIData {
  [faceName: string]: FaceData;
}

interface FullShotAttribute {
  [characterId: string]: {
    [variant: string]: number[];
  };
}

interface CharacterData {
  [id: string]: string[];
}

interface CharacterTextData {
  [id: string]: string[];
}

interface TrimmedImageData {
  [assetKey: string]: string[] | number[];
}

interface TrimRect {
  x: number;
  y: number;
  canvasWidth: number;
  canvasHeight: number;
}

const OTHER_PART_EXPRESSIONS = ['shame.png', 'sweat.png', 'unknown.png'];

export default function FaceBuilder() {
  const [faces, setFaces] = useState<string[]>([]);
  const [faceUIData, setFaceUIData] = useState<FaceUIData>({});
  const [characterData, setCharacterData] = useState<CharacterData>({});
  const [characterTextJP, setCharacterTextJP] = useState<CharacterTextData>({});
  const [characterTextEN, setCharacterTextEN] = useState<CharacterTextData>({});
  const [fullShotAttributes, setFullShotAttributes] = useState<FullShotAttribute>({});
  const [loading, setLoading] = useState(true);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBase, setSelectedBase] = useState<'0' | '1'>('0');
  const [selectedExpressions, setSelectedExpressions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'compose' | 'browse'>('compose');
  const [selectedFile, setSelectedFile] = useState<{ type: 'ui' | 'story' | 'fullshot'; file: string; variant?: string } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [expressionScale, setExpressionScale] = useState(1);
  const [expressionOffsetX, setExpressionOffsetX] = useState(0);
  const [expressionOffsetY, setExpressionOffsetY] = useState(0);
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<'jp' | 'en' | 'both'>('both');
  const [trimmedImageData, setTrimmedImageData] = useState<TrimmedImageData>({});
  const [composeError, setComposeError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const composeRenderIdRef = useRef(0);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const normalizeAssetStem = useCallback((file: string) => {
    return file.replace(/\.(atf|png)$/i, '').toLowerCase();
  }, []);

  const toPngFileName = useCallback((file: string) => {
    return `${normalizeAssetStem(file)}.png`;
  }, [normalizeAssetStem]);

  const getStoryImageUrlForFace = useCallback((faceName: string, file: string) => {
    return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceName}/ui/story/${toPngFileName(file)}`;
  }, [toPngFileName]);

  const getStoryTrimKey = useCallback((faceName: string, file: string) => {
    return `character/${faceName}/ui/story/${normalizeAssetStem(file)}`;
  }, [normalizeAssetStem]);

  const getTrimRect = useCallback((faceName: string, file: string): TrimRect | null => {
    const key = getStoryTrimKey(faceName, file);
    const raw = trimmedImageData[key];
    if (!Array.isArray(raw) || raw.length < 4) return null;

    const x = Number(raw[0]);
    const y = Number(raw[1]);
    const canvasWidth = Number(raw[2]);
    const canvasHeight = Number(raw[3]);

    if ([x, y, canvasWidth, canvasHeight].some((value) => Number.isNaN(value))) {
      return null;
    }

    return { x, y, canvasWidth, canvasHeight };
  }, [getStoryTrimKey, trimmedImageData]);

  const loadData = async () => {
    try {
      const fetchTrimmedImageData = async (): Promise<TrimmedImageData> => {
        const primary = await fetch('/data/datalist/generated/trimmed_image.json');
        if (primary.ok) {
          const data = await primary.json();
          if (data && typeof data === 'object') {
            return data as TrimmedImageData;
          }
        }

        const fallback = await fetch('/data/datalist_en/generated/trimmed_image.json');
        if (fallback.ok) {
          const data = await fallback.json();
          if (data && typeof data === 'object') {
            return data as TrimmedImageData;
          }
        }

        return {};
      };

      const [facesRes, faceUIRes, characterRes, fullShotRes, charTextJPRes, charTextENRes, trimmedImageDataRes] = await Promise.all([
        fetch('/data/faces.json'),
        fetch('/data/face-ui.json'),
        fetch('/data/character.json'),
        fetch('/data/full_shot_image_attribute.json'),
        fetch('/api/character-text?lang=jp'),
        fetch('/api/character-text?lang=en'),
        fetchTrimmedImageData()
      ]);
      
      const facesData = await facesRes.json();
      const faceUIDataRes = await faceUIRes.json();
      const characterDataRes = await characterRes.json();
      const fullShotData = await fullShotRes.json();
      const charTextJP = await charTextJPRes.json();
      const charTextEN = await charTextENRes.json();
      
      setFaces(Array.isArray(facesData.faces) ? facesData.faces : []);
      setFaceUIData(faceUIDataRes && typeof faceUIDataRes === 'object' ? faceUIDataRes : {});
      setCharacterData(characterDataRes && typeof characterDataRes === 'object' ? characterDataRes : {});
      setFullShotAttributes(fullShotData && typeof fullShotData === 'object' ? fullShotData : {});
      setCharacterTextJP(charTextJP?.data && typeof charTextJP.data === 'object' ? charTextJP.data : {});
      setCharacterTextEN(charTextEN?.data && typeof charTextEN.data === 'object' ? charTextEN.data : {});
      setTrimmedImageData(trimmedImageDataRes && typeof trimmedImageDataRes === 'object' ? trimmedImageDataRes : {});
    } catch (error) {
      console.error('Error loading face data:', error);
      // Set defaults on error
      setFaces([]);
      setFaceUIData({});
      setCharacterData({});
      setFullShotAttributes({});
      setCharacterTextJP({});
      setCharacterTextEN({});
      setTrimmedImageData({});
    } finally {
      setLoading(false);
    }
  };

  const filteredFaces = useMemo(() => {
    if (!Array.isArray(faces)) return [];
    if (!searchTerm) return faces;
    return faces.filter(face => 
      face.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faces, searchTerm]);

  const currentFaceData = selectedFace ? faceUIData[selectedFace] : null;
  const selectedExpressionList = useMemo(() => Array.from(selectedExpressions), [selectedExpressions]);

  const availableBaseFiles = useMemo(() => {
    if (!currentFaceData?.story?.files || !Array.isArray(currentFaceData.story.files)) return [];
    return currentFaceData.story.files.filter((file) => normalizeAssetStem(file).startsWith('base'));
  }, [currentFaceData, normalizeAssetStem]);

  const resolvedBaseFile = useMemo(() => {
    if (availableBaseFiles.length === 0) return null;

    const normalizedMap = new Map<string, string>();
    availableBaseFiles.forEach((file) => {
      normalizedMap.set(normalizeAssetStem(file), file);
    });

    const preferred = selectedBase === '1'
      ? ['base_1', 'base_b', 'base_1_right', 'base_b_right', 'base']
      : ['base_0', 'base', 'base_0_right'];

    for (const baseStem of preferred) {
      const matched = normalizedMap.get(baseStem);
      if (matched) return matched;
    }

    const firstWithoutRight = availableBaseFiles.find((file) => !normalizeAssetStem(file).includes('_right'));
    return firstWithoutRight ?? availableBaseFiles[0];
  }, [availableBaseFiles, normalizeAssetStem, selectedBase]);

  const composeCanvasSize = useMemo(() => {
    if (selectedFace && resolvedBaseFile) {
      const baseRect = getTrimRect(selectedFace, resolvedBaseFile);
      if (baseRect) {
        return { width: baseRect.canvasWidth, height: baseRect.canvasHeight };
      }
    }

    if (selectedFace && selectedExpressionList.length > 0) {
      for (const expression of selectedExpressionList) {
        const expressionRect = getTrimRect(selectedFace, expression);
        if (expressionRect) {
          return { width: expressionRect.canvasWidth, height: expressionRect.canvasHeight };
        }
      }
    }

    return { width: 512, height: 512 };
  }, [getTrimRect, resolvedBaseFile, selectedExpressionList, selectedFace]);

  const orderedBaseCandidates = useMemo(() => {
    if (!resolvedBaseFile) return availableBaseFiles;
    return [resolvedBaseFile, ...availableBaseFiles.filter((file) => file !== resolvedBaseFile)];
  }, [availableBaseFiles, resolvedBaseFile]);

  const handleFaceSelect = (face: string) => {
    setSelectedFace(face);
    setSelectedFile(null);
    setImageError(false);
    setComposeError(null);
    setSelectedExpressions(new Set());
    setSelectedBase('0');
    setViewMode('compose');
  };

  const toggleExpression = (expression: string) => {
    setSelectedExpressions(prev => {
      const newSet = new Set(prev);
      const isOtherPart = OTHER_PART_EXPRESSIONS.includes(expression);
      
      if (!isOtherPart) {
        // Main expressions are exclusive: keep one main face expression active.
        availableExpressions.forEach((exp) => {
          if (!OTHER_PART_EXPRESSIONS.includes(exp)) {
            newSet.delete(exp);
          }
        });
        // Toggle the clicked one
        if (prev.has(expression)) {
          // If it was already selected, just remove it (deselect)
          return newSet;
        } else {
          // Add the selected main expression
          newSet.add(expression);
        }
      } else {
        // Other parts are additive/toggleable.
        if (newSet.has(expression)) {
          newSet.delete(expression);
        } else {
          newSet.add(expression);
        }
      }
      
      return newSet;
    });
  };

  const clearExpressions = () => {
    setSelectedExpressions(new Set());
  };

  const copyEncoding = () => {
    const encoding = `scale: ${expressionScale}, offsetX: ${expressionOffsetX}, offsetY: ${expressionOffsetY}`;
    navigator.clipboard.writeText(encoding);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetAdjustments = () => {
    setExpressionScale(1);
    setExpressionOffsetX(0);
    setExpressionOffsetY(0);
  };

  const loadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const cached = imageCacheRef.current.get(url);

      if (cached && cached.complete && cached.naturalWidth > 0) {
        resolve(cached);
        return;
      }

      const img = cached ?? new window.Image();

      const cleanup = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };

      const onLoad = () => {
        cleanup();
        resolve(img);
      };

      const onError = () => {
        cleanup();
        imageCacheRef.current.delete(url);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);

      if (!cached) {
        imageCacheRef.current.set(url, img);
        img.src = url;
      } else if (img.complete && img.naturalWidth > 0) {
        cleanup();
        resolve(img);
      }
    });
  }, []);

  const getStoryImageUrlCandidates = useCallback((faceName: string, file: string) => {
    const normalizedPng = toPngFileName(file);
    const original = file.toLowerCase().endsWith('.png') ? file : normalizedPng;
    const encodedFace = encodeURIComponent(faceName);
    const encodedPng = encodeURIComponent(normalizedPng);
    const encodedOriginal = encodeURIComponent(original);

    const urls = [
      `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceName}/ui/story/${normalizedPng}`,
      `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${encodedFace}/ui/story/${encodedPng}`
    ];

    if (encodedOriginal !== encodedPng) {
      urls.push(`https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${encodedFace}/ui/story/${encodedOriginal}`);
    }

    return Array.from(new Set(urls));
  }, [toPngFileName]);

  const loadImageWithFallback = useCallback(async (urls: string[]) => {
    for (const url of urls) {
      try {
        const image = await loadImage(url);
        return { image, url };
      } catch {
        continue;
      }
    }
    return { image: null, url: null };
  }, [loadImage]);

  const drawStoryLayer = useCallback(async (
    ctx: CanvasRenderingContext2D,
    faceName: string,
    file: string,
    options?: { offsetX?: number; offsetY?: number; scale?: number }
  ) => {
    const { image } = await loadImageWithFallback(getStoryImageUrlCandidates(faceName, file));
    if (!image) return false;
    const trimRect = getTrimRect(faceName, file);
    const offsetX = options?.offsetX ?? 0;
    const offsetY = options?.offsetY ?? 0;
    const scale = options?.scale ?? 1;

    if (trimRect) {
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(
        image,
        trimRect.x + offsetX,
        trimRect.y + offsetY,
        drawWidth,
        drawHeight
      );
      return true;
    }

    // Fallback for rare entries that do not have trim metadata.
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, 512, 512);
    ctx.restore();
    return true;
  }, [getStoryImageUrlCandidates, getTrimRect, loadImageWithFallback]);

  const renderCompositeToCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<boolean> => {
    if (!selectedFace || orderedBaseCandidates.length === 0) return false;

    canvas.width = composeCanvasSize.width;
    canvas.height = composeCanvasSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let baseRendered = false;
    for (const baseFile of orderedBaseCandidates) {
      if (await drawStoryLayer(ctx, selectedFace, baseFile)) {
        baseRendered = true;
        break;
      }
    }

    if (!baseRendered) {
      return false;
    }

    for (const expression of selectedExpressionList) {
      await drawStoryLayer(ctx, selectedFace, expression, {
        offsetX: expressionOffsetX,
        offsetY: expressionOffsetY,
        scale: expressionScale
      });
    }

    return true;
  }, [
    composeCanvasSize.height,
    composeCanvasSize.width,
    drawStoryLayer,
    expressionOffsetX,
    expressionOffsetY,
    expressionScale,
    orderedBaseCandidates,
    selectedExpressionList,
    selectedFace
  ]);

  const downloadComposite = async () => {
    if (!selectedFace || !resolvedBaseFile || !canvasRef.current) return;
    setIsDownloading(true);

    try {
      const rendered = await renderCompositeToCanvas(canvasRef.current);
      if (!rendered) {
        throw new Error('Could not render composite canvas');
      }

      // Trigger download
      try {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${selectedFace}_composite.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Download blocked by cross-origin image policy:', error);
        setComposeError('Preview rendered, but download is blocked for this asset by browser cross-origin policy.');
      }

    } catch (error) {
      console.error('Failed to generate composite:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (viewMode !== 'compose') return;
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;

    if (!selectedFace || !resolvedBaseFile) {
      setComposeError('No base image was found for this face.');
      return;
    }

    const renderId = ++composeRenderIdRef.current;
    let disposed = false;
    setComposeError(null);

    (async () => {
      const rendered = await renderCompositeToCanvas(previewCanvas);
      if (disposed || renderId !== composeRenderIdRef.current) return;
      if (!rendered) {
        setComposeError('Failed to render composite preview.');
      }
    })();

    return () => {
      disposed = true;
    };
  }, [
    expressionOffsetX,
    expressionOffsetY,
    expressionScale,
    renderCompositeToCanvas,
    resolvedBaseFile,
    selectedExpressionList,
    selectedFace,
    viewMode
  ]);

  const handleFileSelect = (type: 'ui' | 'story' | 'fullshot', file: string, variant?: string) => {
    setSelectedFile({ type, file, variant });
    setImageError(false);
    setImageLoading(true);
  };

  const getCharacterId = (faceName: string): string | null => {
    for (const [id, data] of Object.entries(characterData)) {
      if (data[0] === faceName) {
        return id;
      }
    }
    return null;
  };

  const getCharacterName = (faceName: string): string => {
    const charId = getCharacterId(faceName);
    if (!charId) return faceName;
    
    const jpName = characterTextJP[charId]?.[0] || faceName;
    const enName = characterTextEN[charId]?.[0] || '';
    
    if (language === 'jp') return jpName;
    if (language === 'en') return enName || jpName;
    // Both
    return enName ? `${enName} / ${jpName}` : jpName;
  };

  const getFullShotImageUrl = (faceName: string, variant: string) => {
    return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceName}/ui/full_shot_1440_1920_${variant}.png`;
  };

  const getFullShotPositioning = (faceName: string, variant: string) => {
    const charId = getCharacterId(faceName);
    if (!charId || !fullShotAttributes[charId]?.[variant]) {
      return null;
    }
    const [baseWidth, baseHeight, , xOffset, yOffset] = fullShotAttributes[charId][variant];
    return { baseWidth, baseHeight, xOffset, yOffset };
  };

  const getImageUrl = useCallback((type: 'ui' | 'story' | 'fullshot', file: string, variant?: string) => {
    if (!selectedFace) return '';
    
    if (type === 'fullshot' && variant) {
      return getFullShotImageUrl(selectedFace, variant);
    }
    
    // Construct URL based on type
    if (type === 'story') {
      return getStoryImageUrlForFace(selectedFace, file);
    } else {
      // UI files are in character_art/{faceName}/ui/
      return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${selectedFace}/ui/${toPngFileName(file)}`;
    }
  }, [getStoryImageUrlForFace, selectedFace, toPngFileName]);

  const downloadImage = () => {
    if (!selectedFile || !selectedFace) return;
    const url = getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant);
    const link = document.createElement('a');
    link.href = url;
    const filename = selectedFile.variant 
      ? `${selectedFace}_fullshot_${selectedFile.variant}.png`
      : `${selectedFace}_${selectedFile.type}_${selectedFile.file}`;
    link.download = filename;
    link.click();
  };

  const availableExpressions = useMemo(() => {
    if (!selectedFace || !currentFaceData?.story?.files) return [];
    if (!Array.isArray(currentFaceData.story.files)) return [];
    return currentFaceData.story.files.filter(file => 
      !normalizeAssetStem(file).startsWith('base') // Exclude all base files from expressions
    );
  }, [currentFaceData, normalizeAssetStem, selectedFace]);

  const availableFullShotVariants = useMemo(() => {
    if (!selectedFace) return [];
    const charId = getCharacterId(selectedFace);
    if (!charId || !fullShotAttributes[charId]) return [];
    const variants = Object.keys(fullShotAttributes[charId]);
    return Array.isArray(variants) ? variants : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFace, fullShotAttributes]);

  const { mainExps, otherExps } = useMemo(() => {
    const otherPartsSet = new Set(OTHER_PART_EXPRESSIONS);
    const main: string[] = [];
    const oth: string[] = [];
    
    availableExpressions.forEach(exp => {
      if (otherPartsSet.has(exp)) {
        oth.push(exp);
      } else {
        main.push(exp);
      }
    });
    
    return { mainExps: main, otherExps: oth };
  }, [availableExpressions]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-80">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Loading Face Builder</p>
                <p className="text-xs text-muted-foreground mt-1">Loading character data...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Face Selection */}
      <div className="w-80 border-r border-border bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold flex-1">Face Builder</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Language">
                    <Languages className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLanguage('jp')}>
                    <span className={language === 'jp' ? 'font-bold' : ''}>🇯🇵 Japanese</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('en')}>
                    <span className={language === 'en' ? 'font-bold' : ''}>🇬🇧 English</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('both')}>
                    <span className={language === 'both' ? 'font-bold' : ''}>🌐 Both</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search faces..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {filteredFaces.length} face{filteredFaces.length !== 1 ? 's' : ''} available
            </div>
          </div>

          {/* Face List */}
          <ScrollArea className="flex-1">
            <TooltipProvider delayDuration={300}>
              <div className="p-2 space-y-1">
                {filteredFaces.map((face) => (
                  <Tooltip key={face}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={selectedFace === face ? 'default' : 'ghost'}
                        className="w-full justify-start text-left font-normal text-xs"
                        onClick={() => handleFaceSelect(face)}
                      >
                        <User className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{getCharacterName(face)}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="p-2">
                      <div className="flex flex-col gap-2">
                        <Image
                          src={`https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${face}/ui/battle_member_status_0.png`}
                          alt={face}
                          width={128}
                          height={128}
                          className="rounded"
                          style={{ imageRendering: 'pixelated' }}
                          unoptimized
                        />
                        <p className="text-xs font-medium">{getCharacterName(face)}</p>
                        <p className="text-xs text-muted-foreground">{face}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedFace ? (
          <div className="flex h-full items-center justify-center p-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Welcome to Face Builder</CardTitle>
                <CardDescription>
                  Select a character from the sidebar to compose custom faces or browse all assets
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Mode Toggle */}
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'compose' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('compose')}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Compose Face
                </Button>
                <Button
                  variant={viewMode === 'browse' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('browse')}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>
                <div className="flex-1" />
                <h2 className="text-xl font-bold">{selectedFace}</h2>
              </div>
            </div>

            {viewMode === 'compose' ? (
              /* Compose Mode */
              <div className="flex h-full gap-4 p-6 overflow-hidden">
                {/* Left Panel - Expression Selection */}
                <div className="w-80 flex flex-col gap-4">
                  {/* Base Selection */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Base Template</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant={selectedBase === '0' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedBase('0')}
                      >
                        Base 0 (Blank Face)
                      </Button>
                      <Button
                        variant={selectedBase === '1' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedBase('1')}
                      >
                        Base 1 (Alternate)
                      </Button>
                      {resolvedBaseFile && (
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Using: <span className="font-mono">{resolvedBaseFile}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expression Adjustment Controls */}
                  {selectedExpressions.size > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Expression Adjustment</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={resetAdjustments}
                              title="Reset Adjustments"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={copyEncoding}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              {copied ? 'Copied!' : 'Copy'}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Scale */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium flex items-center gap-1">
                              <Maximize2 className="h-3 w-3" />
                              Scale
                            </label>
                            <span className="text-xs text-muted-foreground">{expressionScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="3"
                            step="0.01"
                            value={expressionScale}
                            onChange={(e) => setExpressionScale(parseFloat(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        {/* Offset X */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium flex items-center gap-1">
                              <MoveHorizontal className="h-3 w-3" />
                              Position X
                            </label>
                            <span className="text-xs text-muted-foreground">{expressionOffsetX}px</span>
                          </div>
                          <input
                            type="range"
                            min="-400"
                            max="400"
                            step="1"
                            value={expressionOffsetX}
                            onChange={(e) => setExpressionOffsetX(parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        {/* Offset Y */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium flex items-center gap-1">
                              <MoveVertical className="h-3 w-3" />
                              Position Y
                            </label>
                            <span className="text-xs text-muted-foreground">{expressionOffsetY}px</span>
                          </div>
                          <input
                            type="range"
                            min="-400"
                            max="400"
                            step="1"
                            value={expressionOffsetY}
                            onChange={(e) => setExpressionOffsetY(parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Expression Selection */}
                  {availableExpressions.length > 0 && (
                    <Card className="flex-1 flex flex-col overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Expressions</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearExpressions}
                            disabled={selectedExpressions.size === 0}
                          >
                            Clear
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedExpressions.size} selected
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                          <div className="p-4 pt-0 space-y-4">
                            {mainExps.length > 0 && (
                              <div>
                                <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main Expressions</h4>
                                <div className="space-y-1">
                                  {mainExps.map(expression => (
                                    <Button
                                      key={expression}
                                      variant={selectedExpressions.has(expression) ? 'default' : 'ghost'}
                                      size="sm"
                                      className="w-full justify-start text-left font-normal text-xs"
                                      onClick={() => toggleExpression(expression)}
                                    >
                                      <span className="truncate">◉ {expression.replace('.png', '')}</span>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {otherExps.length > 0 && (
                              <div>
                                <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Other Parts</h4>
                                <div className="space-y-1">
                                  {otherExps.map(expression => (
                                    <Button
                                      key={expression}
                                      variant={selectedExpressions.has(expression) ? 'default' : 'ghost'}
                                      size="sm"
                                      className="w-full justify-start text-left font-normal text-xs"
                                      onClick={() => toggleExpression(expression)}
                                    >
                                      <span className="truncate">☐ {expression.replace('.png', '')}</span>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Panel - Preview */}
                <Card className="flex-1 flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Face Preview</CardTitle>
                        <CardDescription className="mt-1">
                          {resolvedBaseFile ?? `Base ${selectedBase}`} {selectedExpressions.size > 0 && `+ ${selectedExpressions.size} expression${selectedExpressions.size > 1 ? 's' : ''}`}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadComposite}
                        disabled={isDownloading || !resolvedBaseFile}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Download
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center justify-center p-6">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {composeError ? (
                        <div className="text-center text-muted-foreground">
                          <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                          <p className="text-sm">{composeError}</p>
                        </div>
                      ) : (
                        <canvas
                          ref={previewCanvasRef}
                          width={composeCanvasSize.width}
                          height={composeCanvasSize.height}
                          className="max-w-full max-h-full rounded-md border border-border bg-muted/20 shadow-sm"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Browse Mode */
              <div className="flex h-full gap-4 p-6">
                {/* Left Panel - File Selection */}
                <div className="w-80 flex flex-col gap-4 overflow-hidden">
              {/* UI Files */}
              {currentFaceData?.ui?.files && Array.isArray(currentFaceData.ui.files) && (
                <Card className="flex-1 flex flex-col overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      UI Files
                      <Badge variant="secondary" className="ml-auto">
                        {currentFaceData.ui.files.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 pt-0 space-y-1">
                        {currentFaceData.ui.files.map((file) => (
                          <Button
                            key={file}
                            variant={
                              selectedFile?.type === 'ui' && selectedFile?.file === file
                                ? 'default'
                                : 'ghost'
                            }
                            className="w-full justify-start text-left font-normal text-xs"
                            size="sm"
                            onClick={() => handleFileSelect('ui', file)}
                          >
                            <span className="truncate">{file}</span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Story Files */}
              {currentFaceData?.story?.files && Array.isArray(currentFaceData.story.files) && (
                <Card className="flex-1 flex flex-col overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Story Files
                      <Badge variant="secondary" className="ml-auto">
                        {currentFaceData.story.files.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 pt-0 space-y-1">
                        {currentFaceData.story.files.map((file) => (
                          <Button
                            key={file}
                            variant={
                              selectedFile?.type === 'story' && selectedFile?.file === file
                                ? 'default'
                                : 'ghost'
                            }
                            className="w-full justify-start text-left font-normal text-xs"
                            size="sm"
                            onClick={() => handleFileSelect('story', file)}
                          >
                            <span className="truncate">{file}</span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Full Shot Images */}
              {Array.isArray(availableFullShotVariants) && availableFullShotVariants.length > 0 && (
                <Card className="flex-1 flex flex-col overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-primary" />
                      Full Shot
                      <Badge variant="secondary" className="ml-auto">
                        {availableFullShotVariants.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 pt-0 space-y-1">
                        {availableFullShotVariants.map((variant) => (
                          <Button
                            key={variant}
                            variant={
                              selectedFile?.type === 'fullshot' && selectedFile?.variant === variant
                                ? 'default'
                                : 'ghost'
                            }
                            className="w-full justify-start text-left font-normal text-xs"
                            size="sm"
                            onClick={() => handleFileSelect('fullshot', `full_shot_1440_1920_${variant}.png`, variant)}
                          >
                            <span className="truncate">
                              {variant === '0' ? 'Base Form' : `Awakened Form ${variant}`}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Panel - Preview */}
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedFace}</CardTitle>
                    {selectedFile && (
                      <CardDescription className="mt-1">
                        {selectedFile.type === 'fullshot' 
                          ? `FULL SHOT / ${selectedFile.variant === '0' ? 'Base Form' : `Awakened Form ${selectedFile.variant}`}`
                          : `${selectedFile.type.toUpperCase()} / ${selectedFile.file}`
                        }
                      </CardDescription>
                    )}
                  </div>
                  {selectedFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadImage}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center p-6">
                {!selectedFile ? (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Select a file to preview</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {!imageError ? (
                      <>
                        {selectedFile.type === 'fullshot' && selectedFile.variant && selectedFace ? (
                          // Full shot image with positioning
                          (() => {
                            const positioning = getFullShotPositioning(selectedFace, selectedFile.variant);
                            const imageUrl = getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant);
                            
                            return (
                              <div className="relative w-full h-full flex flex-col items-center justify-center gap-4">
                                <div 
                                  className="relative bg-muted rounded-lg overflow-hidden"
                                  style={{ 
                                    width: '720px',
                                    height: '960px',
                                    maxWidth: '100%',
                                    maxHeight: '80%'
                                  }}
                                >
                                  {positioning && (
                                    <div className="relative w-full h-full overflow-hidden">
                                      <Image
                                        src={imageUrl}
                                        alt={`${selectedFace} - Full Shot ${selectedFile.variant}`}
                                        width={1440}
                                        height={1920}
                                        className="absolute"
                                        style={{
                                          imageRendering: 'crisp-edges',
                                          width: `${(positioning.xOffset / positioning.baseWidth) * 100}%`,
                                          height: `${(positioning.yOffset / positioning.baseHeight) * 100}%`,
                                          left: '50%',
                                          top: '50%',
                                          transform: 'translate(-50%, -50%)',
                                          objectFit: 'contain'
                                        }}
                                        onLoadingComplete={() => setImageLoading(false)}
                                        onError={() => {
                                          setImageError(true);
                                          setImageLoading(false);
                                        }}
                                        unoptimized
                                      />
                                    </div>
                                  )}
                                  {!positioning && (
                                    <Image
                                      src={imageUrl}
                                      alt={`${selectedFace} - Full Shot ${selectedFile.variant}`}
                                      fill
                                      className="object-contain"
                                      style={{ imageRendering: 'crisp-edges' }}
                                      onLoadingComplete={() => setImageLoading(false)}
                                      onError={() => {
                                        setImageError(true);
                                        setImageLoading(false);
                                      }}
                                      unoptimized
                                    />
                                  )}
                                </div>
                                {positioning && (
                                  <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                                    Positioning: {positioning.xOffset}x{positioning.yOffset} (Base: {positioning.baseWidth}x{positioning.baseHeight})
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          // Regular UI or Story image
                          <div className="relative max-w-full max-h-full">
                            <Image
                              src={getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant)}
                              alt={`${selectedFace} - ${selectedFile.file}`}
                              width={800}
                              height={800}
                              className="object-contain max-w-full max-h-full"
                              style={{ imageRendering: 'crisp-edges' }}
                              onLoadingComplete={() => setImageLoading(false)}
                              onError={() => {
                                setImageError(true);
                                setImageLoading(false);
                              }}
                              unoptimized
                            />
                          </div>
                        )}
                        {imageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Failed to load image</p>
                        <p className="text-xs mt-2">
                          {getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden Canvas for Composition */}
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
    </div>
  );
}
