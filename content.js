// 이 스크립트는 허용된 웹사이트에 삽입되어 버튼 클릭 작업을 수행하고 상태 표시를 합니다.
// 상수 파일 (constants.js)에서 ALLOWED_URL을 가져옵니다.

let clickInterval = null;
let countdownInterval = null;
let currentClickIntervalTime = 10000; // 기본값 10초, popup에서 전달받아 갱신됨
let countdownTotalSeconds = 10; // 카운트다운 전체 시간 (초 단위)
let countdownRemainingSeconds = 10; // 남은 카운트다운 시간

const BUTTON_SELECTOR = '#dl-menu > button'; //
const STATUS_INDICATOR_ID = 'extension-status-indicator'; //
const COUNTDOWN_SPAN_ID = 'extension-countdown'; //

function clickTheButton() {
  const button = document.querySelector(BUTTON_SELECTOR);
  if (button) {
    button.click(); //
    console.log('버튼이 클릭되었습니다:', BUTTON_SELECTOR); //
  } else {
    console.warn('클릭할 버튼을 찾을 수 없습니다:', BUTTON_SELECTOR); //
  }
  resetCountdown(); // 버튼 클릭 후 카운트다운 초기화
}

function startClicking(intervalTime) {
  if (intervalTime) {
    currentClickIntervalTime = intervalTime;
    countdownTotalSeconds = Math.floor(currentClickIntervalTime / 1000);
  }

  if (clickInterval === null) {
    console.log(`버튼 클릭 인터벌 시작 (${currentClickIntervalTime / 1000}초 간격)`);
    // clickTheButton(); // 원한다면 즉시 실행
    clickInterval = setInterval(clickTheButton, currentClickIntervalTime); //
    startCountdown(); //
  }
  displayStatusIndicator(true); //
}

function stopClicking() {
  if (clickInterval !== null) {
    console.log('버튼 클릭 인터벌 중지'); //
    clearInterval(clickInterval); //
    clickInterval = null; //
  }
  stopCountdown(); //
  displayStatusIndicator(false); //

  // 페이지를 떠나거나 기능이 꺼질 때 백그라운드에 알림
  chrome.runtime.sendMessage({ action: 'contentScriptUnloading' }, function(response) { //
    if (chrome.runtime.lastError) {
      // console.warn('백그라운드 스크립트에 언로드 메시지 전송 실패:', chrome.runtime.lastError);
    } else {
      // console.log('백그라운드 스크립트에 언로드 메시지 전송 완료');
    }
  });
}

function startCountdown() {
  if (countdownInterval === null) {
    console.log('카운트다운 시작'); //
    countdownRemainingSeconds = countdownTotalSeconds; // 설정된 인터벌로 카운트다운 초기화
    updateCountdownDisplay();
    countdownInterval = setInterval(updateCountdown, 1000); //
  }
}

function stopCountdown() {
  if (countdownInterval !== null) {
    console.log('카운트다운 중지'); //
    clearInterval(countdownInterval); //
    countdownInterval = null; //
    updateCountdownDisplay(true); //
  }
}

function updateCountdown() {
  countdownRemainingSeconds--; //
  if (countdownRemainingSeconds < 0) { // 0초까지 표시 후 다음 인터벌에서 리셋됨
    countdownRemainingSeconds = 0; // 버튼 클릭 시 resetCountdown에서 다시 설정됨
  }
  updateCountdownDisplay(); //
}

function updateCountdownDisplay(hide = false) {
  const countdownSpan = document.getElementById(COUNTDOWN_SPAN_ID);
  if (countdownSpan) {
    if (hide) {
      countdownSpan.style.display = 'none'; //
    } else {
      countdownSpan.textContent = `(${countdownRemainingSeconds}초)`; //
      countdownSpan.style.display = 'inline'; //
    }
  }
}

function resetCountdown() {
  countdownRemainingSeconds = countdownTotalSeconds; // 현재 설정된 인터벌로 초기화
  updateCountdownDisplay();
  console.log(`카운트다운 ${countdownTotalSeconds}초로 초기화됨.`);
}

