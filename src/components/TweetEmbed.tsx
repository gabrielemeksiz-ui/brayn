'use client';

import { useEffect, useRef, useState } from 'react';

interface TweetEmbedProps {
  url: string;
}

export function TweetEmbed({ url }: TweetEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setHtml(null);
    setError(false);

    fetch(`/api/tweet-embed?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (data.html) {
          setHtml(data.html);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [url]);

  // After HTML is injected, run Twitter's widget script to render the embed
  useEffect(() => {
    if (!html || !ref.current) return;

    const twttr = (window as any).twttr;
    if (twttr?.widgets) {
      twttr.widgets.load(ref.current);
    } else if (!document.getElementById('twitter-wjs')) {
      const script = document.createElement('script');
      script.id = 'twitter-wjs';
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => {
        (window as any).twttr?.ready(() => {
          twttr?.widgets?.load(ref.current);
        });
      };
      document.head.appendChild(script);
    }
  }, [html]);

  if (error) return null;

  if (!html) {
    return (
      <div className="rounded-[6px] border border-[#2A2A2A] bg-[#252525] p-4 flex items-center gap-3 mb-2">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#444] border-t-[#2E7CD1] animate-spin shrink-0" />
        <span className="text-[12px] text-[#606060]">Chargement du tweet…</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      dangerouslySetInnerHTML={{ __html: html }}
      className="mb-2"
    />
  );
}
