import { Router } from "express";
import { z } from "zod";
import { createEpic, deleteEpic, getEpic, listEpics, updateEpic } from "../services/epics";
import { optionalText, parseId, reference, requiredText } from "../util/validation";

export const epicsRouter = Router();

const title = requiredText("Title", 500);
const description = optionalText("Description", 20_000);
const epicId = (raw: string) => parseId(raw, "Epic not found.");

epicsRouter.get("/", async (req, res) => {
  const { teamId } = z.object({ teamId: z.string().uuid().optional() }).parse(req.query);
  res.json(await listEpics(teamId));
});

epicsRouter.post("/", async (req, res) => {
  const body = z.object({ teamId: reference("Team"), title, description }).parse(req.body);
  res.status(201).json(await createEpic(body));
});

epicsRouter.get("/:id", async (req, res) => {
  res.json(await getEpic(epicId(req.params.id)));
});

epicsRouter.patch("/:id", async (req, res) => {
  const id = epicId(req.params.id);
  const body = z
    .object({
      teamId: z.string().optional(),
      title: title.optional(),
      // Absent = unchanged (ZodOptional short-circuits undefined); null or "" = clear.
      description: description.optional(),
    })
    .parse(req.body);
  res.json(await updateEpic(id, body));
});

epicsRouter.delete("/:id", async (req, res) => {
  await deleteEpic(epicId(req.params.id));
  res.status(204).end();
});
