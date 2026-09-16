(function () {
  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var scripts = document.querySelectorAll('script[widget-id]');
    if (scripts.length) scriptEl = scripts[scripts.length - 1];
  }
  var widgetId = scriptEl ? scriptEl.getAttribute('widget-id') : null;
  if (!widgetId) return;

  var baseUrl = '';
  if (scriptEl && scriptEl.src) {
    baseUrl = scriptEl.src.split('/wa-widget.js')[0];
  } else if (window.location.origin && window.location.origin !== 'null') {
    baseUrl = window.location.origin;
  }
  var configUrl = baseUrl + '/api/wa-widget/' + widgetId;
  
  console.log('[Watibot Widget] Initializing...', { widgetId: widgetId, configUrl: configUrl });

  fetch(configUrl)
    .then(function (r) { 
      if (!r.ok) throw new Error('API returned ' + r.status);
      return r.json(); 
    })
    .then(function (cfg) { 
      mountWidget(cfg); 
    })
    .catch(function (err) { 
      console.error('[Watibot Widget] Could not load config for widget:', widgetId, err); 
    });

  function replaceVars(str, rule) {
    if (!str) return '';
    var s = str.replace(/\{\{page_url\}\}/g, window.location.href)
               .replace(/\{\{page_title\}\}/g, document.title || '');
    if (rule) {
      if (rule.removeChars) s = s.replace(/[-_]/g, ' ');
      if (rule.capitalize) s = s.charAt(0).toUpperCase() + s.slice(1);
    }
    return s;
  }

  function mountWidget(cfg) {
    var phone = cfg.phone || '';
    var buttonBgColor = cfg.buttonBgColor || '#4dc247';
    var ctaText = cfg.ctaText || 'Chat with us';
    var mb = typeof cfg.marginBottom === 'number' ? cfg.marginBottom : 30;
    var ml = typeof cfg.marginLeft === 'number' ? cfg.marginLeft : 30;
    var mr = typeof cfg.marginRight === 'number' ? cfg.marginRight : 30;
    var borderRadius = typeof cfg.borderRadius === 'number' ? cfg.borderRadius : 24;
    var position = cfg.position || 'Bottom-Right';
    var isRight = position !== 'Bottom-Left';
    var brandName = cfg.brandName || 'WhatsApp';
    var brandSubtitle = cfg.brandSubtitle || 'Typically replies within minutes';
    var brandColor = cfg.brandColor || '#00a884';
    var brandImageUrl = cfg.brandImageUrl || '';
    var widgetCtaText = cfg.widgetCtaText || 'Send';
    var prefillMsg = cfg.prefillMsg || '';
    var onScreenMsg = cfg.onScreenMsg || 'Hi,\nHow can I help you?';
    var automationType = cfg.automationType || 'none';
    var isAutomated = automationType === 'ai_agent' || automationType === 'flow';

    if (cfg.urlPersonalizationEnabled && cfg.urlRules && cfg.urlRules.length > 0) {
      var currentUrl = window.location.href;
      for (var i = 0; i < cfg.urlRules.length; i++) {
        var rule = cfg.urlRules[i];
        if (rule.sourceUrl && currentUrl.indexOf(rule.sourceUrl) !== -1) {
          if (rule.prefillMsg) prefillMsg = rule.prefillMsg;
          if (rule.onScreenMsg) onScreenMsg = rule.onScreenMsg;
          prefillMsg = replaceVars(prefillMsg, rule);
          onScreenMsg = replaceVars(onScreenMsg, rule);
          break;
        }
      }
    } else {
      prefillMsg = replaceVars(prefillMsg);
      onScreenMsg = replaceVars(onScreenMsg);
    }

    var styles = '\
      #wb-root { position:fixed; z-index:99999; ' + (isRight ? 'right:'+mr+'px;' : 'left:'+ml+'px;') + ' bottom:'+mb+'px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }\
      #wb-btn { display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:'+borderRadius+'px; background:'+buttonBgColor+'; color:#fff; cursor:pointer; box-shadow:0 4px 20px rgba(0,0,0,.22); border:none; transition:transform .2s cubic-bezier(0.16,1,0.3,1), box-shadow .2s; font-weight:600; font-size:14px; }\
      #wb-btn:hover { transform:scale(1.05); box-shadow:0 6px 24px rgba(0,0,0,.28); }\
      #wb-btn:active { transform:scale(0.98); }\
      #wb-bubble { position:absolute; bottom:calc(100% + 14px); ' + (isRight ? 'right:0;' : 'left:0;') + ' width:360px; max-width:calc(100vw - 32px); background:#fff; border-radius:18px; box-shadow:0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.06); overflow:hidden; display:none; opacity:0; transform:translateY(12px) scale(0.98); transition:opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1); flex-direction:column; }\
      #wb-bubble.wb-open { display:flex; opacity:1; transform:translateY(0) scale(1); }\
      #wb-head { background:'+brandColor+'; padding:12px 16px; display:flex; align-items:center; gap:12px; color:#fff; position:relative; box-shadow:0 1px 3px rgba(0,0,0,.1); }\
      #wb-head-avatar { width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }\
      #wb-head-avatar img { width:100%; height:100%; object-fit:cover; }\
      #wb-head-info { flex:1; min-width:0; }\
      #wb-head-name { color:#fff; font-size:15px; font-weight:700; margin:0; line-height:1.25; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; }\
      #wb-head-tag { color:rgba(255,255,255,.88); font-size:11.5px; margin:2px 0 0; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:flex; align-items:center; gap:5px; }\
      .wb-status-dot { width:7px; height:7px; background:#25d366; border-radius:50%; display:inline-block; flex-shrink:0; }\
      #wb-chat { background-color:#efeae2; background-image:radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px); background-size:16px 16px; padding:16px 14px; min-height:220px; max-height:380px; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth; box-sizing:border-box; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,0.18) transparent; }\
      #wb-chat::-webkit-scrollbar { width:5px; }\
      #wb-chat::-webkit-scrollbar-track { background:transparent; }\
      #wb-chat::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.18); border-radius:6px; }\
      #wb-chat::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,0.3); }\
      #wb-msg-list { display:flex; flex-direction:column; gap:8px; width:100%; }\
      .wb-msg { display:flex; flex-direction:column; width:100%; box-sizing:border-box; animation:wbMsgIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }\
      .wb-msg-inbound { align-items:flex-start; }\
      .wb-msg-outbound { align-items:flex-end; }\
      .wb-msg-inbound + .wb-msg-outbound, .wb-msg-outbound + .wb-msg-inbound { margin-top:6px; }\
      .wb-bubble-bot { background:#fff; color:#111b21; border-radius:12px 12px 12px 3px; padding:8px 12px 6px 12px; font-size:13.5px; line-height:1.45; box-shadow:0 1px 1.5px rgba(11,20,26,.12); word-break:break-word; max-width:86%; position:relative; box-sizing:border-box; }\
      .wb-bubble-user { background:#d9fdd3; color:#111b21; border-radius:12px 12px 3px 12px; padding:8px 12px 6px 12px; font-size:13.5px; line-height:1.45; box-shadow:0 1px 1.5px rgba(11,20,26,.12); word-break:break-word; max-width:86%; position:relative; box-sizing:border-box; }\
      .wb-bubble-bot::after, .wb-bubble-user::after { content:""; display:table; clear:both; }\
      .wb-text-content { white-space:pre-wrap; font-size:13.5px; line-height:1.45; color:#111b21; }\
      .wb-time-wrap { display:inline-flex; align-items:center; justify-content:flex-end; gap:3px; margin-top:4px; float:right; margin-left:10px; user-select:none; }\
      .wb-time { font-size:10.5px; color:#667781; line-height:1; }\
      .wb-check { width:14px; height:10px; display:inline-block; vertical-align:middle; }\
      .wb-buttons-container { display:flex; flex-direction:column; gap:6px; margin-top:8px; width:100%; max-width:86%; }\
      .wb-opt-btn { background:#fff; border:1px solid #d1d7db; color:' + brandColor + '; padding:8px 14px; border-radius:18px; font-size:13px; font-weight:600; cursor:pointer; text-align:center; transition:all .18s ease; width:100%; box-sizing:border-box; box-shadow:0 1px 2px rgba(0,0,0,.04); }\
      .wb-opt-btn:hover:not(:disabled) { background:' + brandColor + '; color:#fff; border-color:' + brandColor + '; transform:translateY(-1px); box-shadow:0 2px 5px rgba(0,0,0,.1); }\
      .wb-opt-btn:active:not(:disabled) { transform:translateY(0); }\
      .wb-opt-btn:disabled { opacity:0.55; cursor:default; border-color:#e5e7eb; color:#94a3b8; background:#f8fafc; }\
      .wb-media-img { width:100%; max-height:220px; object-fit:cover; border-radius:8px; margin-bottom:4px; display:block; cursor:pointer; transition:opacity .15s ease; }\
      .wb-media-img:hover { opacity:0.95; }\
      .wb-media-video { width:100%; max-height:220px; border-radius:8px; margin-bottom:4px; display:block; background:#000; outline:none; }\
      .wb-media-audio-wrap { display:flex; flex-direction:column; gap:4px; width:100%; min-width:210px; max-width:260px; margin-bottom:4px; }\
      .wb-audio-elem { width:100%; height:36px; outline:none; border-radius:18px; }\
      .wb-doc-attachment { display:flex; align-items:center; gap:10px; padding:8px 10px; background:rgba(0,0,0,0.04); border-radius:8px; text-decoration:none; color:#111b21; margin-bottom:4px; transition:background .15s ease; }\
      .wb-doc-attachment:hover { background:rgba(0,0,0,0.08); }\
      .wb-doc-icon { flex-shrink:0; color:' + brandColor + '; display:flex; align-items:center; }\
      .wb-doc-meta { display:flex; flex-direction:column; overflow:hidden; min-width:0; }\
      .wb-doc-name { font-size:12.5px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; }\
      .wb-doc-sub { font-size:11px; color:#667781; }\
      .wb-typing { align-self:flex-start; background:#fff; border-radius:12px 12px 12px 3px; padding:8px 14px; box-shadow:0 1px 1.5px rgba(11,20,26,.12); display:none; align-items:center; gap:4px; }\
      .wb-typing.wb-show { display:flex; }\
      .wb-dot { width:6px; height:6px; background:#8696a0; border-radius:50%; animation:wbBounce 1.2s infinite ease-in-out; }\
      .wb-dot:nth-child(2) { animation-delay:0.2s; }\
      .wb-dot:nth-child(3) { animation-delay:0.4s; }\
      @keyframes wbBounce { 0%,80%,100%{ transform:scale(0.6); opacity:0.5; } 40%{ transform:scale(1); opacity:1; } }\
      @keyframes wbMsgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }\
      @keyframes wbPulse { 0%{ transform:scale(0.92); opacity:0.75; } 50%{ transform:scale(1.15); opacity:1; } 100%{ transform:scale(0.92); opacity:0.75; } }\
      #wb-attach-preview { display:none; align-items:center; justify-content:space-between; padding:8px 12px; background:#f0f2f5; border-top:1px solid #e9edef; font-size:12.5px; color:#111b21; gap:8px; box-sizing:border-box; }\
      #wb-preview-info { display:flex; align-items:center; gap:8px; overflow:hidden; min-width:0; }\
      #wb-preview-thumb { width:32px; height:32px; border-radius:6px; background:#e2e8f0; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }\
      #wb-preview-name { font-size:12px; font-weight:500; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; }\
      #wb-preview-clear { background:none; border:none; color:#667781; cursor:pointer; font-size:18px; line-height:1; padding:2px 6px; border-radius:50%; }\
      #wb-preview-clear:hover { color:#111b21; background:rgba(0,0,0,.08); }\
      #wb-input-area { border-top:1px solid #e9edef; display:flex; align-items:center; padding:8px 10px; gap:6px; background:#f0f2f5; box-sizing:border-box; }\
      .wb-action-icon-btn { width:34px; height:34px; border-radius:50%; background:transparent; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#54656f; transition:background .15s ease, color .15s ease, transform .15s ease; }\
      .wb-action-icon-btn:hover { background:rgba(0,0,0,0.06); color:#111b21; }\
      .wb-action-icon-btn:active { transform:scale(0.95); }\
      .wb-action-icon-btn.wb-rec-active { background:#ea4335 !important; color:#fff !important; animation:wbPulse 1.2s infinite; }\
      #wb-msg-input { flex:1; min-width:0; border:1px solid #d1d7db; background:#fff; border-radius:20px; padding:8px 14px; font-size:13.5px; color:#111b21; outline:none; transition:border-color .2s, box-shadow .2s; font-family:inherit; box-sizing:border-box; }\
      #wb-msg-input:focus { border-color:' + brandColor + '; box-shadow:0 0 0 2px ' + brandColor + '22; }\
      #wb-msg-input::placeholder { color:#8696a0; }\
      #wb-voice-bar { flex:1; display:none; align-items:center; gap:10px; background:#fff; border:1px solid #d1d7db; border-radius:20px; padding:6px 14px; box-sizing:border-box; }\
      .wb-rec-pulse { width:10px; height:10px; border-radius:50%; background:#ea4335; animation:wbPulse 1.1s infinite; flex-shrink:0; }\
      #wb-rec-time { font-size:13px; font-weight:600; color:#ea4335; min-width:34px; flex:1; }\
      #wb-rec-cancel { background:none; border:none; cursor:pointer; padding:2px; display:flex; align-items:center; color:#ea4335; border-radius:4px; }\
      #wb-rec-cancel:hover { background:rgba(234,67,53,0.1); }\
      #wb-send-btn { width:36px; height:36px; border-radius:50%; background:' + buttonBgColor + '; color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease; box-shadow:0 2px 6px rgba(0,0,0,.15); }\
      #wb-send-btn:hover:not(:disabled) { transform:scale(1.06); box-shadow:0 3px 8px rgba(0,0,0,.22); }\
      #wb-send-btn:active:not(:disabled) { transform:scale(0.96); }\
      #wb-send-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; box-shadow:none; }\
      #wb-close { position:absolute; top:13px; right:14px; background:rgba(0,0,0,0.18); border-radius:50%; width:26px; height:26px; border:none; color:#fff; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; line-height:1; transition:background .15s ease, transform .15s ease; }\
      #wb-close:hover { background:rgba(0,0,0,0.3); transform:scale(1.08); }\
      @media (max-width: 480px) {\
        #wb-bubble { width:calc(100vw - 32px); position:fixed; bottom:76px; left:16px !important; right:16px !important; }\
      }\
    ';
    var styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    var avatarHtml = brandImageUrl 
      ? '<img src="' + escHtml(brandImageUrl) + '" alt="Avatar" onerror="this.outerHTML=\'<svg width=22 height=22 viewBox=\\\'0 0 24 24\\\' fill=\\\'white\\\'><path d=\\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\\'/></svg>\'" />'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

    var existingRoot = document.getElementById('wb-root');
    if (existingRoot) existingRoot.remove();

    var root = document.createElement('div');
    root.id = 'wb-root';
    root.innerHTML = '\
      <div id="wb-bubble">\
        <div id="wb-head">\
          <div id="wb-head-avatar">' + avatarHtml + '</div>\
          <div id="wb-head-info">\
            <p id="wb-head-name">' + escHtml(brandName) + '</p>\
            <p id="wb-head-tag"><span class="wb-status-dot"></span>' + escHtml(brandSubtitle) + '</p>\
          </div>\
          <button id="wb-close" onclick="window.wbCloseBubble()" title="Close">&times;</button>\
        </div>\
        <div id="wb-chat">\
          <div id="wb-msg-list"></div>\
          <div id="wb-typing-ind" class="wb-typing">\
            <span class="wb-dot"></span>\
            <span class="wb-dot"></span>\
            <span class="wb-dot"></span>\
          </div>\
        </div>\
        <div id="wb-attach-preview">\
          <div id="wb-preview-info">\
            <div id="wb-preview-thumb"></div>\
            <span id="wb-preview-name"></span>\
          </div>\
          <button id="wb-preview-clear" type="button" onclick="window.wbClearAttachment()" title="Remove file">&times;</button>\
        </div>\
        <div id="wb-input-area">\
          <input id="wb-file-input" type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt" style="display:none;" onchange="window.wbOnFileSelected(event)" />\
          <button id="wb-attach-btn" class="wb-action-icon-btn" type="button" onclick="window.wbTriggerFileInput()" title="Attach file, image, or video">\
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>\
            </svg>\
          </button>\
          <input id="wb-msg-input" type="text" placeholder="Type a message..." value="' + escHtml(prefillMsg) + '" onkeypress="if(event.key === \'Enter\') window.wbSendMsg()" />\
          <div id="wb-voice-bar">\
            <span class="wb-rec-pulse"></span>\
            <span id="wb-rec-time">0:00</span>\
            <button id="wb-rec-cancel" type="button" onclick="window.wbCancelRecording()" title="Cancel recording">\
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>\
            </button>\
          </div>\
          <button id="wb-mic-btn" class="wb-action-icon-btn" type="button" onclick="window.wbToggleRecording()" title="Record voice message">\
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>\
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>\
              <line x1="12" y1="19" x2="12" y2="23"></line>\
              <line x1="8" y1="23" x2="16" y2="23"></line>\
            </svg>\
          </button>\
          <button id="wb-send-btn" onclick="window.wbSendMsg()" title="' + escHtml(widgetCtaText) + '">\
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\
          </button>\
        </div>\
      </div>\
      <button id="wb-btn" onclick="window.wbToggleBubble()">\
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.328-.01-.503-.01-.174 0-.457.065-.695.325-.24.26-.913.892-.913 2.174 0 1.282.933 2.518 1.063 2.69.13.173 1.837 2.805 4.45 3.934.62.268 1.105.429 1.482.548.624.199 1.192.171 1.64.103.5-.076 1.537-.628 1.753-1.235.217-.607.217-1.127.152-1.235-.065-.108-.238-.172-.497-.303zM12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413A11.815 11.815 0 0012.05 0z"/></svg>\
        ' + escHtml(ctaText) + '\
      </button>\
    ';
    document.body.appendChild(root);

    var bubble = document.getElementById('wb-bubble');
    var msgList = document.getElementById('wb-msg-list');
    var typingInd = document.getElementById('wb-typing-ind');
    var chatScroll = document.getElementById('wb-chat');
    var isMobile = window.innerWidth <= 768;

    window.wbToggleBubble = function () {
      bubble.classList.toggle('wb-open');
      if (bubble.classList.contains('wb-open')) {
        setTimeout(scrollToBottom, 50);
        var inp = document.getElementById('wb-msg-input');
        if (inp && !isMobile) inp.focus();
      }
    };
    
    window.wbCloseBubble = function () {
      bubble.classList.remove('wb-open');
      localStorage.setItem('wb_closed_' + widgetId, Date.now().toString());
    };

    function scrollToBottom() {
      if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
    }

    function getTimeStr(dateObj) {
      var d = dateObj ? new Date(dateObj) : new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMessage(direction, text, extra) {
      if (!msgList) return;
      var isUser = direction === 'outbound' || direction === 'user';

      // Defensive formatting: If AI response is raw JSON, extract customer-facing text
      if (!isUser && text && typeof text === 'string') {
        var trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('```')) {
          try {
            var rawJson = trimmed;
            if (rawJson.startsWith('```')) {
              rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
            }
            var firstBrace = rawJson.indexOf('{');
            var lastBrace = rawJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              var parsed = JSON.parse(rawJson.substring(firstBrace, lastBrace + 1));
              if (parsed && (parsed.reply || parsed.message || parsed.response)) {
                text = parsed.reply || parsed.message || parsed.response;
              }
              if (parsed && Array.isArray(parsed.media) && parsed.media.length > 0 && (!extra || !extra.mediaUrl)) {
                if (!extra) extra = {};
                extra.mediaUrl = parsed.media[0].url;
                extra.type = parsed.media[0].type;
              }
            }
          } catch (e) {}
        }
      }

      var cleanText = (text || '').trim();

      // De-duplication check: avoid appending identical message if already present
      if (extra && extra.id) {
        if (msgList.querySelector('[data-msg-id="' + extra.id + '"]')) return;
      }
      var lastMsg = msgList.lastElementChild;
      if (lastMsg) {
        var lastDir = lastMsg.getAttribute('data-direction');
        var lastText = lastMsg.getAttribute('data-text');
        var lastMedia = lastMsg.getAttribute('data-media');
        var lastTime = parseInt(lastMsg.getAttribute('data-ts') || '0', 10);
        var curMedia = extra && extra.mediaUrl ? extra.mediaUrl : '';
        if (lastDir === (isUser ? 'user' : 'bot') && lastText === cleanText && lastMedia === curMedia && (Date.now() - lastTime < 3500)) {
          return;
        }
      }

      var container = document.createElement('div');
      container.className = 'wb-msg ' + (isUser ? 'wb-msg-outbound' : 'wb-msg-inbound');
      container.setAttribute('data-direction', isUser ? 'user' : 'bot');
      container.setAttribute('data-text', cleanText);
      container.setAttribute('data-media', extra && extra.mediaUrl ? extra.mediaUrl : '');
      container.setAttribute('data-ts', Date.now().toString());
      if (extra && extra.id) {
        container.setAttribute('data-msg-id', extra.id);
      }

      var bubbleEl = document.createElement('div');
      bubbleEl.className = isUser ? 'wb-bubble-user' : 'wb-bubble-bot';

      // Media Rendering: Images, Videos, Audio/Voice Notes, Documents
      if (extra && extra.mediaUrl) {
        var rawMediaUrl = extra.mediaUrl;
        if (rawMediaUrl.startsWith('/') && baseUrl) {
          rawMediaUrl = baseUrl + rawMediaUrl;
        }
        var mType = (extra.type || extra.mediaType || '').toLowerCase();
        var lowerUrl = rawMediaUrl.toLowerCase();
        var isAudio = mType === 'audio' || mType === 'voice' || lowerUrl.match(/\.(mp3|ogg|wav|m4a|aac|opus)($|\?)/);
        var isVideo = mType === 'video' || lowerUrl.match(/\.(mp4|webm|mkv|mov|3gp)($|\?)/);
        var isImage = mType === 'image' || lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/);

        if (isAudio) {
          var audioWrap = document.createElement('div');
          audioWrap.className = 'wb-media-audio-wrap';
          var audioEl = document.createElement('audio');
          audioEl.controls = true;
          audioEl.preload = 'metadata';
          audioEl.src = rawMediaUrl;
          audioEl.className = 'wb-audio-elem';
          audioEl.onloadedmetadata = scrollToBottom;
          audioWrap.appendChild(audioEl);
          bubbleEl.appendChild(audioWrap);
          // Suppress redundant default text if it matches placeholder
          if (cleanText === '🎤 Voice message' || cleanText === '[AUDIO]' || cleanText === 'Voice message') {
            cleanText = '';
          }
        } else if (isVideo) {
          var videoEl = document.createElement('video');
          videoEl.controls = true;
          videoEl.playsInline = true;
          videoEl.src = rawMediaUrl;
          videoEl.className = 'wb-media-video';
          videoEl.onloadeddata = scrollToBottom;
          bubbleEl.appendChild(videoEl);
          if (cleanText === '📹 Video' || cleanText === '[VIDEO]') {
            cleanText = '';
          }
        } else if (isImage || (!mType && !isAudio && !isVideo && !lowerUrl.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv|zip)($|\?)/))) {
          var img = document.createElement('img');
          img.src = rawMediaUrl;
          img.className = 'wb-media-img';
          img.alt = 'Photo';
          img.onload = scrollToBottom;
          img.onclick = function() { window.open(rawMediaUrl, '_blank'); };
          img.onerror = function() { this.style.display = 'none'; };
          bubbleEl.appendChild(img);
          if (cleanText === '📷 Photo' || cleanText === '[IMAGE]') {
            cleanText = '';
          }
        } else {
          // Document / file attachment
          var docLink = document.createElement('a');
          docLink.href = rawMediaUrl;
          docLink.target = '_blank';
          docLink.className = 'wb-doc-attachment';
          var docName = extra.fileName || (rawMediaUrl.split('/').pop() || 'Attachment');
          docLink.innerHTML = '\
            <div class="wb-doc-icon">\
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>\
            </div>\
            <div class="wb-doc-meta">\
              <span class="wb-doc-name">' + escHtml(docName) + '</span>\
              <span class="wb-doc-sub">Download / Open</span>\
            </div>\
          ';
          bubbleEl.appendChild(docLink);
          if (cleanText && (cleanText.indexOf(docName) !== -1 || cleanText === '[DOCUMENT]')) {
            cleanText = '';
          }
        }
      }

      if (cleanText && cleanText.length > 0) {
        var textP = document.createElement('div');
        textP.className = 'wb-text-content';
        textP.textContent = cleanText;
        bubbleEl.appendChild(textP);
      }

      var timeWrap = document.createElement('div');
      timeWrap.className = 'wb-time-wrap';

      var timeEl = document.createElement('span');
      timeEl.className = 'wb-time';
      timeEl.textContent = getTimeStr(extra && extra.createdAt);
      timeWrap.appendChild(timeEl);

      if (isUser) {
        var checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkSvg.setAttribute('viewBox', '0 0 16 11');
        checkSvg.setAttribute('class', 'wb-check');
        checkSvg.innerHTML = '<path d="M11.05 0.5L4.5 7.05L1.95 4.5L0.5 5.95L4.5 9.95L12.5 1.95L11.05 0.5Z" fill="#53bdeb"/><path d="M14.55 0.5L8 7.05L6.95 6L5.5 7.45L8 9.95L16 1.95L14.55 0.5Z" fill="#53bdeb"/>';
        timeWrap.appendChild(checkSvg);
      }

      bubbleEl.appendChild(timeWrap);
      container.appendChild(bubbleEl);

      // Render interactive buttons/options for flows
      var buttons = [];
      if (extra && extra.interactiveData) {
        var action = extra.interactiveData.action;
        if (action && action.buttons && Array.isArray(action.buttons)) {
          buttons = action.buttons;
        } else if (action && action.sections && Array.isArray(action.sections)) {
          action.sections.forEach(function(s) {
            if (s.rows && Array.isArray(s.rows)) buttons = buttons.concat(s.rows);
          });
        }
      } else if (extra && extra.buttons && Array.isArray(extra.buttons)) {
        buttons = extra.buttons;
      }

      if (buttons && buttons.length > 0) {
        var btnContainer = document.createElement('div');
        btnContainer.className = 'wb-buttons-container';
        buttons.forEach(function(b) {
          var bTitle = b.reply ? b.reply.title : (b.text || b.title || 'Option');
          var bId = b.reply ? b.reply.id : (b.id || bTitle);
          var optBtn = document.createElement('button');
          optBtn.className = 'wb-opt-btn';
          optBtn.textContent = bTitle;
          optBtn.onclick = function() {
            var siblingBtns = btnContainer.querySelectorAll('.wb-opt-btn');
            siblingBtns.forEach(function(sb) { sb.disabled = true; });
            dispatchMessage(bTitle, bId);
          };
          btnContainer.appendChild(optBtn);
        });
        container.appendChild(btnContainer);
      }

      msgList.appendChild(container);
      scrollToBottom();
    }

    // Visitor Session ID
    var sessionKey = 'watibot_sess_' + widgetId;
    var sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = 'vis_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem(sessionKey, sessionId);
    }

    var isSending = false;

    function dispatchMessage(msgText, buttonId, mediaData) {
      if (isSending) return;
      var cleanMsg = (msgText || '').trim();
      if (!cleanMsg && !buttonId && !mediaData) return;

      appendMessage('user', cleanMsg, mediaData);
      isSending = true;
      if (typingInd) typingInd.classList.add('wb-show');
      scrollToBottom();

      var sendBtn = document.getElementById('wb-send-btn');
      if (sendBtn) sendBtn.disabled = true;

      var payload = {
        sessionId: sessionId,
        message: cleanMsg,
        buttonId: buttonId || null
      };

      if (mediaData) {
        payload.mediaUrl = mediaData.mediaUrl;
        payload.mediaType = mediaData.mediaType;
        payload.fileName = mediaData.fileName;
      }

      fetch(baseUrl + '/api/wa-widget/' + widgetId + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        isSending = false;
        if (typingInd) typingInd.classList.remove('wb-show');
        if (sendBtn) sendBtn.disabled = false;

        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(function(m) {
            appendMessage('bot', m.content, m);
          });
        } else if (data.error) {
          appendMessage('bot', data.error);
        }
      })
      .catch(function(err) {
        console.error('[Watibot Widget] Send failed:', err);
        isSending = false;
        if (typingInd) typingInd.classList.remove('wb-show');
        if (sendBtn) sendBtn.disabled = false;
        appendMessage('bot', 'Sorry, could not connect. Please try again.');
      });
    }

    // Media & File Upload Handling
    var currentAttachedFile = null;

    function uploadFile(file, cb) {
      var fd = new FormData();
      fd.append('file', file);
      fd.append('sessionId', sessionId);

      fetch(baseUrl + '/api/wa-widget/' + widgetId + '/upload', {
        method: 'POST',
        body: fd
      })
      .then(function(r) {
        if (!r.ok) throw new Error('Upload failed with status ' + r.status);
        return r.json();
      })
      .then(function(data) {
        if (data.error) throw new Error(data.error);
        cb(null, data);
      })
      .catch(function(err) {
        console.error('[Watibot Widget] File upload error:', err);
        cb(err);
      });
    }

    window.wbTriggerFileInput = function () {
      if (!isAutomated) {
        // If automation is None, redirect directly to WhatsApp
        var clean = phone.replace(/\D/g, '');
        window.open('https://wa.me/' + clean, '_blank');
        return;
      }
      var fileInput = document.getElementById('wb-file-input');
      if (fileInput) fileInput.click();
    };

    window.wbClearAttachment = function () {
      currentAttachedFile = null;
      var fileInput = document.getElementById('wb-file-input');
      if (fileInput) fileInput.value = '';
      var preview = document.getElementById('wb-attach-preview');
      if (preview) preview.style.display = 'none';
    };

    window.wbOnFileSelected = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      currentAttachedFile = file;
      var preview = document.getElementById('wb-attach-preview');
      var thumb = document.getElementById('wb-preview-thumb');
      var nameEl = document.getElementById('wb-preview-name');

      if (preview && thumb && nameEl) {
        var sizeStr = file.size > 1048576 
          ? (file.size / 1048576).toFixed(1) + ' MB' 
          : Math.round(file.size / 1024) + ' KB';
        nameEl.textContent = file.name + ' (' + sizeStr + ')';

        if (file.type.startsWith('image/')) {
          var reader = new FileReader();
          reader.onload = function(evt) {
            thumb.innerHTML = '<img src="' + evt.target.result + '" style="width:100%;height:100%;object-fit:cover;" />';
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
          thumb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + brandColor + '"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
        } else if (file.type.startsWith('audio/')) {
          thumb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + brandColor + '"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
        } else {
          thumb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + brandColor + '"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
        }
        preview.style.display = 'flex';
        var inp = document.getElementById('wb-msg-input');
        if (inp && !isMobile) inp.focus();
      }
    };

    // Voice Message Recording Handling
    var mediaRecorder = null;
    var audioStream = null;
    var audioChunks = [];
    var recTimerInterval = null;
    var recStartTime = 0;

    window.wbToggleRecording = function () {
      if (!isAutomated) {
        var clean = phone.replace(/\D/g, '');
        window.open('https://wa.me/' + clean, '_blank');
        return;
      }
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        window.wbFinishAndSendRecording();
      } else {
        window.wbStartRecording();
      }
    };

    window.wbStartRecording = function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice message recording is not supported in this browser.');
        return;
      }

      window.wbClearAttachment();

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
          audioStream = stream;
          audioChunks = [];

          var mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4'
          ];
          var supportedMime = '';
          for (var i = 0; i < mimeTypes.length; i++) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeTypes[i])) {
              supportedMime = mimeTypes[i];
              break;
            }
          }

          var options = supportedMime ? { mimeType: supportedMime } : {};
          try {
            mediaRecorder = new MediaRecorder(stream, options);
          } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
          }

          mediaRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };

          mediaRecorder.start(250);

          // UI switches to recording state
          document.getElementById('wb-msg-input').style.display = 'none';
          document.getElementById('wb-attach-btn').style.display = 'none';
          var voiceBar = document.getElementById('wb-voice-bar');
          if (voiceBar) voiceBar.style.display = 'flex';
          var micBtn = document.getElementById('wb-mic-btn');
          if (micBtn) {
            micBtn.classList.add('wb-rec-active');
            micBtn.title = 'Send voice recording';
          }

          recStartTime = Date.now();
          var timeEl = document.getElementById('wb-rec-time');
          if (timeEl) timeEl.textContent = '0:00';
          recTimerInterval = setInterval(function() {
            var elapsedSec = Math.floor((Date.now() - recStartTime) / 1000);
            var m = Math.floor(elapsedSec / 60);
            var s = elapsedSec % 60;
            if (timeEl) timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
          }, 500);
        })
        .catch(function(err) {
          console.error('[Watibot Widget] Mic access error:', err);
          alert('Microphone permission was denied. Please allow microphone access to record voice messages.');
        });
    };

    window.wbCancelRecording = function () {
      if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
        try { mediaRecorder.stop(); } catch (e) {}
      }
      if (audioStream) {
        audioStream.getTracks().forEach(function(t) { t.stop(); });
        audioStream = null;
      }
      audioChunks = [];
      mediaRecorder = null;

      document.getElementById('wb-msg-input').style.display = '';
      document.getElementById('wb-attach-btn').style.display = '';
      var voiceBar = document.getElementById('wb-voice-bar');
      if (voiceBar) voiceBar.style.display = 'none';
      var micBtn = document.getElementById('wb-mic-btn');
      if (micBtn) {
        micBtn.classList.remove('wb-rec-active');
        micBtn.title = 'Record voice message';
      }
    };

    window.wbFinishAndSendRecording = function () {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
      if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }

      var mimeType = mediaRecorder.mimeType || 'audio/webm';
      var ext = mimeType.indexOf('ogg') !== -1 ? 'ogg' : (mimeType.indexOf('mp4') !== -1 ? 'mp4' : 'webm');

      mediaRecorder.onstop = function () {
        if (audioStream) {
          audioStream.getTracks().forEach(function(t) { t.stop(); });
          audioStream = null;
        }

        if (audioChunks.length === 0) {
          window.wbCancelRecording();
          return;
        }

        var audioBlob = new Blob(audioChunks, { type: mimeType });
        var audioFile = new File([audioBlob], 'voice-message-' + Date.now() + '.' + ext, { type: mimeType });

        // Restore input UI
        document.getElementById('wb-msg-input').style.display = '';
        document.getElementById('wb-attach-btn').style.display = '';
        var voiceBar = document.getElementById('wb-voice-bar');
        if (voiceBar) voiceBar.style.display = 'none';
        var micBtn = document.getElementById('wb-mic-btn');
        if (micBtn) {
          micBtn.classList.remove('wb-rec-active');
          micBtn.title = 'Record voice message';
        }

        var sendBtn = document.getElementById('wb-send-btn');
        if (sendBtn) sendBtn.disabled = true;
        if (typingInd) typingInd.classList.add('wb-show');

        uploadFile(audioFile, function (err, res) {
          if (typingInd) typingInd.classList.remove('wb-show');
          if (sendBtn) sendBtn.disabled = false;

          if (err || !res || !res.url) {
            appendMessage('bot', 'Could not send voice message. Please try again.');
            return;
          }

          dispatchMessage('', null, {
            mediaUrl: res.url,
            mediaType: 'audio',
            fileName: 'Voice message'
          });
        });
      };

      mediaRecorder.stop();
    };

    window.wbSendMsg = function () {
      var input = document.getElementById('wb-msg-input');
      var msg = input ? input.value.trim() : '';

      // Backward Compatibility: If automation is None, redirect directly to WhatsApp!
      if (!isAutomated) {
        var clean = phone.replace(/\D/g, '');
        var url = 'https://wa.me/' + clean + (msg ? '?text=' + encodeURIComponent(msg) : '');
        window.open(url, '_blank');
        return;
      }

      // If currently recording voice message, finish and send it
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        window.wbFinishAndSendRecording();
        return;
      }

      // If an attachment is staged
      if (currentAttachedFile) {
        var fileToSend = currentAttachedFile;
        window.wbClearAttachment();
        if (input) input.value = '';

        var sendBtn = document.getElementById('wb-send-btn');
        if (sendBtn) sendBtn.disabled = true;
        if (typingInd) typingInd.classList.add('wb-show');

        uploadFile(fileToSend, function (err, res) {
          if (typingInd) typingInd.classList.remove('wb-show');
          if (sendBtn) sendBtn.disabled = false;

          if (err || !res || !res.url) {
            appendMessage('bot', 'Could not upload file. Please try again.');
            return;
          }

          var cat = res.category;
          if (!cat) {
            if (fileToSend.type.startsWith('image/')) cat = 'image';
            else if (fileToSend.type.startsWith('video/')) cat = 'video';
            else if (fileToSend.type.startsWith('audio/')) cat = 'audio';
            else cat = 'document';
          }

          dispatchMessage(msg, null, {
            mediaUrl: res.url,
            mediaType: cat,
            fileName: fileToSend.name
          });
        });
        return;
      }

      // Automated Flow / AI Agent live chat text
      if (!msg) return;
      if (input) input.value = '';
      dispatchMessage(msg);
    };

    // Load History or Initial Message for automated widget
    if (isAutomated) {
      fetch(baseUrl + '/api/wa-widget/' + widgetId + '/history?sessionId=' + encodeURIComponent(sessionId))
        .then(function(r) { return r.ok ? r.json() : { messages: [] }; })
        .then(function(hist) {
          if (hist.messages && hist.messages.length > 0) {
            hist.messages.forEach(function(m) {
              appendMessage(m.direction === 'inbound' ? 'user' : 'bot', m.content, m);
            });
          } else {
            // First time: display default on-screen greeting message
            appendMessage('bot', onScreenMsg);
          }
        })
        .catch(function() {
          appendMessage('bot', onScreenMsg);
        });
    } else {
      // Non-automated Click-to-Chat: display on-screen message bubble
      appendMessage('bot', onScreenMsg);
    }

    // Auto-open logic
    setTimeout(function() {
      if (isMobile && cfg.openOnMobile === "No") return;
      if (cfg.openByDefault === "No") return;

      if (cfg.reopenByDefault === "After 24 hour") {
        var closedAt = localStorage.getItem('wb_closed_' + widgetId);
        if (closedAt) {
          var hoursSinceClosed = (Date.now() - parseInt(closedAt)) / (1000 * 60 * 60);
          if (hoursSinceClosed < 24) return;
        }
      } else if (cfg.reopenByDefault === "Always") {
        // Ignored localStorage close state
      }

      bubble.classList.add('wb-open');
      setTimeout(scrollToBottom, 50);
    }, 1000);
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
