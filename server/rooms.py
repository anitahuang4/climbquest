import asyncio
import random
import string
import uuid
from dataclasses import dataclass, field

from fastapi import WebSocket

import questions

ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
GAME_DURATION_SECONDS = 60


@dataclass
class Player:
    id: str
    username: str
    ws: WebSocket
    score: int = 0


@dataclass
class Room:
    code: str
    host_id: str
    difficulty: str = "easy"
    state: str = "lobby"  # lobby | playing | finished
    players: dict[str, Player] = field(default_factory=dict)
    join_order: list[str] = field(default_factory=list)
    active_questions: dict[str, tuple[str, int]] = field(default_factory=dict)
    game_task: asyncio.Task | None = None

    def player_summaries(self) -> list[dict]:
        return [
            {
                "id": pid,
                "username": self.players[pid].username,
                "score": self.players[pid].score,
                "is_host": pid == self.host_id,
            }
            for pid in self.join_order
            if pid in self.players
        ]


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.lock = asyncio.Lock()

    def _new_code(self) -> str:
        while True:
            code = "".join(random.choices(ROOM_CODE_ALPHABET, k=6))
            if code not in self.rooms:
                return code

    async def create_room(self, host: Player, difficulty: str) -> Room:
        async with self.lock:
            code = self._new_code()
            room = Room(code=code, host_id=host.id, difficulty=difficulty)
            room.players[host.id] = host
            room.join_order.append(host.id)
            self.rooms[code] = room
            return room

    async def join_room(self, code: str, player: Player) -> Room | None:
        async with self.lock:
            room = self.rooms.get(code)
            if not room:
                return None
            if room.state != "lobby":
                return None
            if player.id in room.players:
                # Same user reconnecting — replace their socket.
                room.players[player.id].ws = player.ws
                return room
            room.players[player.id] = player
            room.join_order.append(player.id)
            return room

    async def remove_player(self, code: str, player_id: str) -> tuple[Room | None, bool, str | None]:
        """Returns (room_or_none_if_deleted, host_changed, new_host_id)."""
        async with self.lock:
            room = self.rooms.get(code)
            if not room:
                return None, False, None
            room.players.pop(player_id, None)
            if player_id in room.join_order:
                room.join_order.remove(player_id)
            if not room.players:
                if room.game_task:
                    room.game_task.cancel()
                del self.rooms[code]
                return None, False, None
            host_changed = False
            new_host = None
            if room.host_id == player_id:
                room.host_id = room.join_order[0]
                host_changed = True
                new_host = room.host_id
            return room, host_changed, new_host

    def get(self, code: str) -> Room | None:
        return self.rooms.get(code)


def make_question_id() -> str:
    return uuid.uuid4().hex[:8]


def issue_question(room: Room, player_id: str) -> dict:
    text, answer = questions.generate(room.difficulty)
    qid = make_question_id()
    room.active_questions[player_id] = (qid, answer)
    return {"type": "question", "question_id": qid, "question": text}
