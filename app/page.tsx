import Link from 'next/link';
import { FileJson, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = {
  title: "WF Tools",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">World Flipper Tools</h1>
            <p className="text-muted-foreground">Explore game data and build custom faces</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          <Link href="/orderedmap" className="block">
            <Card className="h-full hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileJson className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">OrderedMap Explorer</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Browse and explore game data files with advanced filtering, sorting, and asset preview capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Browse categories and files</li>
                  <li>• Preview images and audio</li>
                  <li>• Sort by asset validity</li>
                  <li>• Server & local data sources</li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/facebuilder" className="block">
            <Card className="h-full hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Face Builder</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Build and customize character faces with different expressions and UI variations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Browse 700+ characters</li>
                  <li>• View UI and Story variations</li>
                  <li>• Preview face expressions</li>
                  <li>• Download custom faces</li>
                </ul>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

