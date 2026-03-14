'use client';

import { useEffect, useRef, useState } from 'react';

interface TweetEmbedProps {
  url: string;
}

export function TweetEmbed({ url }: TweetEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 4000);

    const render = () => {
      const twttr = (window as any).twttr;
      if (twttr?.widgets) {
        twttr.widgets.load(ref.current);
      }
    };

    if (!(window as any).twttr) {
      if (!document.getElementById('twitter-wjs')) {
        const script = document.createElement('script');
        script.id = 'twitter-wjs';
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.onload = () => {
          (window as any).twttr?.ready(() => {
            render();
            setLoading(false);
          });
        };
        document.head.appendChild(script);
      }
    } else {
      render();
      setTimeout(() => setLoading(false), 2000);
    }

    return () => clearTimeout(timer);
  }, [url]);

  // Clean URL — remove query params for Twitter widget compatibility
  const cleanUrl = url.split('?')[0];

  return (
    <div>
      {loading && (
        <div className="rounded-[6px] border border-[#2A2A2A] bg-[#252525] p-4 flex items-center gap-3 mb-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#444] border-t-[#2E7CD1] animate-spin shrink-0" />
          <span className="text-[12px] text-[#606060]">Chargement du tweet…</span>
        </div>
      )}
      <div ref={ref}>
        <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
          <a href={cleanUrl} />
        </blockquote>
      </div>
    </div>
  );
}
