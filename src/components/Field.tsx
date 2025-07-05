import { useRef, useEffect } from 'react';

interface FieldProps {
  width?: number;
  height?: number;
}

const Field = ({ width = 800, height = 600 }: FieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // フィールドの緑色背景
    ctx.fillStyle = '#4a7c59';
    ctx.fillRect(0, 0, width, height);

    // フィールドの寸法計算
    // 実際のフィールド: 幅53.3ヤード、表示範囲30ヤード（35-65ヤード）
    const fieldWidthYards = 53.3;
    const displayYards = 30;
    const yardHeight = height / displayYards;
    const yardWidth = width / fieldWidthYards;

    // 単位変換（1ヤード = 3フィート = 36インチ）
    const inchToPixel = yardWidth / 36;
    const footToPixel = yardWidth / 3;

    // サイドラインの位置（実際のフィールドに合わせて）
    const sidelineLeft = 0;
    const sidelineRight = width;

    // サイドライン（4インチ幅）
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = inchToPixel * 4;
    ctx.beginPath();
    ctx.moveTo(sidelineLeft, 0);
    ctx.lineTo(sidelineLeft, height);
    ctx.moveTo(sidelineRight, 0);
    ctx.lineTo(sidelineRight, height);
    ctx.stroke();

    // 5ヤードごとの横線（35, 40, 45, 50, 55, 60, 65）
    // NCAAルール: サイドラインまで引く
    const lineInset = 0;
    ctx.lineWidth = inchToPixel * 4; // 4インチ幅
    for (let yard = 35; yard <= 65; yard += 5) {
      const y = (65 - yard) * yardHeight;
      ctx.beginPath();
      ctx.moveTo(sidelineLeft + lineInset, y);
      ctx.lineTo(sidelineRight - lineInset, y);
      ctx.stroke();
    }

    // 50ヤードラインの強調（他の線と同じ4インチ幅）
    ctx.lineWidth = inchToPixel * 4;
    ctx.strokeStyle = '#ffffff';
    const fiftyYardY = 15 * yardHeight; // 65-50=15
    ctx.beginPath();
    ctx.moveTo(sidelineLeft + lineInset, fiftyYardY);
    ctx.lineTo(sidelineRight - lineInset, fiftyYardY);
    ctx.stroke();

    // 1ヤードマーク（フィールド端とハッシュマーク）
    ctx.lineWidth = inchToPixel * 4; // 4インチ幅
    const markLength = inchToPixel * 24; // 24インチ（2フィート）長

    // フィールド端のマーク位置（4インチ内側）
    const leftMarkStart = sidelineLeft + inchToPixel * 4;
    const leftMarkEnd = leftMarkStart + markLength;
    const rightMarkEnd = sidelineRight - inchToPixel * 4;
    const rightMarkStart = rightMarkEnd - markLength;

    // ハッシュマークの位置（NCAAルール: サイドラインから60フィート）
    // フィールド幅160フィート、ハッシュ間40フィート
    const hashInsetFeet = 60; // 60フィート
    const hashInset = footToPixel * hashInsetFeet;
    // ハッシュマークは中心線上に配置
    const hashLeftX = hashInset;
    const hashRightX = width - hashInset;
    const hashLeftStart = hashLeftX - markLength / 2;
    const hashLeftEnd = hashLeftStart + markLength;
    const hashRightStart = hashRightX - markLength / 2;
    const hashRightEnd = hashRightStart + markLength;

    // 1ヤードごとのマーク描画
    for (let i = 0; i <= displayYards; i++) {
      if (i % 5 !== 0) {
        // 5ヤードラインでは描画しない
        const y = i * yardHeight;

        // 左端のマーク
        ctx.beginPath();
        ctx.moveTo(leftMarkStart, y);
        ctx.lineTo(leftMarkEnd, y);
        ctx.stroke();

        // 右端のマーク
        ctx.beginPath();
        ctx.moveTo(rightMarkStart, y);
        ctx.lineTo(rightMarkEnd, y);
        ctx.stroke();

        // 左側のハッシュマーク
        ctx.beginPath();
        ctx.moveTo(hashLeftStart, y);
        ctx.lineTo(hashLeftEnd, y);
        ctx.stroke();

        // 右側のハッシュマーク
        ctx.beginPath();
        ctx.moveTo(hashRightStart, y);
        ctx.lineTo(hashRightEnd, y);
        ctx.stroke();
      }
    }

    // ヤード数字の位置（NCAAルール: サイドラインから9ヤード内側、数字の上端まで）
    // 数字の高さを6フィートとして、上端が9ヤードになるよう調整
    const numberHeight = footToPixel * 6;
    const numberInset = yardWidth * 9 + numberHeight / 2; // 中心位置を調整

    // ヤード数字の描画
    ctx.font = 'bold 36px Arial'; // サイズを小さく
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 数字をヤードラインをまたぐ形で配置
    const yardNumbersConfig = [
      { digit1: '4', digit2: '0', yardLine: 40 },
      { digit1: '5', digit2: '0', yardLine: 50 },
      { digit1: '4', digit2: '0', yardLine: 60 },
    ];

    // 左側の数字（外から見て自然な向き）
    for (const { digit1, digit2, yardLine } of yardNumbersConfig) {
      const lineY = (65 - yardLine) * yardHeight;
      const digitSpacing = 16; // 数字間の間隔（より詰めて表示）

      // 第1桁（上側）
      ctx.save();
      ctx.translate(numberInset, lineY - digitSpacing);
      ctx.rotate(Math.PI / 2); // 右に90度回転（外から見て正しい向き）
      ctx.fillText(digit1, 0, 0);
      ctx.restore();

      // 第2桁（下側）
      ctx.save();
      ctx.translate(numberInset, lineY + digitSpacing);
      ctx.rotate(Math.PI / 2); // 右に90度回転（外から見て正しい向き）
      ctx.fillText(digit2, 0, 0);
      ctx.restore();

      // 矢印（50以外）- 18インチ×36インチ
      if (yardLine !== 50) {
        const arrowBase = inchToPixel * 18;
        const arrowHeight = inchToPixel * 36;
        const arrowOffset = footToPixel * 6; // 数字から6フィート離れた位置

        ctx.save();
        ctx.fillStyle = '#ffffff';

        if (yardLine === 40) {
          // 40ヤード - 矢印は数字の下（35ヤード方向）- 上向き矢印
          ctx.translate(numberInset, lineY + arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        } else if (yardLine === 60) {
          // 60ヤード - 矢印は数字の上（65ヤード方向）- 下向き矢印
          ctx.translate(numberInset, lineY - arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, -arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 右側の数字（外から見て自然な向き）
    for (const { digit1, digit2, yardLine } of yardNumbersConfig) {
      const lineY = (65 - yardLine) * yardHeight;
      const digitSpacing = 16; // 数字間の間隔（より詰めて表示）

      // 第1桁（下側に配置 - 右側は読み方向が逆）
      ctx.save();
      ctx.translate(width - numberInset, lineY + digitSpacing);
      ctx.rotate(-Math.PI / 2); // 左に90度回転（外から見て正しい向き）
      ctx.fillText(digit1, 0, 0);
      ctx.restore();

      // 第2桁（上側に配置 - 右側は読み方向が逆）
      ctx.save();
      ctx.translate(width - numberInset, lineY - digitSpacing);
      ctx.rotate(-Math.PI / 2); // 左に90度回転（外から見て正しい向き）
      ctx.fillText(digit2, 0, 0);
      ctx.restore();

      // 矢印（50以外）- 18インチ×36インチ
      if (yardLine !== 50) {
        const arrowBase = inchToPixel * 18;
        const arrowHeight = inchToPixel * 36;
        const arrowOffset = footToPixel * 6; // 数字から6フィート離れた位置

        ctx.save();
        ctx.fillStyle = '#ffffff';

        if (yardLine === 40) {
          // 40ヤード - 矢印は数字の下（35ヤード方向）- 上向き矢印
          ctx.translate(width - numberInset, lineY + arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        } else if (yardLine === 60) {
          // 60ヤード - 矢印は数字の上（65ヤード方向）- 下向き矢印
          ctx.translate(width - numberInset, lineY - arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, -arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 9ヤードマーク（ウィングマーク） - NCAAルール
    // 10ヤードラインごとに、サイドラインから9ヤード内側に12インチ長のマーク
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = inchToPixel * 4;
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 shadow-lg"
    />
  );
};

export default Field;
