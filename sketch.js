let capture;
let handPose;
let backgroundImage;
let introBackgroundImage;
let winBackgroundImage;
let loseBackgroundImage;
let hands = [];
let gameX, gameY, gameW, gameH;
let particles = [];
const NUM_PARTICLES = 200;
let confettis = [];
const NUM_CONFETTI = 150; // 彩帶數量
let tears = [];
const NUM_TEARS = 100; // 眼淚/雨滴數量
let gameState = "INTRO"; // INTRO, START, PLAYING, RESULT, CHAMPION, GAMEOVER
let transitionState = 'none'; // 'none', 'out', 'in'
let transitionAlpha = 0;
let nextGameState = '';
let playStartTime = 0;
let playerGesture = "未知";
let computerGesture = "";
let resultMsg = "";
let gestureIcons = { "石頭": "✊", "剪刀": "✌️", "布": "🖐️", "未知": "❓", "讚": "👍", "倒讚": "👎" };
let winCount = 0;
let tieCount = 0;
let loseCount = 0;
let targetWins = 3; // 新增：目標勝場數
let shakeAmount = 0;
let glitchAmount = 0; // 新增：控制故障特效強度的變數
let staticNoiseAmount = 0; // 新增：控制平手靜電雜訊特效

let lightningAmount = 0; // 新增：打雷特效的透明度
let lightningFlashes = 0; // 控制閃電次數
let gestureTimer = 0; // 控制手勢觸發等待的計時器
const GESTURE_HOLD_THRESH = 30; // 判定手勢確認的影格數 (約0.5秒)
// 手部骨架連接點
let connections = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // 大拇指
  [0, 5], [5, 6], [6, 7], [7, 8],       // 食指
  [0, 9], [9, 10], [10, 11], [11, 12],  // 中指
  [0, 13], [13, 14], [14, 15], [15, 16],// 無名指
  [0, 17], [17, 18], [18, 19], [19, 20] // 小拇指
];

function preload() {
  // 載入 ml5.js handPose 模型
  handPose = ml5.handPose();
  backgroundImage = loadImage('back.png');
  introBackgroundImage = loadImage('back1.png');
  winBackgroundImage = loadImage('win.png');
  loseBackgroundImage = loadImage('fall.png');
}

function setup() {
  // 第一步驟：產生一個全螢幕的畫布
  createCanvas(windowWidth, windowHeight);
  
  // 擷取攝影機影像內容並隱藏原本的 DOM 元素
  capture = createCapture(VIDEO);
  capture.hide();
  
  // 開始偵測手部並將結果存入 hands 變數
  handPose.detectStart(capture, results => {
    hands = results;
  });

  createParticles();
  createConfetti(); // 初始化碎紙花
  createTears(); // 初始化眼淚雨滴
}

function createParticles() {
  particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: width / 2,
      y: height / 2,
      angle: random(TWO_PI),
      speed: random(0.5, 2),
      size: random(1, 4)
    });
  }
}

function createConfetti() {
  confettis = [];
  let colors = ['#00f3ff', '#ff00c8', '#ffea00', '#ffffff']; // 賽博龐克配色
  for (let i = 0; i < NUM_CONFETTI; i++) {
    confettis.push({
      x: width / 2 + random(-100, 100), // 集中在畫面下方中間準備噴發
      y: height + random(0, 50),     // 初始位置在畫面最下方
      w: random(8, 16),      // 寬度
      h: random(8, 16),      // 高度
      color: random(colors), // 隨機顏色
      speedY: random(-25, -45),  // 往上噴發的強烈初始速度 (負值)
      speedX: random(-15, 15),   // 往左右散開的速度
      gravity: random(0.6, 1.2), // 重力加速度
      angle: random(TWO_PI),     // 初始旋轉角度
      spin: random(-0.3, 0.3)    // 更快的旋轉速度
    });
  }
}

function createTears() {
  tears = [];
  for (let i = 0; i < NUM_TEARS; i++) {
    tears.push({
      x: random(width),
      y: random(-height, 0),   // 從畫面外上方開始
      speedY: random(10, 25),  // 下落速度較快 (像雨滴)
      length: random(15, 40),  // 雨滴的長度
      weight: random(1, 3)     // 雨滴的粗細
    });
  }
}

function startTransition(targetState) {
  if (transitionState === 'none') {
    nextGameState = targetState;
    transitionState = 'out';
  }
}

