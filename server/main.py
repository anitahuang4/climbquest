import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import questions
from auth import AuthError, verify_supabase_jwt
from rooms import GAME_DURATION_SECONDS, Player, Room, RoomManager, issue_question

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = RoomManager()


class ValidatePayload(BaseModel):
    playerAnswer: int | str | None = None
    correctAnswer: int | str | None = None


@app.get("/question")
def get_question(difficulty: str = "easy"):
    text, answer = questions.generate(difficulty)
    return {"question": text, "answer": answer}


@app.post("/validate")
def validate(payload: ValidatePayload):
    return {"success": questions.is_correct(payload.playerAnswer, payload.correctAnswer)}


async def send(ws: WebSocket, message: dict) -> None:
    try:
        await ws.send_text(json.dumps(message))
    except Exception:
        pass


async def broadcast(room: Room, message: dict, *, exclude: str | None = None) -> None:
    payload = json.dumps(message)
    for pid, player in list(room.players.items()):
        if pid == exclude:
            continue
        try:
            await player.ws.send_text(payload)
        except Exception:
            pass


async def end_game(room: Room) -> None:
    room.state = "finished"
    final = sorted(
        [
            {"player_id": pid, "username": p.username, "score": p.score}
            for pid, p in room.players.items()
        ],
        key=lambda r: r["score"],
        reverse=True,
    )
    await broadcast(room, {"type": "game_over", "final_scores": final})


async def game_timer(room: Room) -> None:
    try:
        await asyncio.sleep(GAME_DURATION_SECONDS)
        await end_game(room)
    except asyncio.CancelledError:
        pass


def score_payload(room: Room) -> dict:
    return {
        "type": "score_update",
        "scores": sorted(
            [
                {"player_id": pid, "username": p.username, "score": p.score}
                for pid, p in room.players.items()
            ],
            key=lambda r: r["score"],
            reverse=True,
        ),
    }


@app.websocket("/ws/lobby")
async def lobby_ws(ws: WebSocket, token: str = Query(...)):
    await ws.accept()

    try:
        user = verify_supabase_jwt(token)
    except AuthError as e:
        await send(ws, {"type": "error", "message": f"unauthorized: {e}"})
        await ws.close(code=4401)
        return

    player_id = user["id"]
    player = Player(id=player_id, username=user["username"], ws=ws)
    room: Room | None = None

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await send(ws, {"type": "error", "message": "invalid json"})
                continue

            mtype = msg.get("type")

            if mtype == "create_room" and room is None:
                difficulty = msg.get("difficulty", "easy")
                if difficulty not in ("easy", "medium", "hard"):
                    difficulty = "easy"
                room = await manager.create_room(player, difficulty)
                await send(ws, {
                    "type": "room_created",
                    "code": room.code,
                    "is_host": True,
                    "difficulty": room.difficulty,
                    "players": room.player_summaries(),
                })

            elif mtype == "join_room" and room is None:
                code = (msg.get("code") or "").strip().upper()
                joined = await manager.join_room(code, player)
                if not joined:
                    await send(ws, {"type": "error", "message": "room not found or already started"})
                    continue
                room = joined
                await send(ws, {
                    "type": "room_joined",
                    "code": room.code,
                    "is_host": room.host_id == player_id,
                    "difficulty": room.difficulty,
                    "players": room.player_summaries(),
                })
                await broadcast(
                    room,
                    {
                        "type": "player_joined",
                        "player": {"id": player_id, "username": player.username, "score": 0},
                    },
                    exclude=player_id,
                )

            elif mtype == "set_difficulty" and room and room.state == "lobby":
                if room.host_id != player_id:
                    await send(ws, {"type": "error", "message": "only the host can change difficulty"})
                    continue
                difficulty = msg.get("difficulty", "easy")
                if difficulty not in ("easy", "medium", "hard"):
                    continue
                room.difficulty = difficulty
                await broadcast(room, {"type": "difficulty_changed", "difficulty": difficulty})

            elif mtype == "start_game" and room and room.state == "lobby":
                if room.host_id != player_id:
                    await send(ws, {"type": "error", "message": "only the host can start the game"})
                    continue
                room.state = "playing"
                for p in room.players.values():
                    p.score = 0
                await broadcast(room, {"type": "game_started", "duration": GAME_DURATION_SECONDS})
                for pid, p in room.players.items():
                    await send(p.ws, issue_question(room, pid))
                room.game_task = asyncio.create_task(game_timer(room))

            elif mtype == "submit_answer" and room and room.state == "playing":
                qid = msg.get("question_id")
                pending = room.active_questions.get(player_id)
                if not pending or pending[0] != qid:
                    continue
                _, correct = pending
                player_answer = msg.get("answer")
                ok = questions.is_correct(player_answer, correct)
                if ok:
                    player.score += 1
                await send(ws, {
                    "type": "answer_result",
                    "question_id": qid,
                    "correct": ok,
                    "score": player.score,
                    "correct_answer": correct,
                })
                await broadcast(room, score_payload(room))
                # Always issue a fresh question (correct or wrong → keep playing).
                await send(ws, issue_question(room, player_id))

            elif mtype == "leave_room":
                break

            else:
                await send(ws, {"type": "error", "message": f"unexpected message: {mtype}"})

    except WebSocketDisconnect:
        pass
    finally:
        if room is not None:
            updated, host_changed, new_host = await manager.remove_player(room.code, player_id)
            if updated is not None:
                await broadcast(updated, {"type": "player_left", "player_id": player_id})
                if host_changed and new_host:
                    await broadcast(updated, {"type": "host_changed", "host_id": new_host})


# Serve the static frontend from the project root. Must be mounted last so
# specific API + WS routes are matched first.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
app.mount("/", StaticFiles(directory=str(PROJECT_ROOT), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
