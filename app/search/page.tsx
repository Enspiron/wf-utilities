import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell, SearchField, SurfaceCard } from '@/components/ui/page-primitives';
import { searchGlobalIndex } from '@/lib/search/global-index';
import type { SearchApiResult, SearchHighlightPart } from '@/lib/search/core';
import {
  ArrowRight,
  Database,
  FileJson,
  Package,
  Search,
  Sparkles,
  Trophy,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

type SearchParamValue = string | string[] | undefined;
type SearchPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

const RESULT_LIMIT = 80;
const GROUP_ORDER = ['Navigation', 'Characters', 'Items', 'Quests', 'Systems'] as const;

function getFirstParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function ResultIcon({ result, className }: { result: SearchApiResult; className?: string }) {
  if (result.kind === 'character') return <User className={className} />;
  if (result.kind === 'equipment') return <Wrench className={className} />;
  if (result.kind === 'item') return <Package className={className} />;
  if (result.kind === 'quest') return <FileJson className={className} />;
  if (result.kind === 'ability') return <Zap className={className} />;
  if (result.kind === 'achievement') return <Trophy className={className} />;
  if (result.kind === 'page' && result.href === '/characters') return <Database className={className} />;
  return <Search className={className} />;
}

function HighlightedText({ parts, className }: { parts: SearchHighlightPart[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.match ? 'rounded-sm bg-primary/15 text-foreground' : undefined}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}

function SearchResultCard({ result }: { result: SearchApiResult }) {
  return (
    <Link href={result.href} className='block'>
      <Card className='h-full border-border/60 transition-colors hover:border-primary/40 hover:bg-muted/20'>
        <CardContent className='flex items-start gap-3 p-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background/70'>
            {result.imageUrl ? (
              <Image
                src={result.imageUrl}
                alt={result.title}
                width={48}
                height={48}
                unoptimized={true}
                className={result.imagePixelated ? 'h-full w-full object-contain [image-rendering:pixelated]' : 'h-full w-full object-contain'}
              />
            ) : (
              <ResultIcon result={result} className='h-5 w-5 text-muted-foreground' />
            )}
          </div>

          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
              <HighlightedText
                parts={result.titleHighlights}
                className='line-clamp-2 text-sm font-semibold text-foreground'
              />
              <Badge variant='outline' className='shrink-0 text-[10px] uppercase tracking-wide'>
                {result.group}
              </Badge>
            </div>

            <HighlightedText
              parts={result.subtitleHighlights}
              className='mt-1 block text-xs text-muted-foreground'
            />

            {result.snippetHighlights && result.snippetHighlights.some((part) => part.text.trim().length > 0) && (
              <HighlightedText
                parts={result.snippetHighlights}
                className='mt-2 block line-clamp-3 text-xs text-muted-foreground'
              />
            )}

            <div className='mt-3 flex flex-wrap items-center gap-2'>
              {result.badges?.slice(0, 4).map((badge) => (
                <Badge key={badge} variant='secondary' className='text-[10px]'>
                  {badge}
                </Badge>
              ))}
              <span className='text-[11px] text-muted-foreground'>{result.reason}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export const metadata = {
  title: 'Global Search',
  description: 'Search across pages, characters, items, quests, abilities, and achievements.',
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = getFirstParam(params.q).trim();
  const { results, operators } = await searchGlobalIndex(query, RESULT_LIMIT);

  const groupedResults = GROUP_ORDER
    .map((group) => ({
      group,
      results: results.filter((result) => result.group === group),
    }))
    .filter((group) => group.results.length > 0);

  return (
    <PageShell>
      <SurfaceCard>
        <CardHeader className='gap-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2 text-xl'>
                <Sparkles className='h-5 w-5 text-primary' />
                Global Search
              </CardTitle>
              <CardDescription>
                Search across pages, characters, items, quests, abilities, and achievements from one place.
              </CardDescription>
            </div>
            <Badge variant='outline' className='border-primary/30 bg-primary/5'>
              {results.length.toLocaleString('en-US')} results
            </Badge>
          </div>

          <form action='/search' className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <SearchField
              name='q'
              defaultValue={query}
              placeholder='Search everything: character, item, quest, VA, face code, or use id:/type:/source:...'
            />
            <Button type='submit' className='gap-1.5'>
              Search
              <ArrowRight className='h-4 w-4' />
            </Button>
          </form>

          <div className='flex flex-wrap gap-2'>
            {operators.map((operator) => (
              <Link key={operator} href={`/search?q=${encodeURIComponent(operator)}`}>
                <Badge variant='secondary' className='cursor-pointer text-[11px]'>
                  {operator}
                </Badge>
              </Link>
            ))}
          </div>
        </CardHeader>
      </SurfaceCard>

      {query ? (
        <p className='text-sm text-muted-foreground'>
          Showing the top {results.length.toLocaleString('en-US')} matches for{' '}
          <span className='font-medium text-foreground'>&quot;{query}&quot;</span>.
        </p>
      ) : (
        <p className='text-sm text-muted-foreground'>
          Start with a name, ID, face code, VA, or an operator like <code>type:equipment</code> or{' '}
          <code>missing:bgm</code>.
        </p>
      )}

      {groupedResults.length > 0 ? (
        groupedResults.map(({ group, results: groupResults }) => (
          <section key={group} className='space-y-3'>
            <div className='flex items-center justify-between gap-2'>
              <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>{group}</h2>
              <Badge variant='outline' className='text-[10px]'>
                {groupResults.length.toLocaleString('en-US')}
              </Badge>
            </div>
            <div className='grid gap-3 lg:grid-cols-2'>
              {groupResults.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <Card className='border-dashed border-border/70 bg-background/70'>
          <CardContent className='flex min-h-48 flex-col items-center justify-center gap-3 text-center'>
            <Search className='h-6 w-6 text-muted-foreground' />
            <div>
              <p className='text-sm font-medium'>No matches found.</p>
              <p className='text-sm text-muted-foreground'>
                Try a broader term or switch to an operator like <code>id:</code>, <code>face:</code>, or{' '}
                <code>source:</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
