'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push('/community');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center p-4'>
      <Card className='w-full'>
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in with your email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='space-y-3' onSubmit={handleSubmit}>
            <div className='space-y-1'>
              <label className='text-xs text-muted-foreground'>Email</label>
              <Input
                type='email'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder='you@example.com'
                required
              />
            </div>
            <div className='space-y-1'>
              <label className='text-xs text-muted-foreground'>Password</label>
              <Input
                type='password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder='--------'
                required
              />
            </div>
            {error ? <p className='text-sm text-destructive'>{error}</p> : null}
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className='mt-3 text-center text-sm text-muted-foreground'>
            No account yet?{' '}
            <Link href='/register' className='text-primary hover:underline'>
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
