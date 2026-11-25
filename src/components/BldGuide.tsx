import { useRef, useState, useSyncExternalStore } from "react";
import { Alg } from "cubing/alg";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { speffzSticker, type Orbit } from "../lib/bld";
import {
  m2Even, m2Parity, m2Setups, m2Special, opCornerSetups, opEdgeSetups, opParity, tPerm, yPerm,
} from "../lib/bldMethods";
import { BldHighlightCube, type Highlight } from "./BldHighlightCube";
import { BldCubeNet, BldCubeViewToggle, type CubeView } from "./BldCubeNet";
import { Modal } from "./Modal/Modal";
import "./AlgorithmLibrary/AlgorithmLibrary";
import "./BldTrainer/BldTrainer";

const setupMethods = ["M2 法", "Old Pochmann 法"] as const;
const methods = [...setupMethods, "3-style"] as const;
type SetupMethod = (typeof setupMethods)[number];
type Method = (typeof methods)[number];
export type SetupTarget = { orbit: Orbit; letter: string; edgeBuffer: string };
type GuideCase = {
  title: string;
  highlights: Highlight[];
  alg?: string;
  setup?: string;
  evenAlg?: string;
  explanation?: string;
  orbit?: Orbit;
  letter?: string;
};
type Group = { title: string; cases: GuideCase[] };

