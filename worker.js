// --- 配置区 ---
const ACCESS_PASSWORD = "1314112"; 
const COOKIE_NAME = "gemini_access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 处理登录请求
    if (url.pathname === "/login" && request.method === "POST") {
      const formData = await request.formData();
      const password = formData.get("password");

      if (password === ACCESS_PASSWORD) {
        return new Response("登录成功", {
          status: 302,
          headers: {
            "Location": "/",
            "Set-Cookie": `${COOKIE_NAME}=${password}; Path=/; HttpOnly; Max-Age=2592000`
          }
        });
      } else {
        return new Response("密码错误！", { status: 403 });
      }
    }

    // 2. 鉴权校验
    const cookieString = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieString.split('; ').map(x => x.split('=')));
    const isAuthorized = cookies[COOKIE_NAME] === ACCESS_PASSWORD;

    if (!isAuthorized) {
      return new Response(getLoginHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // 3. 聊天界面
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(getHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // 4. API 代理
    if (url.pathname.startsWith("/v1")) {
      const targetHost = 'generativelanguage.googleapis.com';
      const targetURL = 'https://' + targetHost + url.pathname + url.search;

      const newHeaders = new Headers(request.headers);
      newHeaders.set('Host', targetHost);
      newHeaders.set('X-Forwarded-For', '1.1.1.1'); 

      const newRequest = new Request(targetURL, {
        method: request.method,
        headers: newHeaders,
        body: request.method === 'POST' ? request.body : null,
        redirect: 'follow'
      });

      try {
        let response = await fetch(newRequest);
        let newResponseHeaders = new Headers(response.headers);
        newResponseHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          headers: newResponseHeaders
        });
      } catch (e) {
        return new Response("代理错误: " + e.message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

function getLoginHTML() {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>身份验证</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-900 h-screen flex items-center justify-center">
    <form action="/login" method="POST" class="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
      <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">请输入访问密码</h2>
      <input type="password" name="password" autofocus
        class="w-full border-2 border-gray-200 rounded-lg px-4 py-3 mb-4 focus:border-blue-500 outline-none transition-all">
      <button type="submit" 
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
        进入系统
      </button>
    </form>
  </body>
  </html>`;
}

function getHTML() {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini 智能助手</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
      .prose pre { background: #1e1e1e; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.5rem 0; }
      .prose code { font-family: monospace; color: #e06c75; }
      .prose pre code { color: #dcdcdc; background: transparent; }
      .prose ul { list-style-type: disc; padding-left: 1.5rem; }
      .prose ol { list-style-type: decimal; padding-left: 1.5rem; }
      .prose p { margin-bottom: 0.5rem; }
      #user-input { scrollbar-width: none; min-height: 44px; max-height: 200px; }
    </style>
  </head>
  <body class="bg-gray-100 h-screen flex flex-col font-sans">
    <header class="bg-white shadow-sm p-4 flex justify-between items-center">
      <h1 class="font-bold text-xl text-blue-600">Gemini 3.x Flash</h1>
      <div class="flex gap-2">
        <button onclick="clearChat()" class="text-sm text-gray-500 hover:text-red-500 px-2">清空对话</button>
        <select id="model-select" class="border rounded-md px-2 py-1 text-sm focus:outline-none bg-gray-50">
          <option value="gemini-3-flash-preview">Gemini 3 Flash</option>  
          <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash lite</option>
        </select>
      </div>
    </header>

    <div id="chat-box" class="flex-1 overflow-y-auto p-4 space-y-6">
      <div class="bg-blue-50 p-3 rounded-lg max-w-[85%] self-start shadow-sm text-gray-700 text-sm">
        系统就绪。对话历史已开启，请输入你的问题。
      </div>
    </div>

    <div class="p-4 bg-white border-t">
      <div class="max-w-4xl mx-auto flex items-end gap-2 bg-gray-50 p-2 rounded-xl border focus-within:border-blue-400 transition-all">
        <textarea id="user-input" rows="1" 
          class="flex-1 bg-transparent border-none px-3 py-2 focus:ring-0 outline-none resize-none overflow-y-auto" 
          placeholder="问问 Gemini..."></textarea>
        <button id="send-btn" onclick="sendMessage()" 
          class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center min-w-[60px] h-[40px]">
          发送
        </button>
      </div>
      <p class="text-[10px] text-gray-400 text-center mt-2">Shift+Enter 换行 | Enter 发送</p>
    </div>

    <script>
      // 1. 初始化对话历史 (用于支持上下文)
      let chatHistory = [];

      // 配置 Markdown 渲染
      marked.setOptions({
        highlight: function(code, lang) {
          return hljs.highlightAuto(code).value;
        },
        breaks: true
      });

      function clearChat() {
        chatHistory = [];
        document.getElementById('chat-box').innerHTML = '<div class="text-center text-gray-400 text-xs py-4">对话已清空</div>';
      }

      // 输入框自动高度调整
      const textarea = document.getElementById('user-input');
      textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      async function sendMessage() {
        const input = document.getElementById('user-input');
        const box = document.getElementById('chat-box');
        const modelSelect = document.getElementById('model-select');
        const sendBtn = document.getElementById('send-btn');
        
        if (!input.value.trim() || sendBtn.disabled) return;

        const userMsg = input.value.trim();
        const selectedModel = modelSelect.value;
        
        // 显示用户消息
        box.innerHTML += \`
          <div class="flex justify-end">
            <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm whitespace-pre-wrap">\${userMsg}</div>
          </div>\`;
        
        // 更新历史记录
        chatHistory.push({ role: "user", parts: [{ text: userMsg }] });
        
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="animate-pulse">...</span>';
        box.scrollTop = box.scrollHeight;

        try {
          // 修改 API Key 建议放到环境变量中更安全
          const apiUrl = "/v1beta/models/" + selectedModel + ":generateContent?key=AIzaSyDeyujuwTb6xhI22DzkW2emqB0HenspZrw";
          
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 发送完整的 chatHistory 数组实现上下文联动
            body: JSON.stringify({ contents: chatHistory })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);

          const reply = data.candidates[0].content.parts[0].text;
          
          // 更新历史记录 (保存 AI 的回复)
          chatHistory.push({ role: "model", parts: [{ text: reply }] });

          // 渲染 Markdown
          const renderedReply = marked.parse(reply);
          
          box.innerHTML += \`
            <div class="flex justify-start">
              <div class="bg-white p-4 rounded-2xl rounded-tl-none max-w-[90%] shadow-sm border border-gray-100 prose text-gray-800 overflow-x-auto">\${renderedReply}</div>
            </div>\`;
          
        } catch (e) {
          box.innerHTML += '<div class="text-red-500 text-center text-sm">错误: ' + e.message + '</div>';
        } finally {
          sendBtn.disabled = false;
          sendBtn.innerText = '发送';
          box.scrollTop = box.scrollHeight;
        }
      }
    </script>
  </body>
  </html>`;
}