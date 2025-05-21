// popup.js
// popup.html의 동작을 제어하고 확장 프로그램 상태를 관리합니다.
// 상수 파일 (constants.js)에서 ALLOWED_URL을 가져옵니다.

const DEFAULT_INTERVAL = 10000; // 기본 갱신 주기 (10초)

document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status');
  const toggleButton = document.getElementById('toggleButton');
  const urlDisplay = document.getElementById('urlDisplay');
  const currentUrlElement = document.getElementById('currentUrl');
  const intervalControls = document.getElementById('intervalControls');
  const intervalSelect = document.getElementById('intervalSelect'); // select 요소 가져오기

  let currentTabId = null;

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs && tabs[0];
    if (currentTab) {
      currentTabId = currentTab.id;
      const currentUrl = currentTab.url;
      const isAllowedSite = currentUrl && currentUrl.startsWith(ALLOWED_URL); //

      if (!isAllowedSite) {
        statusElement.textContent = '이 확장 프로그램은 ' + ALLOWED_URL + ' 에서만 활성화됩니다.'; //
        toggleButton.disabled = true; //
        urlDisplay.classList.add('hidden'); //
        intervalControls.classList.add('hidden');
        console.log('현재 사이트는 확장 프로그램 활성화 대상이 아닙니다:', currentUrl); //
      } else {
        console.log('현재 사이트에서 확장 프로그램이 활성화됩니다:', currentUrl); //
        currentUrlElement.textContent = currentUrl; //
        intervalControls.classList.remove('hidden'); // 허용된 사이트면 인터벌 선택 UI 보이기
        loadStateAndInterval(currentTabId);
      }
    } else {
      statusElement.textContent = '탭 정보를 가져올 수 없습니다.'; //
      toggleButton.disabled = true; //
      urlDisplay.classList.add('hidden'); //
      intervalControls.classList.add('hidden');
    }
  });

  function loadStateAndInterval(tabId) {
    if (tabId === null) return;
    const stateKey = `state_${tabId}`;
    const intervalKey = `interval_${tabId}`;

    chrome.storage.sync.get({
      [stateKey]: false,
      [intervalKey]: DEFAULT_INTERVAL
    }, function(data) {
      const isOn = data[stateKey];
      const currentInterval = data[intervalKey];
      intervalSelect.value = currentInterval;
      updateUI(isOn); // 불러온 상태에 따라 UI 업데이트 (select 활성화/비활성화 포함)
    });
  }

  function updateUI(isOn) {
    if (isOn) {
      statusElement.textContent = '상태: 켜짐'; //
      toggleButton.textContent = '끄기'; //
      urlDisplay.classList.remove('hidden'); //
      intervalControls.classList.remove('hidden'); // 인터벌 UI는 계속 보이도록 함
      intervalSelect.disabled = true; // 상태가 '켜짐'이면 select 박스 비활성화

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) { //
        if (tabs && tabs[0]) {
          currentUrlElement.textContent = tabs[0].url; //
        } else {
          currentUrlElement.textContent = 'URL을 가져올 수 없습니다.'; //
        }
      });
    } else {
      statusElement.textContent = '상태: 꺼짐'; //
      toggleButton.textContent = '켜기'; //
      urlDisplay.classList.add('hidden'); //
      intervalControls.classList.remove('hidden'); // 인터벌 UI는 계속 보이도록 함
      intervalSelect.disabled = false; // 상태가 '꺼짐'이면 select 박스 활성화
      currentUrlElement.textContent = ''; //
    }
  }

  intervalSelect.addEventListener('change', function() {
    // 이 이벤트는 intervalSelect가 활성화된 상태 (즉, 확장 프로그램이 '꺼짐' 상태)에서만 발생합니다.
    if (currentTabId === null) return;
    const selectedInterval = parseInt(this.value);
    const intervalKey = `interval_${currentTabId}`;

    chrome.storage.sync.set({ [intervalKey]: selectedInterval }, function() {
      console.log(`탭 ${currentTabId}의 갱신 주기가 ${selectedInterval / 1000}초로 저장되었습니다. (확장 기능 '꺼짐' 상태에서 변경)`);
    });
  });



  // Helper function to send startClicking message and handle response/error
  function sendStartClickingMessage(tabId, interval, stateKey) {
    chrome.tabs.sendMessage(tabId, {
      action: 'startClicking',
      state: true,
      interval: interval
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn(`콘텐츠 스크립트에 시작 메시지 전송 실패 (메시지 핸들러 내부):`, chrome.runtime.lastError.message);
        statusElement.textContent = '오류: 스크립트 통신 실패';
        // 실패 시 상태를 다시 '꺼짐'으로 되돌리고 UI 업데이트
        chrome.storage.sync.set({ [stateKey]: false }, () => {
            updateUI(false); // updateUI는 intervalSelect.disabled 상태도 처리
        });
      } else {
        console.log('콘텐츠 스크립트 시작 메시지 전송 및 응답 수신 완료:', response);
      }
    });
  }
  
  toggleButton.addEventListener('click', function() {
    if (currentTabId === null || toggleButton.disabled) return;

    const stateKey = `state_${currentTabId}`;
    const intervalKey = `interval_${currentTabId}`;
    const selectedInterval = parseInt(intervalSelect.value);

    chrome.storage.sync.get({ [stateKey]: false }, function(data) {
      const oldState = data[stateKey];
      const newState = !oldState;

      // 먼저 상태와 인터벌을 저장합니다.
      chrome.storage.sync.set({
        [stateKey]: newState,
        [intervalKey]: selectedInterval
      }, function() {
        updateUI(newState); // UI를 즉시 업데이트합니다.
        console.log('확장 프로그램 상태가', newState ? '켜짐' : '꺼짐', '으로 변경되었습니다.');

        if (newState) { // 상태가 '켜짐'으로 변경될 때
          // 1. content.js에 ping 보내서 이미 있는지 확인
          chrome.tabs.sendMessage(currentTabId, { action: 'ping' }, function(response) {
            if (chrome.runtime.lastError || !response || response.status !== 'pong') {
              // 1-1. Ping 실패: content.js가 없거나 응답 없음 -> 삽입 시도
              console.log('콘텐츠 스크립트 ping 실패 또는 응답 없음. 삽입 시도.');
              if (chrome.scripting) {
                chrome.scripting.executeScript({
                  target: { tabId: currentTabId },
                  files: ['content.js']
                }, (injectionResults) => { // injectionResults 인자 추가
                  if (chrome.runtime.lastError) {
                    console.error('콘텐츠 스크립트 삽입 오류:', chrome.runtime.lastError.message);
                    statusElement.textContent = '오류: 스크립트 삽입 실패';
                    // 삽입 실패 시 상태를 다시 '꺼짐'으로 되돌림
                    chrome.storage.sync.set({ [stateKey]: false }, () => updateUI(false));
                    return;
                  }
                  if (injectionResults && injectionResults.length > 0) {
                    console.log('콘텐츠 스크립트 삽입 성공.');
                     // 삽입 성공 후 startClicking 메시지 전송
                    sendStartClickingMessage(currentTabId, selectedInterval, stateKey);
                  } else {
                     // 이 경우는 거의 없지만, 삽입은 성공했으나 결과 배열이 비어있는 경우
                     console.warn('콘텐츠 스크립트 삽입 결과가 비어있습니다.');
                     // 필요하다면 오류 처리
                  }
                });
              } else {
                console.error('오류: chrome.scripting API를 사용할 수 없습니다.');
                statusElement.textContent = '오류: 스크립트 API 사용 불가';
                chrome.storage.sync.set({ [stateKey]: false }, () => updateUI(false));
              }
            } else {
              // 1-2. Ping 성공: content.js 이미 존재함 -> startClicking 메시지만 전송
              console.log('콘텐츠 스크립트 ping 성공. 이미 활성화되어 있음. startClicking 메시지 전송.');
              sendStartClickingMessage(currentTabId, selectedInterval, stateKey);
            }
          });
        } else { // 상태가 '꺼짐'으로 변경될 때
          chrome.tabs.sendMessage(currentTabId, { action: 'stopClicking', state: false }, function(response) {
            if (chrome.runtime.lastError) {
              console.warn('콘텐츠 스크립트에 중지 메시지 전송 실패:', chrome.runtime.lastError.message);
            } else {
              console.log('콘텐츠 스크립트 중지 메시지 전송 완료');
            }
          });
        }
      });
    });
  });
});