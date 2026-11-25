import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ToolPageHeader, type ToolBackLink } from "../ToolPageHeader/ToolPageHeader";
import { Film } from "lucide-react";
import { VideoWorkspace } from "../video/VideoWorkspace";
import "./SolveVideo.css";

export function SolveVideo({ backURL, onBack }: ToolBackLink) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [clip, setClip] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  return (
    <main id="main-content" tabIndex={-1} className="page-content tool-page video-analysis">
      <ToolPageHeader title="動画解析" backURL={backURL} onBack={onBack}>
        {clip && <button onClick={() => fileInput.current?.click()}>動画を変更</button>}
      </ToolPageHeader>
      <input
        hidden ref={fileInput} type="file" accept="video/*,.mov,.mp4"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setClip({ name: file.name, url: URL.createObjectURL(file) });
          event.target.value = "";
        }}
      />
      {clip ? <VideoWorkspace key={clip.url} {...clip} /> : (
        <div className="video-empty">
          <Film size={34} strokeWidth={1.45} aria-hidden="true" />
          <button className="primary" onClick={() => fileInput.current?.click()}>動画を選ぶ</button>
          <p>3×3 のソルブ動画を端末内で解析します。</p>
        </div>
      )}
    </main>
  );
}
