import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Alg } from "cubing/alg";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Copy, LayoutGrid, List } from "lucide-react";
import library from "../data/algorithm-library.json";
import { recallFaces } from "../lib/recallFaces";
import { harrisBaumCodes, harrisBaumRecognition, harrisBaumStickers, type HarrisBaumCode } from "../lib/zbllRecognition";
import { Modal } from "./Modal";
import { RecallCube, recallMasks, type RecallMask } from "./RecallCube";
import "./AlgorithmLibrary.css";

type SetName = keyof typeof library;
type Variant = { alg: string; setup: string; moves: number; generated?: boolean };
type Case = { name: string; group: string; variants: Variant[] };
type CaseView = "list" | "grid";
type CaseOrder = "group" | "name" | "recognition";

const sets = Object.keys(library) as SetName[];
const groupLabels: Record<string, string> = {
  "No Edges": "反転エッジなし",
  "上面と同色のエッジ 0 枚": "0枚（ドット）",
  "上面と同色のエッジ 2 枚": "2枚",
  "上面と同色のエッジ 4 枚": "4枚（クロス）",
  UBUL: "UB・UL",
  UFUB: "UF・UB",
  UFUL: "UF・UL",
};
const searchKey = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/[\s-]+/g, "");
const compareCaseNames = new Intl.Collator("en", { numeric: true }).compare;

