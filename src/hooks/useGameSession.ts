import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const GAME_SESSION_KEY = 'fast-eyes.gameSessionId';

function getOrCreateGameSessionId(): string {
  const existing = sessionStorage.getItem(GAME_SESSION_KEY);
  if (existing) return existing;

  const id =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ||
    `tab_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  sessionStorage.setItem(GAME_SESSION_KEY, id);
  return id;
}

export function useGameSession() {
  const gameSessionId = useMemo(() => getOrCreateGameSessionId(), []);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Ensure we have an auth session (shared across tabs), while gameSessionId stays per-tab.
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('[useGameSession] auth session ok', { authUserId: session.user.id, gameSessionId });
          return;
        }

        const { data: { session: newSession }, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('[useGameSession] anonymous auth error:', error);
          return;
        }

        console.log('[useGameSession] anonymous auth created', { authUserId: newSession?.user?.id, gameSessionId });
      } catch (error) {
        console.error('[useGameSession] session init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useGameSession] auth state changed', { event, hasSession: !!session, gameSessionId });
    });

    initAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [gameSessionId]);

  // sessionId is intentionally per-tab so you can test 2 players in the same browser.
  return { sessionId: gameSessionId, isLoading };
}

