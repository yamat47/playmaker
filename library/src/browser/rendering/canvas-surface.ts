import {
  computeFieldMetrics,
  Disposable,
  type EditorOverlay,
  FieldGeometry,
  type FieldPosition,
  type ImageExportOptions,
  PLAYER_RADIUS_YARDS,
  resolveImageExportSize,
  type SceneData,
  toDisposable,
  WAYPOINT_HANDLE_RADIUS_YARDS,
} from "../../common/index.js";
import { FIELD_FONT_FAMILY } from "../theme/field-font.js";
import { createThemeReader } from "../theme/theme-reader.js";
import type { ThemeReader } from "../theme/tokens.js";
import { FieldRenderer, type FieldTheme } from "./field-renderer.js";
import { LineRenderer, type LineTheme } from "./line-renderer.js";
import { PlayerRenderer, type PlayerTheme } from "./player-renderer.js";

const EMPTY_OVERLAY: EditorOverlay = { kind: "none" };

/**
 * Canvas のライフサイクル・解像度（DPR）・リサイズを管理し、
 * 「描画モデル + 選択 overlay」を 1 フレームへ合成描画する土台。
 * 何を描くか（プレビュー合成・選択強調）の判断は common(EditorController) が持ち、
 * ここは渡されたシーンを描くだけ（Model–View 分離）。
 */
export class CanvasSurface extends Disposable {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fieldRenderer = new FieldRenderer();
  private readonly lineRenderer = new LineRenderer();
  private readonly playerRenderer = new PlayerRenderer();
  private data: SceneData;
  private overlay: EditorOverlay = EMPTY_OVERLAY;
  // 直近 render で確定する。constructor 末尾の resize()→render() で必ず初期化される。
  private geometry!: FieldGeometry;

  constructor(parent: HTMLElement, data: SceneData) {
    super();
    this.data = data;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "playmaker-canvas";
    parent.appendChild(this.canvas);
    this._register(toDisposable(() => this.canvas.remove()));

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: 2D canvas context を取得できませんでした。");
    }
    this.ctx = ctx;

    const observer = new ResizeObserver(() => this.resize());
    observer.observe(parent);
    this._register(toDisposable(() => observer.disconnect()));

