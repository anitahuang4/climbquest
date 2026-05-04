import random

DIFFICULTY_RANGES = {
    "easy":   ((1, 6),  (1, 6)),
    "medium": ((1, 12), (7, 9)),
    "hard":   ((1, 15), (10, 15)),
}


def generate(difficulty: str) -> tuple[str, int]:
    a_range, b_range = DIFFICULTY_RANGES.get(difficulty, DIFFICULTY_RANGES["easy"])
    a = random.randint(*a_range)
    b = random.randint(*b_range)
    return f"{a} × {b}", a * b


def is_correct(player_answer, correct_answer) -> bool:
    try:
        return int(player_answer) == int(correct_answer)
    except (TypeError, ValueError):
        return False
