const fileInput = document.getElementById('fileInput');
const uploadLabel = document.getElementById('uploadLabel');
const statusText = document.getElementById('status');
const cropContainer = document.getElementById('cropContainer');
const imageToCrop = document.getElementById('imageToCrop');
const zineFormSection = document.getElementById('zineFormSection');
const extractBtn = document.getElementById('extractBtn');
const previewArea = document.getElementById('previewArea');
const stampList = document.getElementById('stampList');

let cropper = null;

// 1. OpenCVの準備完了通知を受け取るグローバル関数
window.onOpenCvReady = function() {
    statusText.textContent = '準備完了';
    statusText.className = 'ready';
    uploadLabel.classList.remove('disabled');
    fileInput.disabled = false;
};

// 2. 画像選択イベント
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    previewArea.style.display = 'none';
    statusText.textContent = '範囲を選択し、テキストを入力して生成してください';
    statusText.className = 'ready';

    const reader = new FileReader();
    reader.onload = function(event) {
        imageToCrop.src = event.target.result;
        cropContainer.style.display = 'block';
        zineFormSection.style.display = 'block';

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(imageToCrop, {
            viewMode: 1,
            autoCropArea: 0.8,
            background: false,
            zoomable: false
        });
    };
    reader.readAsDataURL(file);
});

// 3. ZINE生成ボタンイベント
extractBtn.addEventListener('click', () => {
    if (!cropper) return;

    statusText.textContent = 'ZINEページを生成中...';
    statusText.className = 'processing';
    
    setTimeout(() => {
        try {
            const croppedCanvas = cropper.getCroppedCanvas();
            
            let src = cv.imread(croppedCanvas);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

            let blurred = new cv.Mat();
            let ksize = new cv.Size(5, 5);
            cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

            let thresh = new cv.Mat();
            cv.threshold(blurred, thresh, 150, 255, cv.THRESH_BINARY);

            cv.imshow('canvasOutput', thresh);

            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            let validContours = [];

            for (let i = 0; i < contours.size(); ++i) {
                let contour = contours.get(i);
                let area = cv.contourArea(contour);
                if (area < 50) continue; 

                validContours.push(contour);

                let rect = cv.boundingRect(contour);
                if (rect.x < minX) minX = rect.x;
                if (rect.y < minY) minY = rect.y;
                if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
                if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
            }

            if (validContours.length === 0) {
                alert("文字（オブジェクト）がうまく検出されませんでした。選択範囲を調整してください。");
                statusText.textContent = '準備完了';
                statusText.className = 'ready';
                return;
            }

            let stampWidth = maxX - minX;
            let stampHeight = maxY - minY;

            const zineCanvas = document.createElement('canvas');
            zineCanvas.width = 1600;
            zineCanvas.height = 1130;
            const ctx = zineCanvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, zineCanvas.width, zineCanvas.height);

            const targetWidth = 800;
            const targetHeight = 1130;
            const imgWidth = croppedCanvas.width;
            const imgHeight = croppedCanvas.height;
            const imgRatio = imgWidth / imgHeight;
            const targetRatio = targetWidth / targetHeight;
            
            let sX, sY, sSw, sSh;
            if (imgRatio > targetRatio) {
                sSh = imgHeight;
                sSw = imgHeight * targetRatio;
                sX = (imgWidth - sSw) / 2;
                sY = 0;
            } else {
                sSw = imgWidth;
                sSh = imgWidth / targetRatio;
                sX = 0;
                sY = (imgHeight - sSh) / 2;
            }
            ctx.drawImage(croppedCanvas, sX, sY, sSw, sSh, 0, 0, targetWidth, targetHeight);

            const startX = 870;
            const endX = 1530;
            const contentWidth = endX - startX;
            const themeColor = document.getElementById('themeColor').value;

            ctx.fillStyle = themeColor;
            ctx.font = "bold 26px 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(document.getElementById('inputHashtag').value, startX, 90);

            ctx.textAlign = "right";
            ctx.fillText(document.getElementById('inputNumber').value, endX, 90);

            ctx.strokeStyle = themeColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, 1030);
            ctx.lineTo(endX, 1030);
            ctx.stroke();

            ctx.font = "bold 22px 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif";
            ctx.textAlign = "left";
            ctx.fillText("📍 " + document.getElementById('inputLocation').value, startX, 1075);

            ctx.textAlign = "right";
            ctx.fillText(document.getElementById('inputMemo').value, endX, 1075);

            const cX = startX + contentWidth / 2;
            const cY = 200 + (1030 - 200) / 2;
            const maxW = contentWidth - 40;
            const maxH = 1030 - 200 - 60;

            let scale = Math.min(maxW / stampWidth, maxH / stampHeight) * 0.85;
            const drawX = cX - (stampWidth * scale) / 2;
            const drawY = cY - (stampHeight * scale) / 2;

            ctx.fillStyle = themeColor;
            ctx.beginPath();
            for (let i = 0; i < validContours.length; ++i) {
                let contour = validContours[i];
                let pointsData = contour.data32S;
                for (let j = 0; j < pointsData.length; j += 2) {
                    let x = drawX + (pointsData[j] - minX) * scale;
                    let y = drawY + (pointsData[j+1] - minY) * scale;
                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
            }
            ctx.fill();

            const pageImageUrl = zineCanvas.toDataURL('image/png');
            
            const card = document.createElement('div');
            card.className = 'stamp-card';

            const img = document.createElement('img');
            img.src = pageImageUrl;
            img.className = 'stamp-thumb';
            img.alt = 'ZINE Page';

            const dlBtn = document.createElement('a');
            dlBtn.className = 'btn btn-green btn-sm';
            dlBtn.textContent = `ページ画像をダウンロード (No.${document.getElementById('inputNumber').value})`;
            dlBtn.href = pageImageUrl;
            dlBtn.download = `zine_page_${document.getElementById('inputNumber').value}.png`;

            card.appendChild(img);
            card.appendChild(dlBtn);
            
            stampList.insertBefore(card, stampList.firstChild);
            
            previewArea.style.display = 'flex';
            statusText.textContent = 'ZINEのページを記録しました！';
            statusText.className = 'ready';

            const currentNum = parseInt(document.getElementById('inputNumber').value, 10);
            if (!isNaN(currentNum)) {
                document.getElementById('inputNumber').value = String(currentNum + 1).padStart(2, '0');
            }

            src.delete(); gray.delete(); blurred.delete(); thresh.delete();
            contours.delete(); hierarchy.delete();

        } catch (err) {
            console.error(err);
            statusText.textContent = 'エラーが発生しました';
            statusText.className = '';
        }
    }, 100);
});

// 4. PWA用のServiceWorkerを登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('ServiceWorker registered', reg))
            .catch(err => console.error('ServiceWorker registration failed', err));
    });
}