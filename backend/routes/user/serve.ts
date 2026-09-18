
import { Router } from "express";

const router = Router();

let prefs: any = {};

router.get("/", (req, res) => {
  res.json(prefs);
});

router.post("/", (req, res) => {
  prefs = req.body;

  res.status(200).json({
    success: true,
  });
});

export default router;