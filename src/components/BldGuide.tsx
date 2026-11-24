import { useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Alg } from "cubing/alg";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { speffzSticker, type Orbit } from "../lib/bld";
import {
  m2Even, m2Parity, m2Setups, m2Special, opCornerSetups, opEdgeSetups, opParity, tPerm, yPerm,
} from "../lib/bldMethods";
import { BldHighlightCube, type Highlight } from "./BldHighlightCube";
import { Modal } from "./Modal";
import "./AlgorithmLibrary.css";
import "./BldTrainer.css";

const methods = ["M2 法", "Old Pochmann 法", "3-style"] as const;
type Method = (typeof methods)[number];
type GuideCase = {
  title: string;
  highlights: Highlight[];
  alg?: string;
  setup?: string;
  evenAlg?: string;
  explanation?: string;
};
type Group = { title: string; cases: GuideCase[] };

const compactQuery = "(max-width: 760px)";
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
    setup,
    alg: base,
  }));
}

const groups: Record<Method, Group[]> = {
  "M2 法": [
    { title: "エッジのセットアップ", cases: setups("EDGES", "U", "M2", m2Setups) },
    {
      title: "専用手順",
      cases: Object.entries(m2Special).map(([letter, alg]) => ({
        title: `${letter} · ${speffzSticker("EDGES", letter).position}`,
        highlights: marks("EDGES", "U" + letter),
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
  "3-style": [
    { title: "セットアップ", cases: [
      { title: "エッジの3サイクル", highlights: marks("EDGES", "CAB"),
        explanation: "エッジのバッファと2つの対象ステッカーを、順番と向きを保てる基本形に移します。同じエッジを指す2文字には反転手順を使います。" },
      { title: "コーナーの3サイクル", highlights: marks("CORNERS", "ABC"),
        explanation: "コーナーのバッファと2つの対象を、どの面のステッカーを指すかまで確認して基本形に移します。同じコーナーを指す2文字にはねじれ手順を使います。" },
    ] },
  ],
};

export function BldGuide({ backURL, onBack }: {
  backURL: string;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [method, setMethod] = useState<Method>("M2 法");
  const [selected, setSelected] = useState<GuideCase>();
  const [showModal, setShowModal] = useState(false);
  const compact = useSyncExternalStore(subscribeViewport, compactViewport);
  const trigger = useRef<HTMLButtonElement>(null);

  function closeModal() {
    setShowModal(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-content algorithm-library bld-guide-page">
      <header className="algorithm-library-heading">
        <a href={backURL} onClick={onBack} aria-label="BLD トレーナー"><ArrowLeft size={16} aria-hidden="true" /><span>BLD トレーナー</span></a>
        <h1>BLD ガイド</h1>
      </header>
      <div className="algorithm-filters">
        <label>解法
          <select value={method} onChange={(event) => {
            setMethod(event.target.value as Method);
            setSelected(undefined);
            setShowModal(false);
          }}>
            {methods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="algorithm-browser">
        <section className="algorithm-cases" aria-label="手順一覧">
          <div className="algorithm-list-heading"><h2>手順</h2></div>
          {compact && <details className="bld-guide-overview"><summary>解法の進め方</summary><Overview method={method} /></details>}
          <div className="algorithm-case-scroll">
            {groups[method].map((group) => (
              <section className="bld-guide-group" key={group.title} aria-label={group.title}>
                <h3>{group.title}</h3>
                <ul className="algorithm-case-list">
                  {group.cases.map((item) => (
                    <li key={item.title}>
                      <button type="button" aria-current={selected === item ? "true" : undefined}
                        aria-haspopup={compact ? "dialog" : undefined} onClick={(event) => {
                          trigger.current = event.currentTarget;
                          setSelected(item);
                          setShowModal(compact);
                        }}>
                        {item.title}<ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
        {!compact && (
          <section className="algorithm-detail">
            {selected ? <CaseDetail key={selected.title} item={selected} showTitle /> : <Overview method={method} />}
            {selected && <details className="bld-guide-overview"><summary>解法の進め方</summary><Overview method={method} /></details>}
          </section>
        )}
      </div>
      {compact && showModal && selected && (
        <Modal title={selected.title} onClose={closeModal} className="algorithm-modal">
          <CaseDetail key={selected.title} item={selected} />
        </Modal>
      )}
    </main>
  );
}

function CaseDetail({ item, showTitle }: { item: GuideCase; showTitle?: boolean }) {
  const { setup, alg, evenAlg } = item;
  const undo = setup ? new Alg(setup).invert().toString().replace(/2'(?= |$)/g, "2") : "";
  return (
    <div className="bld-guide-detail">
      {showTitle && <h2>{item.title}</h2>}
      <BldHighlightCube highlights={item.highlights} />
      {item.explanation && <p>{item.explanation}</p>}
      {alg ? (
        <dl className="bld-guide-steps">
          {setup !== undefined && <div><dt>セットアップ</dt><dd><code translate="no">{setup || "なし"}</code></dd></div>}
          <div><dt>{evenAlg ? "奇数番目" : setup === undefined ? "手順" : "基本手順"}</dt><dd><code translate="no">{alg}</code></dd></div>
          {evenAlg && <div><dt>偶数番目</dt><dd><code translate="no">{evenAlg}</code></dd></div>}
          {setup !== undefined && <div><dt>セットアップを戻す</dt><dd><code translate="no">{undo || "なし"}</code></dd></div>}
        </dl>
      ) : (
        <p>3D 図は対象ステッカーの配置例です。対象に合わせて <code>S</code> で基本形に移し、基本手順 <code>A</code> を回してから <code>S′</code> で戻します。</p>
      )}
    </div>
  );
}

function Overview({ method }: { method: Method }) {
  return (
    <div className="bld-guide-detail">
      <h2>{method}</h2>
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
