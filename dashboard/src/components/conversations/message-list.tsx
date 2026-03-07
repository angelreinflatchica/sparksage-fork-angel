"use client";

import type { MessageItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Terminal } from "lucide-react";

interface MessageListProps {
  messages: MessageItem[];
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr + "Z");
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No messages in this channel.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        const isCodeReview = msg.content.startsWith("[Code Review]");
        const displayContent = isCodeReview
          ? msg.content.replace("[Code Review]", "").trim()
          : msg.content;

        return (
          <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                isUser ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
              {isCodeReview && (
                <Badge className="mt-2 inline-flex gap-1.5 rounded-full border border-amber-300/70 bg-amber-400 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 shadow-sm hover:bg-amber-400">
                  <Terminal className="h-3 w-3" />
                  Code Review
                </Badge>
              )}
              <div
                className={`mt-1 flex items-center gap-2 text-xs ${
                  isUser ? "opacity-70" : "text-muted-foreground"
                }`}
              >
                <span>{formatTime(msg.created_at)}</span>
                {msg.provider && !isUser && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {msg.provider}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
