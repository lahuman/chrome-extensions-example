// 이 스크립트는 허용된 웹사이트에 삽입되어 버튼 클릭 작업을 수행하고 상태 표시를 합니다.
// 상수 파일 (constants.js)에서 ALLOWED_URL을 가져옵니다.

let clickInterval = null; // setInterval ID를 저장할 변수
let countdownInterval = null; // 카운트다운 setInterval ID를 저장할 변수
let countdown = 10; // 초기 카운트다운 값
const BUTTON_SELECTOR = '#dl-menu > button'; // 클릭할 버튼의 CSS 선택자 (예시, 실제 버튼에 맞게 수정 필요)
const STATUS_INDICATOR_ID = 'extension-status-indicator'; // 상태 표시 요소의 ID
const COUNTDOWN_SPAN_ID = 'extension-countdown'; // 카운트다운 표시 요소의 ID

// 버튼을 찾아 클릭하는 함수
function clickTheButton() {
  resetCountdown(); // 버튼 클릭 후 카운트다운 초기화
  const button = document.querySelector(BUTTON_SELECTOR);
  if (button) {
    button.click(); // 버튼 클릭 이벤트 발생
    console.log('버튼이 클릭되었습니다:', BUTTON_SELECTOR);
  } else {
    console.warn('클릭할 버튼을 찾을 수 없습니다:', BUTTON_SELECTOR);
    // 버튼을 찾지 못하면 인터벌 중지 (선택 사항)
    // stopClicking();
  }
}

// 클릭 인터벌을 시작하는 함수
function startClicking() {
  if (clickInterval === null) { // 이미 실행 중이 아니면 시작
    console.log('버튼 클릭 인터벌 시작 (10초 간격)');
    // 첫 클릭은 즉시 발생하도록 setTimeout을 사용하거나,
    // setInterval의 첫 실행을 기다리거나,
    // 최초 1회 clickTheButton()을 직접 호출할 수 있습니다.
    // 여기서는 setInterval의 첫 실행을 기다립니다.
    clickInterval = setInterval(clickTheButton, 10000); // 10초 (10000ms) 간격으로 클릭
    startCountdown(); // 클릭 인터벌 시작과 함께 카운트다운 시작
  }
  displayStatusIndicator(true); // 상태 표시기 보이기
}

// 클릭 인터벌을 중지하고 백그라운드에 상태 업데이트 요청
function stopClicking() {
  if (clickInterval !== null) {
    console.log('버튼 클릭 인터벌 중지');
    clearInterval(clickInterval); // 인터벌 중지
    clickInterval = null; // ID 초기화
  }
  stopCountdown(); // 클릭 인터벌 중지와 함께 카운트다운 중지
  displayStatusIndicator(false); // 상태 표시기 숨기기

  // 백그라운드 스크립트에 현재 탭의 상태를 '꺼짐'으로 업데이트하도록 요청
  // content script에서 chrome.runtime.sendMessage를 호출하면 sender 정보(tabId 포함)가 자동으로 전달됨.
  chrome.runtime.sendMessage({ action: 'contentScriptUnloading' }, function(response) {
    if (chrome.runtime.lastError) {
      console.warn('백그라운드 스크립트에 언로드 메시지 전송 실패:', chrome.runtime.lastError);
    } else {
      console.log('백그라운드 스크립트에 언로드 메시지 전송 완료');
    }
  });
}

// 카운트다운을 시작하는 함수
function startCountdown() {
    if (countdownInterval === null) { // 이미 실행 중이 아니면 시작
        console.log('카운트다운 시작');
        countdown = 10; // 카운트다운 초기화
        updateCountdownDisplay(); // 초기 카운트다운 값 표시
        countdownInterval = setInterval(updateCountdown, 1000); // 1초 (1000ms) 간격으로 카운트다운 업데이트
    }
}

// 카운트다운을 중지하는 함수
function stopCountdown() {
    if (countdownInterval !== null) {
        console.log('카운트다운 중지');
        clearInterval(countdownInterval); // 카운트다운 인터벌 중지
        countdownInterval = null; // ID 초기화
        updateCountdownDisplay(true); // 카운트다운 중지 시 표시 숨김
    }
}

// 카운트다운 값을 업데이트하고 표시를 갱신하는 함수
function updateCountdown() {
    countdown--; // 카운트다운 감소
    updateCountdownDisplay(); // 표시 갱신

    if (countdown <= 0) {
        // 카운트다운이 0 이하가 되면 (클릭 직전)
        // clickTheButton 함수에서 카운트다운을 다시 10으로 초기화합니다.
        // 여기서는 0이 되면 다음 클릭까지 대기 상태임을 표시할 수 있습니다.
         countdown = 0; // 0으로 고정
         updateCountdownDisplay();
         console.log('카운트다운 0. 다음 클릭 대기 중.');
    }
}

// 카운트다운 표시를 갱신하는 함수
function updateCountdownDisplay(hide = false) {
    const countdownSpan = document.getElementById(COUNTDOWN_SPAN_ID);
    if (countdownSpan) {
        if (hide) {
            countdownSpan.style.display = 'none'; // 숨김
        } else {
            countdownSpan.textContent = `(${countdown}초)`; // 카운트다운 값 표시
            countdownSpan.style.display = 'inline'; // 보이기
        }
    }
}

