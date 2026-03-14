'use client';

import { useEffect, useState } from 'react';

interface TweetData {
  authorName: string;
  authorHandle: string;
  text: string;
  url: string;
}

interface TweetEmbedProps {
  url: string;
}

export function TweetEmbed({ url }: TweetEmbedProps) {
  const [data, setData] = useState<TweetData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null);
    setError(false);
    fetch(`/api/tweet-embed?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.authorName) setData(d);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [url]);

  if (error) return null;

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-3 h-3 rounded-full border-2 border-[#444] border-t-[#2E7CD1] animate-spin shrink-0" />
        <span className="text-[12px] text-[#606060]">Chargement du tweet…</span>
      </div>
    );
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-[6px] border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2.5 hover:border-[#333] hover:bg-[#222] transition-colors duration-100 no-underline group"
    >
      {/* X logo */}
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-black flex items-center justify-center border border-[#2A2A2A]">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[13px] font-medium text-[#D4D4D4] truncate group-hover:text-white transition-colors">{data.authorName}</span>
          <span className="text-[12px] text-[#606060] shrink-0">@{data.authorHandle}</span>
        </div>
        <p className="text-[12px] text-[#9B9B9B] leading-relaxed line-clamp-2">{data.text}</p>
      </div>
    </a>
  );
}
