import { Maximize2 } from "lucide-react";
import { auth, type useAuth } from "../../lib/auth";
import { googleClientId } from "../../lib/cloud";
import type { EventId, Solve } from "../../lib/model";
import type { useStore } from "../../lib/useStore";
import type { useTimerSession } from "../../pages/timer/useTimerSession";
import { Account } from "../Account";
import { DriveSync } from "../DriveSync";
import { Modal } from "../Modal/Modal";
import { SessionForm } from "../SessionForm";
import { Settings } from "../Settings/Settings";
import { SolveForm } from "../SolveForm/SolveForm";

export type ModalKind = "settings" | "account" | "manual" | "help" | "newSession" | null;
export type AccountPanel = "login" | "drive";

export function AppDialogs({
  store, account, modal, setModal, accountPanel, setAccountPanel,
  editing, setEditing, event, timer, setSelected, fullscreen,
}: {
  store: ReturnType<typeof useStore>;
  account: ReturnType<typeof useAuth>;
  modal: ModalKind;
  setModal: (modal: ModalKind) => void;
  accountPanel: AccountPanel;
  setAccountPanel: (panel: AccountPanel) => void;
  editing: Solve | null;
  setEditing: (solve: Solve | null) => void;
  event: EventId;
  timer: Pick<ReturnType<typeof useTimerSession>, "pending" | "timed" | "newSolve" | "persistSolve" | "removeSolve">;
  setSelected: (id: string) => void;
  fullscreen: () => Promise<void>;
}) {
  const { pending, timed, newSolve, persistSolve, removeSolve } = timer;
  return (
    <>
      {modal === "settings" && (
        <Modal title="設定" onClose={() => setModal(null)}>
          <Settings
            value={store.settings}
            save={(s) => store.commit("settings", "settings", s)}
            ops={store.ops}
            importOps={store.importOps}
          />
        </Modal>
      )}
      {modal === "account" && (
        <Modal title="アカウントと同期" onClose={() => setModal(null)}>
          <div className="stack">
            {auth && googleClientId && (
              <div className="segmented" role="group" aria-label="アカウントと同期">
                <button
                  type="button"
                  className={accountPanel === "login" ? "selected" : ""}
                  aria-pressed={accountPanel === "login"}
                  onClick={() => setAccountPanel("login")}
                >
                  アカウント
                </button>
                <button
                  type="button"
                  className={accountPanel === "drive" ? "selected" : ""}
                  aria-pressed={accountPanel === "drive"}
                  onClick={() => setAccountPanel("drive")}
                >
                  Google Drive
                </button>
              </div>
            )}
            {accountPanel === "login" ? (
              <Account
                user={account.user}
                ready={account.ready}
                recovery={account.recovery}
                doneRecovery={() => account.setRecovery(false)}
              />
            ) : (
              <DriveSync
                user={store.driveUser}
                signIn={store.signIn}
                signOut={store.signOut}
                loaded={store.loaded}
                error={store.error}
                importGuest={store.importGuest}
                sync={store.sync}
                status={store.syncStatus}
              />
            )}
          </div>
        </Modal>
      )}
      {(modal === "manual" || editing) && (
        <Modal
          title={
            editing ? "記録を編集" : pending ? "結果を記録" : "タイムを入力"
          }
          onClose={() => {
            setModal(null);
            setEditing(null);
          }}
        >
          <SolveForm
            key={editing?.id ?? pending?.id ?? "new"}
            event={editing?.event ?? event}
            solve={editing ?? pending ?? undefined}
            save={async (data) => {
              const s = {
                ...(editing ?? pending ?? newSolve(0, "OK", [])),
                ...data,
              };
              if (editing) {
                await store.commit("solve", s.id, s);
              } else await persistSolve(s);
              setModal(null);
              setEditing(null);
            }}
            remove={
              editing
                ? async () => {
                    await removeSolve(editing);
                    setEditing(null);
                  }
                : undefined
            }
          />
        </Modal>
      )}
      {pending && !timed && !modal && (
        <div className="pending-result">
          <span>結果の入力が必要です。</span>
          <button onClick={() => setModal("manual")}>結果を入力</button>
        </div>
      )}
      {modal === "newSession" && (
        <Modal title="新規セッション" onClose={() => setModal(null)}>
          <SessionForm
            initialEvent={event}
            onSave={async (s) => {
              await store.commit("session", s.id, s);
              setSelected(s.id);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="操作ガイド" onClose={() => setModal(null)}>
          <div className="help-content">
            <dl>
              <dt>
                <kbd>Space</kbd> / タップ
              </dt>
              <dd>
                長押しして準備完了を待ち、離すと計測を開始します。計測中に押すと停止します。
              </dd>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>
                計測中はDNFとして保存します。インスペクション中は中止します。
              </dd>
              <dt>ショートカット</dt>
              <dd>
                1〜4でタイマー・統計・セッション・ツールを開きます。タイマーではRでスクランブルを再生成し、Hでヒントを開閉します。Recall
                TrainerではSpaceで開始・一時停止、Nまたは右矢印で次のケース、Aで答えを表示・非表示にします。
              </dd>
              <dt>インスペクション</dt>
              <dd>
                設定で有効にできます。15秒以上で+2、17秒以上でDNFになります。目隠し種目と最少手数には適用しません。
              </dd>
              <dt>区間計測</dt>
              <dd>
                区間数を設定すると、押すたびに区間を記録し、最後の区間で停止します。
              </dd>
              <dt>平均</dt>
              <dd>
                ao5・ao12などは上下5%を切り上げて除外します。mo3は3回すべての平均です。残った記録にDNFがある場合は平均もDNFです。
              </dd>
              <dt>スクランブル</dt>
              <dd>
                cubing.jsのWCA種目別生成を使用しています。公式大会のスクランブル配布・認定を代替するものではありません。
              </dd>
              <dt>タイマーの精度</dt>
              <dd>
                小数点以下3桁で保存します。ブラウザと入力機器の遅延があるため、公式計測機器と同じ精度を保証するものではありません。
              </dd>
            </dl>
            <button onClick={() => void fullscreen()}>
              <Maximize2 size={16} />
              全画面表示
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