function draw() {
  background(0); // 加上黑色背景底色，避免半透明產生殘影
  imageMode(CORNER);

  // 永遠在最底層繪製機台背景 (back.png)，這樣首頁跟冠軍畫面才不會失去機台外框
  image(backgroundImage, 0, 0, width, height);

  // 調整以下四個數值，可以精準對齊你圖片中的機台螢幕框框
  gameW = width * 0.7;       // 遊戲畫面的寬度
  gameH = height * 0.65;     // 遊戲畫面的高度
  gameX = width * 0.15;      // 遊戲畫面左上角的 X 座標
  gameY = height * 0.18;     // 遊戲畫面左上角的 Y 座標 (稍微往上移)

  // 處理轉場邏輯
  if (transitionState === 'out') {
    transitionAlpha += 20; // 淡出速度
    if (transitionAlpha >= 255) {
      transitionAlpha = 255;
      transitionState = 'in';

      // 當畫面全黑時，切換遊戲狀態並重置需要重置的內容
      if (nextGameState === 'PLAYING' && gameState !== 'PLAYING') {
        playStartTime = millis();
      }
      if ((nextGameState === 'START' || nextGameState === 'INTRO') && (gameState === 'CHAMPION' || gameState === 'GAMEOVER')) {
        winCount = 0; tieCount = 0; loseCount = 0;
        lightningAmount = 0;
        lightningFlashes = 0;
        createConfetti();
        createTears();
      }
      gameState = nextGameState;
    }
  }

  // 檢查滑鼠是否在遊戲畫面內，並改變游標圖案
  if (mouseX > gameX && mouseX < gameX + gameW &&
      mouseY > gameY && mouseY < gameY + gameH) {
    cursor('crosshair');
  } else {
    cursor(ARROW);
  }

  // 偵測玩家的手勢 (移到外層，確保各個狀態都能偵測)
  detectPlayerGesture();

  // 手勢觸發 UI 邏輯 (維持 0.5 秒手勢即觸發按鈕)
  if (transitionState === 'none' && gameState !== "PLAYING") {
    let activeGesture = false;
    
    if (gameState === "INTRO") {
      if (playerGesture === "剪刀" || playerGesture === "布") activeGesture = true;
    } else {
      if (playerGesture === "讚" || playerGesture === "倒讚") activeGesture = true;
    }

    if (activeGesture) {
      gestureTimer++;
      if (gestureTimer >= GESTURE_HOLD_THRESH) {
        triggerUI(playerGesture);
        gestureTimer = 0;
      }
    } else {
      gestureTimer = 0;
    }
  } else {
    gestureTimer = 0;
  }

  if (gameState === "INTRO") {
    // 介紹畫面顯示 back1.png
    // 若希望圖片只在螢幕框內，可改為 image(introBackgroundImage, gameX, gameY, gameW, gameH);
    image(introBackgroundImage, 0, 0, width, height); 
    drawIntroParticles();
    drawIntroScreen();
  } else {
    if (gameState === "CHAMPION") {
      // 冠軍畫面顯示 win.png
      image(winBackgroundImage, 0, 0, width, height); // 同理，可改為 gameX, gameY, gameW, gameH
      // 新增：繪製彩帶碎紙花
      drawConfetti();
    } else if (gameState === "GAMEOVER") {
      // 輸了的畫面顯示 fall.png
      image(loseBackgroundImage, 0, 0, width, height); // 同理，可改為 gameX, gameY, gameW, gameH
      // 新增：繪製眼淚/下雨特效
      drawTears();

      // 新增：打雷特效
      // 當還有閃電次數且上一次閃電已結束時，觸發下一次
      if (lightningFlashes > 0 && lightningAmount <= 0) {
        lightningAmount = 255;
        lightningFlashes--;
      }
      if (lightningAmount > 0) {
        push();
        fill(255, lightningAmount); // 用透明度做出閃爍效果
        rect(0, 0, width, height);
        pop();
        lightningAmount -= 25; // 閃電淡出速度 (加快一些)
      }
    }
    // 繪製遊戲的雙視窗版面與 UI
    drawLayout();
  }

  // 處理轉場淡入
  if (transitionState === 'in') {
    transitionAlpha -= 20; // 淡入速度
    if (transitionAlpha <= 0) {
      transitionAlpha = 0;
      transitionState = 'none';
    }
  }

  // 在最上層繪製轉場遮罩
  if (transitionState !== 'none') {
    // 計算最大半徑（畫面中心到角落的距離）
    let maxRadius = dist(0, 0, width / 2, height / 2);
    // 將 transitionAlpha (0~255) 轉換為半徑：0 = 最大 (無遮罩), 255 = 0 (全黑)
    let currentRadius = map(transitionAlpha, 0, 255, maxRadius, 0);
    
    fill(0);
    noStroke();
    beginShape();
    vertex(0, 0); vertex(width, 0); vertex(width, height); vertex(0, height); // 外圍全螢幕矩形
    beginContour();
    for (let a = TWO_PI; a > 0; a -= 0.05) {
      vertex(width / 2 + cos(a) * currentRadius, height / 2 + sin(a) * currentRadius);
    }
    endContour();
    endShape(CLOSE);
  }
}