// 카운트다운을 10으로 초기화하는 함수
function resetCountdown() {
    countdown = 10; // 카운트다운 초기화
    updateCountdownDisplay(); // 표시 갱신
    console.log('카운트다운 초기화됨.');
}


// 웹 페이지에 상태 표시기를 추가하거나 제거하는 함수
function displayStatusIndicator(show) {
  let indicator = document.getElementById(STATUS_INDICATOR_ID);

  if (show) {
    if (!indicator) {
      // 표시기가 없으면 새로 생성
      indicator = document.createElement('div');
      indicator.id = STATUS_INDICATOR_ID;
      indicator.textContent = '자동 조회 중... '; // 표시될 텍스트 (카운트다운을 위해 공백 추가)

      // 카운트다운 표시 span 추가
      const countdownSpan = document.createElement('span');
      countdownSpan.id = COUNTDOWN_SPAN_ID;
      indicator.appendChild(countdownSpan); // 표시기에 카운트다운 span 추가

      // 표시기 스타일 설정 (예시 스타일, 필요에 따라 수정)
      indicator.style.position = 'fixed'; // 화면에 고정
      indicator.style.bottom = '10px'; // 하단에서 10px 위
      indicator.style.right = '10px'; // 우측에서 10px 왼쪽
      indicator.style.backgroundColor = 'rgba(76, 175, 80, 0.8)'; // 반투명 녹색 배경
      indicator.style.color = 'white'; // 흰색 글자색
      indicator.style.padding = '5px 10px'; // 패딩
      indicator.style.borderRadius = '5px'; // 둥근 모서리
      indicator.style.zIndex = '10000'; // 다른 요소 위에 표시
      indicator.style.fontSize = '12px'; // 글자 크기
      indicator.style.pointerEvents = 'none'; // 마우스 이벤트 무시
      document.body.appendChild(indicator); // body에 추가
      console.log('상태 표시기 추가됨');
    }
    indicator.style.display = 'block'; // 표시기 보이기
    updateCountdownDisplay(); // 표시기가 보일 때 카운트다운 표시도 갱신
  } else {
    if (indicator) {
      indicator.style.display = 'none'; // 표시기 숨기기
      console.log('상태 표시기 숨김');
      // 필요하다면 완전히 제거할 수도 있습니다.
      // indicator.remove();
    }
    updateCountdownDisplay(true); // 표시기가 숨겨질 때 카운트다운 표시도 숨김
  }
}


// 팝업 또는 백그라운드 스크립트로부터 메시지를 수신합니다.
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log('콘텐츠 스크립트 메시지 수신:', request);
    if (request.action === 'startClicking') {
      startClicking(); // 클릭 시작 및 표시기 보이기
      sendResponse({ status: 'started' });
    } else if (request.action === 'stopClicking') {
      stopClicking(); // 클릭 중지 및 표시기 숨기기
      sendResponse({ status: 'stopped' });
    } else if (request.action === 'updateStatusIndicator') {
        // 백그라운드로부터 상태 업데이트 메시지를 받으면 표시기 업데이트
        displayStatusIndicator(request.state);
        if (request.state) {
            startCountdown(); // 상태가 켜짐이면 카운트다운 시작
        } else {
            stopCountdown(); // 상태가 꺼짐이면 카운트다운 중지
        }
        sendResponse({ status: 'indicatorUpdated' });
    }
    // true를 반환하여 비동기 응답을 사용함을 알립니다 (sendResponse 호출이 나중에 일어날 수 있음)
    // 이 경우에는 즉시 응답하므로 필요 없지만, 비동기 작업이 있다면 필요합니다.
    // return true;
  }
);

// 콘텐츠 스크립트 로드 시 백그라운드에 현재 상태 요청
// 백그라운드 스크립트가 응답하면 그 상태에 따라 표시기를 설정합니다.
chrome.runtime.sendMessage({ action: 'requestState' }, function(response) {
    if (chrome.runtime.lastError) {
        console.warn('백그라운드에 상태 요청 실패:', chrome.runtime.lastError);
    } else if (response && typeof response.isOn !== 'undefined') {
        console.log('백그라운드로부터 초기 상태 응답 받음:', response.isOn);
        displayStatusIndicator(response.isOn); // 받은 상태에 따라 표시기 설정
        // 만약 상태가 켜짐이면 클릭 인터벌과 카운트다운도 시작 (팝업에서 시작 메시지를 받지 못했을 경우 대비)
        if (response.isOn) {
             console.log("초기 상태 '켜짐' 감지, 클릭 인터벌 및 카운트다운 시작");
             startClicking(); // 인터벌 및 카운트다운 시작 (표시기는 이미 설정됨)
        }
    }
});


console.log('콘텐츠 스크립트가 로드되었습니다.');

// 페이지가 언로드될 때 (사용자가 다른 페이지로 이동하거나 탭을 닫을 때) 인터벌 중지 및 상태 업데이트 요청
window.addEventListener('beforeunload', stopClicking);