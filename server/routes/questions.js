import express from "express";
const router = express.Router();

router.get("/question", (req, res) => {
  const difficulty = req.query.difficulty || "easy";
  let a, b;

  if (difficulty === "easy") {
    a = Math.floor(Math.random() * 6) + 1;
    b = Math.floor(Math.random() * 6) + 1;
  } else if (difficulty === "medium") {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 3) + 7;
  } else {
    a = Math.floor(Math.random() * 15) + 1;
    b = Math.floor(Math.random() * 6) + 10;
  }

  res.json({ question: `${a} × ${b}`, answer: a * b });
});

router.post("/validate", (req, res) => {
  const { playerAnswer, correctAnswer } = req.body;
  res.json({ success: Number(playerAnswer) === Number(correctAnswer) });
});

export default router;