// 新增：套用光暈效果的輔助函式
function applyGlow(glowColor, glowSize) {
  drawingContext.shadowBlur = glowSize;
  drawingContext.shadowColor = glowColor;
}

function drawIntroParticles() {
  // 繪製與更新粒子
  push();
  noStroke();
  fill(255, 255, 255, 150); // 讓粒子稍微亮一點
  for (let p of particles) {
    // 更新位置
    p.x += cos(p.angle) * p.speed;
    p.y += sin(p.angle) * p.speed;

    // 繪製粒子
    circle(p.x, p.y, p.size);

    // 如果粒子超出畫面，就將它重置回畫面中央
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = width / 2;
      p.y = height / 2;
    }
  }
  pop();
}

function drawConfetti() {
  push();
  noStroke();
  for (let c of confettis) {
    c.speedY += c.gravity; // 套用重力，讓向上的速度逐漸變小並開始下落
    c.y += c.speedY;
    c.x += c.speedX;
    c.angle += c.spin;
    
    // 如果掉出畫面底部，就讓它從上面重新掉落
    if (c.y > height + 50 && c.speedY > 0) {
      c.y = random(-50, -10);
      c.x = random(width);
      c.speedY = random(2, 6); // 恢復成一般的緩慢下落速度
      c.speedX = random(-1.5, 1.5); // 恢復成一般的左右飄移
      c.gravity = 0; // 重新從上方掉落時不需要再受額外重力影響
    }
    
    push();
    translate(c.x, c.y);
    rotate(c.angle);
    fill(c.color);
    rectMode(CENTER);
    rect(0, 0, c.w, c.h);
    pop();
  }
  pop();
}

function drawTears() {
  push();
  stroke(100, 200, 255, 180); // 半透明的淺藍色
  for (let t of tears) {
    strokeWeight(t.weight);
    line(t.x, t.y, t.x, t.y + t.length); // 畫出雨滴線條
    t.y += t.speedY; // 更新垂直位置
    
    // 如果掉出畫面底部，讓它從上方重新掉落
    if (t.y > height) {
      t.y = random(-100, -10);
      t.x = random(width);
    }
  }
  pop();
}

function drawIntroScreen() {
  push();
  translate(gameX, gameY);
  textAlign(CENTER, CENTER);
  textFont('sans-serif'); // 換成無襯線字體，讓中文顯示現代且俐落
  textStyle(BOLD);
  
  let titleY = gameH * -0.025; // 向下移動約0.5公分

  // --- 標題 ---
  applyGlow('transparent', 0);
  applyGlow('#00f3ff', 40);
  fill(255);
  stroke('#00f3ff');
  strokeWeight(4);
  textSize(80);
  text("賽博猜拳", gameW / 2, titleY);

  applyGlow('transparent', 0);
  noStroke();

  // --- 為下方文字加上半透明深色背景，增加可讀性 ---
  fill(0, 0, 0, 160);
  rectMode(CENTER);
  rect(gameW / 2, gameH * 0.53, gameW * 0.9, 160, 20);
  
  fill(255);
  textSize(24);
  text("請將手掌對準鏡頭，準備開始遊戲", gameW / 2, gameH * 0.45); 

  // 新增遊戲規則說明 (閃爍動畫)
  // 將閃爍動畫改為固定的顏色
  fill('#ffea00'); // 固定為霓虹黃色
  textSize(20);
  text("【 遊戲規則 】\n👉 比出「✌️ 剪刀」或「🖐️ 布」選擇賽制 (先達標者獲勝) 👈\n👉 結算與暫停時，皆可比出「👍 讚」繼續或「👎 倒讚」結束 👈", gameW / 2, gameH * 0.58);

  let scissorsProgress = (playerGesture === "剪刀") ? gestureTimer / GESTURE_HOLD_THRESH : 0;
  let paperProgress = (playerGesture === "布") ? gestureTimer / GESTURE_HOLD_THRESH : 0;

  drawButton("✌️ 三戰兩勝", gameW / 2 - 120, gameH * 0.85, scissorsProgress);
  drawButton("🖐️ 五戰三勝", gameW / 2 + 120, gameH * 0.85, paperProgress);
  pop();
}

