from flask import Flask, render_template, request, jsonify
import os
import subprocess
import base64
import uuid

app = Flask(__name__)

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
    uml_code = request.json.get('code', '')
    output_format = request.json.get('format', 'svg')
    
    print(f"生成图表，格式: {output_format}")
    print(f"临时目录: {TEMP_DIR}")
    print(f"JAR目录: {JAR_DIR}")
    
    if not uml_code:
        return jsonify({'error': 'No PlantUML code provided'}), 400
    
    # 生成唯一文件名，避免冲突
    file_id = str(uuid.uuid4())
    uml_file = os.path.join(TEMP_DIR, f"{file_id}.uml")
    output_file = os.path.join(TEMP_DIR, f"{file_id}.{output_format}")
    
    try:
        # 写入UML代码到临时文件
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
        
        # 添加额外的JAR文件到类路径
        env = os.environ.copy()
        jar_files = [f for f in os.listdir(JAR_DIR) if f.endswith('.jar') and f != 'plantuml-1.2024.6.jar']
        if jar_files:
            classpath = os.pathsep.join([os.path.join(JAR_DIR, jar) for jar in jar_files])
            env['CLASSPATH'] = classpath
        
        # 执行PlantUML
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd=TEMP_DIR)
        print(f"命令执行结果: {result.returncode}")
        print(f"标准输出: {result.stdout}")
        if result.stderr:
            print(f"错误输出: {result.stderr}")

        if result.returncode != 0:
            return jsonify({'error': result.stderr}), 500
        
        # 检查输出文件是否存在
        if not os.path.exists(output_file):
            return jsonify({'error': '生成图表失败，输出文件不存在'}), 500
        
        # 读取生成的图像文件
        if output_format == 'svg':
            with open(output_file, 'r', encoding='utf-8') as f:
                svg_content = f.read()
            return jsonify({'svg': svg_content})
        else:
            # 对于二进制格式，返回base64编码
            with open(output_file, 'rb') as f:
                image_data = f.read()
            return jsonify({
                'image': base64.b64encode(image_data).decode('utf-8'),
                'format': output_format
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # 清理临时文件
        try:
            if os.path.exists(uml_file):
                os.unlink(uml_file)
            if os.path.exists(output_file):
                os.unlink(output_file)
        except Exception as e:
            print(f"清理文件时出错: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
