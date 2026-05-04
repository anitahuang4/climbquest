# ClimbQuest backend

FastAPI app: serves static frontend, HTTP question/validate endpoints, and the multiplayer WebSocket lobby.

## Setup

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Open .env and paste SUPABASE_JWT_SECRET (Supabase Dashboard → Project Settings → API → JWT Secret)
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 3000 --reload
```

Then open http://localhost:3000/index.html.

## Demo via ngrok

```bash
# one-time
brew install ngrok
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>

# each demo
ngrok http 3000
```

Share the `https://<subdomain>.ngrok.app` URL with the class. Open it once yourself first to clear the ngrok interstitial warning.
