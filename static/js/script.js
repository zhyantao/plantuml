document.addEventListener('DOMContentLoaded', function () {
    const editor = document.getElementById('uml-editor');
    const preview = document.getElementById('preview');
    const renderBtn = document.getElementById('render-btn');
    const clearBtn = document.getElementById('clear-btn');
    const exportBtn = document.getElementById('export-btn');
    const formatBtn = document.getElementById('format-btn');
    const formatSelect = document.getElementById('format-select');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('spinner');
    const errorDiv = document.getElementById('error');
    const exampleBtns = document.querySelectorAll('.example-btn');

    // 设置初始状态
    let isProcessing = false;
    window.lastGeneratedFile = null;

    // 初始渲染
    renderDiagram();

    // 监听编辑器变化
    editor.addEventListener('input', debounce(renderDiagram, 1000));

    // 渲染按钮点击事件
    renderBtn.addEventListener('click', renderDiagram);

    // 清空按钮点击事件
    clearBtn.addEventListener('click', function () {
        editor.value = '';
        preview.innerHTML = `
                    <div style="text-align:center;">
                        <p style="margin-bottom:15px;color:#4ca1af;font-weight:bold;">图表预览</p>
                        <div
                            style="padding:20px;border:2px dashed #4ca1af;border-radius:8px;display:inline-block;background:#f9f9f9;">
                            <p><i class="fas fa-project-diagram" style="font-size:2.5rem;color:#4ca1af;"></i></p>
                            <div id="error" class="error"></div>
                        </div>
                    </div>`;
        errorDiv.style.display = 'none';
        window.lastGeneratedFile = null;
        updateStatus('编辑器已清空');
    });

    // 导出按钮点击事件
    exportBtn.addEventListener('click', function () {
        const format = formatSelect.value;

        if (!window.lastGeneratedFile || window.lastGeneratedFile.format !== format) {
            // 如果还没有生成过图表或者格式不同，先生成再下载
            renderDiagram(true).then(() => {
                if (window.lastGeneratedFile) {
                    triggerDownload(window.lastGeneratedFile.file_id, format);
                }
            });
        } else {
            // 直接下载
            triggerDownload(window.lastGeneratedFile.file_id, format);
        }
    });

    // 格式化按钮点击事件 - 修改后的实现
    formatBtn.addEventListener('click', function () {
        updateStatus('正在格式化代码...');

        // 1. 获取当前代码
        let code = editor.value;

        // 2. 处理 if/else 等关键字的缩进
        code = formatPlantUMLCode(code);

        // 3. 移除多余的空行
        code = code.replace(/\n{3,}/g, '\n\n');

        // 4. 设置编辑器内容
        editor.value = code;
        updateStatus('代码已格式化');
    });

    // 示例按钮点击事件
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const exampleType = this.getAttribute('data-example');
            loadExample(exampleType);
        });
    });

    // 格式选择变化事件
    formatSelect.addEventListener('change', function () {
        renderDiagram();
    });

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }

    // 更新状态函数
    function updateStatus(message, showSpinner = false) {
        statusText.textContent = message;
        spinner.style.display = showSpinner ? 'block' : 'none';
    }

    // 触发下载的函数
    function triggerDownload(file_id, format) {
        const downloadUrl = `/download/${file_id}.${format}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `plantuml-diagram.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        updateStatus(`正在下载 ${format.toUpperCase()} 文件`);
    }

    // PlantUML 代码格式化函数
    function formatPlantUMLCode(code) {
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        const indentSize = 2;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line.length === 0) {
                formattedLines.push('');
                continue;
            }

            // 处理结束标签 - 在添加行之前减少缩进
            if (line.startsWith('endif') || line.startsWith('end') ||
                line.startsWith('}') || line.startsWith(']') ||
                line.startsWith('else') || line.startsWith('elseif') ||
                line.startsWith('fork again') || line.startsWith('end fork') ||
                line.startsWith('end while') || line.startsWith('end loop') ||
                line.startsWith('repeat while')
            ) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // 添加当前行的缩进
            const indent = ' '.repeat(indentLevel * indentSize);
            formattedLines.push(indent + line);

            // 处理开始标签 - 在添加行之后增加缩进
            if ((line.startsWith('if') || line.startsWith('fork') ||
                line.startsWith('loop') || line.startsWith('while') ||
                line.startsWith('split') || line.startsWith('partition') ||
                (!line.startsWith('repeat while') && line.startsWith('repeat')) ||
                line.endsWith('{') || line.endsWith('[')
            )) {
                indentLevel++;
            }

            // 处理 else/elseif - 在添加行之后增加缩进
            if (line.startsWith('else') || line.startsWith('elseif')) {
                indentLevel++;
            }
        }

        return formattedLines.join('\n');
    }

    // 渲染图表函数
    async function renderDiagram(isExport = false) {
        if (isProcessing) return;

        const umlCode = editor.value.trim();
        const format = formatSelect.value;
        updateStatus('正在生成图表...', true);
        errorDiv.style.display = 'none';

        if (!umlCode) {
            preview.innerHTML = '<p>请输入 PlantUML 代码</p>';
            updateStatus('就绪');
            return;
        }

        isProcessing = true;

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: umlCode,
                    format: format
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || '生成图表时出错');
            }

            // 保存文件信息用于下载
            window.lastGeneratedFile = data;

            // 显示预览
            if (format === 'svg') {
                const previewResponse = await fetch(`/preview/${data.file_id}.${data.format}`);
                if (!previewResponse.ok) {
                    throw new Error('预览加载失败');
                }
                const svgContent = await previewResponse.text();
                preview.innerHTML = svgContent;
            } else {
                const img = document.createElement('img');
                img.src = `/preview/${data.file_id}.${data.format}`;
                img.alt = 'PlantUML Diagram';
                img.onerror = function () {
                    throw new Error('图片加载失败');
                };
                preview.innerHTML = '';
                preview.appendChild(img);
            }

            updateStatus('图表已生成');

        } catch (error) {
            console.error('Error:', error);
            errorDiv.textContent = `错误: ${error.message}`;
            errorDiv.style.display = 'block';
            updateStatus('生成图表时出错');

            // 显示错误状态
            preview.innerHTML = `
                <div style="text-align:center; color:#e74c3c; padding:20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:3rem;"></i>
                    <p>图表生成失败</p>
                    <p style="font-size:0.9rem;">${error.message}</p>
                </div>
            `;
        } finally {
            isProcessing = false;
        }
    }

    // 检测图表类型
    function detectDiagramType(code) {
        if (code.includes('sequence') || code.includes('actor') || code.includes('participant')) {
            return '序列图';
        } else if (code.includes('usecase')) {
            return '用例图';
        } else if (code.includes('class')) {
            return '类图';
        } else if (code.includes('activity')) {
            return '活动图';
        } else if (code.includes('component')) {
            return '组件图';
        }
        return '未知类型';
    }

    // 加载示例代码
    function loadExample(type) {
        let exampleCode = '';

        switch (type) {
            case 'sequence':
                exampleCode = `@startuml
skinparam backgroundColor #f9f9f9
skinparam sequenceArrowColor #4ca1af

actor 用户 as User
participant "客户端" as Client
participant "服务器" as Server
participant "数据库" as Database

User -> Client: 输入请求
Client -> Server: 发送API请求
Server -> Database: 查询数据
Database --> Server: 返回数据
Server --> Client: 返回响应
Client --> User: 显示结果
@enduml`;
                break;

            case 'usecase':
                exampleCode = `@startuml
skinparam backgroundColor #f9f9f9
skinparam usecaseBorderColor #2c3e50
skinparam usecaseBackgroundColor #4ca1af
skinparam usecaseFontColor white

left to right direction
actor 客户 as Customer
actor 管理员 as Admin

usecase (浏览商品) as UC1
usecase (购买商品) as UC2
usecase (管理库存) as UC3
usecase (查看报表) as UC4

Customer --> UC1
Customer --> UC2
Admin --> UC3
Admin --> UC4
@enduml`;
                break;

            case 'class':
                exampleCode = `@startuml
skinparam backgroundColor #f9f9f9
skinparam classBorderColor #2c3e50
skinparam classBackgroundColor #e9ecef

class ArrayList {
  - Object[] elementData
  - int size
  + ArrayList()
  + add(Object e)
  + get(int index)
  + remove(int index)
  + size()
}

class LinkedList {
  - Node first
  - Node last
  - int size
  + LinkedList()
  + add(Object e)
  + get(int index)
  + remove(int index)
  + size()
}

interface List {
  + add(Object e)
  + get(int index)
  + remove(int index)
  + size()
}

List <|.. ArrayList
List <|.. LinkedList
@enduml`;
                break;

            case 'activity':
                exampleCode = `@startuml
skinparam backgroundColor #f9f9f9
skinparam activityBorderColor #2c3e50
skinparam activityBackgroundColor #4ca1af

start
:登录系统;
if (用户名和密码正确?) then (是)
  :进入主页;
  :浏览内容;
  if (想要购买?) then (是)
    :下订单;
    :支付;
    :确认订单;
  else (否)
    :继续浏览;
  endif
else (否)
  :显示错误信息;
  stop
endif
:登出系统;
stop
@enduml`;
                break;

            case 'component':
                exampleCode = `@startuml
skinparam backgroundColor #f9f9f9
skinparam componentBorderColor #2c3e50
skinparam componentBackgroundColor #e9ecef

package "前端" {
  [Web浏览器] as Browser
  [移动应用] as App
}

package "后端" {
  [API服务器] as API
  [数据库] as DB
}

Browser --> API : HTTP请求
App --> API : HTTP请求
API --> DB : 查询数据
@enduml`;
                break;
        }

        editor.value = exampleCode;
        renderDiagram();
        updateStatus(`已加载${detectDiagramType(exampleCode)}示例`);
    }
});