// popup.js
// popup.html의 동작을 제어하고 확장 프로그램 상태를 관리합니다.
// 상수 파일 (constants.js)에서 ALLOWED_URL을 가져옵니다.

// DOMContentLoaded 이벤트는 HTML 문서가 완전히 로드되고 파싱되었을 때 발생합니다.
document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status'); // 상태 표시 요소
  const toggleButton = document.getElementById('toggleButton'); // 토글 버튼
  const urlDisplay = document.getElementById('urlDisplay'); // URL 표시 영역
  const currentUrlElement = document.getElementById('currentUrl'); // 현재 URL 표시 요소

  let currentTabId = null; // 현재 팝업이 열린 탭의 ID 저장

  // 현재 탭의 URL을 확인하고 확장 프로그램 활성화 여부를 결정합니다.
  // manifest.json의 host_permissions에 의해 특정 사이트에서만 권한이 부여됩니다.
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs && tabs[0];
    if (currentTab) {
      currentTabId = currentTab.id; // 현재 탭 ID 저장
      const currentUrl = currentTab.url;

      // 상수 파일에서 가져온 ALLOWED_URL 사용
      const isAllowedSite = currentUrl && currentUrl.startsWith(ALLOWED_URL);


      if (!isAllowedSite) {
        // 허용되지 않은 사이트일 경우 (URL 검사 또는 권한 부족)
        statusElement.textContent = '이 확장 프로그램은 ' + ALLOWED_URL + ' 에서만 활성화됩니다.';
        toggleButton.disabled = true; // 버튼 비활성화
        urlDisplay.classList.add('hidden'); // URL 표시 영역 숨김
        console.log('현재 사이트는 확장 프로그램 활성화 대상이 아닙니다:', currentUrl);
      } else {
        // 허용된 사이트일 경우
        console.log('현재 사이트에서 확장 프로그램이 활성화됩니다:', currentUrl);
        // 팝업 로드 시에도 URL을 표시합니다.
        currentUrlElement.textContent = currentUrl; // URL 표시
        loadState(currentTabId); // 탭 ID를 전달하여 상태 로드 및 UI 업데이트
      }
    } else {
      // 탭 정보를 가져오지 못한 경우
      statusElement.textContent = '탭 정보를 가져올 수 없습니다.';
      toggleButton.disabled = true;
      urlDisplay.classList.add('hidden');
    }
  });

  // 확장 프로그램의 현재 상태를 불러오는 함수 (탭 ID 기반)
  function loadState(tabId) {
    if (tabId === null) return;
    // 탭 ID를 키의 일부로 사용하여 탭별 상태를 저장합니다.
    chrome.storage.sync.get({ [`state_${tabId}`]: false }, function(data) {
      const isOn = data[`state_${tabId}`];
      updateUI(isOn); // 불러온 상태에 따라 UI 업데이트
    });
  }

  // 확장 프로그램 상태에 따라 UI를 업데이트하는 함수
  function updateUI(isOn) {
    if (isOn) {
      statusElement.textContent = '상태: 켜짐'; // 상태 텍스트 변경
      toggleButton.textContent = '끄기'; // 버튼 텍스트 변경
      urlDisplay.classList.remove('hidden'); // URL 표시 영역 보이기

      // 상태가 '켜짐'으로 변경될 때 현재 탭의 URL을 다시 가져와 표시합니다.
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
          currentUrlElement.textContent = tabs[0].url; // URL 표시 요소에 현재 URL 설정
        } else {
          currentUrlElement.textContent = 'URL을 가져올 수 없습니다.';
        }
      });

    } else {
      statusElement.textContent = '상태: 꺼짐'; // 상태 텍스트 변경
      toggleButton.textContent = '켜기'; // 버튼 텍스트 변경
      urlDisplay.classList.add('hidden'); // URL 표시 영역 숨기기
      currentUrlElement.textContent = ''; // URL 표시 내용 초기화
    }
  }

  // 토글 버튼 클릭 이벤트 리스너
  toggleButton.addEventListener('click', function() {
    if (currentTabId === null || toggleButton.disabled) return;

    // 현재 상태를 가져와서 반전시킵니다.
    chrome.storage.sync.get({ [`state_${currentTabId}`]: false }, function(data) {
      const oldState = data[`state_${currentTabId}`];
      const newState = !oldState; // 상태 반전

      // 변경된 상태를 저장합니다.
      chrome.storage.sync.set({ [`state_${currentTabId}`]: newState }, function() {
        updateUI(newState); // 변경된 상태로 UI 업데이트
        console.log('확장 프로그램 상태가', newState ? '켜짐' : '꺼짐', '으로 변경되었습니다.');

        // 상태 변경에 따라 콘텐츠 스크립트에 메시지 전달
        if (newState) {
          // 상태가 켜짐으로 변경되면 콘텐츠 스크립트 실행 및 메시지 전송
          // chrome.scripting 객체가 사용 가능한지 확인합니다.
          // host_permissions에 의해 허용된 사이트에서만 실행 가능
          if (chrome.scripting) {
            chrome.scripting.executeScript({
              target: { tabId: currentTabId },
              files: ['content.js'] // 삽입할 콘텐츠 스크립트 파일
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('콘텐츠 스크립트 삽입 오류:', chrome.runtime.lastError);
                statusElement.textContent = '오류: 스크립트 삽입 실패';
                updateUI(false); // 상태를 다시 꺼짐으로
                chrome.storage.sync.set({ [`state_${currentTabId}`]: false });
              } else {
                // 스크립트 삽입 성공 후 메시지 전송
                chrome.tabs.sendMessage(currentTabId, { action: 'startClicking', state: true }, function(response) {
                  if (chrome.runtime.lastError) {
                    console.warn('콘텐츠 스크립트에 메시지 전송 실패:', chrome.runtime.lastError);
                    // 콘텐츠 스크립트가 아직 로드되지 않았거나 다른 문제 발생
                    statusElement.textContent = '오류: 스크ript 통신 실패';
                    updateUI(false); // 상태를 다시 꺼짐으로
                    chrome.storage.sync.set({ [`state_${currentTabId}`]: false });
                  } else {
                    console.log('콘텐츠 스크립트 시작 메시지 전송 완료');
                  }
                });
              }
            });
          } else {
            console.error('오류: chrome.scripting API를 사용할 수 없습니다. manifest.json에 "scripting" 권한이 있는지 확인하고 확장 프로그램을 새로고침하세요.');
             statusElement.textContent = '오류: 스크립트 API 사용 불가';
             updateUI(false); // 상태를 다시 꺼짐으로
             chrome.storage.sync.set({ [`state_${currentTabId}`]: false });
          }
        } else {
          // 상태가 꺼짐으로 변경되면 콘텐츠 스크립트에 중지 메시지 전송
           chrome.tabs.sendMessage(currentTabId, { action: 'stopClicking', state: false }, function(response) {
             if (chrome.runtime.lastError) {
               console.warn('콘텐츠 스크립트에 중지 메시지 전송 실패:', chrome.runtime.lastError);
               // 콘텐츠 스크립트가 이미 종료되었거나 다른 문제 발생
             } else {
                console.log('콘텐츠 스크립트 중지 메시지 전송 완료');
             }
           });
        }
      });
    });
  });

  // 팝업이 닫힐 때 현재 탭의 상태를 저장할 필요는 없습니다.
  // 상태는 토글 버튼 클릭 시 이미 저장됩니다.
  // 탭 이동 감지는 background.js에서 처리합니다.
});