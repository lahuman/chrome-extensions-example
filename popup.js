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

  toggleButton.addEventListener('click', function() {
    if (currentTabId === null || toggleButton.disabled) return;

    const stateKey = `state_${currentTabId}`;
    const intervalKey = `interval_${currentTabId}`;
    // '켜기' 버튼을 누를 때 현재 select 박스에 설정된 값을 사용합니다.
    // 이 시점에서 select 박스는 활성화되어 있어야 사용자 값을 읽을 수 있습니다.
    const selectedInterval = parseInt(intervalSelect.value);

    chrome.storage.sync.get({ [stateKey]: false }, function(data) {
      const oldState = data[stateKey];
      const newState = !oldState;

      chrome.storage.sync.set({
        [stateKey]: newState,
        [intervalKey]: selectedInterval // 켜질 때 현재 선택된 인터벌 값으로 저장
      }, function() {
        updateUI(newState); // UI 업데이트 (select 활성화/비활성화 포함)
        console.log('확장 프로그램 상태가', newState ? '켜짐' : '꺼짐', '으로 변경되었습니다.');

        if (newState) {
          // 상태가 '켜짐'으로 변경될 때의 로직
          if (chrome.scripting) { //
            chrome.scripting.executeScript({ //
              target: { tabId: currentTabId }, //
              files: ['content.js'] //
            }, () => {
              if (chrome.runtime.lastError) { //
                console.error('콘텐츠 스크립트 삽입 오류:', chrome.runtime.lastError); //
                statusElement.textContent = '오류: 스크립트 삽입 실패'; //
                chrome.storage.sync.set({ [stateKey]: false }, () => updateUI(false)); //
                return;
              }
              chrome.tabs.sendMessage(currentTabId, { //
                action: 'startClicking', //
                state: true, //
                interval: selectedInterval // 선택된 인터벌 전달
              }, function(response) {
                if (chrome.runtime.lastError) { //
                  console.warn('콘텐츠 스크립트에 시작 메시지 전송 실패:', chrome.runtime.lastError); //
                  statusElement.textContent = '오류: 스크립트 통신 실패'; //
                  chrome.storage.sync.set({ [stateKey]: false }, () => updateUI(false)); //
                } else {
                  console.log('콘텐츠 스크립트 시작 메시지 전송 완료'); //
                }
              });
            });
          } else {
            console.error('오류: chrome.scripting API를 사용할 수 없습니다.'); //
            statusElement.textContent = '오류: 스크립트 API 사용 불가'; //
            chrome.storage.sync.set({ [stateKey]: false }, () => updateUI(false)); //
          }
        } else {
          // 상태가 '꺼짐'으로 변경될 때의 로직
          chrome.tabs.sendMessage(currentTabId, { action: 'stopClicking', state: false }, function(response) { //
            if (chrome.runtime.lastError) { //
              console.warn('콘텐츠 스크립트에 중지 메시지 전송 실패:', chrome.runtime.lastError); //
            } else {
              console.log('콘텐츠 스크립트 중지 메시지 전송 완료'); //
            }
          });
        }
      });
    });
  });
});