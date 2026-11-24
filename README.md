# SPLIT — Cube Timer

PCとモバイルで使える、ローカル保存・アカウント同期対応のキューブタイマーです。React、TypeScript、Vite、cubing.js、Supabase Auth、Google Drive APIで実装しています。
VIBECODED

## 起動

Node.js 22.3以上を使用します。

```sh
npm ci
npm run dev
```

接続設定がなくても、計測・スクランブル・統計・練習機能は使えます。記録はIndexedDBに保存されます。架空の記録やデモ用アカウントは含めていません。

```sh
npm test
npm run build
npm run preview
```

## メールでのログインを有効にする

既存の Supabase プロジェクトの URL と公開キーを、`.env.local` の `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` に設定します。Supabase Authentication で Email を有効にし、Site URL と Redirect URLs に利用する URL を登録します。メール登録、ログイン、パスワード再設定には Supabase Auth を使います。計測履歴は端末に保存され、Drive を接続した場合は手動で同期できます。

## 同期を有効にする

1. Google Cloud のプロジェクトで [Google Drive API](https://developers.google.com/workspace/drive/api/quickstart/js) を有効にします。
2. Google Auth Platform で同意画面を設定し、テスト中は利用する Google アカウントをテストユーザーに追加します。
3. ウェブアプリケーション用の OAuth クライアント ID を作成し、「承認済みの JavaScript 生成元」に実際のオリジンを登録します。開発時は `http://localhost:5173`、公開時は `https://example.com` のように、パスを含めずに指定します。
4. `.env.example` を `.env.local` にコピーし、`VITE_GOOGLE_CLIENT_ID` にクライアント ID を設定します。開発サーバーを再起動するか、設定した状態でビルドします。
5. 「アカウントと同期」で Google Drive を開き、Google でログインしてから「同期」または「今すぐ同期」を押します。別の端末でも同じ Google アカウントでログインし、同期します。

同期すると、記録の追加・編集・削除を Google Drive の[アプリ専用領域](https://developers.google.com/workspace/drive/api/guides/appdata)に保存し、他の端末で保存した変更を取り込みます。別々の記録は両方残ります。同じ記録を複数端末で編集した場合は、論理時刻と操作IDで採用する変更を決めます。すべての操作は履歴に残り、端末ごとに異なる結果にはなりません。

ゲストの記録は「ゲストの記録を取り込む」で追加できます。アプリのアカウントと Google Drive は個別に接続できます。Drive を接続している間は Google アカウントの履歴が表示され、接続を解除するとアプリのアカウントまたはゲストの履歴に戻ります。ページを開き直したときや Google の認証期限が切れたときは、次回の同期で Google の認証画面が開くことがあります。

端末にあるアカウントの記録を Drive に移すには、Drive の接続を解除した状態でアプリにログインし、設定画面で JSON バックアップを保存します。旧版で Supabase にだけ残っている記録は、旧版で同期してから JSON に保存してください。Drive を接続して JSON を取り込んだあと、同期すると Drive に保存できます。

## 公開

Vercel、Cloudflare Pages、GitHub Pagesで静的サイトとして公開できます。Google のクライアント ID はビルド時に設定します。

### Vercel / Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.3以上
- 環境変数: `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_GOOGLE_CLIENT_ID`
- `VITE_BASE_PATH`: `/`

リポジトリを接続してデプロイします。公開先のオリジンを Google の OAuth クライアントに登録してください。独自ドメインにも対応できます。公開の実行や外部プロジェクトの作成はこのリポジトリには含みません。

### GitHub Pages

プロジェクトサイトなら `VITE_BASE_PATH=/リポジトリ名/` を設定してビルドします。`dist` をPagesへ配信してください。ルートドメインやカスタムドメインなら `/` のままです。クライアントルーターを使用していないため、画面の切り替えにサーバー側のrewriteは不要です。

## キーボードショートカット

1〜4でタイマー、統計、セッション、練習を開きます。タイマーではRでスクランブルを再生成します。Recall TrainerではSpaceで開始・一時停止、Nまたは右矢印で次のケース、Aで答えを表示・非表示にします。入力欄やダイアログを操作している間はショートカットを実行しません。

## iPhoneとオフライン

SafariでHTTPSの公開URLを開き、共有メニューから「ホーム画面に追加」を選択します。アイコン、manifest、Service Workerを同梱しています。初回にオンラインでキャッシュが完了すると、オフラインでもスクランブル生成・計測・保存ができます。通信が戻ったら「同期」を押して、端末内の変更を Google Drive に保存できます。アプリの更新で計測を中断しないよう、Service Workerの即時切り替えは行いません。

Safariのプライベートブラウズやストレージ消去では記録を失う可能性があります。設定画面からJSONバックアップを保存できます。端末やブラウザによるストレージ保持の保証はありません。

## Recall Trainer

「練習」からRecall Trainerを開けます。PLL 21、OLL 57、F2L 41、ZBLL 472、COLL 40、WV 27、VLS 216ケースを収録しています。WVとVLSは右手前のスロットで練習できるようにそろえています。VLSにはWV相当のケースも含まれます。表示は3D、上面、上面と側面から選べます。側面表示では、表示する面数と、判別に不要な部分を灰色にするかを設定できます。自動切り替えの間隔は1〜10秒で、練習設定はブラウザに保存されます。

ケースは手順の逆操作で生成し、ランダムAUFを有効にするとU面を回します。Spaceで開始・一時停止、Nまたは右矢印で次のケース、Aで答えを表示できます。実物キューブの状態は検出しません。ケースデータはMITライセンスのAlg-Trainerをもとにしています。

## 対応機能

- Space、Enterまたはタッチ操作。小数点以下3桁の保存と2桁・3桁の表示。
- WCA全17種目のスクランブル。複数目隠しでは指定個数の独立したスクランブルを生成。
- キューブの6面展開図と、その他パズルの2D展開図。
- ヒントを1回クリックすると、ボタンの近くに探索結果を表示します。対象面とクロス・X-crossの選択は設定画面から変更できます。6面のクロス探索に対応します。X-crossは指定面と固定のF2Lペア1組を対象に最大12手・10秒で探索。探索時間の上限を超えた場合はエラーを表示。手順の3D再生。
- mo3、ao5、ao12、ao50、ao100、ao500、ao1000、各指標のベスト、単発ベスト、タイム推移。
- セッション作成・変更・削除、記録コメント、手入力、+2、DNF、区間計測。
- 15秒インスペクション。15秒以上で+2、17秒以上でDNF。8秒・12秒の通知音。目隠し種目・最少手数は対象外。
- 最少手数の手数入力とmo3。複数目隠しの成功数・挑戦数・時間入力、ポイントとタイムによる順位付け。
- テーマ、アクセント、長押し時間、表示桁数、計測中の表示、展開図の表示設定。
- JSONのバックアップと復元、csTimer JSONの取り込み、CSV出力。csTimerの複数目隠し記録は対象外です。
- メールでの登録・ログイン・パスワード再設定と、Google Drive を使った端末間の手動同期。

aoNは上下それぞれ `ceil(N × 5%)` 件を除外し、残った値の平均を計算します。mo3では除外しません。残った値にDNFがある場合は平均もDNFです。ao50以降は練習用の指標で、WCAの公式競技形式ではありません。集計画面の単純平均はDNFを除外します。

スクランブルは[cubing.jsの種目別API](https://js.cubing.net/cubing/scramble/)を使用します。必要な種目ではrandom-state生成を行います。公式大会での利用には[WCA規則4b](https://www.worldcubeassociation.org/regulations/#4b)に従った公式スクランブルプログラムが必要です。このアプリは大会用スクランブルの認定・配布を代替しません。

ブラウザの時刻計測APIで計測しており、入力デバイスの遅延やOSによる制約があります。3桁表示は公式機器と同じ計測精度の保証ではありません。区間計測と音は練習用です。

## 検証

- `npm test`: 平均、DNF、+2、時刻書式、インスペクション、データ検証、csTimer取り込み、全6面のクロス・X-cross解の検証。
- `node tests/browser.mjs`: Chromeで計測、編集、セッション、保存、統計、ヒント、PC・タブレット・モバイル表示を検証。先に `npm run build` と `npm run preview` を実行します。開発サーバーで確認するときは `TEST_URL=http://127.0.0.1:5173` を指定します。
- `node tests/events.mjs`: 全17種目の生成・展開図の読み込みを確認。
- `node tests/interactions.mjs`: 本番PWAのオフライン起動、タッチ計測、インスペクションの+2、区間計測、削除、320px幅での表示を確認。
- `node tests/hint-popover.mjs`: ヒントのワンクリック表示、設定の保持、ポップオーバーの配置と閉じる操作を確認。
- `docs/screenshots/`: 自動操作で作成した記録を含む検証画面。利用者の初期データには含めません。

実際の Supabase Auth と Google Drive への接続、iPhone実機でのインストール、外部へのデプロイは接続情報・対象環境がないため未検証です。Stackmat、Bluetoothスマートキューブ、csTimerの全スクランブルカテゴリ・全カスタマイズは実装していません。

## ライセンス

cubing.jsはMPL-2.0またはGPL-3.0-or-laterで提供されています。本アプリではMPL-2.0として利用し、改変せずにバンドルしています。詳細は `THIRD_PARTY_NOTICES.md` を参照してください。