function drawLayout() {
  let boxW = gameW * 0.3;  // 再縮小卡片寬度
  let boxH = gameH * 0.45; // 再縮小卡片高度
  let leftX = gameW * 0.32;  // 左卡片往中間移
  let rightX = gameW * 0.68; // 右卡片往中間移
  let centerY = gameH * 0.5;
  
  push();
  
  // === 加入畫面震動效果 ===
  if (shakeAmount > 0) {
    translate(random(-shakeAmount, shakeAmount), random(-shakeAmount, shakeAmount));
    shakeAmount *= 0.9; // 讓震動隨時間逐漸衰減
    if (shakeAmount < 0.5) shakeAmount = 0;
  }

  translate(gameX, gameY); // 將座標原點移動到機台螢幕的左上角

  // 如果不是冠軍也不是遊戲結束，才繪製遊戲卡片畫面
  if (gameState !== "CHAMPION" && gameState !== "GAMEOVER") {
    // === 左側玩家區域 ===
    push();
    translate(leftX, centerY);
    
    // 套用光暈
    applyGlow('#00f3ff', 20);

    fill(20, 20, 35, 220); // 半透明深色卡片
    stroke('#00f3ff');     // 霓虹青色邊框
    strokeWeight(4);
    rectMode(CENTER);
    rect(0, 0, boxW + 40, boxH + 80, 20); // 背景卡片
    
    // 顯示攝影機與骨架 (置中縮放並左右顛倒)
    let camScale = Math.min(boxW / capture.width, boxH / capture.height);
    let imgW = capture.width * camScale;
    let imgH = capture.height * camScale;
    
    // 重設光暈，避免影響內部影像
    applyGlow('transparent', 0);

    push();
    scale(-1, 1); // 左右顛倒（鏡像）
    imageMode(CENTER);
    image(capture, 0, 0, imgW, imgH);
    
    // 繪製骨架
    drawSkeleton(imgW, imgH);
    pop();
    
    // 顯示玩家當前手勢文字
    // 顯示玩家當前手勢文字 (加上光暈)
    applyGlow('#00f3ff', 15);
    fill('#00f3ff');
    noStroke();
    textFont('sans-serif'); 
    textSize(28);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text("PLAYER: " + playerGesture, 0, boxH / 2 + 20);
    
    // 新增：平手的靜電雜訊特效
    if (staticNoiseAmount > 0 && (gameState === "RESULT" || gameState === "CHAMPION" || gameState === "GAMEOVER")) {
      drawStaticNoise(boxW + 40, boxH + 80, staticNoiseAmount);
    }
    pop();
    
    // === 右側電腦區域 ===
    push();
    translate(rightX, centerY);

    // === 新增：電腦卡片故障 (Glitch) 特效 ===
    if (glitchAmount > 0 && (gameState === "RESULT" || gameState === "CHAMPION" || gameState === "GAMEOVER")) {
      // RGB 色散殘影 (紅色與青色分離)
      push();
      fill(255, 0, 100, 150); // 螢光紅殘影
      noStroke();
      translate(random(-glitchAmount, glitchAmount), random(-glitchAmount, glitchAmount));
      rect(0, 0, boxW + 40, boxH + 80, 20);
      pop();

      push();
      fill(0, 255, 255, 150); // 螢光青殘影
      noStroke();
      translate(random(-glitchAmount, glitchAmount), random(-glitchAmount, glitchAmount));
      rect(0, 0, boxW + 40, boxH + 80, 20);
      pop();

      // 本體隨機位移與縮放干擾
      translate(random(-glitchAmount, glitchAmount), random(-glitchAmount, glitchAmount));
      scale(random(0.95, 1.05));
    }

    // 套用光暈
    applyGlow('#ff00c8', 20);

    fill(20, 20, 35, 220);
    stroke('#ff00c8'); // 霓虹粉色邊框
    strokeWeight(4);
    rectMode(CENTER);
    rect(0, 0, boxW + 40, boxH + 80, 20);
    
    // 重設光暈
    applyGlow('transparent', 0);

    // 電腦標題加上光暈
    applyGlow('#ff00c8', 15);
    fill('#ff00c8');
    noStroke();
    textFont('sans-serif');
    textSize(28);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text("CPU", 0, -boxH / 2 - 20);
    
    // 處理遊戲電腦端的邏輯與動畫
    handleGameLogic(0, 0);
    
    // 新增：平手的靜電雜訊特效
    if (staticNoiseAmount > 0 && (gameState === "RESULT" || gameState === "CHAMPION" || gameState === "GAMEOVER")) {
      drawStaticNoise(boxW + 40, boxH + 80, staticNoiseAmount);
    }
    
    // 確保故障特效數值隨時間衰減 (寫在 pop() 前面)
    if (glitchAmount > 0) {
      glitchAmount *= 0.85; // 快速衰減
      if (glitchAmount < 0.5) glitchAmount = 0;
    }
    if (staticNoiseAmount > 0) {
      staticNoiseAmount *= 0.85; // 快速衰減
      if (staticNoiseAmount < 0.5) staticNoiseAmount = 0;
    }
    pop();
  }
  
  // === 中央結果與按鈕 UI ===
  drawCenterUI(centerY);
  
  // === 顯示計分板 ===
  drawScore();
  
  pop(); // 結束機台螢幕的座標位移
}

