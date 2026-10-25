import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    # Debug doar dacă FLASK_DEBUG=1. Nu publica niciodată run.py (ex. prin ngrok) cu debug pornit.
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1', port=5000)
