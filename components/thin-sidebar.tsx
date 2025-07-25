'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FlaskConical,
  Newspaper,
  Folders,
  User, 
  LogOut,
  Shield // Added for Admin button
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client'; // Added to fetch role
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { SessionLibrary } from './session-library';
import Image from 'next/image';

export function ThinSidebar() {
  // If auth status not determined yet or user not authenticated, render nothing
  // Prevents sidebar from flashing for unauthenticated visitors

  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUserRole(profile.role);
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    fetchUserRole();
  }, []);
  
  const navItems = [
    { icon: Home, name: 'Home', href: '/home' },
    { icon: FlaskConical, name: 'Research', href: '/home/research' },
    { icon: Newspaper, name: 'News', href: '/home/news' },
    { icon: Folders, name: 'Spaces', href: '/home/spaces' },
  ];

  if (isAuthenticated === false) {
    return null;
  }
  if (isAuthenticated === null) {
    return null; // optionally a spinner
  }

  return (
    <div className="flex flex-col h-screen w-14 bg-background border-r border-border">
      {/* Logo */}
      <div className="flex justify-center py-4">
        <Link href="/home">
          <Image src="/images/ellen-logo.svg" width={28} height={28} alt="ELLEN logo" className="rounded-sm" />
        </Link>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 flex flex-col items-center pt-4 gap-2">
        <TooltipProvider delayDuration={300}>
          {navItems.map((item) => {
            if (item.name === 'Home') {
              return (
                <HoverCard key={item.name} openDelay={100} closeDelay={50}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HoverCardTrigger asChild>
                        <Link href={item.href} passHref>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-10 w-10 rounded-full",
                              pathname === item.href && "bg-accent text-accent-foreground"
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="sr-only">{item.name}</span>
                          </Button>
                        </Link>
                      </HoverCardTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                  <HoverCardContent side="right" align="start" className="h-screen w-80 border-0 border-r p-0 rounded-none">
                    <SessionLibrary />
                  </HoverCardContent>
                </HoverCard>
              );
            }
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link href={item.href} passHref>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-10 w-10 rounded-full",
                        pathname === item.href && "bg-accent text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.name}</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
      
      {/* User and Logout */}
      <div className="flex flex-col items-center py-4 gap-2">
        <TooltipProvider delayDuration={300}>
          {userRole === 'admin' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/admin" passHref>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 rounded-full",
                      pathname.startsWith('/admin') && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Shield className="h-5 w-5" />
                    <span className="sr-only">Admin</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Admin</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/account" passHref>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                  <User className="h-5 w-5" />
                  <span className="sr-only">Account</span>
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Account</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <form action="/auth/sign-out" method="post">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" type="submit">
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Logout</span>
                </Button>
              </form>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
