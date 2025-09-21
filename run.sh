python -m pip install --upgrade pip
pip install -r requirements.txt
waitress-serve --listen=127.0.0.1:8000 app:app
