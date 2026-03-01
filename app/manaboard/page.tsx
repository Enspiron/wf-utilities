'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Coins, Layers, Loader2, RefreshCw, Search, Sparkles, WandSparkles } from 'lucide-react';

type Lang = 'en' | 'jp';
type BoardId = '1' | '2';

type CharacterItem = {
  id: string;
  nameEn: string;
  nameJp: string;
  faceCode: string;
  group: string;
  boardNodeCounts: Record<string, number>;
  hasBoard2: boolean;
};

type Requirement = {
  levelRequirements: number[];
  board2ConditionIds: string[];
};

type ListPayload = {
  characters: CharacterItem[];
  requirementsByGroup: Record<string, Requirement>;
};

type Material = {
  itemId: string;
  amount: number;
  name: string;
  iconPath: string | null;
};

type NodeEntry = {
  index: number;
  nodeId: string;
  manaCost: number;
  nodeType: number;
  tier: number | null;
  materials: Material[];
};

type UpskillSlot = {
  slot: number;
  key: string | null;
  descriptionEn: string | null;
  descriptionJp: string | null;
};

type DetailPayload = {
  id: string;
  group: string;
  boards: Record<string, NodeEntry[]>;
  boardSummaries: Record<string, { totalMana: number; totalNodes: number }>;
  upskills: UpskillSlot[];
  requirement: Requirement | null;
  characterKit: {
    devNickname: string;
    enName: string | null;
    jpName: string | null;
    skill: string | null;
    leaderBuff: string | null;
    abilities: string[];
    skillWait: string | null;
  } | null;
};

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
const parseNodeSet = (v: string | null) => {
  const set = new Set<number>();
  if (!v) return set;
  for (const t of v.split(/[,._-]/)) {
    const n = Number.parseInt(t.trim(), 10);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return set;
};
const serializeNodeSet = (s: Set<number>) => [...s].sort((a, b) => a - b).join(',');
const nodeTypeLabel = (type: number) => (type === 2 ? 'Core' : type === 1 ? 'Skill' : 'Stat');
const nodeTypeClass = (type: number) =>
  type === 2
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : type === 1
      ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
      : 'bg-muted text-muted-foreground border-border';

function splitLabeledText(input: string | null): { title: string | null; body: string | null } {
  if (!input) return { title: null, body: null };
  const text = input.trim();
  if (!text) return { title: null, body: null };

  const bracketMatch = text.match(/^\[([^\]]+)\]\s*(?:\r?\n)?([\s\S]*)$/);
  if (bracketMatch) {
    const title = bracketMatch[1]?.trim() || null;
    const body = bracketMatch[2]?.trim() || null;
    return { title, body };
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { title: lines[0], body: lines.slice(1).join(' ') };
  }

  return { title: null, body: text };
}

