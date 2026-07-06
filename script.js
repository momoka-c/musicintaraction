let localStream = null;
let originalMaskImage = null; // 切り抜いた図形（白黒マスク）を保持
let currentSelectedColor = "#d9381e"; // デフォルト選択色

// ==========================================
// イベントの流れ制御
// ==========================================

// 1. プロフィール画面：決定ボタンが押されたとき
document.getElementById('profile-form').addEventListener('submit', function(event) {
    event.preventDefault(); // ページリロード防止
    
    // 画面を切り替える
    document.getElementById('profile-screen').classList.add('hidden');
    document.getElementById('camera-screen').classList.remove('hidden');
    
    // カメラを起動
    initCamera();
});

// 2. カメラ画面：シャッター（足跡）ボタンが押されたとき
document.getElementById('shutter-btn').addEventListener('click', function() {
    const video = document.getElementById('webcam');
    const hiddenCanvas = document.getElementById('hidden-canvas');
    const ctx = hiddenCanvas.getContext('2d');

    if (!localStream) return;

    // 現在のビデオフレームのサイズに隠しキャンバスを合わせる
    hiddenCanvas.width = video.videoWidth;
    hiddenCanvas.height = video.videoHeight;
    
    // 隠しキャンバスに現在の映像を焼き付ける
    ctx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // 画像から「形」を二値化抽出（切り抜きマスクを作成）
    processImageToMask(hiddenCanvas, ctx);

    // カメラストリームを停止してエコにする
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // 画面を記録画面に切り替える
    document.getElementById('camera-screen').classList.add('hidden');
    document.getElementById('record-screen').classList.remove('hidden');

    // 切り抜いたキャンバスを色付きで描画
    renderColoredCanvas();
});

// ==========================================
// カメラ・画像処理ロジック
// ==========================================

// カメラ映像をvideoタグに紐づける関数
function initCamera() {
    const video = document.getElementById('webcam');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: 640, height: 640 }, 
            audio: false 
        })
        .then(function(stream) {
            localStream = stream;
            video.srcObject = stream;
        })
        .catch(function(error) {
            console.error("カメラ起動エラー:", error);
            alert("カメラの起動に失敗しました。ブラウザのカメラ権限を確認してください。");
        });
    }
}

// 撮影した画像を解析して文字や輪郭（明るい部分）を切り抜く関数
function processImageToMask(canvas, ctx) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // ピクセルを走査して閾値処理
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        // 輝度（明るさ）を計算
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // 【しきい値調整】明るいところ（文字など）を残して、暗い背景を透明化
        if (brightness > 110) { 
            data[i] = 0;     // シルエット用（色付けするので何色でもOK）
            data[i+1] = 0;
            data[i+2] = 0;
            data[i+3] = 255; // 不透明（残す）
        } else {
            data[i+3] = 0;   // 完全透過（切り抜く）
        }
    }
    ctx.putImageData(imgData, 0, 0);
    
    // 形をデータURL経由で画像オブジェクトとして保存
    originalMaskImage = new Image();
    originalMaskImage.src = canvas.toDataURL();
}

// 選択された色でマスクを塗りつぶしてプレビューに描画
function renderColoredCanvas() {
    if (!originalMaskImage) return;

    const mainCanvas = document.getElementById('svg-canvas');
    const ctx = mainCanvas.getContext('2d');
    
    originalMaskImage.onload = function() {
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        
        // まずパレットで選ばれている色でCanvas全体を塗りつぶす
        ctx.fillStyle = currentSelectedColor;
        ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

        // 重ね合わせの設定（destination-in：描画済みの色を、次に重ねる画像の形だけでくり抜く）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(originalMaskImage, 0, 0, mainCanvas.width, mainCanvas.height);
        
        // 設定を通常（上書きモード）に戻す
        ctx.globalCompositeOperation = 'source-over';
    };

    if (originalMaskImage.complete) {
        originalMaskImage.onload();
    }
}

// ==========================================
// カラーパレット & 保存の制御
// ==========================================

