import React from 'react';
import { Bell, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[#abadae]/10"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center justify-between h-16 px-8">
        <div className="flex items-center gap-8">
          <div className="text-xl font-semibold text-[#2c2f30] tracking-tight">
            EntrepreneurOS
          </div>
          {title && (
            <div className="text-base font-medium text-[#595c5d]">
              {title}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-[#595c5d] hover:text-[#2c2f30] hover:bg-[#eff1f2]"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[#6a37d4] rounded-full" />
          </Button>
          
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src="" />
            <AvatarFallback className="bg-[#ae8dff] text-white text-xs">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
