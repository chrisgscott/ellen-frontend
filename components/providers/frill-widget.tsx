"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Lightweight Frill bootstrap copied from vendor snippet, injected at runtime
const BOOTSTRAP = `
(function(t,r){function s(){var a=r.getElementsByTagName("script")[0],e=r.createElement("script");e.type="text/javascript",e.async=!0,e.src="https://widget.frill.co/v2/container.js",a.parentNode.insertBefore(e,a)}if(!t.Frill){var o=0,i={};t.Frill=function(e,p){var n,l=o++,c=new Promise(function(v,d){i[l]={params:[e,p],resolve:function(f){n=f,v(f)},reject:d}});return c.destroy=function(){delete i[l],n&&n.destroy()},c},t.Frill.q=i;}r.readyState==="complete"||r.readyState==="interactive"?s():r.addEventListener("DOMContentLoaded",s)})(window,document);
`;

type FrillInitParams = {
  key: string;
  user?: { email?: string; name?: string };
};

type FrillApi = {
  (action: 'container', params: FrillInitParams | { key: string; ssoToken: string }): unknown;
  (action: 'identify', params: { email?: string; name?: string } | { ssoToken: string }): unknown;
  (action: 'unidentify'): unknown;
  (action: 'help'): unknown;
};

declare global {
  interface Window {
    Frill?: FrillApi;
    frillHelp?: () => unknown;
  }
}

export function FrillWidget() {
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;

    // 1) Inject bootstrap if not present
    if (typeof window !== "undefined" && !window.Frill) {
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.defer = true;
      s.innerHTML = BOOTSTRAP;
      document.head.appendChild(s);
    }

    // 2) Identify user via Supabase and init Frill
    const init = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      const frillKey = process.env.NEXT_PUBLIC_FRILL_KEY || "9ba6e3d3-aafe-4f09-93b4-9f13d7462d44";

      // Build identification object if user exists
      const identified = user
        ? {
            email: user.email ?? undefined,
            name:
              (user.user_metadata?.full_name as string | undefined) ||
              (user.user_metadata?.name as string | undefined) ||
              undefined,
          }
        : undefined;

      // Prefer SSO token if available
      const getAndInit = async () => {
        try {
          const res = await fetch('/api/frill/sso-token', { cache: 'no-store' });
          if (res.ok) {
            const { token } = (await res.json()) as { token: string };
            window.Frill?.('container', { key: frillKey, ssoToken: token });
            return true;
          }
        } catch {
          // ignore
        }
        // Fallback: guest identification when SSO token not available
        window.Frill?.('container', {
          key: frillKey,
          ...(identified ? { user: identified } : {}),
        });
        return false;
      };

      await getAndInit();

      // Subscribe to auth state changes to keep Frill user in sync (re-init)
      const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
        await getAndInit();
      });

      // Minimal debug helper in dev
      if (process.env.NODE_ENV !== "production") {
        window.frillHelp = () => window.Frill && window.Frill('help');
      }

      // Cleanup
      return () => {
        subscription?.subscription?.unsubscribe?.();
      };
    };

    init();
  }, []);

  return null;
}

export default FrillWidget;
