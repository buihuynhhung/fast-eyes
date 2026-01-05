import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { ChatMessage, Player } from '@/types/game';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatBoxProps {
  messages: ChatMessage[];
  players: Player[];
  onSendMessage: (message: string) => void;
  currentPlayerName: string;
}

export function ChatBox({ messages, players, onSendMessage, currentPlayerName }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const getPlayerColor = (playerName: string) => {
    const player = players.find(p => p.player_name === playerName);
    return player?.player_color || 'hsl(180, 100%, 50%)';
  };

  return (
    <div className="flex flex-col h-full rounded-lg neon-border-purple bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-accent/30 bg-accent/10">
        <MessageCircle className="w-5 h-5 text-accent" />
        <h3 className="font-display text-accent">CHAT</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "text-sm",
                msg.is_system && "text-center italic text-muted-foreground"
              )}
            >
              {msg.is_system ? (
                <span className="text-accent/80">{msg.message}</span>
              ) : (
                <>
                  <span
                    className="font-semibold"
                    style={{ color: getPlayerColor(msg.player_name) }}
                  >
                    {msg.player_name}:
                  </span>
                  <span className="ml-2 text-foreground/90">{msg.message}</span>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-accent/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-accent/30 focus:border-accent"
          />
          <Button
            type="submit"
            size="icon"
            className="bg-accent hover:bg-accent/80"
            disabled={!input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
