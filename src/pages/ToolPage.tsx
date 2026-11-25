import { lazy, Suspense, type MouseEventHandler } from "react";
import { pageURL, type FollowPage, type Page } from "../navigation";

const RecallTrainer = lazy(() =>
  import("../components/RecallTrainer/RecallTrainer").then((m) => ({
    default: m.RecallTrainer,
  })),
);
const BldTrainer = lazy(() => import("../components/BldTrainer/BldTrainer").then((m) => ({ default: m.BldTrainer })));
const VirtualCube = lazy(() => import("../components/VirtualCube/VirtualCube").then((m) => ({ default: m.VirtualCube })));
const SolveVideo = lazy(() =>
  import("../components/SolveVideo/SolveVideo").then((m) => ({ default: m.SolveVideo })),
);
const AlgorithmLibrary = lazy(() =>
  import("../components/AlgorithmLibrary/AlgorithmLibrary").then((m) => ({ default: m.AlgorithmLibrary })),
);

export function ToolPage({ page, followPage, navigate }: {
  page: Page;
  followPage: FollowPage;
  navigate: (page: Page) => void;
}) {
  const backURL = pageURL("practice");
  const onBack: MouseEventHandler<HTMLAnchorElement> = (event) => followPage(event, "practice");

  return (
    <Suspense fallback={<main id="main-content" tabIndex={-1} className="loading-screen">読み込み中…</main>}>
      {page === "virtual" ? <VirtualCube backURL={backURL} onBack={onBack} />
        : page === "recall" ? <RecallTrainer backURL={backURL} onBack={onBack} />
        : page === "algorithms" ? <AlgorithmLibrary backURL={backURL} onBack={onBack} />
        : page === "bld" || page === "bld-guide" ? (
          <BldTrainer
            openGuide={page === "bld-guide"} backURL={backURL} onBack={onBack}
            onCloseGuide={() => { if (page === "bld-guide") navigate("bld"); }}
          />
        ) : <SolveVideo backURL={backURL} onBack={onBack} />}
    </Suspense>
  );
}
