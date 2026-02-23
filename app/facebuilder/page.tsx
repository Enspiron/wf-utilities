'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, User, Image as ImageIcon, BookOpen, Loader2, Download, Monitor, Layers, Copy, MoveHorizontal, MoveVertical, Maximize2, Languages } from 'lucide-react';
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
  const [expressionScale, setExpressionScale] = useState(0.24);
  const [expressionOffsetX, setExpressionOffsetX] = useState(199);
  const [expressionOffsetY, setExpressionOffsetY] = useState(233);
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<'jp' | 'en' | 'both'>('both');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [facesRes, faceUIRes, characterRes, fullShotRes, charTextJPRes, charTextENRes] = await Promise.all([
        fetch('/data/faces.json'),
        fetch('/data/face-ui.json'),
        fetch('/data/character.json'),
        fetch('/data/full_shot_image_attribute.json'),
        fetch('/api/character-text?lang=jp'),
        fetch('/api/character-text?lang=en')
      ]);
      
      const facesData = await facesRes.json();
      const faceUIDataRes = await faceUIRes.json();
      const characterDataRes = await characterRes.json();
      const fullShotData = await fullShotRes.json();
      const charTextJP = await charTextJPRes.json();
      const charTextEN = await charTextENRes.json();
      
      setFaces(facesData.faces);
      setFaceUIData(faceUIDataRes);
      setCharacterData(characterDataRes);
      setFullShotAttributes(fullShotData);
      setCharacterTextJP(charTextJP.data);
      setCharacterTextEN(charTextEN.data);
    } catch (error) {
      console.error('Error loading face data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFaces = useMemo(() => {
    if (!searchTerm) return faces;
    return faces.filter(face => 
      face.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faces, searchTerm]);

  const currentFaceData = selectedFace ? faceUIData[selectedFace] : null;

  const handleFaceSelect = (face: string) => {
    setSelectedFace(face);
    setSelectedFile(null);
    setImageError(false);
    setSelectedExpressions(new Set());
    setSelectedBase('0');
    setViewMode('compose');
  };

  const toggleExpression = (expression: string) => {
    const exclusiveExpressions = ['anger.png', 'consent.png', 'consent_b.png', 'joy.png', 'normal.png', 'pride.png', 'surprise.png', 'think.png'];
    
    setSelectedExpressions(prev => {
      const newSet = new Set(prev);
      const isExclusive = exclusiveExpressions.includes(expression);
      
      if (isExclusive) {
        // For exclusive expressions, remove all other exclusive ones first
        exclusiveExpressions.forEach(exp => newSet.delete(exp));
        // Toggle the clicked one
        if (prev.has(expression)) {
          // If it was already selected, just remove it (deselect)
          return newSet;
        } else {
          // Add the new exclusive expression
          newSet.add(expression);
        }
      } else {
        // For toggleable expressions, just toggle normally
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
    return `https://wfjukebox.b-cdn.net/character/character_art/${faceName}/ui/full_shot_1440_1920_${variant}.png`;
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
    
    // Remove file extensions like .atf and .png for cleaner URLs
    const cleanFile = file.replace(/\.(atf|png)$/, '.png');
    
    // Construct URL based on type
    if (type === 'story') {
      // Story/expression files are in character_art/{faceName}/ui/story/
      return `https://wfjukebox.b-cdn.net/character/character_art/${selectedFace}/ui/story/${cleanFile}`;
    } else {
      // UI files are in character_art/{faceName}/ui/
      return `https://wfjukebox.b-cdn.net/character/character_art/${selectedFace}/ui/${cleanFile}`;
    }
  }, [selectedFace]);

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
    if (!selectedFace || !currentFaceData?.story) return [];
    return currentFaceData.story.files.filter(file => 
      !file.startsWith('base_') // Exclude base files from expressions
    );
  }, [selectedFace, currentFaceData]);

  const availableFullShotVariants = useMemo(() => {
    if (!selectedFace) return [];
    const charId = getCharacterId(selectedFace);
    if (!charId || !fullShotAttributes[charId]) return [];
    return Object.keys(fullShotAttributes[charId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFace, fullShotAttributes]);

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
                          src={`https://wfjukebox.b-cdn.net/character/character_art/${face}/ui/battle_member_status_0.png`}
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
                    </CardContent>
                  </Card>

                  {/* Expression Adjustment Controls */}
                  {selectedExpressions.size > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Expression Adjustment</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyEncoding}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            {copied ? 'Copied!' : 'Copy'}
                          </Button>
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
                          <div className="p-4 pt-0 space-y-1">
                            {availableExpressions.map((expression) => {
                              const exclusiveExpressions = ['anger.png', 'consent.png', 'consent_b.png', 'joy.png', 'normal.png', 'pride.png', 'surprise.png', 'think.png'];
                              const isExclusive = exclusiveExpressions.includes(expression);
                              
                              return (
                                <Button
                                  key={expression}
                                  variant={selectedExpressions.has(expression) ? 'default' : 'ghost'}
                                  size="sm"
                                  className="w-full justify-start text-left font-normal text-xs"
                                  onClick={() => toggleExpression(expression)}
                                >
                                  <span className="truncate">
                                    {isExclusive && '◉ '}
                                    {!isExclusive && '☐ '}
                                    {expression.replace('.png', '')}
                                  </span>
                                </Button>
                              );
                            })}
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
                          Base {selectedBase} {selectedExpressions.size > 0 && `+ ${selectedExpressions.size} expression${selectedExpressions.size > 1 ? 's' : ''}`}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center justify-center p-6">
                    <div className="relative inline-block">
                      {/* Base Image */}
                      <Image
                        src={getImageUrl('story', `base_${selectedBase}.png`)}
                        alt={`Base ${selectedBase}`}
                        width={512}
                        height={512}
                        style={{ imageRendering: 'pixelated', display: 'block' }}
                        unoptimized
                      />
                      {/* Expression Layers */}
                      {Array.from(selectedExpressions).map((expression) => (
                        <Image
                          key={expression}
                          src={getImageUrl('story', expression)}
                          alt={expression}
                          width={512}
                          height={512}
                          className="absolute"
                          style={{ 
                            imageRendering: 'pixelated',
                            left: `${expressionOffsetX}px`,
                            top: `${expressionOffsetY}px`,
                            transform: `scale(${expressionScale})`,
                            transformOrigin: 'top left'
                          }}
                          unoptimized
                        />
                      ))}
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
              {currentFaceData?.ui && (
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
              {currentFaceData?.story && (
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
              {availableFullShotVariants.length > 0 && (
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
    </div>
  );
}