const compactQuery = "(max-width: 760px), (pointer: coarse) and (max-height: 540px)";
function subscribeViewport(listener: () => void) {
  const media = matchMedia(compactQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const compactViewport = () => matchMedia(compactQuery).matches;
const marks = (orbit: Orbit, letters: string): Highlight[] =>
  [...letters].map((letter) => ({ orbit, letter }));

function setups(orbit: Orbit, buffer: string, base: string, entries: Record<string, string>) {
  return Object.entries(entries).map(([letter, setup]): GuideCase => ({
    title: `${letter} · ${speffzSticker(orbit, letter).position}`,
    highlights: marks(orbit, buffer + letter),
    orbit, letter,
    setup,
    alg: base,
  }));
}

const groups: Record<SetupMethod, Group[]> = {
  "M2 法": [
    { title: "エッジのセットアップ", cases: setups("EDGES", "U", "M2", m2Setups) },
    {
      title: "専用手順",
      cases: Object.entries(m2Special).map(([letter, alg]) => ({
        title: `${letter} · ${speffzSticker("EDGES", letter).position}`,
        highlights: marks("EDGES", "U" + letter),
        orbit: "EDGES", letter,
        alg,
        evenAlg: m2Special[m2Even[letter]],
        explanation: "交換文字列の先頭から数えて、奇数番目と偶数番目で手順を切り替えます。サイクルが変わっても番号は続けます。",
      })),
    },
    { title: "パリティ", cases: [{
      title: "パリティ処理", highlights: marks("EDGES", "CWAD"), alg: m2Parity,
      explanation: "交換数が奇数のときは、エッジの処理後にこの手順を回し、UBL バッファの Old Pochmann 法でコーナーを処理します。",
    }] },
  ],
  "Old Pochmann 法": [
    { title: "エッジのセットアップ", cases: setups("EDGES", "B", tPerm, opEdgeSetups) },
    { title: "コーナーのセットアップ", cases: setups("CORNERS", "A", yPerm, opCornerSetups) },
    { title: "パリティ", cases: [{
      title: "パリティ処理", highlights: [...marks("EDGES", "AD"), ...marks("CORNERS", "BC")], alg: opParity,
      explanation: "交換数が奇数のときは、エッジの後、コーナーの前に回します。エッジに M2 法を使う場合は M2 法のパリティ手順を使います。",
    }] },
  ],
};

function letterCase(method: SetupMethod, orbit: Orbit, letter: string): GuideCase {
  return groups[method].flatMap((group) => group.cases).find((item) =>
    item.orbit === orbit && item.letter === letter) ?? {
    title: `${letter} · ${speffzSticker(orbit, letter).position}`,
    highlights: marks(orbit, letter), orbit, letter,
    explanation: "このステッカーはバッファのピースにあります。",
  };
}

export function BldGuide({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<Method>("3-style");
  return <Modal title="BLD ガイド" onClose={onClose} className="bld-guide-modal bld-card-modal">
    <div className="bld-section">
      <div className="segmented" role="group" aria-label="解法">
        {methods.map((item) => <button key={item} type="button" aria-pressed={method === item}
          className={method === item ? "selected" : ""} onClick={() => setMethod(item)}>{item}</button>)}
      </div>
      <Overview method={method} />
    </div>
  </Modal>;
}

export function BldSetup({ initial, onClose }: { initial?: SetupTarget; onClose: () => void }) {
  const [method, setMethod] = useState<SetupMethod>(
    initial && (initial.orbit === "CORNERS" || initial.edgeBuffer === "UR" ||
      (initial.edgeBuffer === "UF" && "UK".includes(initial.letter))) ? "Old Pochmann 法" : "M2 法",
  );
  const [selected, setSelected] = useState<GuideCase | undefined>(() =>
    initial && letterCase(method, initial.orbit, initial.letter),
  );
  const [showDetail, setShowDetail] = useState(!!initial);
  const [view, setView] = useState<CubeView | "list">(initial ? "net" : "list");
  const [orbit, setOrbit] = useState<Orbit>(initial?.orbit ?? "EDGES");
  const compact = useSyncExternalStore(subscribeViewport, compactViewport);
  const trigger = useRef<HTMLElement | null>(null);
  const back = useRef<HTMLButtonElement>(null);

  function choose(item: GuideCase, button?: HTMLButtonElement) {
    trigger.current = button ?? (document.activeElement instanceof HTMLButtonElement ? document.activeElement : null);
    setSelected(item);
    setShowDetail(compact);
    if (compact) requestAnimationFrame(() => back.current?.focus());
  }

  function returnToList() {
    setShowDetail(false);
    requestAnimationFrame(() => (trigger.current ?? document.querySelector<HTMLSelectElement>("#bld-setup-method"))?.focus());
  }

  return (
    <Modal title="セットアップ手順" onClose={onClose} wide className="bld-guide-modal bld-card-modal">
      <div className="bld-guide-layout">
        <div hidden={compact && showDetail}>
          <div className="bld-guide-toolbar">
            <label>解法
              <select id="bld-setup-method" value={method} onChange={(event) => {
                const next = event.target.value as SetupMethod;
                setMethod(next);
                if (orbit === "CORNERS" && next === "M2 法") {
                  setOrbit("EDGES");
                  setSelected(undefined);
                } else {
                  setSelected(selected?.orbit === orbit && selected.letter ? letterCase(next, orbit, selected.letter) : undefined);
                }
              }}>
                {setupMethods.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <BldCubeViewToggle view={view} onChange={setView} views={["list", "net", "3d"]} />
          </div>
          <div className="algorithm-browser">
            <section className="algorithm-cases" aria-label="手順一覧">
              {view !== "list" ? (
                <div className="bld-section bld-guide-map">
                  {method === "Old Pochmann 法" && <div className="segmented" role="group" aria-label="ピースの種類">
                    <button type="button" aria-pressed={orbit === "EDGES"} className={orbit === "EDGES" ? "selected" : ""} onClick={() => setOrbit("EDGES")}>エッジ</button>
                    <button type="button" aria-pressed={orbit === "CORNERS"} className={orbit === "CORNERS" ? "selected" : ""} onClick={() => setOrbit("CORNERS")}>コーナー</button>
                  </div>}
                  <BldCubeNet view={view} orbit={orbit} selection={selected?.orbit === orbit && selected.letter ? [selected.letter] : []}
                    onSelect={(letter) => choose(letterCase(method, orbit, letter))} />
                  <button type="button" onClick={(event) => choose(groups[method].at(-1)!.cases[0], event.currentTarget)}>パリティ処理</button>
                </div>
              ) : (
                <div className="algorithm-case-scroll">
                  {groups[method].map((group) => (
                    <section className="bld-guide-group" key={group.title} aria-label={group.title}>
                      <h3>{group.title}</h3>
                      <ul className="algorithm-case-list">
                        {group.cases.map((item) => (
                          <li key={item.title}>
                            <button type="button" aria-current={selected?.title === item.title ? "true" : undefined}
                              onClick={(event) => choose(item, event.currentTarget)}>
                              {item.title}<ChevronRight size={15} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </section>
            {!compact && (
              <section className="algorithm-detail">
                {selected ? <CaseDetail key={selected.title} item={selected} /> : <p className="muted">確認する文字かパリティ処理を選んでください。</p>}
              </section>
            )}
          </div>
        </div>
        {compact && showDetail && selected && (
          <div className="bld-section">
            <button ref={back} type="button" className="text-button bld-back" onClick={returnToList}>
              <ArrowLeft size={16} aria-hidden="true" /> 手順の選択に戻る
            </button>
            <CaseDetail key={selected.title} item={selected} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function CaseDetail({ item }: { item: GuideCase }) {
  const { setup, alg, evenAlg } = item;
  const undo = setup ? new Alg(setup).invert().toString().replace(/2'(?= |$)/g, "2") : "";
  return (
    <div className="bld-guide-detail">
      <h2>{item.title}</h2>
      <BldHighlightCube highlights={item.highlights} />
      {item.explanation && <p>{item.explanation}</p>}
      {alg && (
        <dl className="bld-guide-steps">
          {setup !== undefined && <div><dt>セットアップ</dt><dd><code translate="no">{setup || "なし"}</code></dd></div>}
          <div><dt>{evenAlg ? "奇数番目" : setup === undefined ? "手順" : "基本手順"}</dt><dd><code translate="no">{alg}</code></dd></div>
          {evenAlg && <div><dt>偶数番目</dt><dd><code translate="no">{evenAlg}</code></dd></div>}
          {setup !== undefined && <div><dt>セットアップを戻す</dt><dd><code translate="no">{undo || "なし"}</code></dd></div>}
        </dl>
      )}
    </div>
  );
}

function Overview({ method }: { method: Method }) {
  return (
    <div className="bld-guide-detail">
      {method === "M2 法" ? (
        <>
          <p>エッジを1文字ずつ処理します。DF の D 面（U）がバッファ、UB の U 面（A）が基本交換先です。コーナーは Old Pochmann 法と組み合わせられます。</p>
          <p>通常の文字は対象を A に運び、<code>M2</code> を回してからセットアップの逆手順で戻します。C・I・S・W では、交換文字列全体で数えた奇数番目と偶数番目に応じて専用手順を選びます。</p>
          <a href="https://jperm.net/bld/faster" target="_blank" rel="noreferrer">M2 法の解説動画（J Perm、英語）</a>
        </>
      ) : method === "Old Pochmann 法" ? (
        <>
          <p>エッジは UR の U 面（B）がバッファ、UL の U 面（D）が基本交換先です。セットアップで対象を D に移し、T パームを回して戻します。</p>
          <p>コーナーは UBL の U 面（A）がバッファ、UFR の U 面（C）が基本交換先です。対象を C に移し、Y パームを回して戻します。</p>
        </>
      ) : (
        <>
          <p>交換文字列を2文字ずつ読み、バッファと2つの対象を順番どおりに巡回させます。エッジとコーナーは別の列として扱います。</p>
          <p><code>[A, B]</code> は <code>A B A′ B′</code> の順です。3つの対象のうち2つを1回転で一方からもう一方へ送れる配置にし、その回転を <code>B</code> とします。残り1つを動かす手順 <code>A</code> を探し、その層の2位置の片方だけに作用させます。</p>
          <p>エッジとコーナーに1文字ずつ残ったら、両バッファをそれぞれの対象と交換するパリティ手順を使います。</p>
          <a href="https://www.youtube.com/watch?v=9KPqwwKNldc" target="_blank" rel="noreferrer">3-style の解説動画（J Perm、英語）</a>
        </>
      )}
      <details className="bld-guide-overview">
        <summary>交換文字列の作り方</summary>
        <p>バッファにあるステッカーの行き先を文字にし、バッファに戻るまで次の行き先を追います。未解決のピースが残ったら別のサイクルを始め、閉じるときは最初のピースに戻るステッカーの文字も書きます。向きだけ違うピースも追跡に含めます。</p>
      </details>
    </div>
  );
}
