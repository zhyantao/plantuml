python -m pip install --upgrade pip
pip install -r requirements.txt
uwsgi --http :8000 --wsgi-file app.py --callable app
