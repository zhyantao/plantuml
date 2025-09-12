python -m pip install --upgrade pip
pip install -r requirements.txt
gunicorn app:app --bind 127.0.0.1:5000 --workers 2
