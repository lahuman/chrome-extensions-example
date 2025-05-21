// background.js
// 이 스크립트는 브라우저 백그라운드에서 실행되며 탭 상태 변화를 감지하고 아이콘을 관리합니다.
importScripts('constants.js'); //

const DEFAULT_INTERVAL_BG = 10000; // 백그라운드용 기본 인터벌

// 확장 프로그램 설치 또는 업데이트 시 모든 탭의 아이콘 상태 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log("확장 프로그램 설치/업데이트 감지. 모든 탭 아이콘 상태 초기화."); //
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      checkUrlAndSetIconState(tab); //
      // 설치/업데이트 시 모든 탭의 상태와 인터벌을 초기화 (선택 사항)
      // chrome.storage.sync.set({
      //   [`state_${tab.id}`]: false,
      //   [`interval_${tab.id}`]: DEFAULT_INTERVAL_BG
      // });
    });
  });
});

// 탭 업데이트 이벤트 리스너
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url || changeInfo.status === 'complete') { //
    chrome.tabs.get(tabId, function(updatedTab) {
      if (chrome.runtime.lastError || !updatedTab) {
        console.warn(`탭 ${tabId} 정보를 가져오는 중 오류 발생:`, chrome.runtime.lastError); //
        return;
      }
      checkUrlAndSetIconState(updatedTab); //

      if (changeInfo.status === 'complete') { //
        const stateKey = `state_${tabId}`;
        const intervalKey = `interval_${tabId}`;
        chrome.storage.sync.get({
          [stateKey]: false,
          [intervalKey]: DEFAULT_INTERVAL_BG
        }, function(data) {
          const isOn = data[stateKey];
          const interval = data[intervalKey];
          // 콘텐츠 스크립트에 상태 및 인터벌 업데이트 메시지 전송
          chrome.tabs.sendMessage(tabId, {
            action: 'updateStatusIndicator',
            state: isOn,
            interval: interval // 인터벌 정보 추가
          }, function(response) {
            if (chrome.runtime.lastError) {
              // console.warn(`탭 ${tabId} 콘텐츠 스크립트에 상태 업데이트 메시지 전송 실패:`, chrome.runtime.lastError);
            } else {
              // console.log(`탭 ${tabId} 콘텐츠 스크립트에 상태 업데이트 메시지 전송 완료`);
            }
          });
        });
      }
    });
  }

  // URL 변경 시 허용된 사이트 벗어났는지 체크 로직은 유지
  if (changeInfo.url || changeInfo.status === 'complete') { //
    chrome.tabs.get(tabId, function(updatedTab) {
      if (!updatedTab || !updatedTab.url) { // updatedTab.url 체크 추가
        // console.warn(`탭 ${tabId} 정보를 가져올 수 없거나 URL이 없습니다.`);
        return;
      }

      const isNowAllowedSite = updatedTab.url.startsWith(ALLOWED_URL); //
      const stateKey = `state_${tabId}`;

      chrome.storage.sync.get({ [stateKey]: false }, function(data) {
        const wasOn = data[stateKey];
        if (wasOn && !isNowAllowedSite) { //
          console.log(`탭 ${tabId}가 허용된 사이트를 벗어났습니다. 상태를 끄기로 변경합니다.`); //
          chrome.storage.sync.set({ [stateKey]: false }, function() { //
            console.log(`탭 ${tabId} 상태가 꺼짐으로 저장되었습니다.`); //
            chrome.tabs.sendMessage(tabId, { action: 'stopClicking', state: false }, function(response) { //
              if (chrome.runtime.lastError) {
                // console.warn(`탭 ${tabId}에 중지 메시지 전송 실패:`, chrome.runtime.lastError);
              } else {
                // console.log(`탭 ${tabId}에 중지 메시지 전송 완료`);
              }
            });
          });
        }
      });
    });
  }
});


// 탭 활성화 이벤트 리스너
chrome.tabs.onActivated.addListener(function(activeInfo) {
  console.log(`탭 활성화 감지: Tab ID = ${activeInfo.tabId}`); //
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError || !tab) {
      console.warn(`활성화된 탭 ${activeInfo.tabId} 정보를 가져오는 중 오류 발생:`, chrome.runtime.lastError); //
      return;
    }
    checkUrlAndSetIconState(tab); //
  });
});

function checkUrlAndSetIconState(tab) {
  if (!tab.url) {
    chrome.action.disable(tab.id); //
    chrome.action.setIcon({ tabId: tab.id, path: { "16": "icons/icon16.png", "48": "icons/icon48.png" } }); //
    return;
  }
  const isAllowedSite = tab.url.startsWith(ALLOWED_URL); //
  if (isAllowedSite) {
    chrome.action.enable(tab.id); //
    chrome.action.setIcon({ tabId: tab.id, path: { "16": "icons/icon16.png", "48": "icons/icon48.png" } }); //
  } else {
    chrome.action.disable(tab.id); //
    chrome.action.setIcon({ tabId: tab.id, path: { "16": "icons/icon16-inactive.png", "48": "icons/icon48-inactive.png" } }); //
  }
}

// 탭이 닫힐 때 해당 탭의 상태와 인터벌을 저장소에서 제거
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  console.log(`탭 ${tabId}가 닫혔습니다. 저장된 상태 및 인터벌을 제거합니다.`); //
  const stateKey = `state_${tabId}`;
  const intervalKey = `interval_${tabId}`;
  chrome.storage.sync.remove([stateKey, intervalKey], function() { //
    if (chrome.runtime.lastError) {
      console.error(`탭 ${tabId} 정보 제거 오류:`, chrome.runtime.lastError); //
    } else {
      console.log(`탭 ${tabId} 정보가 저장소에서 제거되었습니다.`); //
    }
  });
});

// 콘텐츠 스크립트로부터 메시지를 수신
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (sender.tab) { //
      const tabId = sender.tab.id; //
      const stateKey = `state_${tabId}`;
      // const intervalKey = `interval_${tabId}`; // intervalKey는 requestState에서만 필요

      if (request.action === 'contentScriptUnloading') { //
        console.log(`콘텐츠 스크립트 언로드 감지 (탭 ${tabId}). 상태를 '꺼짐'으로 변경 요청 받음.`); //
        chrome.storage.sync.set({ [stateKey]: false }, function() { //
          if (chrome.runtime.lastError) {
            console.error(`탭 ${tabId} 상태 업데이트 오류:`, chrome.runtime.lastError); //
          } else {
            console.log(`탭 ${tabId} 상태가 '꺼짐'으로 저장되었습니다.`); //
            sendResponse({ status: 'stateUpdated' }); //
          }
        });
        return true; // 비동기 응답

      } else if (request.action === 'requestState') { //
        console.log(`탭 ${tabId}로부터 상태 및 인터벌 요청 받음.`); //
        const intervalKey = `interval_${tabId}`; // 여기서 intervalKey 정의
        chrome.storage.sync.get({
          [stateKey]: false,
          [intervalKey]: DEFAULT_INTERVAL_BG // 기본 인터벌 값
        }, function(data) {
          const isOn = data[stateKey];
          const interval = data[intervalKey];
          console.log(`탭 ${tabId} 상태 응답: ${isOn}, 인터벌: ${interval / 1000}초`); //
          sendResponse({ isOn: isOn, interval: interval }); // 현재 상태 및 인터벌 응답
        });
        return true; // 비동기 응답
      }
    }
  }
);

console.log('백그라운드 스크립트가 로드되었습니다.'); //