import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getAuthContext } from '@/lib/community/auth';
import { updateProfileSchema } from '@/lib/community/schemas';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type TeamStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
type TeamStatusCounts = Record<TeamStatus, number>;
type ProfileRow = {
  display_name?: string | null;
  avatar_url?: string | null;
  role?: 'user' | 'moderator' | 'admin' | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function createEmptyTeamStatusCounts(): TeamStatusCounts {
  return {
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
  };
}

function getDefaultDisplayName(email: string): string {
  return email.split('@')[0] || 'User';
}

function getMetadataDisplayName(user: User): string | null {
  const value = user.user_metadata?.display_name;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function createProfilePayload(args: { auth: { userId: string; email: string; role: 'user' | 'moderator' | 'admin' }; user: User; profile: ProfileRow | null }) {
  const { auth, user, profile } = args;
  return {
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
    displayName: profile?.display_name || getMetadataDisplayName(user) || getDefaultDisplayName(auth.email),
    avatarUrl: profile?.avatar_url || null,
    createdAt: profile?.created_at || user.created_at || null,
    updatedAt: profile?.updated_at || null,
    lastSignInAt: user.last_sign_in_at || null,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const server = await createSupabaseServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const [profileResult, teamsResult, saveSharesResult, reportsResult] = await Promise.all([
      admin
        .from('profiles')
        .select('display_name, avatar_url, role, created_at, updated_at')
        .eq('id', auth.userId)
        .maybeSingle(),
      admin.from('teams').select('publish_status').eq('owner_id', auth.userId),
      admin.from('save_shares').select('visibility, download_count').eq('owner_id', auth.userId),
      admin.from('reports').select('status').eq('reporter_id', auth.userId),
    ]);

    if (profileResult.error) {
      return NextResponse.json({ ok: false, error: profileResult.error.message }, { status: 400 });
    }
    if (teamsResult.error) {
      return NextResponse.json({ ok: false, error: teamsResult.error.message }, { status: 400 });
    }
    if (saveSharesResult.error) {
      return NextResponse.json({ ok: false, error: saveSharesResult.error.message }, { status: 400 });
    }
    if (reportsResult.error) {
      return NextResponse.json({ ok: false, error: reportsResult.error.message }, { status: 400 });
    }

    const teamRows = (teamsResult.data || []) as Array<{ publish_status?: TeamStatus }>;
    const teamStatusCounts = createEmptyTeamStatusCounts();
    for (const row of teamRows) {
      const status = row.publish_status;
      if (!status) continue;
      if (!Object.prototype.hasOwnProperty.call(teamStatusCounts, status)) continue;
      teamStatusCounts[status] += 1;
    }

    const saveRows = (saveSharesResult.data || []) as Array<{ visibility?: 'private' | 'unlisted' | 'public'; download_count?: number }>;
    let savePrivate = 0;
    let saveUnlisted = 0;
    let savePublic = 0;
    let saveDownloads = 0;
    for (const row of saveRows) {
      const visibility = row.visibility;
      if (visibility === 'private') savePrivate += 1;
      if (visibility === 'unlisted') saveUnlisted += 1;
      if (visibility === 'public') savePublic += 1;
      saveDownloads += Number.isFinite(row.download_count) ? Number(row.download_count) : 0;
    }

    const reportRows = (reportsResult.data || []) as Array<{ status?: string }>;
    let reportsOpen = 0;
    for (const row of reportRows) {
      if ((row.status || '').toLowerCase() === 'open') {
        reportsOpen += 1;
      }
    }

    const profile = (profileResult.data || null) as ProfileRow | null;
    return NextResponse.json({
      ok: true,
      profile: createProfilePayload({ auth, user, profile }),
      status: {
        authenticated: true,
        teams: {
          total: teamRows.length,
          ...teamStatusCounts,
        },
        saveShares: {
          total: saveRows.length,
          private: savePrivate,
          unlisted: saveUnlisted,
          public: savePublic,
          downloads: saveDownloads,
        },
        reports: {
          total: reportRows.length,
          open: reportsOpen,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load profile.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return NextResponse.json({ ok: false, error: 'Content-Type must be application/json.' }, { status: 415 });
    }

    const payload = (await request.json()) as unknown;
    const parsed = updateProfileSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const server = await createSupabaseServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('display_name, avatar_url, role, created_at, updated_at')
      .eq('id', auth.userId)
      .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json({ ok: false, error: existingProfileError.message }, { status: 400 });
    }

    const existing = (existingProfile || null) as ProfileRow | null;
    const metadataDisplayName = getMetadataDisplayName(user) || getDefaultDisplayName(auth.email);
    const currentDisplayName = existing?.display_name || metadataDisplayName;
    const currentAvatarUrl = existing?.avatar_url || null;

    const requestedDisplayName = parsed.data.displayName?.trim();
    const requestedAvatarUrl =
      parsed.data.avatarUrl === undefined
        ? undefined
        : parsed.data.avatarUrl === null || parsed.data.avatarUrl.trim() === ''
          ? null
          : parsed.data.avatarUrl.trim();

    const nextDisplayName = requestedDisplayName ?? currentDisplayName;
    const nextAvatarUrl = requestedAvatarUrl === undefined ? currentAvatarUrl : requestedAvatarUrl;

    const hasDisplayNameChange = nextDisplayName !== currentDisplayName;
    const hasAvatarChange = nextAvatarUrl !== currentAvatarUrl;

    if (!hasDisplayNameChange && !hasAvatarChange) {
      return NextResponse.json({
        ok: true,
        profile: createProfilePayload({ auth, user, profile: existing }),
      });
    }

    const nowIso = new Date().toISOString();
    const { data: savedProfile, error: saveProfileError } = await admin
      .from('profiles')
      .upsert(
        {
          id: auth.userId,
          display_name: nextDisplayName,
          avatar_url: nextAvatarUrl,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      )
      .select('display_name, avatar_url, role, created_at, updated_at')
      .single();

    if (saveProfileError) {
      return NextResponse.json({ ok: false, error: saveProfileError.message }, { status: 400 });
    }

    if (hasDisplayNameChange) {
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(auth.userId, {
        user_metadata: {
          ...(user.user_metadata || {}),
          display_name: nextDisplayName,
        },
      });

      if (updateAuthError) {
        return NextResponse.json({ ok: false, error: updateAuthError.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      profile: createProfilePayload({
        auth,
        user: hasDisplayNameChange
          ? {
              ...user,
              user_metadata: {
                ...(user.user_metadata || {}),
                display_name: nextDisplayName,
              },
            }
          : user,
        profile: (savedProfile || null) as ProfileRow | null,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
