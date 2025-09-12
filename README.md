# Deploy Flask App with Java to GitHub Pages

## Usage

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
export PORT=5000
gunicorn app:app --bind 0.0.0.0:$PORT --workers 2
```