    this.resize();
    this.renderWhenFontReady();
  }

  /**
   * 同梱フォント（@font-face "Playmaker Saira"）は CSS パース後に非同期で実体化する。
   * 初回フレームは即描画（フォント未ロードなら sans-serif で代替）し、ロード完了後に
   * 1 回だけ再描画して数字・ラベルを同梱フォントへ差し替える＝白画面を出さない。
   * 既にロード済み（キャッシュ）なら初回 render で完成しているので何もしない。
   */
  private renderWhenFontReady(): void {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const fontSpec = `700 1em ${FIELD_FONT_FAMILY}`;
    if (!fonts || fonts.check(fontSpec)) {
      return;
    }
    fonts.load(fontSpec).then(
      () => {
        if (!this.isDisposed) {
          this.render();
        }
      },
      () => {
        // 代替フォントのまま描画を続ける（ロード失敗でも図は成立する）。
      },
    );
  }

  /** テーマ変数は描くたびに読み直すので、ホストが変数を変えたあとに呼べば反映される。 */
  refresh(): void {
    this.render();
  }

  /** 描画モデルと選択 overlay を差し替えて再描画する（編集のたびに呼ばれる）。 */
  setScene(data: SceneData, overlay: EditorOverlay): void {
    this.data = data;
    this.overlay = overlay;
    this.render();
  }

  /**
   * Canvas クライアント座標（マウスイベントの clientX/Y）をヤード空間へ逆変換する。
   * 入力 → コマンドの土台。geometry が唯一の座標規約なのでここを通す。
   */
  clientToYard(clientX: number, clientY: number): FieldPosition {
    const rect = this.canvas.getBoundingClientRect();
    return this.geometry.fromCanvas({ x: clientX - rect.left, y: clientY - rect.top });
  }

  /** コンテナサイズと DPR に合わせてバックバッファを再構成し再描画する。 */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.host;
    this.canvas.width = Math.max(1, Math.round(clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    // 以降は CSS px 空間で描く（geometry も CSS px で算出）。
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  /**
   * 指定したプレー図を PNG（Blob）として書き出す。
   * - data はコミット済みスナップショット想定。選択強調・waypoint ハンドル・
   *   作図中プレビューといった編集補助は drawPlay が描かない構図なので構造的に
   *   含まれない（ツールバー/パネルは HTML 兄弟要素で canvas 外＝元から非対象）。
   * - 配色は画面と同じ host の --playmaker-* を読むためオンスクリーンと一致する。
   * - 出力寸法はフィールド窓のアスペクト比なのでレターボックス余白は出ない。
   */
  exportToPngBlob(data: SceneData, options?: ImageExportOptions): Promise<Blob> {
    const { width, height } = resolveImageExportSize(data.field.zone, options);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Playmaker: エクスポート用 2D canvas context を取得できませんでした。");
    }
    const geometry = new FieldGeometry(width, height, data.field);
    this.drawPlay(ctx, geometry, data, this.readTheme());
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Playmaker: PNG への変換に失敗しました。"));
        }
      }, "image/png");
    });
  }

  private render(): void {
    const { clientWidth, clientHeight } = this.host;
    this.geometry = new FieldGeometry(clientWidth, clientHeight, this.data.field);
    const read = this.readTheme();
    this.drawPlay(this.ctx, this.geometry, this.data, read);
    this.drawOverlay(read);
  }

  /**
   * プレー本体（フィールド→線→選手）を 1 フレーム描く。編集 overlay は含めない
   * ＝ ライブ描画と PNG エクスポートで同一構図を共有し「export = 画面 − 編集 UI」を
   * 構造で保証する（PRD 5.7）。線は選手の下に敷く＝起点（選手位置）がマーカーで
   * 隠れ、線の根元が綺麗に見える。
   */
  private drawPlay(
    ctx: CanvasRenderingContext2D,
    geometry: FieldGeometry,
    data: SceneData,
    read: ThemeReader,
  ): void {
    const { field, line, player } = toRendererThemes(read);
    // 寸法トークンは W/U から導く純計算。1 フレーム 1 回に束ね、各レンダラへ渡す。
    const metrics = computeFieldMetrics(geometry.fieldPixelWidth, geometry.scale);
    this.fieldRenderer.draw(ctx, geometry, field, metrics);
    this.lineRenderer.draw(ctx, geometry, data.lines, data.players, line, metrics);
    this.playerRenderer.draw(ctx, geometry, data.players, player, metrics);
  }

  /**
   * 選択強調と waypoint ハンドルを最前面に描く（編集中の視認用）。
   * 位置計算は common のジオメトリに委譲し、ここは色と図形を置くだけ。
   *
   * 選択色は対象の「外」に置き、対象の上には重ねない（選手はマーカーの外周リング、線は
   * waypoint/終点のハンドル）。線色はユーザーがパレットで選ぶので、上塗りすると線色と
   * 混ざって何色の線なのか読めなくなる。
   */
  private drawOverlay(read: ThemeReader): void {
    switch (this.overlay.kind) {
      case "none":
        return;
      case "player":
        this.drawSelectedPlayer(this.overlay.playerId, read("selection"));
        return;
      case "line":
        this.drawLineHandles(this.overlay, read("selection"), read("selectionOutline"));
        return;
    }
  }

  private drawSelectedPlayer(playerId: string, selectionColor: string): void {
    const player = this.data.players.find((p) => p.id === playerId);
    if (!player) {
      return;
    }
    const { x, y } = this.geometry.toCanvas(player.position);
    const r = PLAYER_RADIUS_YARDS * this.geometry.scale + 4;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = selectionColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private drawLineHandles(
    handles: Extract<EditorOverlay, { kind: "line" }>,
    selectionColor: string,
    outlineColor: string,
  ): void {
    // アイコンは hit 許容（WAYPOINT_HANDLE_RADIUS_YARDS）の一部だけを描く。フルに
    // 描くとマーカー並みに大きいので小さく出し、掴みやすさは hit 許容側に委ねる。
    const handleHalf = Math.max(3, 0.45 * WAYPOINT_HANDLE_RADIUS_YARDS * this.geometry.scale);
    // 現在の path（beginPath 済み）を、ハンドル共通の塗りと縁取りで仕上げる。
    const paintHandle = () => {
      this.ctx.fillStyle = selectionColor;
      this.ctx.fill();
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = outlineColor;
      this.ctx.stroke();
    };
    for (const wp of handles.waypointHandles) {
      const { x, y } = this.geometry.toCanvas(wp);
      this.ctx.beginPath();
      this.ctx.rect(x - handleHalf, y - handleHalf, handleHalf * 2, handleHalf * 2);
      paintHandle();
    }

    // 終点ハンドルは waypoint（四角）と区別できるよう円で描く（先端の掴み所を明示）。
    const { x, y } = this.geometry.toCanvas(handles.endpointHandle);
    this.ctx.beginPath();
    this.ctx.arc(x, y, handleHalf + 1, 0, Math.PI * 2);
    paintHandle();
  }

  // 大きさとテーマ変数は、canvas を置いた要素から読む。
  private get host(): HTMLElement {
    return this.canvas.parentElement ?? this.canvas;
  }

  private readTheme(): ThemeReader {
    return createThemeReader(this.host);
  }
}

function toRendererThemes(read: ThemeReader): {
  field: FieldTheme;
  line: LineTheme;
  player: PlayerTheme;
} {
  return {
    field: {
      fieldColor: read("fieldGrass"),
      stripeColor: read("fieldStripe"),
      oobColor: read("fieldOob"),
      endzoneColor: read("fieldEndzone"),
      lineColor: read("fieldLine"),
      goalLineColor: read("fieldGoalLine"),
      numberColor: read("fieldNumber"),
      pylonColor: read("fieldPylon"),
      goalpostColor: read("fieldGoalpost"),
    },
    line: {
      routeColor: read("lineRoute"),
      blockColor: read("lineBlock"),
      motionColor: read("lineMotion"),
    },
    player: {
      fillColor: read("playerFill"),
      strokeColor: read("playerStroke"),
      labelColor: read("playerLabel"),
    },
  };
}
