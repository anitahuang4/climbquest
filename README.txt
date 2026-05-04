to run first setup the backend

1. navigate to the /server directory
make a file: .env
in there put these two lines 
SUPABASE_URL=<the-url>
SUPABASE_JWT_SECRET=<the secret>

2. make a .venv
python -m venv .venv

activate the venv with
source .venv/bin/activate

then download the dependencies

pip3 install -r requirements.txt

then start the backend
uvicorn main:app --host 0.0.0.0 --port 3000 --reload

navigate to localhost:3000


