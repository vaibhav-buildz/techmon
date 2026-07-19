"use client";

import Link from "next/link";
import React from "react";

type Props = {
  text: string;
};

export default function HashtagText({ text }: Props) {
  if (!text) return null;

  // Split by hashtags using a regex. 
  // Capturing group ensures the delimiter (the hashtag) is included in the split result.
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/^#[a-zA-Z0-9_]+$/)) {
          const tag = part.slice(1).toLowerCase();
          return (
            <Link
              key={i}
              href={`/hashtag/${tag}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[#2F5D8A] hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
