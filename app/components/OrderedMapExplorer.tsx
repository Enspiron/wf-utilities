'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Search, FileJson, Folder, ChevronRight, Grid3x3, FileCode, Home as HomeFolder, Loader2, Home, ArrowLeft, FolderOpen, List, Languages } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import ParsedDataView from '@/components/ParsedDataView';
import { parseOrderedMapJson } from '@/lib/json-parser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FilesByCategory {
  [category: string]: string[];
}

interface OrderedMapData {
  category: string;
  file: string;
  data: unknown;
}

type ViewLocation = 
  | { type: 'root' }
  | { type: 'folder'; category: string }
  | { type: 'file'; category: string; file: string };

export default function OrderedMapExplorer() {
  const [categories, setCategories] = useState<string[]>([]);
  const [filesByCategory, setFilesByCategory] = useState<FilesByCategory>({});
  const [currentLocation, setCurrentLocation] = useState<ViewLocation>({ type: 'root' });
  const [fileData, setFileData] = useState<OrderedMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'raw' | 'parsed'>('parsed');
  const [pixelPerfect, setPixelPerfect] = useState(true);
  const [browseLayout, setBrowseLayout] = useState<'grid' | 'list'>('grid');
  const [language, setLanguage] = useState<'jp' | 'en' | 'both'>('jp');

  const parsedItems = useMemo(() => {
    if (!fileData?.data) return [];
    return parseOrderedMapJson(fileData.data);
  }, [fileData]);

  useEffect(() => {
    fetchFileList();
  }, [language]);

  const fetchFileList = async () => {
    try {
      const lang = language === 'both' ? 'jp' : language;
      const response = await fetch(`/api/orderedmap/list?lang=${lang}`);
      const data = await response.json();
      setCategories(data.categories);
      setFilesByCategory(data.filesByCategory);
    } catch (error) {
      console.error('Error fetching file list:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileData = async (category: string, file: string) => {
    setDataLoading(true);
    try {
      const lang = language === 'both' ? 'jp' : language;
      const response = await fetch(
        `/api/orderedmap/data?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}&lang=${lang}`
      );
      const data = await response.json();
      setFileData(data);
    } catch (error) {
      console.error('Error fetching file data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const navigateToFolder = (category: string) => {
    setCurrentLocation({ type: 'folder', category });
    setFileData(null);
  };

  const navigateToFile = (category: string, file: string) => {
    setCurrentLocation({ type: 'file', category, file });
    fetchFileData(category, file);
  };

  const navigateBack = () => {
    if (currentLocation.type === 'file') {
      setCurrentLocation({ type: 'folder', category: currentLocation.category });
      setFileData(null);
    } else if (currentLocation.type === 'folder') {
      setCurrentLocation({ type: 'root' });
    }
  };

  const navigateToRoot = () => {
    setCurrentLocation({ type: 'root' });
    setFileData(null);
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    return categories.filter(cat =>
      cat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const filteredFiles = useMemo(() => {
    if (currentLocation.type !== 'folder') return [];
    const files = filesByCategory[currentLocation.category] || [];
    if (!searchTerm) return files;
    return files.filter(file =>
      file.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentLocation, filesByCategory, searchTerm]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-80">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Loading OrderedMap Explorer</p>
                <p className="text-xs text-muted-foreground mt-1">Fetching categories and files...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background flex-col">
      {/* Loading bar */}
      {dataLoading && (
        <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
      )}
      
      {/* Toolbar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" title="Home Page">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={navigateBack}
            disabled={currentLocation.type === 'root'}
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={navigateToRoot}
            disabled={currentLocation.type === 'root'}
            title="Go to Root"
          >
            <HomeFolder className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          {currentLocation.type !== 'file' && (
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant={browseLayout === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setBrowseLayout('grid')}
                title="Grid View"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={browseLayout === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setBrowseLayout('list')}
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPixelPerfect(!pixelPerfect)}
            title={pixelPerfect ? 'Disable Pixel Perfect' : 'Enable Pixel Perfect'}
          >
            <FileCode className={`h-4 w-4 ${pixelPerfect ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
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
                <span className={language === 'both' ? 'font-bold' : ''}>🌐 Both (Bilingual)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>

      {/* Breadcrumb / Address Bar */}
      <div className="border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={navigateToRoot}
          >
            <HomeFolder className="h-3.5 w-3.5 mr-1.5" />
            Root
          </Button>
          {currentLocation.type !== 'root' && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => currentLocation.type === 'file' && navigateToFolder(currentLocation.category)}
                disabled={currentLocation.type === 'folder'}
              >
                <Folder className="h-3.5 w-3.5 mr-1.5" />
                {currentLocation.category}
              </Button>
            </>
          )}
          {currentLocation.type === 'file' && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1.5 px-2 h-7">
                <FileJson className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{currentLocation.file}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search Bar - Only show when browsing folders/files */}
      {currentLocation.type !== 'file' && (
        <div className="border-b border-border bg-card px-4 py-2">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={currentLocation.type === 'root' ? 'Search folders...' : 'Search files...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentLocation.type === 'root' && (
          <ScrollArea className="h-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 px-2 flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Categories ({filteredCategories.length})
              </h2>
              {browseLayout === 'grid' ? (
                <div className="grid gap-4" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 120px))'}}>
                  {filteredCategories.map((category) => (
                    <TooltipProvider key={category}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex flex-col items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group w-[120px]"
                            onClick={() => navigateToFolder(category)}
                            onDoubleClick={() => navigateToFolder(category)}
                          >
                            <Folder className="h-16 w-16 text-amber-500 group-hover:text-amber-400 transition-colors" />
                            <div className="w-full text-center">
                              <span className="text-xs font-medium w-full block truncate px-1 leading-tight">{category}</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-1">
                                {filesByCategory[category]?.length || 0}
                              </Badge>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{category}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCategories.map((category) => (
                    <TooltipProvider key={category}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors w-full text-left group"
                            onClick={() => navigateToFolder(category)}
                            onDoubleClick={() => navigateToFolder(category)}
                          >
                            <Folder className="h-8 w-8 text-amber-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block truncate">{category}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs px-2 flex-shrink-0">
                              {filesByCategory[category]?.length || 0}
                            </Badge>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{category}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
              {filteredCategories.length === 0 && (
                <div className="text-center py-12">
                  <Folder className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No folders found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {currentLocation.type === 'folder' && (
          <ScrollArea className="h-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4 px-2 flex items-center gap-2">
                <FileJson className="h-5 w-5 text-primary" />
                Files in {currentLocation.category} ({filteredFiles.length})
              </h2>
              {browseLayout === 'grid' ? (
                <div className="grid gap-4" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 120px))'}}>
                  {filteredFiles.map((file) => (
                    <TooltipProvider key={file}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex flex-col items-center gap-2 p-3 rounded-md hover:bg-accent transition-colors group w-[120px]"
                            onClick={() => navigateToFile(currentLocation.category, file)}
                            onDoubleClick={() => navigateToFile(currentLocation.category, file)}
                          >
                            <FileJson className="h-16 w-16 text-blue-500 group-hover:text-blue-400 transition-colors" />
                            <span className="text-xs font-medium text-center w-full block truncate px-1 leading-tight">
                              {file.replace('.json', '')}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{file.replace('.json', '')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFiles.map((file) => (
                    <TooltipProvider key={file}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors w-full text-left group"
                            onClick={() => navigateToFile(currentLocation.category, file)}
                            onDoubleClick={() => navigateToFile(currentLocation.category, file)}
                          >
                            <FileJson className="h-8 w-8 text-blue-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                            <span className="text-sm font-medium block truncate">
                              {file.replace('.json', '')}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{file.replace('.json', '')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
              {filteredFiles.length === 0 && (
                <div className="text-center py-12">
                  <FileJson className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No files found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {currentLocation.type === 'file' && (
          <div className="h-full flex flex-col">
            {dataLoading ? (
              <div className="flex h-full items-center justify-center">
                <Card className="w-80">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <div className="text-center">
                        <p className="text-sm font-medium">Loading File Data</p>
                        <p className="text-xs text-muted-foreground mt-1">Parsing {currentLocation.file}...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : fileData ? (
              <>
                {viewMode === 'raw' ? (
                  <div className="h-full flex flex-col">
                    <div className="border-b border-border px-4 py-2 bg-card">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setViewMode('raw')}
                        >
                          <FileCode className="mr-2 h-4 w-4" />
                          Raw JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewMode('parsed')}
                        >
                          <Grid3x3 className="mr-2 h-4 w-4" />
                          Parsed View
                        </Button>
                      </div>
                    </div>
                  <ScrollArea className="flex-1 p-6">
                    <pre className="text-sm bg-muted rounded-lg p-4">
                      <code>{JSON.stringify(fileData.data, null, 2)}</code>
                    </pre>
                  </ScrollArea>
                  </div>
                ) : (
                  <ParsedDataView
                    items={parsedItems}
                    category={currentLocation.category}
                    file={currentLocation.file}
                    dataSource="server"
                    pixelPerfect={pixelPerfect}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                  />
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
