// background.js
// 이 스크립트는 브라우저 백그라운드에서 실행되며 탭 상태 변화를 감지하고 아이콘을 관리합니다.
// 상수 파일 (constants.js)을 로드합니다.
importScripts('constants.js');

// 확장 프로그램 설치 또는 업데이트 시 모든 탭의 아이콘 상태 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log("확장 프로그램 설치/업데이트 감지. 모든 탭 아이콘 상태 초기화.");
  // 모든 탭을 쿼리하여 현재 URL에 따라 아이콘 상태 설정
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      checkUrlAndSetIconState(tab);
      // 설치/업데이트 시 모든 탭의 상태를 '꺼짐'으로 초기화 (선택 사항)
      // chrome.storage.sync.set({ [`state_${tab.id}`]: false });
    });
  });
});


// 탭 업데이트 이벤트 리스너 (URL 변경, 로딩 상태 변경 등)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // changeInfo.url이 존재하거나 로딩이 완료되었을 때 (complete) 처리
   if (changeInfo.url || changeInfo.status === 'complete') {
     // 탭 정보를 다시 가져와서 최신 URL을 확인 (changeInfo.url이 없을 수도 있음)
     chrome.tabs.get(tabId, function(updatedTab) {
       if (chrome.runtime.lastError || !updatedTab) {
         console.warn(`탭 ${tabId} 정보를 가져오는 중 오류 발생:`, chrome.runtime.lastError);
         return;
       }
       checkUrlAndSetIconState(updatedTab); // 아이콘 상태 및 이미지 설정

       // 페이지 로딩 완료 시 (status === 'complete') 해당 탭의 상태를 콘텐츠 스크립트에 전달
       if (changeInfo.status === 'complete') {
           chrome.storage.sync.get({ [`state_${tabId}`]: false }, function(data) {
               const isOn = data[`state_${tabId}`];
               // 콘텐츠 스크립트에 상태 업데이트 메시지 전송
               // 콘텐츠 스크립트가 로드되어 있어야 메시지 수신 가능
               chrome.tabs.sendMessage(tabId, { action: 'updateStatusIndicator', state: isOn }, function(response) {
                   if (chrome.runtime.lastError) {
                       console.warn(`탭 ${tabId} 콘텐츠 스크립트에 상태 업데이트 메시지 전송 실패:`, chrome.runtime.lastError);
                       // 콘텐츠 스크립트가 아직 로드되지 않았거나 해당 탭에 삽입되지 않았을 수 있습니다.
                   } else {
                       console.log(`탭 ${tabId} 콘텐츠 스크립트에 상태 업데이트 메시지 전송 완료`);
                   }
               });
           });
       }

     });
   }

  // changeInfo.url이 존재하고, 로딩이 완료되었을 때 (또는 URL이 변경되었을 때)
  // changeInfo.status === 'complete' 조건을 추가하여 페이지 로딩 완료 시점을 정확히 감지
  if (changeInfo.url || changeInfo.status === 'complete') {
    // 현재 탭 정보를 다시 가져와서 최신 URL과 활성화 상태를 확인합니다.
    chrome.tabs.get(tabId, function(updatedTab) {
      if (!updatedTab) {
        console.warn(`탭 ${tabId} 정보를 가져올 수 없습니다.`);
        return;
      }

      console.log(`탭 업데이트 감지: Tab ID = ${tabId}, URL = ${updatedTab.url}, Status = ${changeInfo.status}`);

      // manifest.json의 host_permissions 설정 덕분에
      // 이 리스너가 실행될 때 updatedTab.url에 접근 가능하며,
      // 해당 탭이 허용된 사이트인지 여부는 이미 권한 부여에 반영됩니다.
      // 상수 파일에서 가져온 ALLOWED_URL 사용
      const isNowAllowedSite = updatedTab.url && updatedTab.url.startsWith(ALLOWED_URL);


      // 해당 탭의 저장된 상태를 확인합니다.
      chrome.storage.sync.get({ [`state_${tabId}`]: false }, function(data) {
        const wasOn = data[`state_${tabId}`];

        // 만약 이전에 켜짐 상태였는데 현재 허용된 사이트가 아니라면
        // (host_permissions에 의해 이탈 시 자동으로 권한이 해제되지만, 상태 저장소 업데이트는 필요)
        if (wasOn && !isNowAllowedSite) {
          console.log(`탭 ${tabId}가 허용된 사이트를 벗어났습니다. 상태를 끄기로 변경합니다.`);
          // 상태를 끄기로 변경하고 저장합니다.
          chrome.storage.sync.set({ [`state_${tabId}`]: false }, function() {
            console.log(`탭 ${tabId} 상태가 꺼짐으로 저장되었습니다.`);
            // 해당 탭의 콘텐츠 스크립트에 중지 메시지를 보냅니다.
            // 콘텐츠 스크립트가 아직 로드되지 않았을 수도 있으므로 에러 처리가 필요합니다.
            // (host_permissions에 의해 권한이 해제되었으므로 메시지 전송이 실패할 수 있음)
            chrome.tabs.sendMessage(tabId, { action: 'stopClicking', state: false }, function(response) {
              if (chrome.runtime.lastError) {
                console.warn(`탭 ${tabId}에 중지 메시지 전송 실패:`, chrome.runtime.lastError);
                // 콘텐츠 스크립트가 없거나 이미 종료되었을 수 있습니다.
              } else {
                console.log(`탭 ${tabId}에 중지 메시지 전송 완료`);
              }
            });
          });
        }
        // TODO: 만약 허용되지 않은 사이트에서 허용된 사이트로 이동했고, 해당 탭의 상태가 이전에 '켜짐'이었다면
        // 자동으로 다시 '켜짐' 상태로 만들고 클릭을 시작할지 결정해야 합니다.
        // 현재 로직은 팝업을 다시 열어서 켜야 합니다. 자동 시작을 원하면 여기에 로직 추가 필요.
        // 예: if (!wasOn && isNowAllowedSite && /* 이전에 켜짐 상태였던 기록 등 */) { ... }
      });
    });
  }
});

