import { Router } from "express";
import { z } from "zod";
import { createTeam, deleteTeam, getTeam, listTeams, renameTeam } from "../services/teams";
import { parseId, requiredText } from "../util/validation";

export const teamsRouter = Router();

const teamBody = z.object({ name: requiredText("Team name", 200) });
const teamId = (raw: string) => parseId(raw, "Team not found.");

teamsRouter.get("/", async (_req, res) => {
  res.json(await listTeams());
});

teamsRouter.post("/", async (req, res) => {
  const { name } = teamBody.parse(req.body);
  res.status(201).json(await createTeam(name));
});

teamsRouter.get("/:id", async (req, res) => {
  res.json(await getTeam(teamId(req.params.id)));
});

teamsRouter.patch("/:id", async (req, res) => {
  const id = teamId(req.params.id);
  const { name } = teamBody.parse(req.body);
  res.json(await renameTeam(id, name));
});

teamsRouter.delete("/:id", async (req, res) => {
  await deleteTeam(teamId(req.params.id));
  res.status(204).end();
});
