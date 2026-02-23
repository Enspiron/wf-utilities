import Link from 'next/link';
import { FileJson, User, Calendar, Database, ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "World Flipper Tools - Home",
  description: "Explore game data, characters, events, and build custom faces for World Flipper",
};

const features = [
  {
    href: '/orderedmap',
    icon: FileJson,
    title: 'OrderedMap Explorer',
    description: 'Browse and explore game data files with advanced filtering and asset preview',
    highlights: [
      'Browse all game data categories',
      'Preview images and audio assets',
      'Advanced sorting and filtering',
      'Server & local data sources'
    ],
    badge: 'Data Explorer',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    href: '/characters',
    icon: Database,
    title: 'Character Database',
    description: 'Search through 6000+ characters with detailed stats and filtering',
    highlights: [
      '6000+ characters available',
      'Advanced search and filters',
      'Full JP/EN translation',
      'Detailed stats and abilities'
    ],
    badge: 'Database',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    href: '/calendar',
    icon: Calendar,
    title: 'Campaign Calendar',
    description: 'View all game events, campaigns, and gacha schedules in a calendar format',
    highlights: [
      'All campaign types',
      'Gacha event schedules',
      'Active missions tracking',
      'Interactive month view'
    ],
    badge: 'Events',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    href: '/facebuilder',
    icon: User,
    title: 'Face Builder',
    description: 'Build and customize character faces with different expressions',
    highlights: [
      '700+ characters',
      'UI and Story variations',
      'Multiple expressions',
      'Download custom faces'
    ],
    badge: 'Creative Tool',
    gradient: 'from-green-500 to-emerald-500'
  }
];

const stats = [
  { icon: Database, value: '6000+', label: 'Characters' },
  { icon: FileJson, value: '50+', label: 'Data Categories' },
  { icon: Calendar, value: '200+', label: 'Events Tracked' },
  { icon: User, value: '700+', label: 'Face Variations' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container relative mx-auto px-4 py-20 sm:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="outline" className="mb-4 text-sm">
              <Sparkles className="mr-1 h-3 w-3" />
              World Flipper Data Tools
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Explore Game Data & Build Custom Content
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto">
              A comprehensive toolkit for exploring World Flipper game data, browsing characters, tracking events, and creating custom character faces.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/orderedmap">
                <Button size="lg" className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/characters">
                <Button size="lg" variant="outline">
                  Browse Characters
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="flex flex-col items-center text-center">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Powerful Tools at Your Fingertips</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to explore, analyze, and work with World Flipper game data
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Link key={index} href={feature.href} className="group">
                  <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
                    <CardHeader>
                      <div className="mb-4 flex items-start justify-between">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {feature.badge}
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl group-hover:text-primary transition-colors">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feature.highlights.map((highlight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Zap className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
                        Explore now
                        <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer Info Section */}
      <section className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 flex justify-center">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <h3 className="mb-3 text-2xl font-bold">Open Source & Community Driven</h3>
            <p className="text-muted-foreground">
              Built with Next.js, TypeScript, and shadcn/ui. All game data is sourced from official World Flipper files. 
              This is a fan-made tool for the community.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