function displayStatusIndicator(show) {
  let indicator = document.getElementById(STATUS_INDICATOR_ID);

  if (show) {
    if (!indicator) {
      indicator = document.createElement('div'); //
      indicator.id = STATUS_INDICATOR_ID; //
      indicator.textContent = '자동 조회 중... '; //
      const countdownSpan = document.createElement('span'); //
      countdownSpan.id = COUNTDOWN_SPAN_ID; //
      indicator.appendChild(countdownSpan); //
      indicator.style.position = 'fixed'; //
      indicator.style.bottom = '10px'; //
      indicator.style.right = '10px'; //
      indicator.style.backgroundColor = 'rgba(76, 175, 80, 0.8)'; //
      indicator.style.color = 'white'; //
      indicator.style.padding = '5px 10px'; //
      indicator.style.borderRadius = '5px'; //
      indicator.style.zIndex = '10000'; //
      indicator.style.fontSize = '12px'; //
      indicator.style.pointerEvents = 'none'; //
      document.body.appendChild(indicator); //
      console.log('상태 표시기 추가됨'); //
    }
    indicator.style.display = 'block'; //
    updateCountdownDisplay(); //
  } else {
    if (indicator) {
      indicator.style.display = 'none'; //
      console.log('상태 표시기 숨김'); //
    }
    updateCountdownDisplay(true); //
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log('콘텐츠 스크립트 메시지 수신:', request); //
    if (request.action === 'startClicking') {
      startClicking(request.interval); // 인터벌 값으로 시작
      sendResponse({ status: 'started' }); //
    } else if (request.action === 'stopClicking') {
      stopClicking(); //
      sendResponse({ status: 'stopped' }); //
    } else if (request.action === 'updateStatusIndicator') {
      displayStatusIndicator(request.state); //
      if (request.state) {
        // 백그라운드에서 상태 업데이트 시, 저장된 인터벌로 카운트다운 시작
        // request.interval이 있으면 사용, 없으면 기존 currentClickIntervalTime 사용
        currentClickIntervalTime = request.interval || currentClickIntervalTime;
        countdownTotalSeconds = Math.floor(currentClickIntervalTime / 1000);
        startCountdown();
      } else {
        stopCountdown(); //
      }
      sendResponse({ status: 'indicatorUpdated' }); //
    } else if (request.action === 'updateInterval') {
      // 팝업에서 인터벌 변경 시
      console.log(`갱신 주기 변경 요청 받음: ${request.interval / 1000}초`);
      stopClicking(); // 기존 인터벌 중지
      startClicking(request.interval); // 새 인터벌로 시작
      sendResponse({ status: 'intervalUpdated' });
    } else if (request.action === 'ping') { // 추가된 부분
      console.log('콘텐츠 스크립트: Ping 수신');
      sendResponse({ status: 'pong', scriptVersion: '1.0' }); // 응답하여 존재를 알림
      return true; // 비동기 응답을 위해 true 반환해야 함
    }

  }
);

// 콘텐츠 스크립트 로드 시 백그라운드에 현재 상태 및 인터벌 요청
chrome.runtime.sendMessage({ action: 'requestState' }, function(response) { //
  if (chrome.runtime.lastError) {
    console.warn('백그라운드에 상태 요청 실패:', chrome.runtime.lastError); //
  } else if (response) {
    console.log('백그라운드로부터 초기 상태 응답 받음:', response); //
    if (response.isOn) {
      console.log("초기 상태 '켜짐' 감지, 클릭 인터벌 및 카운트다운 시작"); //
      // response.interval이 있으면 사용, 없으면 기본값으로 startClicking 호출
      startClicking(response.interval || currentClickIntervalTime);
    } else {
      displayStatusIndicator(false); // 꺼져있으면 표시기 숨김
    }
  }
});

console.log('콘텐츠 스크립트가 로드되었습니다.'); //

window.addEventListener('beforeunload', stopClicking); //