export default function ManaBoardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<Lang>('en');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<ListPayload | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState('');
  const [selectedBoard, setSelectedBoard] = useState<BoardId>('1');
  const [selectedNodes, setSelectedNodes] = useState<Record<BoardId, Set<number>>>({
    '1': new Set<number>(),
    '2': new Set<number>(),
  });

  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const hydratedRef = useRef(false);
  const cacheRef = useRef<Map<string, DetailPayload>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setListLoading(true);
        const res = await fetch('/api/manaboard/list');
        if (!res.ok) throw new Error(`Failed to fetch list (${res.status})`);
        const payload = (await res.json()) as ListPayload;
        if (!cancelled) setList(payload);
      } catch (e) {
        if (!cancelled) setListError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!list || hydratedRef.current) return;
    const charParam = searchParams.get('char')?.trim() ?? '';
    const boardParam: BoardId = searchParams.get('board') === '2' ? '2' : '1';
    const fallback = list.characters[0]?.id ?? '';
    const valid = charParam && list.characters.some((c) => c.id === charParam);

    hydratedRef.current = true;
    setSelectedId(valid ? charParam : fallback);
    setSelectedBoard(boardParam);
    setSelectedNodes({
      '1': parseNodeSet(searchParams.get('n1')),
      '2': parseNodeSet(searchParams.get('n2')),
    });
  }, [list, searchParams]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    const cached = cacheRef.current.get(selectedId);
    if (cached) {
      setDetail(cached);
      setDetailError(null);
      return;
    }

    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const res = await fetch(`/api/manaboard/character?id=${encodeURIComponent(selectedId)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch detail (${res.status})`);
        const payload = (await res.json()) as DetailPayload;
        if (!cancelled) {
          cacheRef.current.set(selectedId, payload);
          setDetail(payload);
        }
      } catch (e) {
        if (ctrl.signal.aborted || cancelled) return;
        setDetailError(e instanceof Error ? e.message : 'Failed to load detail');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [selectedId]);

  useEffect(() => {
    if (!detail) return;
    const hasBoard2 = (detail.boards['2']?.length ?? 0) > 0;
    if (!hasBoard2 && selectedBoard === '2') setSelectedBoard('1');
    if (!hasBoard2 && selectedNodes['2'].size > 0) {
      setSelectedNodes((prev) => ({ ...prev, '2': new Set<number>() }));
    }
  }, [detail, selectedBoard, selectedNodes]);

  useEffect(() => {
    if (!selectedId || !hydratedRef.current) return;
    const current = searchParams.toString();
    const next = new URLSearchParams(current);
    next.set('char', selectedId);
    next.set('board', selectedBoard);

    const n1 = serializeNodeSet(selectedNodes['1']);
    const n2 = serializeNodeSet(selectedNodes['2']);
    if (n1) next.set('n1', n1);
    else next.delete('n1');
    if (n2) next.set('n2', n2);
    else next.delete('n2');

    const nextQuery = next.toString();
    if (nextQuery !== current) router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, selectedBoard, selectedId, selectedNodes]);

  const filtered = useMemo(() => {
    const chars = list?.characters ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return chars;
    return chars.filter((c) => {
      return (
        c.id.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.nameJp.toLowerCase().includes(q) ||
        c.faceCode.toLowerCase().includes(q)
      );
    });
  }, [list, query]);

  const selectedCharacter = useMemo(() => {
    return (list?.characters ?? []).find((c) => c.id === selectedId) ?? null;
  }, [list, selectedId]);

  const boardNodes = useMemo(() => detail?.boards[selectedBoard] ?? [], [detail, selectedBoard]);
  const boardSet = selectedNodes[selectedBoard];
  const boardSummary = detail?.boardSummaries[selectedBoard] ?? { totalMana: 0, totalNodes: boardNodes.length };

  const tiers = useMemo(() => {
    return [...new Set(boardNodes.map((n) => n.tier).filter((v): v is number => v !== null))].sort((a, b) => a - b);
  }, [boardNodes]);

  const groupedNodes = useMemo(() => {
    const map = new Map<string, NodeEntry[]>();
    for (const t of tiers) map.set(`Tier ${t}`, []);
    map.set('Special', []);
    for (const n of boardNodes) {
      if (n.tier === null) map.get('Special')?.push(n);
      else map.get(`Tier ${n.tier}`)?.push(n);
    }
    return [...map.entries()].filter(([, nodes]) => nodes.length > 0);
  }, [boardNodes, tiers]);

  const currentBoardSlots = useMemo(() => {
    if (!detail) return [] as UpskillSlot[];
    const offset = selectedBoard === '1' ? 0 : 6;
    return detail.upskills.slice(offset, offset + 6);
  }, [detail, selectedBoard]);

  const skillBySpecialNode = useMemo(() => {
    const m = new Map<number, UpskillSlot>();
    boardNodes
      .filter((n) => n.nodeType !== 0)
      .sort((a, b) => a.index - b.index)
      .forEach((n, i) => {
        const slot = currentBoardSlots[i];
        if (slot?.key) m.set(n.index, slot);
      });
    return m;
  }, [boardNodes, currentBoardSlots]);

  const totals = useMemo(() => {
    if (!detail) return { nodes: 0, mana: 0, materials: [] as Array<Material & { total: number }> };

    let mana = 0;
    let nodes = 0;
    const mats = new Map<string, Material & { total: number }>();

    (['1', '2'] as BoardId[]).forEach((boardId) => {
      const set = selectedNodes[boardId];
      for (const node of detail.boards[boardId] ?? []) {
        if (!set.has(node.index)) continue;
        mana += node.manaCost;
        nodes += 1;
        for (const mat of node.materials) {
          const ex = mats.get(mat.itemId);
          if (ex) ex.total += mat.amount;
          else mats.set(mat.itemId, { ...mat, total: mat.amount });
        }
      }
    });

    const materials = [...mats.values()].sort((a, b) => (a.total === b.total ? a.name.localeCompare(b.name) : b.total - a.total));
    return { nodes, mana, materials };
  }, [detail, selectedNodes]);

  const requirement = detail?.requirement ?? (selectedCharacter?.group ? list?.requirementsByGroup[selectedCharacter.group] ?? null : null);
  const progress = boardSummary.totalNodes ? (boardSet.size / boardSummary.totalNodes) * 100 : 0;
  const characterKit = detail?.characterKit ?? null;
  const parsedSkill = useMemo(() => splitLabeledText(characterKit?.skill ?? null), [characterKit?.skill]);
  const parsedLeaderBuff = useMemo(() => splitLabeledText(characterKit?.leaderBuff ?? null), [characterKit?.leaderBuff]);

  const onCharacterSelect = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
      setSelectedBoard('1');
      setSelectedNodes({ '1': new Set<number>(), '2': new Set<number>() });
    },
    [selectedId],
  );

  const toggleNode = useCallback(
    (index: number) => {
      setSelectedNodes((prev) => {
        const next = new Set(prev[selectedBoard]);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return { ...prev, [selectedBoard]: next };
      });
    },
    [selectedBoard],
  );

  const setBoardSelection = useCallback(
    (nextSet: Set<number>) => setSelectedNodes((prev) => ({ ...prev, [selectedBoard]: nextSet })),
    [selectedBoard],
  );

  const selectBoard = useCallback(() => setBoardSelection(new Set(boardNodes.map((n) => n.index))), [boardNodes, setBoardSelection]);
  const clearBoard = useCallback(() => setBoardSelection(new Set<number>()), [setBoardSelection]);
  const clearAll = useCallback(() => setSelectedNodes({ '1': new Set<number>(), '2': new Set<number>() }), []);

  const toggleTier = useCallback(
    (tier: number) => {
      const ids = boardNodes.filter((n) => n.tier === tier).map((n) => n.index);
      if (!ids.length) return;
      setSelectedNodes((prev) => {
        const next = new Set(prev[selectedBoard]);
        const all = ids.every((id) => next.has(id));
        ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
        return { ...prev, [selectedBoard]: next };
      });
    },
    [boardNodes, selectedBoard],
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          <Card className="border-primary/20 bg-card/70 backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-2xl"><Sparkles className="h-5 w-5 text-primary" />Mana Board Builder</CardTitle>
                  <CardDescription>Build unlock plans, calculate costs, and link node skill descriptions with JP fallback.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={lang === 'en' ? 'default' : 'outline'} onClick={() => setLang('en')}>EN</Button>
                  <Button size="sm" variant={lang === 'jp' ? 'default' : 'outline'} onClick={() => setLang('jp')}>JP</Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-muted-foreground" />Characters</CardTitle>
                <CardDescription>{list ? `${fmt(filtered.length)} of ${fmt(list.characters.length)}` : 'Loading...'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name/id/face" />
                {listLoading && <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>}
                {listError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{listError}</div>}
                {!listLoading && !listError && (
                  <ScrollArea className="h-[62vh] rounded-md border border-border/70">
                    <div className="space-y-1 p-2">
                      {filtered.map((c) => {
                        const display = lang === 'jp' ? c.nameJp : c.nameEn;
                        const sub = lang === 'jp' ? c.nameEn : c.nameJp;
                        const active = selectedId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onCharacterSelect(c.id)}
                            className={cn('flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left transition-colors', active ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-background/30 hover:bg-accent/50')}
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                              {c.faceCode ? (
                                <Image
                                  src={`${CDN_ROOT}/wfjukebox/character/character_art/${c.faceCode}/ui/square_0.png`}
                                  alt={c.nameEn}
                                  width={40}
                                  height={40}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No Img</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{display || c.id}</p>
                              <p className="truncate text-xs text-muted-foreground">{sub || c.faceCode || c.id}</p>
                              <p className="truncate text-[11px] text-muted-foreground/80">ID {c.id}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-[10px]">B1 {c.boardNodeCounts['1'] ?? 0}</Badge>
                              <Badge variant="outline" className="text-[10px]">{c.hasBoard2 ? `B2 ${c.boardNodeCounts['2'] ?? 0}` : 'B2 N/A'}</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selectedCharacter ? `${lang === 'jp' ? selectedCharacter.nameJp : selectedCharacter.nameEn} - Board ${selectedBoard}` : 'Select a character'}</CardTitle>
                    <CardDescription>{selectedCharacter ? `Selected ${boardSet.size}/${boardSummary.totalNodes} nodes` : 'Choose a character from the left panel.'}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={selectedBoard === '1' ? 'default' : 'outline'} onClick={() => setSelectedBoard('1')}>Board 1</Button>
                    <Button size="sm" variant={selectedBoard === '2' ? 'default' : 'outline'} onClick={() => setSelectedBoard('2')} disabled={!selectedCharacter?.hasBoard2}>Board 2</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={selectBoard} disabled={boardNodes.length === 0}><Layers className="h-3.5 w-3.5" />Select Board</Button>
                  <Button size="sm" variant="outline" onClick={clearBoard}><RefreshCw className="h-3.5 w-3.5" />Clear Board</Button>
                  <Button size="sm" variant="ghost" onClick={clearAll}>Clear All</Button>
                </div>

                {tiers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">Tier quick select:</span>
                    {tiers.map((tier) => {
                      const nodes = boardNodes.filter((n) => n.tier === tier);
                      const all = nodes.every((n) => boardSet.has(n.index));
                      return <Button key={tier} size="sm" variant={all ? 'default' : 'outline'} onClick={() => toggleTier(tier)} className="h-7 px-2 text-[11px]">Tier {tier}</Button>;
                    })}
                  </div>
                )}

                <div className="space-y-2 rounded-md border border-border/70 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Board Progress</span><span>{boardSet.size}/{boardSummary.totalNodes} ({Math.round(progress)}%)</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
                </div>

                {detailLoading && <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading board data...</div>}
                {detailError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{detailError}</div>}
                {!detailLoading && !detailError && groupedNodes.length === 0 && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No nodes available for this board.</div>}

                {!detailLoading && !detailError && groupedNodes.length > 0 && (
                  <div className="space-y-4">
                    {groupedNodes.map(([name, nodes]) => (
                      <section key={name} className="space-y-2">
                        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">{name}</h3>
                        <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                          {nodes.map((node) => {
                            const active = boardSet.has(node.index);
                            const slot = skillBySpecialNode.get(node.index);
                            const desc = slot ? (lang === 'jp' ? slot.descriptionJp ?? slot.descriptionEn ?? slot.key : slot.descriptionEn ?? slot.descriptionJp ?? slot.key) : null;
                            return (
                              <button key={`${selectedBoard}-${node.index}`} type="button" onClick={() => toggleNode(node.index)} className={cn('rounded-lg border p-3 text-left transition-colors', active ? 'border-primary/60 bg-primary/10 shadow-sm' : 'border-border/70 bg-background/30 hover:bg-accent/40')}>
                                <div className="flex items-start justify-between gap-2">
                                  <div><p className="text-sm font-semibold">Node {node.index}</p><p className="text-[11px] text-muted-foreground">ID {node.nodeId}</p></div>
                                  <Badge variant="outline" className={cn('text-[10px]', nodeTypeClass(node.nodeType))}>{nodeTypeLabel(node.nodeType)}</Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" />{fmt(node.manaCost)} mana</span>
                                  {node.tier !== null && <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />Tier {node.tier}</span>}
                                </div>
                                {node.materials.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{node.materials.slice(0, 3).map((m) => `${m.name} x${fmt(m.amount)}`).join(' • ')}{node.materials.length > 3 ? ` +${node.materials.length - 3} more` : ''}</p>}
                                {slot?.key && desc && <p className="mt-2 text-[11px] text-sky-300">Slot {slot.slot}: {desc}</p>}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Build Summary</CardTitle>
                  <CardDescription>Totals across Board 1 + Board 2 selections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2"><p className="text-xs text-muted-foreground">Selected Nodes</p><p className="text-lg font-semibold">{fmt(totals.nodes)}</p></div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2"><p className="text-xs text-muted-foreground">Mana Cost</p><p className="text-lg font-semibold">{fmt(totals.mana)}</p></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials</p>
                    {totals.materials.length === 0 ? <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No materials selected yet.</p> : (
                      <ScrollArea className="h-64 rounded-md border border-border/70">
                        <div className="space-y-1 p-2">
                          {totals.materials.map((m) => (
                            <div key={m.itemId} className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 px-2 py-1.5">
                              <div className="flex min-w-0 items-center gap-2">
                                {m.iconPath && (
                                  <Image
                                    src={`${CDN_ROOT}/${m.iconPath.replace(/^\/+/, '')}${/\.[a-z0-9]{2,5}$/i.test(m.iconPath) ? '' : '.png'}`}
                                    alt={m.name}
                                    width={20}
                                    height={20}
                                    className="h-5 w-5 shrink-0 rounded-sm object-contain"
                                    loading="lazy"
                                    unoptimized
                                  />
                                )}
                                <div className="min-w-0"><p className="truncate text-xs font-medium">{m.name}</p><p className="truncate text-[10px] text-muted-foreground">Item {m.itemId}</p></div>
                              </div>
                              <Badge variant="outline" className="ml-2 text-xs">x{fmt(m.total)}</Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Character Kit Context</CardTitle>
                  <CardDescription>From characters_all metadata (skill and ability sentences).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!characterKit ? (
                    <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No character kit text found for this unit.</p>
                  ) : (
                    <>
                      <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Dev Nickname</p>
                        <p className="text-sm font-medium">{characterKit.devNickname}</p>
                        {(characterKit.enName || characterKit.jpName) && (
                          <p className="mt-1 text-xs text-muted-foreground">{lang === 'jp' ? characterKit.jpName ?? characterKit.enName : characterKit.enName ?? characterKit.jpName}</p>
                        )}
                      </div>

                      {(parsedSkill.title || parsedSkill.body) && (
                        <div className="rounded-md border border-border/70 p-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skill</p>
                          {parsedSkill.title && <p className="mt-1 text-sm font-medium">{parsedSkill.title}</p>}
                          {parsedSkill.body && <p className="mt-1 text-xs text-muted-foreground">{parsedSkill.body}</p>}
                          {characterKit.skillWait && <p className="mt-1 text-[11px] text-muted-foreground">Skill Wait: {characterKit.skillWait}</p>}
                        </div>
                      )}

                      {(parsedLeaderBuff.title || parsedLeaderBuff.body) && (
                        <div className="rounded-md border border-border/70 p-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leader Buff</p>
                          {parsedLeaderBuff.title && <p className="mt-1 text-sm font-medium">{parsedLeaderBuff.title}</p>}
                          {parsedLeaderBuff.body && <p className="mt-1 text-xs text-muted-foreground">{parsedLeaderBuff.body}</p>}
                        </div>
                      )}

                      {characterKit.abilities.length > 0 && (
                        <div className="rounded-md border border-border/70 p-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abilities</p>
                          <div className="mt-1 space-y-1.5">
                            {characterKit.abilities.map((ability, idx) => (
                              <div key={`${idx}-${ability}`} className="rounded-sm border border-border/60 bg-background/50 px-2 py-1">
                                <p className="text-[11px] text-muted-foreground">Ability {idx + 1}</p>
                                <p className="text-xs">{ability}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><WandSparkles className="h-4 w-4 text-primary" />Node Skill Reference</CardTitle>
                  <CardDescription>Current board upskill slots</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {currentBoardSlots.length === 0 ? <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No upskill slots for this character.</p> : currentBoardSlots.map((slot) => {
                    const desc = lang === 'jp' ? slot.descriptionJp ?? slot.descriptionEn ?? slot.key : slot.descriptionEn ?? slot.descriptionJp ?? slot.key;
                    return <div key={slot.slot} className="rounded-md border border-border/70 p-2"><div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">Slot {slot.slot}</Badge><p className="truncate text-xs font-medium">{slot.key ?? '(None)'}</p></div><p className="mt-1 text-xs text-muted-foreground">{desc ?? 'No skill assigned'}</p></div>;
                  })}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Unlock Hints</CardTitle>
                  <CardDescription>Level and board condition metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2"><p className="text-muted-foreground">Character Group</p><p className="font-semibold">{selectedCharacter?.group || detail?.group || 'Unknown'}</p></div>
                  {requirement ? (
                    <>
                      <div className="rounded-md border border-border/70 bg-muted/20 p-2"><p className="text-muted-foreground">Level Requirements</p><div className="mt-1 flex flex-wrap gap-1">{requirement.levelRequirements.map((lv, i) => <Badge key={`${lv}-${i}`} variant="outline" className="text-[10px]">Lv {lv}</Badge>)}</div></div>
                      <div className="rounded-md border border-border/70 bg-muted/20 p-2"><p className="text-muted-foreground">Board 2 Condition IDs</p>{requirement.board2ConditionIds.length > 0 ? <div className="mt-1 flex flex-wrap gap-1">{requirement.board2ConditionIds.map((c) => <Badge key={c} variant="outline" className="text-[10px]">Condition {c}</Badge>)}</div> : <p className="mt-1">No explicit board 2 condition entry.</p>}</div>
                    </>
                  ) : <p className="rounded-md border border-dashed p-3 text-muted-foreground">No unlock metadata found for this group.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}