function drawScore() {
  push();
  textFont('sans-serif');
  textSize(32);
  textAlign(CENTER, TOP);
  textStyle(BOLD);

  // --- 計分板：先畫一層粗的黑色邊框底 ---
  applyGlow('transparent', 0);
  stroke(0);
  strokeWeight(8);
  text(`WINS: ${winCount}/${targetWins} | TIES: ${tieCount} | LOSSES: ${loseCount}/${targetWins}`, gameW / 2, 20);

  // --- 計分板：疊加上原本的霓虹青色發光效果 ---
  applyGlow('#00f3ff', 15);
  fill('#00f3ff');
  noStroke();
  text(`WINS: ${winCount}/${targetWins} | TIES: ${tieCount} | LOSSES: ${loseCount}/${targetWins}`, gameW / 2, 20);
  pop();
}

// 新增：繪製靜電雜訊特效
function drawStaticNoise(w, h, amount) {
  push();
  noStroke();
  rectMode(CENTER);
  let alpha = map(amount, 0, 255, 0, 150); // 透明度隨時間降低
  for (let i = 0; i < 40; i++) {
    fill(random(50, 255), alpha); // 隨機灰階顏色
    let rx = random(-w / 2, w / 2);
    let ry = random(-h / 2, h / 2);
    let rw = random(10, w);       // 長條狀的干擾線
    let rh = random(2, 6);
    rect(rx, ry, rw, rh);
  }
  pop();
}

function drawSkeleton(imgW, imgH) {
  if (hands.length > 0) {
    let hand = hands[0];
    let scaleX = imgW / capture.width;
    let scaleY = imgH / capture.height;
    let offsetX = -imgW / 2;
    let offsetY = -imgH / 2;

    stroke('#00f3ff'); // 霓虹青色骨架線條
    strokeWeight(6);
    for (let [i, j] of connections) {
      let p1 = hand.keypoints[i];
      let p2 = hand.keypoints[j];
      line(
        p1.x * scaleX + offsetX, p1.y * scaleY + offsetY,
        p2.x * scaleX + offsetX, p2.y * scaleY + offsetY
      );
    }

    fill('#ff00c8'); // 霓虹粉色關節點
    noStroke();
    for (let kp of hand.keypoints) {
      circle(kp.x * scaleX + offsetX, kp.y * scaleY + offsetY, 12);
    }
  }
}

