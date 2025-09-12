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

    // 初始渲染
    renderDiagram();

    // 监听编辑器变化
    editor.addEventListener('input', debounce(renderDiagram, 1000));

    // 渲染按钮点击事件
    renderBtn.addEventListener('click', renderDiagram);

    // 清空按钮点击事件
    clearBtn.addEventListener('click', function () {
        editor.value = '';
        preview.innerHTML = '<p>图表将在此处显示...</p>';
        errorDiv.style.display = 'none';
        updateStatus('编辑器已清空');
    });

    // 导出按钮点击事件
    exportBtn.addEventListener('click', function () {
        const format = formatSelect.value;
        updateStatus(`正在导出${format.toUpperCase()}...`, true);

        // 在实际实现中，这里会调用导出功能
        renderDiagram(true).then(() => {
            updateStatus(`导出完成 (${format.toUpperCase()})`);
            alert(`在完整实现中，这里将导出${format.toUpperCase()}图像。`);
        });
    });

    // 格式化按钮点击事件
    formatBtn.addEventListener('click', function () {
        updateStatus('正在格式化代码...');

        // 简单的格式化：确保@startuml和@enduml单独成行
        const code = editor.value;
        editor.value = code.replace(/\s*@startuml\s*/g, '\n@startuml\n')
            .replace(/\s*@enduml\s*/g, '\n@enduml\n')
            .replace(/\n{3,}/g, '\n\n');
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

            if (!response.ok) {
                throw new Error(data.error || '生成图表时出错');
            }

            if (format === 'svg' && data.svg) {
                preview.innerHTML = data.svg;
            } else if (data.image) {
                // 对于PNG/JPG等二进制格式
                const img = document.createElement('img');
                img.src = `data:image/${format};base64,${data.image}`;
                img.alt = 'PlantUML Diagram';
                preview.innerHTML = '';
                preview.appendChild(img);
            } else {
                throw new Error('无法显示图表');
            }

            updateStatus('图表已生成');

        } catch (error) {
            console.error('Error:', error);
            errorDiv.textContent = `错误: ${error.message}`;
            errorDiv.style.display = 'block';
            updateStatus('生成图表时出错');
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