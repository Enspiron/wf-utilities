import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Share Assets',
  description: 'Share CDN assets with rich metadata previews.',
};

export default function ShareIndexPage() {
  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.07),transparent_45%)] p-4 sm:p-6'>
      <div className='mx-auto max-w-3xl'>
        <Card>
          <CardHeader>
            <CardTitle>Share Links</CardTitle>
            <CardDescription>
              Use this route to wrap CDN assets in a metadata page for richer embeds.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            <p>Examples:</p>
            <p className='rounded border bg-muted/20 p-2 font-mono text-xs'>
              /share/bgm/world_12/story/world_12_story_its_not_over.mp3
            </p>
            <p className='rounded border bg-muted/20 p-2 font-mono text-xs'>
              /share/wfjukebox/character/character_art/100011/square_0.png
            </p>
            <p>You can also pass optional metadata overrides via query params:</p>
            <p className='rounded border bg-muted/20 p-2 font-mono text-xs'>
              ?title=Custom%20Title&description=Custom%20Description&image=thumbnail/share_music.png
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
