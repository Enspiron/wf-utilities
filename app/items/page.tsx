"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Item } from "../api/items/route";

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<"all" | "item" | "equipment">("all");

  const getRarityIcon = (rarity: number) => {
    const rarityMap: Record<number, string> = {
      1: "rarity_one",
      2: "rarity_two",
      3: "rarity_three",
      4: "rarity_four",
      5: "rarity_five",
    };
    const r = Number(rarity) || 1;
    // rarity icons are stored locally under public/filtericons/rarity
    return `/filtericons/rarity/${rarityMap[r] || "rarity_one"}.png`;
  };

  const CDN_ROOT = 'https://wfjukebox.b-cdn.net';

  const hasImageExtension = (s: string) => /\.(png|jpe?g|webp|svg|gif)$/i.test(s);

  const buildImageUrl = (s?: string) => {
    if (!s) return '';
    // if already absolute URL, return as-is
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    // if starts with '/', remove leading slash and prepend CDN
    const path = s.startsWith('/') ? s.slice(1) : s;
    return `${CDN_ROOT}/${hasImageExtension(path) ? path : `${path}.png`}`;
  };

  const isValidImageSrc = (s?: string) => {
    if (!s) return false;
    // consider strings as valid if they are non-empty (we'll build URL),
    // but avoid strings that look like placeholders
    if (s.trim() === '') return false;
    return true;
  };

  useEffect(() => {
    fetch("/api/items")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load items:", err);
        setLoading(false);
      });
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.devname.toLowerCase().includes(q) &&
          !item.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (selectedType !== "all") {
        if (selectedType === "item" && item.type !== "item") return false;
        if (selectedType === "equipment" && item.type !== "equipment") return false;
      }
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedRarity !== null && Number(item.rarity) !== selectedRarity) return false;
      return true;
    });
  }, [items, searchQuery, selectedCategory, selectedRarity, selectedType]);

  // Rarity counts are derived from the full items list so the filter is always visible
  const rarities = useMemo(() => {
    const names: Record<number, string> = {
      1: "rarity_one",
      2: "rarity_two",
      3: "rarity_three",
      4: "rarity_four",
      5: "rarity_five",
    };
    const map = new Map<number, { icon: string; count: number }>();

    items.forEach((it) => {
      const r = Number(it.rarity);
      if (!Number.isNaN(r) && r >= 1 && r <= 5) {
        const cur = map.get(r);
        // rarity icons are local under public/filtericons/rarity
        const icon = `/filtericons/rarity/${names[r] || 'rarity_one'}.png`;
        if (!cur) map.set(r, { icon, count: 1 });
        else cur.count++;
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [items]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredItems, currentPage]);

  useEffect(() => {
    // if filters change, reset to page 1 (async to avoid sync setState warning)
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [searchQuery, selectedCategory, selectedRarity, selectedType]);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading items...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-72 min-w-[288px] max-w-[288px] border-r bg-background/95 px-4 py-8 flex flex-col gap-6 sticky top-0 h-screen overflow-y-auto">
        <div className="mb-6 p-4 rounded-lg bg-card border border-primary shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="text-lg font-bold text-primary">Rarity</label>
            {selectedRarity !== null && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedRarity(null)} className="h-6 text-xs">
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {rarities.map(([rarityValue, rarityData]) => (
              <Button
                key={rarityValue}
                variant={selectedRarity === rarityValue ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRarity(rarityValue === selectedRarity ? null : rarityValue)}
                className="justify-start"
              >
                <div className="flex items-center gap-2 w-full">
                  <Image src={rarityData.icon} alt={`${rarityValue} stars`} width={108} height={22} style={{ width: 108, height: 22, objectFit: 'contain', imageRendering: 'pixelated' }} unoptimized={true} />
                  <Badge variant="secondary" className="ml-auto">{rarityData.count}</Badge>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">Filters</h2>

        <div>
          <label className="text-sm font-medium mb-2 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            {searchQuery && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-8 w-8 p-0" onClick={() => setSearchQuery("")}> 
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Type</label>
          <div className="flex flex-col gap-2">
            <Button variant={selectedType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedType('all')} className="justify-start">All</Button>
            <Button variant={selectedType === 'item' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedType('item')} className="justify-start">Items</Button>
            <Button variant={selectedType === 'equipment' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedType('equipment')} className="justify-start">Equipment</Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Category</label>
            {selectedCategory && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)} className="h-6 text-xs">Clear</Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="flex flex-col gap-2 pr-4">
              {categories.map(category => (
                <Button key={category} variant={selectedCategory === category ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(category === selectedCategory ? null : category)} className="justify-start">
                  <span className="flex-1 text-left">{category}</span>
                  <Badge variant="secondary" className="ml-2">{items.filter(i => i.category === category).length}</Badge>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {paginatedItems.map(item => (
            <Card key={item.id} className="bg-card border shadow-md cursor-pointer" onClick={() => setSelectedItem(item)}>
              <div className="p-3 flex flex-col items-center gap-2">
                <div className="w-24 h-24 flex items-center justify-center">
                  {isValidImageSrc(item.thumbnail || item.icon) ? (
                    <Image
                      src={buildImageUrl(item.thumbnail || item.icon)}
                      alt={item.name}
                      width={90}
                      height={90}
                      style={{ width: 90, height: 90, objectFit: 'contain', imageRendering: 'pixelated' }}
                      unoptimized={true}
                    />
                  ) : (
                    <Image src={getRarityIcon(item.rarity)} alt={`${item.rarity} stars`} width={86} height={18} style={{ imageRendering: 'pixelated' }} unoptimized={true} />
                  )}
                </div>
                <div className="font-bold text-sm text-center truncate w-full">{item.name}</div>
              </div>
            </Card>
          ))}
        </div>

        {paginatedItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No items found matching your filters</div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Previous</Button>
            <span className="px-2 text-sm">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</Button>
          </div>
        )}
        {/* Item details modal */}
        <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
          <DialogContent>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
            <div className="mt-2">
              <div className="flex gap-4">
                {selectedItem && (selectedItem.icon || selectedItem.thumbnail) && (
                  <div className="w-40 h-40 flex-shrink-0">
                    <Image src={buildImageUrl(selectedItem.icon || selectedItem.thumbnail)} alt={selectedItem.name} width={160} height={160} style={{ imageRendering: 'pixelated', objectFit: 'contain' }} unoptimized={true} />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex gap-2 mb-2 items-center">
                    <Badge variant="outline">{selectedItem?.category}</Badge>
                    <Badge variant="secondary">{selectedItem?.type}</Badge>
                    {selectedItem && (
                      <Image src={getRarityIcon(selectedItem.rarity)} alt="rarity" width={108} height={22} style={{ width: 108, height: 22, objectFit: 'contain', imageRendering: 'pixelated' }} unoptimized={true} />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{selectedItem?.description}</div>
                  {selectedItem?.flavorText && <div className="text-xs italic text-muted-foreground mt-2">{selectedItem?.flavorText}</div>}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