const compactQuery = "(max-width: 760px)";
function subscribeToCompactViewport(onChange: () => void) {
  const media = matchMedia(compactQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const compactViewport = () => matchMedia(compactQuery).matches;

function groupCases(cases: Case[], key: (entry: Case) => string) {
  const groups = new Map<string, Case[]>();
  for (const entry of cases) {
    const group = key(entry);
    const members = groups.get(group);
    if (members) members.push(entry);
    else groups.set(group, [entry]);
  }
  return [...groups];
}

const CasePattern = memo(function CasePattern({
  setup, set, mask, showHarrisBaum,
}: { setup: string; set: SetName; mask?: RecallMask; showHarrisBaum: boolean }) {
  return (
    <RecallCube
      alg={new Alg(setup).invert().toString()}
      auf=""
      view="net"
      top="yellow"
      sides={4}
      rows={set === "F2L" ? 3 : 1}
      mask={mask}
      markStickers={showHarrisBaum ? harrisBaumStickers : undefined}
    />
  );
});

function CaseChoices({
  entries, view, set, mask, showHarrisBaum, compact, selected, onChoose,
}: {
  entries: Case[];
  view: CaseView;
  set: SetName;
  mask?: RecallMask;
  showHarrisBaum: boolean;
  compact: boolean;
  selected?: string;
  onChoose: (entry: Case, trigger: HTMLButtonElement) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [visiblePatterns, setVisiblePatterns] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (view !== "grid" || !list.current) return;
    const observer = new IntersectionObserver((items) => {
      const visible: string[] = [];
      for (const item of items) {
        if (!item.isIntersecting) continue;
        const target = item.target as HTMLElement;
        if (target.dataset.caseName) visible.push(target.dataset.caseName);
        observer.unobserve(target);
      }
      if (visible.length) setVisiblePatterns((previous) => new Set([...previous, ...visible]));
    }, { rootMargin: "180px" });
    list.current.querySelectorAll("[data-case-name]").forEach((thumbnail) => observer.observe(thumbnail));
    return () => observer.disconnect();
  }, [entries, view]);

  return (
    <ul className="algorithm-case-list" ref={list}>
      {entries.map((entry) => (
        <li key={entry.name}>
          <button
            type="button"
            aria-current={entry.name === selected || undefined}
            aria-haspopup={compact ? "dialog" : undefined}
            onClick={(event) => onChoose(entry, event.currentTarget)}
          >
            {view === "grid" && (
              <span className="algorithm-thumbnail" data-case-name={entry.name} aria-hidden="true">
                {visiblePatterns.has(entry.name) && <CasePattern setup={entry.variants[0].setup} set={set} mask={mask} showHarrisBaum={showHarrisBaum} />}
              </span>
            )}
            <span>{entry.name}</span>
            {view === "list" && <ChevronRight size={15} aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AlgorithmLibrary({
  practiceURL, onBack,
}: {
  practiceURL: string;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [set, setSet] = useState<SetName>("PLL");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CaseView>("list");
  const [caseOrder, setCaseOrder] = useState<CaseOrder>("group");
  const [codeFilter, setCodeFilter] = useState<HarrisBaumCode | "">("");
  const [codesBySetup, setCodesBySetup] = useState<Map<string, HarrisBaumCode | null>>();
  const [recognitionError, setRecognitionError] = useState(false);
  const [grayUnneeded, setGrayUnneeded] = useState(false);
  const [selectedCase, setSelectedCase] = useState("");
  const [floatingCase, setFloatingCase] = useState<Case>();
  const [shortFirst, setShortFirst] = useState(false);
  const modalTrigger = useRef<HTMLButtonElement>(null);
  const compact = useSyncExternalStore(subscribeToCompactViewport, compactViewport);
  const cases: Case[] = library[set];
  const order = set !== "ZBLL" && caseOrder === "recognition" ? "group" : caseOrder;
  const showHarrisBaum = order === "recognition";

  useEffect(() => {
    if (!showHarrisBaum || codesBySetup) return;
    let active = true;
    setRecognitionError(false);
    const setups = new Set(library.ZBLL.flatMap(({ variants }) => variants.map(({ setup }) => setup)));
    void Promise.all([...setups].map(async (setup) => {
      const faces = await recallFaces(new Alg(setup).invert().toString(), "yellow");
      return [setup, harrisBaumRecognition(faces).code] as const;
    })).then((entries) => {
      if (active) setCodesBySetup(new Map(entries));
    }).catch(() => {
      if (active) setRecognitionError(true);
    });
    return () => { active = false; };
  }, [showHarrisBaum, codesBySetup]);

  const groups = [...new Set(cases.map((entry) => entry.group))];
  const mask = grayUnneeded ? recallMasks[set] : undefined;
  const key = searchKey(query);
  const matches = useMemo(() => {
    const filtered = cases.filter((entry) =>
      (!group || entry.group === group) &&
      (!(showHarrisBaum && codeFilter) || codesBySetup?.get(entry.variants[0].setup) === codeFilter) &&
      searchKey(entry.name).includes(key),
    );
    return order === "name" ? filtered.sort((a, b) => compareCaseNames(a.name, b.name)) : filtered;
  }, [cases, group, key, order, showHarrisBaum, codeFilter, codesBySetup]);
  const current = matches.find(({ name }) => name === selectedCase) ?? matches[0];
  const sections = useMemo(() => {
    if (order === "name") return [{ name: "", entries: matches, subgroups: [] }];
    if (showHarrisBaum) {
      const byCode = new Map(groupCases(matches, (entry) => codesBySetup?.get(entry.variants[0].setup) ?? ""));
      return harrisBaumCodes.flatMap((name) => {
        const entries = byCode.get(name);
        if (!entries) return [];
        const shapes = groupCases(entries, (entry) => entry.group);
        return [{ name, entries, subgroups: shapes.length > 1 ? shapes : [] }];
      });
    }
    return groupCases(matches, (entry) => entry.group).map(([name, entries]) => ({
      name,
      entries,
      subgroups: set === "ZBLL" ? groupCases(entries, (entry) => entry.name.split(" ", 2)[1]) : [],
    }));
  }, [matches, order, set, showHarrisBaum, codesBySetup]);
  const choiceProps = {
    view, set, mask, showHarrisBaum, compact,
    selected: compact ? selectedCase : current?.name,
    onChoose: chooseCase,
  };

  function changeSet(value: SetName) {
    setSet(value);
    setGroup("");
    setCodeFilter("");
    setQuery("");
    setSelectedCase("");
  }

  function chooseCase(entry: Case, trigger: HTMLButtonElement) {
    setSelectedCase(entry.name);
    if (compact) {
      modalTrigger.current = trigger;
      setFloatingCase(entry);
    }
  }

  function closeDetail() {
    setFloatingCase(undefined);
    modalTrigger.current?.focus({ preventScroll: true });
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-content algorithm-library">
      <header className="algorithm-library-heading">
        <a href={practiceURL} onClick={onBack} aria-label="練習に戻る">
          <ArrowLeft size={16} aria-hidden="true" /><span>練習</span>
        </a>
        <h1>アルゴリズム集</h1>
      </header>

      <div className="algorithm-filters">
        <label>
          セット
          <select value={set} onChange={(event) => changeSet(event.target.value as SetName)}>
            {sets.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        {groups.length > 1 && (
          <label>
            {set === "OLL" ? "上面と同色のエッジ" : showHarrisBaum ? "上面の形" : "グループ"}
            <select value={group} onChange={(event) => setGroup(event.target.value)}>
              <option value="">すべて</option>
              {groups.map((name) => <option key={name} value={name}>{groupLabels[name] ?? name}</option>)}
            </select>
          </label>
        )}
        <label className="algorithm-search">
          ケース名
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {groups.length > 1 && (
          <label>
            ケースの並び順
            <select value={order} onChange={(event) => setCaseOrder(event.target.value as CaseOrder)}>
              <option value="group">グループ別</option>
              <option value="name">{set === "PLL" ? "名前順" : "番号順"}</option>
              {set === "ZBLL" && <option value="recognition">Harris/Baum</option>}
            </select>
          </label>
        )}
        {showHarrisBaum ? (
          <label className="algorithm-code-filter">
            判別コード
            <select value={codeFilter} onChange={(event) => setCodeFilter(event.target.value as HarrisBaumCode | "")}>
              <option value="">すべて</option>
              {harrisBaumCodes.map((code) => <option key={code}>{code}</option>)}
            </select>
          </label>
        ) : (
          <label className="algorithm-mask-setting" title={recallMasks[set] ? undefined : "このセットの図は表示中の色をすべて使います"}>
            <input
              type="checkbox"
              checked={!!mask}
              disabled={!recallMasks[set]}
              onChange={(event) => setGrayUnneeded(event.target.checked)}
            />
            <span>判別に不要な部分を灰色にする</span>
          </label>
        )}
      </div>

      <div className="algorithm-browser" data-view={view}>
        <section className="algorithm-cases" aria-label="ケース一覧">
          <div className="algorithm-list-heading">
            <h2>ケース <small role="status">{matches.length}件</small></h2>
            <div className="segmented algorithm-view" role="group" aria-label="ケースの表示">
              <button type="button" className={view === "list" ? "selected" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}>
                <List size={15} aria-hidden="true" />リスト
              </button>
              <button type="button" className={view === "grid" ? "selected" : ""} aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                <LayoutGrid size={15} aria-hidden="true" />グリッド
              </button>
            </div>
            {showHarrisBaum && <small className="algorithm-code-legend">C 同色・A 隣接色・O 対面色</small>}
          </div>

          <div className="algorithm-case-scroll" key={`${set}-${order}`}>
            {sections.map(({ name, entries, subgroups }) => (
              <div className="algorithm-case-group" key={name}>
                {name && groups.length > 1 && (
                  <h3>{groupLabels[name] ?? name}{showHarrisBaum && <small>{entries.length}件</small>}</h3>
                )}
                {subgroups.length ? (
                  subgroups.map(([subgroup, members]) => (
                    <div className="algorithm-case-subgroup" key={subgroup}>
                      <h4>{subgroup}</h4>
                      <CaseChoices entries={members} {...choiceProps} />
                    </div>
                  ))
                ) : (
                  <CaseChoices entries={entries} {...choiceProps} />
                )}
              </div>
            ))}
            {showHarrisBaum && !codesBySetup ? (
              <p className="algorithm-empty" role="status">
                {recognitionError ? "判別コードを読み込めませんでした。並び順を切り替えて再試行してください。" : "判別コードを読み込み中…"}
              </p>
            ) : !matches.length && <p className="algorithm-empty" role="status">該当するケースがありません。</p>}
          </div>
        </section>

        {!compact && current && (
          <section className="algorithm-detail" aria-label={current.name} key={current.name}>
            <div className="algorithm-detail-heading">
              <h2>{current.name}</h2>
              <SourceLink set={set} />
            </div>
            <AlgorithmDetail entry={current} set={set} mask={mask} codesBySetup={showHarrisBaum ? codesBySetup : undefined} shortFirst={shortFirst} setShortFirst={setShortFirst} />
          </section>
        )}
      </div>

      {floatingCase && (
        <Modal title={floatingCase.name} onClose={closeDetail} className="algorithm-modal">
          <AlgorithmDetail entry={floatingCase} set={set} mask={mask} codesBySetup={showHarrisBaum ? codesBySetup : undefined} shortFirst={shortFirst} setShortFirst={setShortFirst} />
          <div className="algorithm-modal-source"><SourceLink set={set} /></div>
        </Modal>
      )}

      <footer className="algorithm-credit">
        手順の収録元 <a href="https://github.com/tao-yu/Alg-Trainer/blob/master/js/alg_list.js">Alg-Trainer <ArrowUpRight size={12} aria-hidden="true" /></a>
      </footer>
    </main>
  );
}

function SourceLink({ set }: { set: SetName }) {
  return (
    <a
      className="algorithm-source"
      href={`https://www.speedcubedb.com/a/3x3/${set}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`${set}をSpeedCubeDBで見る`}
    >
      SpeedCubeDB <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

function AlgorithmDetail({
  entry, set, mask, codesBySetup, shortFirst, setShortFirst,
}: {
  entry: Case;
  set: SetName;
  mask?: RecallMask;
  codesBySetup?: ReadonlyMap<string, HarrisBaumCode | null>;
  shortFirst: boolean;
  setShortFirst: (value: boolean) => void;
}) {
  const [selection, setSelection] = useState("");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const variants = shortFirst
    ? [...entry.variants].sort((a, b) => a.moves - b.moves)
    : entry.variants;
  const primary = entry.variants[0];
  const active = variants.find(({ alg }) => alg === selection) ?? (codesBySetup ? primary : variants[0]);
  const recognitionCode = codesBySetup?.get(active.setup);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyError(false);
    } catch {
      setCopied("");
      setCopyError(true);
    }
  }

  return (
    <>
      <div className="algorithm-pattern">
        <div className="algorithm-illustration">
          <CasePattern setup={active.setup} set={set} mask={mask} showHarrisBaum={!!codesBySetup} />
        </div>
        <div className="algorithm-setup">
          <div className="algorithm-block-heading">
            <h3>セットアップ</h3>
            <button type="button" className="icon-button" aria-label="セットアップをコピー" title="セットアップをコピー" onClick={() => void copy(active.setup, "セットアップ")}>
              {copied === "セットアップ" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
          <code>{active.setup}</code>
          <small>黄色を上、青を手前に</small>
          {recognitionCode && <small>Harris/Baum <strong>{recognitionCode}</strong></small>}
          {recognitionCode === null && <small>このセットアップはHarris/Baum判別の対象外です。</small>}
        </div>
      </div>

      <div className="algorithm-variants">
        <div className="algorithm-block-heading">
          <h3>手順 <small>{variants.length}件</small></h3>
          <div className="algorithm-variant-actions">
            <select aria-label="手順の並び順" value={shortFirst ? "short" : "source"} onChange={(event) => setShortFirst(event.target.value === "short")}>
              <option value="source">収録順</option>
              <option value="short">手数の少ない順</option>
            </select>
            <button type="button" className="icon-button" aria-label="選択した手順をコピー" title="選択した手順をコピー" onClick={() => void copy(active.alg, "手順")}>
              {copied === "手順" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div role="status" className={copyError ? "muted" : "sr-only"}>
          {copyError ? "コピーできませんでした。" : copied && `${copied}をコピーしました。`}
        </div>
        <ul className="algorithm-variant-list">
          {variants.map((variant) => (
            <li key={variant.alg}>
              <button
                type="button"
                aria-pressed={active.alg === variant.alg}
                onClick={() => setSelection(variant.alg)}
              >
                <code>{variant.alg}</code>
                <small>{variant.generated && <span>自動生成</span>}{variant.moves}手</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
