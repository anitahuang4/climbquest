import express from "express";
import cors from "cors";
import questionRoutes from "./routes/questions.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/", questionRoutes);

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));
