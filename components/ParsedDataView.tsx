'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, X, ImageOff, FileImage, Music, Copy, CheckCircle2, XCircle, ArrowUpDown, Loader2, Grid3x3, List, FileCode, Languages } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ParsedItem, searchItems } from '@/lib/json-parser';
import AudioPlayer from '@/components/AudioPlayer';

type FileExtension = 'png' | 'jpg' | 'mp3';

interface ParsedDataViewProps {
  items: ParsedItem[];
  category: string;
  file: string;
  dataSource: 'server' | 'local';
  pixelPerfect: boolean;
  viewMode?: 'raw' | 'parsed';
  setViewMode?: (mode: 'raw' | 'parsed') => void;
}


export default function ParsedDataView({ items, category, file, dataSource, pixelPerfect, viewMode, setViewMode }: ParsedDataViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fileExtension, setFileExtension] = useState<FileExtension>('png');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ParsedItem | null>(null);
  const [selectedItemEN, setSelectedItemEN] = useState<ParsedItem | null>(null);
  const [dialogImageError, setDialogImageError] = useState(false);
  const [dialogImageLoading, setDialogImageLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'valid' | 'invalid'>('default');
  const [dialogLang, setDialogLang] = useState<'jp' | 'en'>('jp');
  const [fetchingTranslation, setFetchingTranslation] = useState(false);
  const [browseLayout, setBrowseLayout] = useState<'grid' | 'list'>('grid');
  
  // Use refs to track errors without triggering re-renders on every item
  const errorTrackingRef = useRef<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    const searched = searchItems(items, searchTerm);
    
    if (sortBy === 'default') return searched;
    
    // Update imageErrors state from ref when sorting
    const currentErrors = errorTrackingRef.current;
    
    return searched.sort((a, b) => {
      const aHasError = currentErrors.has(a.id) || !a.imageUrl;
      const bHasError = currentErrors.has(b.id) || !b.imageUrl;
      
      if (sortBy === 'valid') {
        // Valid first (no errors)
        if (!aHasError && bHasError) return -1;
        if (aHasError && !bHasError) return 1;
      } else if (sortBy === 'invalid') {
        // Invalid first (has errors)
        if (aHasError && !bHasError) return -1;
        if (!aHasError && bHasError) return 1;
      }
      
      return 0;
    });
  }, [items, searchTerm, sortBy]);

  // Fetch English translation when dialog opens
  useEffect(() => {
    if (selectedItem && !selectedItemEN && !fetchingTranslation) {
      fetchEnglishVersion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem]);

  const fetchEnglishVersion = async () => {
    if (!selectedItem) return;
    
    setFetchingTranslation(true);
    try {
      const response = await fetch(
        `/api/orderedmap/data?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}&lang=en`
      );
      const data = await response.json();
      
      if (data.data) {
        const parser = await import('@/lib/json-parser');
        const enItems = parser.parseOrderedMapJson(data.data);
        const enItem = enItems.find(item => item.id === selectedItem.id);
        setSelectedItemEN(enItem || null);
      }
    } catch (error) {
      console.error('Error fetching English version:', error);
    } finally {
      setFetchingTranslation(false);
    }
  };

  const handleItemClick = (item: ParsedItem) => {
    setSelectedItem(item);
    setSelectedItemEN(null);
    setDialogLang('jp');
    setDialogImageError(false);
    setDialogImageLoading(false);
  };

  const handleDialogClose = () => {
    setSelectedItem(null);
    setSelectedItemEN(null);
    setDialogLang('jp');
  };

  const displayItem = dialogLang === 'en' && selectedItemEN ? selectedItemEN : selectedItem;

  const handleImageError = useCallback((itemId: string) => {
    errorTrackingRef.current.add(itemId);
  }, []);

  const handleImageLoad = useCallback((itemId: string) => {
    // No-op, but kept for image component compatibility
  }, []);

  const handleImageLoadStart = useCallback((itemId: string) => {
    // No-op, but kept for image component compatibility
  }, []);

  const handleExtensionChange = (ext: FileExtension) => {
    setFileExtension(ext);
    errorTrackingRef.current = new Set();
    setDialogImageError(false); // Reset dialog error too
    setDialogImageLoading(false); // Reset dialog loading too
    setSortBy('default'); // Reset sort when changing extension
  };

  const getAssetUrl = (baseUrl: string | undefined): string | undefined => {
    if (!baseUrl) return undefined;
    
    // Replace the extension in the URL
    const urlWithExtension = baseUrl.replace(/\.(png|jpg|mp3)$/, `.${fileExtension}`);
    
    // If local mode, use the local asset API route
    if (dataSource === 'local') {
      // Extract the path after the CDN base URL
      const assetPath = urlWithExtension.replace('https://wfjukebox.b-cdn.net/', '');
      return `/api/local-assets?path=${encodeURIComponent(assetPath)}`;
    }
    
    return urlWithExtension;
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="h-full flex">
      {/* Left Sidebar with Controls */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h3 className="text-xl font-bold mb-2">Parsed Data</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{filteredItems.length} Items</Badge>
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* View Mode Toggle */}
            {setViewMode && (
              <div>
                <label className="text-sm font-medium mb-2 block">View Mode</label>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={viewMode === 'parsed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('parsed')}
                    className="justify-start"
                  >
                    <Grid3x3 className="mr-2 h-4 w-4" />
                    Parsed View
                  </Button>
                  <Button
                    variant={viewMode === 'raw' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('raw')}
                    className="justify-start"
                  >
                    <FileCode className="mr-2 h-4 w-4" />
                    Raw JSON
                  </Button>
                </div>
              </div>
            )}

            {/* Layout Toggle */}
            <div>
              <label className="text-sm font-medium mb-2 block">Layout</label>
              <div className="flex flex-col gap-2">
                <Button
                  variant={browseLayout === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrowseLayout('grid')}
                  className="justify-start"
                >
                  <Grid3x3 className="mr-2 h-4 w-4" />
                  Grid
                </Button>
                <Button
                  variant={browseLayout === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrowseLayout('list')}
                  className="justify-start"
                >
                  <List className="mr-2 h-4 w-4" />
                  List
                </Button>
              </div>
            </div>

            {/* File Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">File type</label>
              <div className="flex flex-col gap-2">
                <Button
                  variant={fileExtension === 'png' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleExtensionChange('png')}
                  className="justify-start"
                >
                  <FileImage className="mr-2 h-4 w-4" />
                  PNG
                </Button>
                <Button
                  variant={fileExtension === 'jpg' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleExtensionChange('jpg')}
                  className="justify-start"
                >
                  <FileImage className="mr-2 h-4 w-4" />
                  JPG
                </Button>
                <Button
                  variant={fileExtension === 'mp3' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleExtensionChange('mp3')}
                  className="justify-start"
                >
                  <Music className="mr-2 h-4 w-4" />
                  MP3
                </Button>
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-sm font-medium mb-2 block">Sort</label>
              <div className="flex flex-col gap-2">
                <Button
                  variant={sortBy === 'default' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('default')}
                  className="justify-start"
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Default
                </Button>
                <Button
                  variant={sortBy === 'valid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('valid')}
                  className="justify-start"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Valid First
                </Button>
                <Button
                  variant={sortBy === 'invalid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('invalid')}
                  className="justify-start"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Invalid First
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Items Grid/List */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No items found</p>
            </div>
          ) : browseLayout === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const assetUrl = getAssetUrl(item.imageUrl);
                const hasAsset = assetUrl && !errorTrackingRef.current.has(item.id);
                const isAudio = fileExtension === 'mp3';

                return (
                  <Card 
                    key={item.id} 
                    className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="text-sm font-medium truncate" title={item.label}>
                        {item.label}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">ID: {item.id}</p>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {assetUrl && (
                        <div className={`mb-3 ${isAudio ? '' : 'aspect-square'} relative bg-muted rounded-md overflow-hidden`}>
                          {isAudio ? (
                            <div className="p-2">
                              {hasAsset ? (
                                <AudioPlayer
                                  src={assetUrl}
                                  onError={() => handleImageError(item.id)}
                                  compact
                                />
                              ) : (
                                <div className="flex items-center justify-center py-8">
                                  <Music className="h-8 w-8 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>
                          ) : hasAsset ? (
                            <>
                              <Image
                                src={assetUrl}
                                alt={item.label}
                                fill
                                className="object-contain"
                                style={pixelPerfect ? { imageRendering: 'pixelated' } : undefined}
                                onLoadingComplete={() => handleImageLoad(item.id)}
                                onError={() => handleImageError(item.id)}
                                onLoadStart={() => handleImageLoadStart(item.id)}
                                quality={100}
                                unoptimized
                              />
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Debug Info */}
                      {assetUrl && (
                        <div className="mb-3 p-2 bg-muted/50 rounded-md border border-border">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs font-semibold text-muted-foreground">Asset URL:</span>
                                {hasAsset ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                              <p className="text-xs font-mono text-foreground break-all">{assetUrl}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(assetUrl)}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="Copy URL"
                            >
                              {copiedUrl === assetUrl ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        {Object.entries(item.data)
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground">{key}: </span>
                              <span className="font-mono">{String(value).substring(0, 30)}{String(value).length > 30 ? '...' : ''}</span>
                            </div>
                          ))}
                        {Object.keys(item.data).length > 3 && (
                          <p className="text-xs text-muted-foreground italic">
                            +{Object.keys(item.data).length - 3} more fields
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const assetUrl = getAssetUrl(item.imageUrl);
                const hasAsset = assetUrl && !errorTrackingRef.current.has(item.id);
                const isAudio = fileExtension === 'mp3';

                return (
                  <Card 
                    key={item.id} 
                    className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex gap-4 p-4">
                      {/* Thumbnail */}
                      {assetUrl && (
                        <div className={`${isAudio ? 'w-32' : 'w-24 h-24'} shrink-0 relative bg-muted rounded-md overflow-hidden`}>
                          {isAudio ? (
                            <div className="p-2">
                              {hasAsset ? (
                                <AudioPlayer
                                  src={assetUrl}
                                  onError={() => handleImageError(item.id)}
                                  compact
                                />
                              ) : (
                                <div className="flex items-center justify-center py-4">
                                  <Music className="h-6 w-6 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>
                          ) : hasAsset ? (
                            <Image
                              src={assetUrl}
                              alt={item.label}
                              fill
                              className="object-contain"
                              style={pixelPerfect ? { imageRendering: 'pixelated' } : undefined}
                              onLoadingComplete={() => handleImageLoad(item.id)}
                              onError={() => handleImageError(item.id)}
                              onLoadStart={() => handleImageLoadStart(item.id)}
                              quality={100}
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-2">
                          <h4 className="font-medium truncate" title={item.label}>{item.label}</h4>
                          <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(item.data)
                            .slice(0, 6)
                            .map(([key, value]) => (
                              <div key={key} className="text-xs truncate">
                                <span className="text-muted-foreground">{key}: </span>
                                <span className="font-mono">{String(value).substring(0, 40)}{String(value).length > 40 ? '...' : ''}</span>
                              </div>
                            ))}
                        </div>
                        
                        {Object.keys(item.data).length > 6 && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            +{Object.keys(item.data).length - 6} more fields
                          </p>
                        )}
                      </div>

                      {/* Status Indicator */}
                      {assetUrl && (
                        <div className="shrink-0">
                          {hasAsset ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" title="Asset loaded" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" title="Asset failed" />
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {displayItem && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle>{displayItem.label}</DialogTitle>
                    <DialogDescription>
                      {category} / {file} / ID: {displayItem.id}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1 border rounded-md p-1">
                    <Button
                      variant={dialogLang === 'jp' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDialogLang('jp')}
                      disabled={!selectedItem}
                      className="h-7 px-2"
                    >
                      🇯🇵 JP
                    </Button>
                    <Button
                      variant={dialogLang === 'en' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDialogLang('en')}
                      disabled={!selectedItemEN && !fetchingTranslation}
                      className="h-7 px-2"
                    >
                      {fetchingTranslation ? <Loader2 className="h-3 w-3 animate-spin" /> : '🇬🇧 EN'}
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
                  {/* Asset Preview */}
                  {displayItem.imageUrl && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Asset Preview</h3>
                        <div className="flex gap-1">
                          <Button
                            variant={fileExtension === 'png' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleExtensionChange('png')}
                          >
                            <FileImage className="mr-1 h-3 w-3" />
                            PNG
                          </Button>
                          <Button
                            variant={fileExtension === 'jpg' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleExtensionChange('jpg')}
                          >
                            <FileImage className="mr-1 h-3 w-3" />
                            JPG
                          </Button>
                          <Button
                            variant={fileExtension === 'mp3' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleExtensionChange('mp3')}
                          >
                            <Music className="mr-1 h-3 w-3" />
                            MP3
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const assetUrl = getAssetUrl(displayItem.imageUrl);
                        const hasAsset = assetUrl && !dialogImageError;
                        const isAudio = fileExtension === 'mp3';

                        return (
                          <>
                            <div className={`${isAudio ? 'aspect-auto' : 'aspect-square'} relative bg-muted rounded-md overflow-hidden`}>
                              {isAudio ? (
                                <div className="p-6">
                                  {hasAsset ? (
                                    <AudioPlayer
                                      src={assetUrl}
                                      onError={() => setDialogImageError(true)}
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center py-8">
                                      <Music className="h-12 w-12 text-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>
                              ) : hasAsset ? (
                                <>  
                                  <Image
                                    src={assetUrl}
                                    alt={displayItem.label}
                                    fill
                                    className="object-contain"
                                    style={pixelPerfect ? { imageRendering: 'pixelated' } : undefined}
                                    onLoadingComplete={() => setDialogImageLoading(false)}
                                    onError={() => setDialogImageError(true)}
                                    onLoadStart={() => setDialogImageLoading(true)}
                                    quality={100}
                                    unoptimized
                                  />
                                  {dialogImageLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm">
                                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageOff className="h-16 w-16 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>

                            {/* Debug Info */}
                            {assetUrl && (
                              <div className="p-3 bg-muted/50 rounded-md border border-border">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-xs font-semibold text-muted-foreground">Asset URL:</span>
                                      <span title={hasAsset ? "Loaded successfully" : "Failed to load"}>
                                        {hasAsset ? (
                                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <XCircle className="h-3 w-3 text-red-500" />
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-xs font-mono text-foreground break-all">{assetUrl}</p>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(assetUrl)}
                                    className="text-muted-foreground hover:text-foreground p-1"
                                    title="Copy URL"
                                  >
                                    {copiedUrl === assetUrl ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Data Fields */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">Data Fields</h3>
                      <Badge variant="secondary">{Object.keys(displayItem.data).length} fields</Badge>
                    </div>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2 pr-4">
                        {Object.entries(displayItem.data).map(([key, value]) => (
                          <div
                            key={key}
                            className="p-3 bg-muted/50 rounded-md border border-border hover:bg-muted transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-muted-foreground">{key}</span>
                              <button
                                onClick={() => copyToClipboard(String(value))}
                                className="text-muted-foreground hover:text-foreground p-1"
                                title="Copy value"
                              >
                                {copiedUrl === String(value) ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-xs font-mono break-all">
                              {typeof value === 'object' ? (
                                <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
                              ) : (
                                String(value)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
