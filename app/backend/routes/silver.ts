import express from "express";
import { z } from "zod";
import { createSilverAsset } from "../services/silver.service";

const router = express.Router();

// ---------- Schema ----------
const createSilverSchema = z.object({
  vaultId: z.string().uuid(),
  weightGrams: z.number().positive(),
  purity: z.number().positive(),
});

// ---------- Routes ----------
router.post("/", async (req, res) => {
  try {
    const { vaultId, weightGrams, purity } =
      createSilverSchema.parse(req.body);

    const asset = await createSilverAsset(
      vaultId,
      weightGrams,
      purity,
      undefined
    );

    res.json(asset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid input",
        details: error.issues, // ✅ correct
      });
    }

    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
