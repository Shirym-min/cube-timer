import type { MouseEventHandler, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export type ToolBackLink = {
  backURL: string;
  onBack: MouseEventHandler<HTMLAnchorElement>;
};

export function ToolPageHeader({ title, backURL, onBack, children }: ToolBackLink & {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="tool-page-header">
      <a className="action-link tool-page-back" href={backURL} onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />ツールに戻る
      </a>
      <div className="tool-page-heading">
        <h1>{title}</h1>
        {children && <div className="tool-page-actions">{children}</div>}
      </div>
    </header>
  );
}