// 탭 활성화 이벤트 리스너 (사용자가 다른 탭으로 전환할 때)
chrome.tabs.onActivated.addListener(function(activeInfo) {
  console.log(`탭 활성화 감지: Tab ID = ${activeInfo.tabId}`);
  // 활성화된 탭의 정보를 가져와서 아이콘 상태 설정
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError || !tab) {
      console.warn(`활성화된 탭 ${activeInfo.tabId} 정보를 가져오는 중 오류 발생:`, chrome.runtime.lastError);
      return;
    }
    checkUrlAndSetIconState(tab); // 아이콘 상태 및 이미지 설정
  });
});


// 탭의 URL에 따라 확장 프로그램 아이콘 상태와 이미지를 설정하는 함수
function checkUrlAndSetIconState(tab) {
  if (!tab.url) {
    // URL이 없는 탭 (예: 새 탭 페이지)에서는 아이콘 비활성화 및 기본 아이콘 설정
    chrome.action.disable(tab.id);
     chrome.action.setIcon({
        tabId: tab.id,
        path: {
          16: "icons/icon16.png", // 기본 아이콘 경로
          48: "icons/icon48.png"  // 기본 아이콘 경로
        }
      });
    console.log(`탭 ${tab.id}: URL 없음. 아이콘 비활성화 및 기본 이미지 설정.`);
    return;
  }

  // 상수 파일에서 가져온 ALLOWED_URL 사용
  const isAllowedSite = tab.url.startsWith(ALLOWED_URL);

  if (isAllowedSite) {
    // 허용된 사이트인 경우 아이콘 활성화 및 활성 아이콘 이미지 설정
    chrome.action.enable(tab.id);
    chrome.action.setIcon({
        tabId: tab.id,
        path: {
          16: "icons/icon16.png", // 활성 아이콘 경로
          48: "icons/icon48.png"  // 활성 아이콘 경로
        }
      });
    console.log(`탭 ${tab.id}: 허용된 사이트 (${tab.url}). 아이콘 활성화 및 활성 이미지 설정.`);
  } else {
    // 허용되지 않은 사이트인 경우 아이콘 비활성화 및 비활성 아이콘 이미지 설정
    chrome.action.disable(tab.id);
     chrome.action.setIcon({
        tabId: tab.id,
        path: {
          16: "icons/icon16-inactive.png", // 비활성 아이콘 경로
          48: "icons/icon48-inactive.png"  // 비활성 아이콘 경로
        }
      });
    console.log(`탭 ${tab.id}: 허용되지 않은 사이트 (${tab.url}). 아이콘 비활성화 및 비활성 이미지 설정.`);
  }
}


// 탭이 닫힐 때 해당 탭의 상태를 저장소에서 제거 (선택 사항, 메모리 관리)
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  console.log(`탭 ${tabId}가 닫혔습니다. 저장된 상태를 제거합니다.`);
  chrome.storage.sync.remove(`state_${tabId}`, function() {
    if (chrome.runtime.lastError) {
      console.error(`탭 ${tabId} 상태 제거 오류:`, chrome.runtime.lastError);
    } else {
      console.log(`탭 ${tabId} 상태가 저장소에서 제거되었습니다.`);
    }
  });
});

// 콘텐츠 스크립트로부터 메시지를 수신하는 리스너 추가
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    // 메시지를 보낸 곳이 콘텐츠 스크립트인지 확인
    if (sender.tab) {
        const tabId = sender.tab.id; // 메시지를 보낸 탭의 ID

        if (request.action === 'contentScriptUnloading') {
          console.log(`콘텐츠 스크립트 언로드 감지 (탭 ${tabId}). 상태를 '꺼짐'으로 변경 요청 받음.`);

          // 해당 탭의 상태를 '꺼짐'으로 변경하고 저장합니다.
          chrome.storage.sync.set({ [`state_${tabId}`]: false }, function() {
            if (chrome.runtime.lastError) {
              console.error(`탭 ${tabId} 상태 업데이트 오류:`, chrome.runtime.lastError);
            } else {
              console.log(`탭 ${tabId} 상태가 '꺼짐'으로 저장되었습니다.`);
               // 팝업이 열려있다면 상태 변경을 알릴 수도 있습니다. (선택 사항)
               // chrome.runtime.sendMessage({ action: 'stateUpdatedInStorage', tabId: tabId, state: false });
              sendResponse({ status: 'stateUpdated' }); // 응답 전송 (선택 사항)
            }
          });
          return true; // 비동기 응답을 사용함을 알립니다.

        } else if (request.action === 'requestState') {
            // 콘텐츠 스크립트로부터 현재 상태 요청 받음
            console.log(`탭 ${tabId}로부터 상태 요청 받음.`);
             chrome.storage.sync.get({ [`state_${tabId}`]: false }, function(data) {
                const isOn = data[`state_${tabId}`];
                console.log(`탭 ${tabId} 상태 응답: ${isOn}`);
                sendResponse({ isOn: isOn }); // 현재 상태 응답
             });
             return true; // 비동기 응답을 사용함을 알립니다.
        }
    }
  }
);

console.log('백그라운드 스크립트가 로드되었습니다.');