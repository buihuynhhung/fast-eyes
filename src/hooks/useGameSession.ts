import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useGameSession() {
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing session first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setSessionId(session.user.id);
          setIsLoading(false);
          return;
        }

        // No session, sign in anonymously
        const { data: { session: newSession }, error } = await supabase.auth.signInAnonymously();
        
        if (error) {
          console.error('Anonymous auth error:', error);
          setIsLoading(false);
          return;
        }
        
        if (newSession?.user) {
          setSessionId(newSession.user.id);
        }
      } catch (error) {
        console.error('Session init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setSessionId(session.user.id);
        } else {
          setSessionId('');
        }
      }
    );

    initAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { sessionId, isLoading };
}