function detectPlayerGesture() {
  if (hands.length === 0) {
    playerGesture = "未知";
    return;
  }
  let keypoints = hands[0].keypoints;
  
  // 判斷手指是否伸直：指尖(tip)到手腕(0)的距離 > 第二關節(pip)到手腕的距離
  let isExtended = (tip, pip) => {
    let dTip = dist(keypoints[tip].x, keypoints[tip].y, keypoints[0].x, keypoints[0].y);
    let dPip = dist(keypoints[pip].x, keypoints[pip].y, keypoints[0].x, keypoints[0].y);
    return dTip > dPip;
  };

  let fingers = [
    isExtended(4, 2),   // 大拇指
    isExtended(8, 6),   // 食指
    isExtended(12, 10), // 中指
    isExtended(16, 14), // 無名指
    isExtended(20, 18)  // 小拇指
  ];

  let extCount = fingers.filter(Boolean).length;

  // 猜拳邏輯簡單判斷
  if (fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && !fingers[4]) {
    // 判斷大拇指尖端 (keypoints[4]) 與大拇指根部 (keypoints[2]) 的 Y 軸相對位置
    // 螢幕座標 Y 軸向下遞增，所以尖端 Y 較小表示朝上
    if (keypoints[4].y < keypoints[2].y) {
      playerGesture = "讚"; 
    } else {
      playerGesture = "倒讚"; // 往下比為倒讚，用來結束或返回
    }
  } else if (extCount >= 4) {
    playerGesture = "布";
  } else if (extCount <= 1) {
    playerGesture = "石頭";
  } else if (fingers[1] && fingers[2] && !fingers[3] && !fingers[4]) {
    playerGesture = "剪刀";
  } else {
    playerGesture = "未知";
  }
}

function handleGameLogic(cx, cy) {
  if (gameState === "START") {
    textSize(120);
    text("🤖", cx, cy);
  } 
  else if (gameState === "PLAYING") {
    let elapsed = millis() - playStartTime;
    let remain = 3 - Math.floor(elapsed / 1000);
    
    // 動畫：快速切換猜拳圖示
    let animIcons = ["✊", "✌️", "🖐️"];
    let currentIcon = animIcons[Math.floor(elapsed / 150) % 3];
    
    textSize(120);
    text(currentIcon, cx, cy);
    
    // 倒數結束，出拳！
    if (remain <= 0) {
      computerGesture = random(["石頭", "剪刀", "布"]);
      
      // 降低平手率：如果電腦抽到跟玩家一樣，有 70% 的機率重新從另外兩個選項抽
      if (computerGesture === playerGesture && random() < 0.7) {
        let otherOptions = ["石頭", "剪刀", "布"].filter(g => g !== playerGesture);
        computerGesture = random(otherOptions);
      }
      
      decideWinner(); // decideWinner 會設定遊戲狀態
    }
  } 
  else if (gameState === "RESULT" || gameState === "CHAMPION" || gameState === "GAMEOVER") {
    textSize(120);
    text(gestureIcons[computerGesture] || "🤖", cx, cy);
  }
}

