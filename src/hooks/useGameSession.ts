import { useState, useEffect } from 'react';
import { generateSessionId } from '@/lib/gameUtils';

const SESSION_KEY = 'fastEyes_sessionId';

export function useGameSession() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      stored = generateSessionId();
      localStorage.setItem(SESSION_KEY, stored);
    }
    setSessionId(stored);
  }, []);

  return sessionId;
}
