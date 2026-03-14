'use client';

import { useEffect, useRef, useState } from 'react';

interface TweetEmbedProps {
  url: string;
}

export function TweetEmbed({ url }: TweetEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);

    const loadWidgets = () => {
      const twttr = (window as any).twttr;
      if (twttr?.widgets) {
        twttr.widgets.load(ref.current);
        twttr.events?.bind('rendered', () => setLoaded(true));
      }
    };

    if (!(window as any).twttr) {
      const script = document.createElement('script');
      script.id = 'twitter-wjs';
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => {
        (window as any).twttr?.ready(() => {
          loadWidgets();
          setLoaded(true);
        });
      };
      script.onerror = () => setError(true);
      document.head.appendChild(script);
    } else {
      loadWidgets();
      // Give it a moment to render
      setTimeout(() => setLoaded(true), 1500);
    }
  }, [url]);

  if (error) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/3 p-4 text-center">
        <p className="text-xs text-zinc-500">Tweet indisponible</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 block"
        >
          Voir sur X →
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      {!loaded && (
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-indigo-400 animate-spin" />
          <span className="text-xs text-zinc-500">Chargement du tweet…</span>
        </div>
      )}
      <div
        ref={ref}
        className={loaded ? 'block' : 'hidden'}
        style={{ colorScheme: 'dark' }}
      >
        <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
          <a href={url} />
        </blockquote>
      </div>
    </div>
  );
}