function drawCenterUI(centerY) {
  textAlign(CENTER, CENTER);
  textFont('sans-serif');
  
  let thumbsUpProgress = (playerGesture === "讚") ? gestureTimer / GESTURE_HOLD_THRESH : 0;
  let thumbsDownProgress = (playerGesture === "倒讚") ? gestureTimer / GESTURE_HOLD_THRESH : 0;

  // === 新增：在畫面中標示清楚的手勢操作提示 ===
  if (gameState === "START" || gameState === "RESULT" || gameState === "CHAMPION" || gameState === "GAMEOVER") {
    push();
    applyGlow('#ffea00', 15);
    fill('#ffea00');
    noStroke();
    textSize(22);
    text("✨ 比出「👍 讚」繼續 /「👎 倒讚」結束遊戲 ✨", gameW / 2, gameH * 0.75);
    pop();
  }

  if (gameState === "START") {
    drawButton("👍 開始遊戲", gameW / 2 - 120, gameH * 0.85, thumbsUpProgress);
    drawButton("👎 回到首頁", gameW / 2 + 120, gameH * 0.85, thumbsDownProgress);
  } 
  else if (gameState === "PLAYING") {
    let elapsed = millis() - playStartTime;
    let remain = 3 - Math.floor(elapsed / 1000);
    
    if (remain > 0) {
      // 畫一個半透明遮罩覆蓋遊戲區域，凸顯倒數動畫
      push();
      fill(0, 0, 0, 150);
      rectMode(CORNER);
      rect(0, 0, gameW, gameH, 20);
      
      // 計算縮放與透明度的動畫比例 (根據每秒的進度 0.0 ~ 1.0)
      let animProgress = (elapsed % 1000) / 1000;
      let scaleVal = map(animProgress, 0, 1, 4, 1); // 尺寸從 4 倍縮小到 1 倍
      let alphaVal = constrain(map(animProgress, 0.5, 1, 255, 0), 0, 255); // 後半段漸漸變透明
      
      translate(gameW / 2, centerY);
      scale(scaleVal);
      applyGlow('#00f3ff', 40); // 使用霓虹青色光暈
      fill(0, 243, 255, alphaVal); // RGBA 色彩，配合淡出效果
      noStroke();
      textSize(80);
      textStyle(BOLD);
      text(remain, 0, 0);
      pop();
    } else {
      applyGlow('#ff00c8', 30); 
      fill('#ff00c8'); 
      noStroke();
      textSize(100);
      textStyle(BOLD);
      text("FIGHT!", gameW / 2, centerY);
    }
  } 
  else if (gameState === "RESULT") {
    let glowColor = '#ffffff';
    if (resultMsg.includes("贏")) {
      glowColor = '#00f3ff';
      fill('#00f3ff');
    } else if (resultMsg.includes("輸")) {
      glowColor = '#ff00c8';
      fill('#ff00c8');
    } else {
      fill('#ffffff'); // 平手改為純白色
    }
    
    applyGlow(glowColor, 25); // 結果文字光暈
    noStroke();
    textSize(50);
    textStyle(BOLD);
    text(resultMsg, gameW / 2, centerY);
    
    // 重設光暈再畫按鈕
    applyGlow('transparent', 0);
    drawButton("👍 再玩一次", gameW / 2 - 120, gameH * 0.85, thumbsUpProgress);
    drawButton("👎 結束遊戲", gameW / 2 + 120, gameH * 0.85, thumbsDownProgress);
  } 
  else if (gameState === "CHAMPION") {
    let titleY = gameH * 0.25; // 稍微調整位置，避免跟上方的計分板重疊
    // --- 冠軍標題：先畫一層粗的黑色邊框底 ---
    applyGlow('transparent', 0);
    stroke(0);
    strokeWeight(10);
    textSize(60);
    textLeading(70); // 確保兩行字不會互相重疊
    textStyle(BOLD);
    text("YOU ARE THE\nCHAMPION!", gameW / 2, titleY);

    // --- 冠軍標題：疊加上象徵勝利的霓虹黃金色發光效果 ---
    applyGlow('#ffea00', 40);
    fill('#ffea00'); // 改為亮黃色/金色
    noStroke(); // 新增這行：防止黑框蓋住金色的字
    text("YOU ARE THE\nCHAMPION!", gameW / 2, titleY);

    // 重設光暈再畫按鈕
    applyGlow('transparent', 0);
    drawButton("👍 重新開始", gameW / 2 - 120, gameH * 0.85, thumbsUpProgress);
    drawButton("👎 結束遊戲", gameW / 2 + 120, gameH * 0.85, thumbsDownProgress);
  }
  else if (gameState === "GAMEOVER") {
    applyGlow('#ff00c8', 40);
    fill('#ff00c8'); // 霓虹粉色字體
    noStroke();
    textSize(60);
    textStyle(BOLD);
    text("GAME OVER", gameW / 2, centerY);

    // 重設光暈再畫按鈕
    applyGlow('transparent', 0);
    drawButton("👍 重新開始", gameW / 2 - 120, gameH * 0.85, thumbsUpProgress);
    drawButton("👎 結束遊戲", gameW / 2 + 120, gameH * 0.85, thumbsDownProgress);
  }
  // 確保每次 draw() 結束後都重設光暈
  applyGlow('transparent', 0);
}

function drawButton(txt, bx, by, progress = 0) {
  let mx = mouseX - gameX;
  let my = mouseY - gameY;
  let isHover = mx > bx - 100 && mx < bx + 100 && my > by - 30 && my < by + 30;
  
  applyGlow('#00f3ff', 20); // 按鈕光暈改為霓虹青色
  fill(isHover ? '#00f3ff' : '#111');
  stroke('#00f3ff');
  strokeWeight(4);
  rectMode(CENTER);
  rect(bx, by, 200, 60, 30);
  
  // 繪製手勢確認進度條
  if (progress > 0) {
    push();
    fill('#ffea00'); 
    noStroke();
    rectMode(CORNER);
    rect(bx - 80, by + 18, 160 * progress, 6, 3);
    pop();
  }

  applyGlow('transparent', 0); // 文字不要光暈
  fill(isHover ? '#111' : '#00f3ff'); // 按鈕文字也改為青色
  noStroke();
  textSize(28);
  textFont('sans-serif');
  textStyle(BOLD);
  text(txt, bx, by);
}

