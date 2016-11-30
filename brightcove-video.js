/*
    這隻檔案是給 brightcove 嵌在他們的 iframe plugin裡
    Doc : http://docs.brightcove.com/en/video-cloud/brightcove-player/samples/listen-for-play-button.html
 */
var is_ad_is_serving = false;

videojs.plugin('tnl_index', function () {
    var player = this,
        playVideo = function(evt){
            if(evt.data === "playVideo" && !is_ad_is_serving){
                player.play().muted(true);      // 靜音
            }
        },
        pauseVideo = function(evt){
            if(evt.data === "pauseVideo" && !is_ad_is_serving){
                player.pause();
            }
        };
    // 送 postMessage("playVideo","http://players.brightcove.net");
    window.addEventListener("message", playVideo);
    // 送 postMessage("pauseVideo","http://players.brightcove.net");
    window.addEventListener("message", pauseVideo);
});

// 主動開起字幕
videojs.plugin('enableCaptions', function() {
    var myPlayer = this;
    myPlayer.on("play", function() {
        // Start first caption automatically
        try{
            myPlayer.textTracks()[1].mode = "showing";
        }catch (err){
            console.log(err);
        }
    });
});

// 測試
var messageObject = {};
videojs.plugin('listenForPlay', function(){
    var player = this;
    try {

        player.on('play', function () {
            rewriteIris();
            console.log("start playing");
            messageObject.id = player.mediainfo.id;
            messageObject.title = player.mediainfo.name;
            messageObject.image_url = player.mediainfo.poster;
            messageObject.pub_date_tmsp = Math.round(new Date(player.mediainfo.published_at).getTime() / 1000);
            messageObject.type = 'videoPlayEvent';
            parent.postMessage(JSON.stringify(messageObject), "*");
        });
        player.on('pause', function () {
            console.log("pause");
            messageObject.type = 'videoPauseEvent';
            parent.postMessage(JSON.stringify(messageObject), "*");
        });
        player.on('stop', function () {
            // 對 parse.ly 來說只有一個播放跟暫停，但如果自動換下一則，他會以為剛剛那個還在播= =
            console.log("stop playing");
            messageObject.type = 'videoPauseEvent';
            parent.postMessage(JSON.stringify(messageObject), "*");
        });
    }catch(err){
        console.log("error:", err);
    }
});
// Iris Library 覆寫功能
// 要覆寫這隻：https://d1v4mfkbpjku1v.cloudfront.net/brightcove/nextgen/plugin-min.js
// 說明文件：https://iristv.atlassian.net/wiki/pages/viewpage.action?pageId=10027010

var rewriteIris = function(){
    // 自己創一個 function 用來送 event 到 thenewslens 要不然使用者按跳過也抓不到 pause
    IrisPlayer.prototype.ListenOnSkip = function(){
        console.log("fire on skip");
        messageObject.type = 'videoPauseEvent';
        parent.postMessage(JSON.stringify(messageObject), "*");
    };
// 覆寫 skip_forward
    IrisPlayer.prototype.skip_forward = function(callback) {
        this.setBehavior('percentage_watched',this.percentageWatched());
        this.setBehavior("next");
        this.update();
        this.playNextVideo();
        this.ListenOnSkip();            // 自己新增的 code
        this.executeCallback(callback);
    };
// 覆寫 skip_backward
    IrisPlayer.prototype.skip_backward = function(callback) {
        this.playPreviousVideo();
        this.ListenOnSkip();            // 自己新增的 code
        this.executeCallback(callback);
    };
};


// 廣告功能
videojs.plugin('pluginAd', function() {
    /**
     * 廣告跳過功能
     * @type {Element}
     */
    // 插入需要的 CSS
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = ".vjs-skip-ad-button{position: absolute;background: rgba(0,0,0,0.5);color: white;right: 0;bottom: 35px;padding: 10px 30px;cursor: pointer;}.vjs-skip-ad-button:hover{background: #00a1db;}";
    document.head.insertBefore(css, document.head.childNodes[0]);
    // JS
    var player = this,
        overlay = document.createElement('p'),
        timeCount;
    overlay.className = 'vjs-skip-ad-button';
    // 計算每秒鐘
    player.on('ads-ad-started', function (event) {
        is_ad_is_serving = true;
        timeCount = 5;
        overlay.innerHTML = "剩下 " + timeCount + " 秒可以跳過廣告";
        player.el().appendChild(overlay);
        var CountDownSkip = setInterval(function () {
            timeCount--;
            overlay.innerHTML = "剩下 " + timeCount + " 秒可以跳過廣告";
            if (timeCount == 0) StartSkipAd();
        }, 1000);
        var StartSkipAd = function () {
            clearInterval(CountDownSkip);
            overlay.innerHTML = "Skip Ad 〉";
            var detectClick = function () {
                is_ad_is_serving = false;
                player.ima3.adsManager.stop();
                overlay.parentElement.removeChild(overlay);
                unbind();
            };
            overlay.addEventListener("click", detectClick);
            var unbind = function(){
                overlay.removeEventListener("click", detectClick);  // unbind 廣告
                console.log("unbind");
            }
        }
    });
    // 廣告播25%的時候跳出
//                player.on('ads-first-quartile', function(event) {
//
//                });
    // 廣告播完的時候
    player.on('ads-ad-ended', function (event) {
        is_ad_is_serving = false;
        overlay.parentElement.removeChild(overlay);
    });
});
