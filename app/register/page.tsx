'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Registration failed.');
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setMessage('Account created. Please verify your email before logging in if required by your Supabase settings.');
        return;
      }

      router.push('/community');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center p-4'>
      <Card className='w-full'>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Create your account for team uploads and save sharing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='space-y-3' onSubmit={handleSubmit}>
            <div className='space-y-1'>
              <label className='text-xs text-muted-foreground'>Display Name</label>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder='Your name'
                required
                minLength={2}
              />
            </div>
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
                placeholder='At least 8 characters'
                required
                minLength={8}
              />
            </div>
            {error ? <p className='text-sm text-destructive'>{error}</p> : null}
            {message ? <p className='text-sm text-muted-foreground'>{message}</p> : null}
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className='mt-3 text-center text-sm text-muted-foreground'>
            Already have an account?{' '}
            <Link href='/login' className='text-primary hover:underline'>
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