function mousePressed() {
  // 檢查按鈕是否被點擊
  let mx = mouseX - gameX;
  let my = mouseY - gameY;
  let by = gameH * 0.85;

  // 根據遊戲狀態處理按鈕點擊
  if (gameState === "INTRO") {
    let b1x = gameW / 2 - 120;
    let b2x = gameW / 2 + 120;
    if (mx > b1x - 100 && mx < b1x + 100 && my > by - 30 && my < by + 30) {
      targetWins = 2; // 三戰兩勝
      startTransition("START");
    } else if (mx > b2x - 100 && mx < b2x + 100 && my > by - 30 && my < by + 30) {
      targetWins = 3; // 五戰三勝
      startTransition("START");
    }
  } else {
    let b1x = gameW / 2 - 120;
    let b2x = gameW / 2 + 120;
    let clickedB1 = mx > b1x - 100 && mx < b1x + 100 && my > by - 30 && my < by + 30;
    let clickedB2 = mx > b2x - 100 && mx < b2x + 100 && my > by - 30 && my < by + 30;

    if (clickedB1) {
      if (gameState === "START" || gameState === "RESULT") {
        gameState = "PLAYING";
        playStartTime = millis();
      } else if (gameState === "CHAMPION" || gameState === "GAMEOVER") {
        startTransition("START"); // 直接繼續原賽制
      }
    } else if (clickedB2) {
      startTransition("INTRO"); // 結束並回到首頁
    }
  }
}

// 新增：手勢觸發狀態切換的邏輯
function triggerUI(gesture) {
  if (gameState === "INTRO") {
    if (gesture === "剪刀") {
      targetWins = 2; // 三戰兩勝
      startTransition("START");
    } else if (gesture === "布") {
      targetWins = 3; // 五戰三勝
      startTransition("START");
    }
  } else if (gameState === "START" || gameState === "RESULT") {
    if (gesture === "讚") {
      gameState = "PLAYING";
      playStartTime = millis();
    } else if (gesture === "倒讚") {
      startTransition("INTRO"); // 回到首頁
    }
  } else if (gameState === "CHAMPION" || gameState === "GAMEOVER") {
    if (gesture === "讚") {
      startTransition("START"); // Skip 首頁，直接繼續原賽制
    } else if (gesture === "倒讚") {
      startTransition("INTRO"); // 結束並回到首頁
    }
  }
}

function decideWinner() {
  if (playerGesture === "未知" || playerGesture === "讚" || playerGesture === "倒讚") {
    resultMsg = "未能辨識，平手！";
    tieCount++;
    shakeAmount = 10; // 輕微震動
    staticNoiseAmount = 255; // 觸發平手靜電特效
    gameState = "RESULT";
  } else if (playerGesture === computerGesture) {
    resultMsg = "平手！";
    tieCount++;
    shakeAmount = 10; // 輕微震動
    staticNoiseAmount = 255; // 觸發平手靜電特效
    gameState = "RESULT";
  } else if (
    (playerGesture === "石頭" && computerGesture === "剪刀") ||
    (playerGesture === "剪刀" && computerGesture === "布") ||
    (playerGesture === "布" && computerGesture === "石頭")
  ) {
    resultMsg = "🎉 你贏了！";
    winCount++;
    shakeAmount = 20; // 勝利震動
    glitchAmount = 40; // 觸發對手故障特效
    gameState = "RESULT";
    if (winCount >= targetWins) {
      setTimeout(() => startTransition("CHAMPION"), 1500); // 延遲 1.5 秒再轉場
    }
  } else {
    resultMsg = "😭 你輸了！";
    loseCount++;
    shakeAmount = 30; // 失敗時震動更強烈
    gameState = "RESULT";
    if (loseCount >= targetWins) {
      setTimeout(() => {
        lightningFlashes = 2; // 設定閃電兩次
        startTransition("GAMEOVER");
      }, 1500); // 延遲 1.5 秒再轉場
    }
  }
}

function windowResized() {
  // 確保視窗縮放時維持全螢幕
  resizeCanvas(windowWidth, windowHeight);
  createParticles();
  createConfetti(); // 視窗縮放時重置彩帶位置
  createTears(); // 視窗縮放時重置眼淚位置
}
