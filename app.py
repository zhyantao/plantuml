from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import os
import subprocess
import uuid
from pathlib import Path

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
CURRENT_DIR = os.path.abspath(os.path.dirname(__file__))
JAR_DIR = os.path.join(CURRENT_DIR, 'jars')
PLANTUML_JAR = os.path.join(JAR_DIR, 'plantuml-1.2024.6.jar')
TEMP_DIR = os.path.join(CURRENT_DIR, 'temp')
os.makedirs(TEMP_DIR, exist_ok=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/generate', methods=['POST'])
def generate_diagram():
    data = request.get_json()
    uml_code = data.get('code', '') if data else ''
    output_format = data.get('format', 'svg') if data else 'svg'

    if not uml_code:
        return jsonify({'error': 'No PlantUML code provided', 'success': False}), 400

    # 生成唯一文件名，避免冲突
    file_id = str(uuid.uuid4())
    uml_file = os.path.join(TEMP_DIR, f"{file_id}.uml")
    output_file = os.path.join(TEMP_DIR, f"{file_id}.{output_format}")

    print(f"生成 UML 文件: {uml_file}")
    print(f"输出文件: {output_file}")

    try:
        # 写入 UML 代码到临时文件
        with open(uml_file, 'w', encoding='utf-8') as f:
            f.write(uml_code)

        # 设置Java命令
        cmd = [
            'java',
            '-jar',
            PLANTUML_JAR,
            f'-t{output_format}',
            '-charset', 'UTF-8',
            uml_file
        ]

        # 添加额外的 JAR 文件到类路径
        env = os.environ.copy()
        jar_files = [f for f in os.listdir(JAR_DIR) if f.endswith(
            '.jar') and f != 'plantuml-1.2024.6.jar']
        if jar_files:
            classpath = os.pathsep.join(
                [os.path.join(JAR_DIR, jar) for jar in jar_files])
            env['CLASSPATH'] = classpath

        # 执行 PlantUML
        result = subprocess.run(cmd, capture_output=True,
                                text=True, env=env, cwd=TEMP_DIR)
        print(f"命令执行结果: {result.returncode}")

        if result.stderr:
            print(f"错误输出: {result.stderr}")

        if result.returncode != 0:
            # 清理临时文件
            if os.path.exists(uml_file):
                os.unlink(uml_file)
            return jsonify({'error': result.stderr, 'success': False}), 500

        # 检查输出文件是否存在
        if not os.path.exists(output_file):
            # 清理临时文件
            if os.path.exists(uml_file):
                os.unlink(uml_file)
            return jsonify({'error': '生成图表失败，输出文件不存在', 'success': False}), 500

        # 返回文件ID和信息
        return jsonify({
            'file_id': file_id,
            'format': output_format,
            'success': True
        })

    except Exception as e:
        # 清理临时文件
        try:
            if os.path.exists(uml_file):
                os.unlink(uml_file)
            if os.path.exists(output_file):
                os.unlink(output_file)
        except:
            pass
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/preview/<file_id>.<format>')
def preview_diagram(file_id, format):
    file_path = os.path.join(TEMP_DIR, f"{file_id}.{format}")

    if not os.path.exists(file_path):
        return jsonify({'error': '文件不存在或已过期'}), 404

    try:
        if format == 'svg':
            with open(file_path, 'r', encoding='utf-8') as f:
                svg_content = f.read()
            return svg_content, 200, {'Content-Type': 'image/svg+xml'}
        else:
            return send_file(file_path)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download/<file_id>.<format>')
def download_diagram(file_id, format):
    file_path = os.path.join(TEMP_DIR, f"{file_id}.{format}")
    uml_file = os.path.join(TEMP_DIR, f"{file_id}.uml")

    if not os.path.exists(file_path):
        return jsonify({'error': '文件不存在或已过期'}), 404

    try:
        download_name = f"plantuml_diagram.{format}"
        if format == 'svg':
            return send_file(
                file_path,
                as_attachment=True,
                download_name=download_name,
                mimetype='image/svg+xml'
            )
        else:
            return send_file(
                file_path,
                as_attachment=True,
                download_name=download_name
            )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # 下载后清理文件
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
            if os.path.exists(uml_file):
                os.unlink(uml_file)
        except Exception as e:
            print(f"清理文件时出错: {e}")


@app.route('/health')
def health_check():
    try:
        # 检查Java是否可用
        result = subprocess.run(['java', '-version'],
                                capture_output=True, text=True)
        java_available = result.returncode == 0

        # 检查PlantUML JAR文件是否存在
        plantuml_jar_exists = os.path.exists(PLANTUML_JAR)

        return jsonify({
            'status': 'healthy',
            'java_available': java_available,
            'java_version': result.stderr.split('\n')[0] if java_available else None,
            'plantuml_jar_exists': plantuml_jar_exists
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
