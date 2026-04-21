// --- 核心配置 ---
const ACCESS_PASSWORD = "131411"; 
const COOKIE_NAME = "gemini_access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login" && request.method === "POST") {
      const formData = await request.formData();
      if (formData.get("password") === ACCESS_PASSWORD) {
        return new Response("OK", {
          status: 302,
          headers: { 
            "Location": "/", 
            "Set-Cookie": COOKIE_NAME + "=" + ACCESS_PASSWORD + "; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax" 
          }
        });
      }
      return new Response("密码错误", { status: 403 });
    }

    const cookies = Object.fromEntries((request.headers.get("Cookie") || "").split('; ').map(x => x.split('=')));
    if (cookies[COOKIE_NAME] !== ACCESS_PASSWORD) {
      return new Response(getLoginHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(getHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    if (url.pathname.startsWith("/v1")) {
      const targetURL = new URL('https://generativelanguage.googleapis.com' + url.pathname + url.search);
      targetURL.searchParams.set('key', env.GOOGLE_API_KEY);
      
      const newRequest = new Request(targetURL, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Host': 'generativelanguage.googleapis.com',
          'X-Forwarded-For': '1.1.1.1'
        },
        body: request.method === 'POST' ? request.body : null
      });
      return fetch(newRequest);
    }
    return new Response("Not Found", { status: 404 });
  }
};

function getLoginHTML() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-900 h-screen flex items-center justify-center"><form action="/login" method="POST" class="bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 shadow-2xl w-80 text-center"><h2 class="text-white text-2xl mb-6 font-bold">验证身份</h2><input type="password" name="password" autofocus class="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Password"><button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">进入</button></form></body></html>`;
}

function getHTML() {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini Pro Chat</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/font-awesome/css/font-awesome.min.css">
    <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
  body { font-family: 'Inter', sans-serif; background: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; margin:0; }
  
  #chat-box { 
    flex: 1; 
    overflow-y: auto; 
    padding: 1.5rem; 
    scroll-behavior: smooth; 
    max-width: 900px; /* 稍微增加容器宽度 */
    margin: 0 auto; 
    width: 100%;
  }
  
  /* 消息气泡基础样式 */
  .message-bubble { 
    max-width: 80%; /* 缩小最大宽度 */
    padding: 0.75rem 1rem; 
    border-radius: 1rem; 
    margin-bottom: 1rem; 
    line-height: 1.5;
    font-size: 0.95rem; /* 稍微减小字号，显得更精致 */
    word-wrap: break-word;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .user-m { 
    background: #4f46e5; 
    color: white; 
    border-bottom-right-radius: 0.2rem; 
    margin-left: auto; 
    width: fit-content;
  }

  .bot-m { 
    background: white; 
    border: 1px solid #e2e8f0; 
    border-bottom-left-radius: 0.2rem; 
    color: #1e293b; 
  }

  /* 核心：限制代码块和超长回复 */
  .bot-m pre {
    background: #1e1e1e !important;
    padding: 10px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
    max-height: 400px; /* 限制代码块高度，防止一个代码块占满全屏 */
  }

  .bot-m code {
    font-size: 0.85rem;
    font-family: 'Fira Code', monospace;
  }

  /* 针对列表和段落的间距微调 */
  .bot-m p { margin-bottom: 0.5rem; }
  .bot-m ul, .bot-m ol { margin-left: 1.5rem; margin-bottom: 0.5rem; }

  /* 输入框容器 */
  .input-wrapper {
    width: 95% !important;
    max-width: 700px !important;
    margin: 0 auto 10px auto !important;
  }
</style>
  </head>
  <body>
    <header class="bg-white/80 backdrop-blur-md border-b px-6 py-4 flex justify-between items-center shadow-sm">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
        <span class="text-xl font-bold text-slate-800">Gemini AI</span>
      </div>
      <select id="model-select" class="bg-slate-100 border-none rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Lite</option>
          <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
      </select>
    </header>

    <main id="chat-box">
      <div id="welcome" class="text-center py-20">
        <h1 class="text-4xl font-bold text-slate-900 mb-2">Hello, Master.</h1>
        <p class="text-slate-500 text-sm font-mono uppercase tracking-widest">Input size optimized</p>
      </div>
    </main>

    <footer class="p-6 bg-transparent">
      <div class="input-wrapper bg-white rounded-[24px] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 focus-within:border-indigo-400 transition-all">
        <textarea id="user-input" rows="1" 
          class="flex-1 bg-transparent p-3 ml-2 outline-none resize-none text-slate-700 placeholder-slate-400 min-h-[44px] max-h-[150px] leading-6" 
          placeholder="问问 Gemini..."></textarea>
        
        <button id="send-btn" 
          class="bg-indigo-600 text-white w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full hover:bg-indigo-700 active:scale-90 transition-all mb-1 mr-1 shadow-md">
          <i class="fa fa-paper-plane" style="font-size: 14px;"></i>
        </button>
      </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js" async></script>

    <script>
      var historyList = [];
      var chatBox = document.getElementById('chat-box');
      var userInput = document.getElementById('user-input');
      var sendBtn = document.getElementById('send-btn');

      function addMessage(role, content, id) {
        var welcome = document.getElementById('welcome');
        if(welcome) welcome.remove();
        var div = document.createElement('div');
        div.className = 'message-bubble ' + (role === 'user' ? 'user-m' : 'bot-m animate-in fade-in');
        if(id) div.id = id;
        if(role === 'user') { div.textContent = content; } 
        else { div.innerHTML = marked.parse(content); }
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      async function sendMessage() {
        var text = userInput.value.trim();
        if (!text) return;
        addMessage('user', text);
        userInput.value = '';
        userInput.style.height = 'auto';
        var botId = 'bot-' + Date.now();
        addMessage('bot', '...', botId);

        try {
          var model = document.getElementById('model-select').value;
          var res = await fetch('/v1beta/models/' + model + ':generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: historyList.concat([{role:'user', parts:[{text: text}]}] ) })
          });
          var data = await res.json();
          var reply = data.candidates[0].content.parts[0].text;
          historyList.push({role:'user', parts:[{text: text}]}, {role:'model', parts:[{text: reply}]});
          var botDiv = document.getElementById(botId);
          botDiv.innerHTML = marked.parse(reply);
          botDiv.querySelectorAll('pre code').forEach(function(el) { hljs.highlightElement(el); });
        } catch (e) {
          document.getElementById(botId).innerHTML = '<span style="color:#ef4444">Error: ' + e.message + '</span>';
        }
      }

      sendBtn.onclick = sendMessage;
      userInput.onkeydown = function(e) {
        if(e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      };
      
      // 自动高度脚本
      userInput.oninput = function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
      };
    </script>
  </body>
  </html>`;
}