const colorDots = document.querySelectorAll('.color-dot');
colorDots.forEach(dot => {
    dot.addEventListener('click', function() {
        colorDots.forEach(d => d.classList.remove('active'));
        this.classList.add('active');

        // 色情報を更新して再描画
        currentSelectedColor = this.getAttribute('data-color');
        renderColoredCanvas();
    });
});

// 最後の「記録する」ボタンの処理
document.getElementById('save-btn').addEventListener('click', function() {
    const loc = document.getElementById('record-location').value;
    const com = document.getElementById('record-comment').value;
    const finalImage = document.getElementById('svg-canvas').toDataURL();

    const resultData = {
        image: finalImage,
        location: loc,
        comment: com
    };

    console.log("保存されたデータ:", resultData);
    alert("散歩の記録を保存しました！\nコンソールを確認してください。");
});

// --- script.js の末尾に追加、または既存の保存イベントを書き換え ---

// アプリ起動時、または読み込み時にコレクションを初期描画
window.addEventListener('DOMContentLoaded', () => {
    initCamera(); 
    setupTabEvents();
    renderCollectionGrid();
});

// タブ切り替えのイベント設定
function setupTabEvents() {
    // すべての「撮る」「探す」ボタンを制御
    document.querySelectorAll('.tab-navigator').forEach(nav => {
        const buttons = nav.querySelectorAll('.tab-item');
        
        buttons[0].addEventListener('click', () => {
            // 「撮る」が押されたらカメラ画面へ（ストリーム再開が必要ならinitCamera）
            switchScreen('camera-screen');
            initCamera();
        });
        
        buttons[1].addEventListener('click', () => {
            // 「探す」が押されたらコレクション画面へ
            switchScreen('collection-screen');
            renderCollectionGrid();
        });
    });
}

// 画面切り替えの共通ヘルパー
function switchScreen(screenId) {
    document.getElementById('profile-screen').classList.add('hidden');
    document.getElementById('camera-screen').classList.add('hidden');
    document.getElementById('record-screen').classList.add('hidden');
    document.getElementById('collection-screen').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');
}

// ★ 「記録する」ボタンの処理をコレクション連動用にアップデート
document.getElementById('save-btn').addEventListener('click', function() {
    const loc = document.getElementById('record-location').value;
    const com = document.getElementById('record-comment').value;
    const finalImage = document.getElementById('svg-canvas').toDataURL();

    const newRecord = {
        image: finalImage,
        location: loc,
        comment: com,
        date: new Date().getTime()
    };

    // 既存のコレクションデータをLocalStorageから取得
    let collection = JSON.parse(localStorage.getItem('sanpzine_collection')) || [];
    
    // 新しいデータを先頭（または末尾）に追加
    collection.push(newRecord);
    
    // 再び保存
    localStorage.setItem('sanpzine_collection', JSON.stringify(collection));

    alert("コレクションに追加しました！");
    
    // 自動的にコレクション画面（探すタブ）に移動
    switchScreen('collection-screen');
    renderCollectionGrid();
});

// ★ コレクションの24マスのグリッドを生成・描画する関数
function renderCollectionGrid() {
    const gridContainer = document.getElementById('collection-grid');
    gridContainer.innerHTML = ''; // 一度リセット

    // 保存されているデータを取得
    const collection = JSON.parse(localStorage.getItem('sanpzine_collection')) || [];

    // 画像のように、最低24個（またはそれ以上）のマスのグリッドを作成
    const totalCells = Math.max(24, Math.ceil((collection.length + 1) / 4) * 4);

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.classList.add('grid-cell');

        // もしこのインデックスに撮影データがあれば画像を配置
        if (collection[i]) {
            cell.classList.add('has-image');
            const img = document.createElement('img');
            img.src = collection[i].image;
            cell.appendChild(img);
        } else {
            // データがない空マスのうち、5, 10, 15, 20番目（インデックス+1）に数字を表示
            const cellNumber = i + 1;
            if (cellNumber === 5 || cellNumber === 10 || cellNumber === 15 || cellNumber === 20) {
                const numSpan = document.createElement('span');
                numSpan.classList.add('grid-number');
                numSpan.textContent = cellNumber;
                cell.appendChild(numSpan);
            }
        }

        gridContainer.appendChild(cell);
    }
}
