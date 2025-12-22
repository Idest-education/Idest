"use client";

import MarkdownRenderer from "@/components/conversation/MarkdownRenderer";
import type { StimulusV2, MediaAssetV2 } from "@/types/assignment";

function isLikelyImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url);
}

function MediaBlock({ asset }: { asset: MediaAssetV2 }) {
  if (asset.kind === "image" || isLikelyImageUrl(asset.url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={asset.url}
        alt={asset.alt || asset.title || "image"}
        className="max-w-full rounded border border-gray-200"
      />
    );
  }
  if (asset.kind === "audio") {
    return <audio controls src={asset.url} className="w-full" />;
  }
  return (
    <a className="underline text-blue-600" href={asset.url} target="_blank" rel="noreferrer">
      {asset.title || asset.url}
    </a>
  );
}

export default function StimulusRenderer({ stimulus }: { stimulus: StimulusV2 }) {
  return (
    <div className="space-y-3">
      {stimulus.instructions_md && (
        <div className="text-sm text-gray-800">
          <MarkdownRenderer content={stimulus.instructions_md} />
        </div>
      )}

      {stimulus.content_md && (
        <div className="text-sm text-gray-800">
          <MarkdownRenderer content={stimulus.content_md} />
        </div>
      )}

      {stimulus.template?.body && (
        <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded border border-gray-200">
          {stimulus.template.body}
        </div>
      )}

      {stimulus.media?.length ? (
        <div className="grid grid-cols-1 gap-3">
          {stimulus.media.map((m) => (
            <MediaBlock key={m.id} asset={m} />
          ))}
        </div>
      ) : null}
    </div>
  );
}


