import React from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Contact = {
  id: string;
  waId: string;
  name: string | null;
  profilePic?: string | null;
};

export const ChatAvatar = ({ contact, className }: { contact: Contact | null | undefined, className?: string }) => {
  if (!contact) return (
    <Avatar className={cn("h-10 w-10", className)}>
      <AvatarFallback><User className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
    </Avatar>
  );

  // High-quality fallback using UI Avatars if no profile pic is available
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name || contact.waId)}&background=random&color=fff&bold=true&size=128`;

  return (
    <Avatar className={cn("h-10 w-10 border border-border/50", className)}>
      <AvatarImage src={contact.profilePic || fallbackUrl} alt={contact.name || "Contact"} />
      <AvatarFallback className={cn(
        "text-xs font-bold",
        "bg-slate-100 dark:bg-slate-800 text-slate-500"
      )}>
        {/^\d/.test(contact.name || contact.waId) ? (
          <User className="h-2/3 w-2/3 opacity-50" />
        ) : (
          (contact.name || contact.waId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '??'
        )}
      </AvatarFallback>
    </Avatar>
  );
};
