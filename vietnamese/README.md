# Nói mỗi ngày · 越南語練習室

由 10/13–11/09 共 14 堂越南語課的整理筆記編寫，使用繁體中文提示。

- 84 個單字：越文示範、翻卡、例句、記得／待加強。
- 42 道句子重組：點選或拖曳詞塊，保留重複詞，依題目參考語序判答。
- 27 個發音練習：越文示範、速度設定、30 秒錄音及本頁回放、辨識文字對照。
- 8 組固定情境、25 回合：瀏覽器語音辨識或打字回答，附參考句及可接受的替代句。
- 按課堂篩選、待加強複習、本機進度保存及 JSON 匯出。

## 使用

部署於 GitHub Pages 的 `/vietnamese/`。純 HTML/CSS/ES modules，不需要安裝套件、後端或 API 金鑰。

本機從此資料夾執行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8765/`。不要直接雙擊 `index.html`，題庫 fetch 與麥克風需要 HTTP localhost 或 HTTPS。

語音設定位於左下角；手機版可點頁尾「關於語音與資料」。先選越南語聲音，再決定是否啟用瀏覽器語音辨識。每次錄音或辨識均由按鈕啟動。若沒有越南語聲音，請在系統朗讀設定加入越南語聲音，或換用提供越南語聲音的瀏覽器。

## 語音與資料界線

文字一致度是辨識文字與參考句的詞級比對，不是音素、聲調或口音評分。聲調符號有差異時保留差異；不把 ASR 結果當作實際發音診斷。對話為固定練習，不是生成式自由聊天；未收錄的合理回答也可能無法自動通過。

錄音 Blob 只暫存在本頁，切題、離開或關閉頁面後清除；網站不儲存或上傳錄音。瀏覽器自己的語音辨識及部分示範聲音可能使用外部語音服務，介面於啟用前說明。辨識服務可能不支援所在瀏覽器、地區或語言，失敗時可改用錄音回放與文字練習。

練習進度使用 localStorage，限同一瀏覽器及網站來源，沒有帳號與跨裝置同步。Google Fonts 提供字型；沒有分析追蹤碼。題庫只含教材詞句與改寫情境，不包含課堂錄影、完整逐字稿、私人聊天或真實聯絡資料。練習人稱依情境指定，並非使用者個人資料。

API 參考：[SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)、[SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)、[MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)。

## 維護

`content.json` 放課程、詞彙、重組句、對話及跟讀目標；`app.js` 負責互動，`speech.js` 處理語音生命週期，`core.js` 處理練習紀錄與詞塊。

新增重組題時，`tokens.join(' ')` 必須完全等於 `vi`；使用唯一 ID 與存在的 lesson ID。公開版題庫需避免私人課堂內容。
